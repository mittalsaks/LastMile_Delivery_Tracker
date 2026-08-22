# Fixes Applied — Auto-Assignment & Related Gaps

This file documents the changes made to the previously submitted codebase.
Kept separate from README/SYSTEM_DESIGN so the diff is easy to review.

## 1. Auto-assignment now triggers automatically on order creation

**File:** `backend/src/controllers/orderController.js`

Previously, an order was created with `assignedAgent: null` and an admin had
to manually click "Auto-assign" on every single order. `createOrder` now
calls `findBestAgent()` + `applyAssignment()` right after the order (and its
first `TrackingHistory` entry) are saved.

This is wrapped in a `try/catch` so it can **never** block order creation —
if no agent is available, the order is simply created as "Unassigned" and an
admin can still trigger manual/auto assignment later from the Orders screen
(that button still works, now as a fallback/re-trigger rather than the only
path). The API response now includes a `meta.autoAssigned` flag so the
frontend can show a toast like "Order created — Agent X auto-assigned" or
"Order created — no agent available yet".

## 2. Fixed a real bug in reschedule auto-reassignment

**Files:** `backend/src/utils/agentAssigner.js`, `backend/src/controllers/rescheduleController.js`, `backend/src/controllers/assignmentController.js`

`findBestAgent()` used to take a whole `order` object and read `order.pickupZone`
off it. `rescheduleController.js` was calling it with `{ zone, excludeAgentId }` —
a completely different shape — so `order.pickupZone` was always `undefined`
and every auto-reassignment after a failed delivery threw
`"Order has no pickupZone set — cannot auto-assign"`.

Fixed by changing `findBestAgent(zoneId, { excludeAgentId })` to take a zone
ID directly plus an options object:
- `assignmentController.js` (fresh order auto-assign) now calls
  `findBestAgent(order.pickupZone)`
- `rescheduleController.js` (redelivery attempt) now calls
  `findBestAgent(order.dropZone, { excludeAgentId })` — deliberately using
  **dropZone**, not pickupZone, since a redelivery attempt starts from where
  the parcel already is, not the original pickup point
- `excludeAgentId` is now actually implemented as a Mongo `$ne` filter, so
  the previous (failed-delivery) agent is properly excluded from being
  reassigned to the same order

## 3. Admin status override

**Files:** `backend/src/controllers/trackingController.js`, `backend/src/routes/orderRoutes.js`

New endpoint: `PATCH /api/orders/:id/override-status` (admin-only). Unlike
the normal `PATCH /:id/status` (which enforces the forward-only state
machine for agents), this lets an admin force-set any status to correct a
mistake or resolve an edge case. It still writes an immutable
`TrackingHistory` entry (tagged `[ADMIN OVERRIDE]`) and still fires the
customer notification, so the audit trail and communication stay consistent.

## 4. Admin order list — zone & agent filters

**File:** `backend/src/controllers/orderController.js`

`GET /api/orders` now also accepts `?zone=<zoneId>` (matches either the
pickup or drop leg) and `?agentId=<agentId>`, alongside the existing
`status`/`orderType`/`paymentType`/`customerId` filters, matching the spec's
"filter by status/zone/agent" requirement.

## 5. Security — real credentials removed from `.env.example`

**Files:** `backend/.env.example`, `backend/.env`

`.env.example` had real MongoDB Atlas, JWT, and Gmail OAuth credentials
committed as if they were placeholders. Replaced with actual placeholders.

`backend/.env` still has the original working values so local dev isn't
broken right now, but a warning banner was added at the top — **rotate all
of these credentials (new DB user/password, new JWT secret, regenerate the
Gmail OAuth client secret + refresh token) before deploying or sharing this
project again**, and put only the new values into Render/Vercel's
environment variable settings, not back into a file.

## 8. Admin: agent roster + remove/deactivate underperforming agents

**Files:**
`backend/src/controllers/agentController.js`, `backend/src/routes/agentRoutes.js`,
`frontend/src/pages/admin/AdminAgents.jsx`, `frontend/src/api/agentApi.js`,
`frontend/src/App.jsx`, `frontend/src/components/AdminLayout.jsx`

New **Agents** page in the admin sidebar (`/admin/agents`), separate from
the existing "Agent approvals" queue — this one shows the **full roster**
(every agent regardless of approval/active status), each row with: zone,
approval status, active/deactivated status, live active-order count, and
average rating (from the new feedback feature, #9 below).

`GET /api/agents/all` (admin-only) returns this enriched list.

**"Remove agent"** = `PATCH /api/agents/:id/deactivate`. This is a soft
delete, not a destructive one — the agent's account, order history, and
feedback all stay intact (needed for the immutable audit trail), it's just
locked out of login/assignment (`isActive: false`,
`agentDetails.isAvailable: false`). Deactivating never destroys anything,
so it can be undone any time with **"Reactivate"**
(`PATCH /api/agents/:id/reactivate`).

Deactivation also **auto-reassigns** any of that agent's in-flight orders
(anything not yet `Delivered`/`Failed`) to another available agent, reusing
the same `findBestAgent` + `applyAssignment` logic as auto-assign-on-create
(excluding the agent being removed). If no other agent is free right now,
that order is simply set back to unassigned rather than blocking the
deactivation — the admin UI reports exactly how many orders were
reassigned vs. left for manual handling.

## 9. Customer feedback / ratings

**Files:**
`backend/src/models/Feedback.js`, `backend/src/controllers/feedbackController.js`,
`backend/src/routes/orderRoutes.js`, `backend/src/routes/agentRoutes.js`,
`frontend/src/components/FeedbackForm.jsx`, `frontend/src/pages/customer/MyOrders.jsx`,
`frontend/src/api/orderApi.js`

New `Feedback` collection: one entry per order (`rating` 1–5, optional
`comment`), linked to both the customer and the agent who delivered it.

- `POST /api/orders/:id/feedback` (customer-only) — only works once the
  order's status is `Delivered`, and only for that order's own customer.
  Upserts, so a customer can revise their rating/comment later rather than
  getting an error on a second submit.
- `GET /api/orders/:id/feedback` — used by the frontend to show "already
  rated" state pre-filled instead of a blank form.
- `GET /api/agents/:id/feedback` (admin-only) — average rating, total count,
  and the 10 most recent comments for one agent; the average/count also
  appear directly in the new Agents roster table (#8) so admin can spot an
  under-performing agent (low rating + high load) at a glance, which is
  exactly the signal you'd use to decide whether to deactivate them.

On the customer side, `MyOrders.jsx` now shows a "Rate this delivery"
button on any `Delivered` order, opening a simple 5-star + comment form.

## Not changed in this pass (flagged earlier, still open)

- GPS/location-based ranking for auto-assignment — deliberately **not**
  added. The spec allows "current location **or** zone" for nearest-agent
  detection, and the zone-based + load-balanced ranking above already
  satisfies that. Adding browser GPS tracking is optional future scope, not
  required for the spec to be met.
- Real SMS delivery (still a stub/no-op) — spec lists SMS as optional
  ("any free tier service"; email already covers the notification
  requirement).

## 6. Google Sign-In (customer login/register)

**Files:**
`backend/src/controllers/authController.js`, `backend/src/routes/authRoutes.js`,
`backend/src/models/User.js`, `frontend/index.html`,
`frontend/src/components/GoogleSignInButton.jsx`,
`frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`,
`frontend/src/context/AuthContext.jsx`, `frontend/src/api/authApi.js`

Uses Google Identity Services (the official "Sign in with Google" button)
on the frontend, which returns a signed ID token. That token is POSTed to
the new `POST /api/auth/google` endpoint, which verifies it server-side
with `google-auth-library` using only `GOOGLE_CLIENT_ID` (no client secret
needed for this flow). On first sign-in it creates a **customer** account
(agents/admins are unaffected — they still go through the existing
document-verification / admin-only flows). If an email already has a
password-based account, Google sign-in links to it instead of duplicating.

`User.password` is now optional for Google-linked accounts (`required` only
when `googleId` is not set).

**Setup required from you (cannot be done by me):**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID → Application type: **Web application**
3. Under "Authorized JavaScript origins" add `http://localhost:5173`
   (and your deployed frontend URL once you deploy)
4. Copy the generated **Client ID** into:
   - `backend/.env` → `GOOGLE_CLIENT_ID=...`
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID=...` (same value — this one is
     safe to expose publicly, every Google Sign-In button on the web does this)
5. No client secret is needed anywhere for this flow.

If `GOOGLE_CLIENT_ID` isn't set, the button simply doesn't render — normal
email/password login/register keeps working either way.

## 7. Forgot / Reset Password

**Files:**
`backend/src/controllers/authController.js`, `backend/src/routes/authRoutes.js`,
`backend/src/models/User.js`, `backend/src/templates/resetPasswordEmailTemplate.js`,
`frontend/src/pages/ForgotPassword.jsx`, `frontend/src/pages/ResetPassword.jsx`,
`frontend/src/pages/Login.jsx`, `frontend/src/App.jsx`, `frontend/src/api/authApi.js`

Standard token-based flow, reusing the existing Gmail-API mailer (no new
service/credentials needed):

1. `POST /api/auth/forgot-password` — takes an email, and **always** returns
   the same generic success message whether or not the account exists (so
   the endpoint can't be used to check which emails are registered). If the
   account exists and has a local password (not Google-only), a random
   token is generated, hashed with SHA-256 and stored on the user
   (`resetPasswordToken`, `resetPasswordExpires` — 30 min expiry), and the
   **unhashed** token is emailed as a link: `/reset-password/<token>`.
2. `POST /api/auth/reset-password/:token` — hashes the incoming token and
   looks up a user with a matching, unexpired token; if found, sets the new
   password (the existing `pre('save')` bcrypt hook hashes it) and clears
   the reset fields.
3. Login page now has a "Forgot password?" link → `/forgot-password` →
   after submitting, `/reset-password/:token` (opened from the emailed link).

Google-only accounts (no local password) are intentionally excluded from
this flow — there's nothing to reset — but still get the same generic
response so account existence/auth-method isn't leaked.

