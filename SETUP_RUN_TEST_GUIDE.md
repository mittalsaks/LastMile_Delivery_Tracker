# Last-Mile Delivery Tracker — Setup, Run & Testing Guide

This is your **one merged, runnable repo** (all 10 parts combined and
verified to load/build cleanly). Everything below assumes you're working
from `last-mile-delivery-tracker/` in VS Code.

---

## Part A — One-time setup in VS Code

### 1. Open the project
- Unzip `last-mile-delivery-tracker.zip` anywhere on your machine.
- VS Code → **File → Open Folder** → select `last-mile-delivery-tracker`.
- Install these VS Code extensions (optional but helpful): **ESLint**,
  **MongoDB for VS Code**, **Thunder Client** (a Postman-style REST client
  built into VS Code — you'll use this a lot below).

### 2. Install Node.js
You need Node 18+. Check in the VS Code terminal (`` Ctrl+` `` / `` Cmd+` ``):
```bash
node -v
npm -v
```
If missing, install from https://nodejs.org (LTS version).

### 3. Get MongoDB running
Pick ONE:
- **Local Mongo**: install MongoDB Community Server, then run it (`mongod`
  as a service, or `mongod --dbpath <folder>` manually). Default connection:
  `mongodb://127.0.0.1:27017/lastmile`
- **MongoDB Atlas (recommended, no local install)**: create a free cluster
  at mongodb.com/atlas → Database Access (create a user) → Network Access
  (allow your IP, or `0.0.0.0/0` for simplicity while developing) → Connect
  → copy the `mongodb+srv://...` connection string.

### 4. Backend environment file
```bash
cd backend
cp .env.example .env
```
Open `.env` in VS Code and fill in:
- `MONGO_URI` — your local or Atlas connection string
- `JWT_SECRET` — any long random string (e.g. mash your keyboard)
- `SMTP_*` — for email notifications (Part 7). Easiest: sign up free at
  mailtrap.io → Email Testing → Inboxes → copy the SMTP host/port/user/pass
  shown there. Leave `SMTP_PROVIDER=mailtrap`. Emails land safely in your
  Mailtrap inbox, not real addresses.
- Leave `CLIENT_ORIGIN` blank for local dev (it defaults to
  `http://localhost:5173`).

### 5. Frontend environment file
```bash
cd ../frontend
cp .env.example .env
```
Default `VITE_API_BASE_URL=/api` is correct for local dev — leave it as is
(Vite proxies `/api` calls to your backend automatically).

### 6. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## Part B — Running the app

Open **two terminals** in VS Code (Terminal → Split Terminal):

**Terminal 1 — backend:**
```bash
cd backend
npm run dev
```
You should see `Server running on port 5000` and a Mongo connection log.
Visit http://localhost:5000 in a browser — you should see
`{"message":"Last-Mile Delivery Tracker API is running"}`.

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```
Visit the URL it prints (http://localhost:5173).

If either fails to start, read the error in the terminal — it's almost
always a missing/incorrect `.env` value (bad `MONGO_URI` is the most common).

---

## Part C — Create your test users

The register page only offers `customer` and `agent` roles (admin
self-registration is intentionally disabled). So:

1. Go to http://localhost:5173/register → create:
   - `customer@test.com` / role: customer
   - `agent@test.com` / role: agent
2. Promote an admin manually. Either use **MongoDB for VS Code** extension
   (connect → browse to your DB → `users` collection → edit a document's
   `role` field), or register a third user `admin@test.com` as a customer
   and then run in `mongosh` / Atlas shell:
   ```js
   db.users.updateOne({ email: "admin@test.com" }, { $set: { role: "admin" } })
   ```
3. Log out and log back in as each to confirm role-based redirects work
   (customer → `/customer/...`, agent → `/agent`, admin → `/admin/...`).

---

## Part D — Full step-by-step functional test (every feature)

Do this **in order** — later steps depend on data created in earlier ones.
You can do this through the **React UI** (faster, visual) or via **Thunder
Client / curl** hitting the API directly (more precise for grading
evidence). Both are given.

### Step 1 — Admin: create Zones
**UI:** Login as admin → Zones page → create two zones, e.g.:
- Zone A: pincodes `400001, 400002`, areas `Fort, Colaba`
- Zone B: pincodes `400050, 400051`, areas `Bandra, Khar`

**API:**
```bash
curl -X POST http://localhost:5000/api/zones \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"name":"Zone A","pincodes":["400001","400002"],"areas":["Fort","Colaba"]}'
```
✅ Check: `GET /api/zones` lists both zones.

### Step 2 — Admin: create Rate Cards
Create at least one **inter-zone B2C** card (Zone A → Zone B) so a real
order can be priced, e.g. `baseRate: 30, ratePerKg: 10`.
```bash
curl -X POST http://localhost:5000/api/ratecards \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"orderType":"B2C","rateType":"inter","fromZone":"<ZONE_A_ID>","toZone":"<ZONE_B_ID>","baseRate":30,"ratePerKg":10}'
```
✅ Check: creating a duplicate combination returns `409`. Creating
`rateType: intra` with different `fromZone`/`toZone` returns `400`.

### Step 3 — Admin: create COD Config
```bash
curl -X POST http://localhost:5000/api/codconfig \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"orderType":"B2C","surchargeType":"flat","value":25}'
```
✅ Check: creating a second B2C config fails (only one per orderType allowed).

### Step 4 — Customer: preview & place an order
**UI:** Login as customer → Place Order → pickup pincode `400001`, drop
pincode `400050`, dimensions, weight `2.5kg`, type `B2C`, payment `COD` →
confirm the charge preview shown matches: base rate + (chargeable weight ×
rate/kg) + COD surcharge.

**API:**
```bash
# Preview only (nothing created)
curl -X POST http://localhost:5000/api/orders/calculate-charge \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" -H "Content-Type: application/json" \
  -d '{"pickupAddress":{"addressLine":"12 MG Road","area":"Fort","pincode":"400001"},
       "dropAddress":{"addressLine":"45 Linking Road","area":"Bandra","pincode":"400050"},
       "dimensions":{"length":30,"breadth":20,"height":15},
       "actualWeight":2.5,"orderType":"B2C","paymentType":"COD"}'

# Confirm — creates the order for real
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" -H "Content-Type: application/json" \
  -d '{ ...same body... }'
```
✅ Check: volumetric weight = (30×20×15)/5000 = 18kg, so chargeable weight
is `max(2.5, 18) = 18kg` (higher of actual vs volumetric — the whole point
of this engine). Charge = `30 + (18×10) + 25 = 235`.
✅ Check: `GET /api/orders/my` (as customer) shows this order.
✅ Check: an unserviceable pincode (not in any zone) returns `404`.

### Step 5 — Agent: go online
**UI:** Login as agent → toggle "Available" → select current zone = Zone A.
**API:**
```bash
curl -X PATCH http://localhost:5000/api/agents/me/availability \
  -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \
  -d '{"isAvailable": true, "currentZone": "<ZONE_A_ID>"}'
```

### Step 6 — Admin: assign the agent
**UI:** Admin → Orders table → click "Auto-assign" (or "Assign" to pick manually).
**API:**
```bash
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/auto-assign \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
✅ Check: `GET /api/agents/me/orders` (as agent) now shows this order.

### Step 7 — Agent: move the order through its lifecycle
**UI:** Agent dashboard → status buttons only show *legal* next steps.
**API — do these IN ORDER:**
```bash
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \
  -d '{"status": "Picked Up"}'

curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \
  -d '{"status": "In Transit"}'
```
✅ Check (important negative test): try jumping straight to `Delivered`
from `Created` on a fresh order — expect `400`, "cannot be skipped".
✅ Check: after each status change, look at your Mailtrap inbox — an email
should have arrived (Part 7 hooks into every status change).
✅ Check: `GET /api/orders/<ORDER_ID>/tracking` shows the full ordered
timeline (as customer, agent-if-assigned, or admin).

### Step 8 — Failed delivery + reschedule flow
```bash
# Agent marks it Failed
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \
  -d '{"status": "Failed"}'

# Customer requests a reschedule
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/reschedule \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" -H "Content-Type: application/json" \
  -d '{"newDate": "2026-09-01", "reason": "Not home"}'

# Admin reassigns an agent for the retry
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/reschedule/reassign \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"mode": "auto"}'

# New agent can now pick it up again
curl -X PATCH http://localhost:5000/api/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \
  -d '{"status": "Picked Up"}'
```
✅ Check: order status went `Failed → Rescheduled → Picked Up`.
✅ Check: `assignedAgent` was cleared on reschedule, then set again on reassign.
✅ Check: a "Rescheduled" email fired.

### Step 9 — Admin dashboard powers
**UI:** Admin → Orders → filter by status/zone/agent; use "Override Status"
to force a status change bypassing the normal state machine.
✅ Check: filters actually narrow the table. Override successfully changes
status even across normally-illegal transitions.

### Step 10 — Full regression pass
Repeat steps 4–8 once more end-to-end for a **B2B intra-zone Prepaid**
order (create the extra rate card first) to prove the engine handles all
four combinations: B2B/B2C × intra/inter.

---

## Part E — Common problems & fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend crashes on start, Mongo timeout | Wrong `MONGO_URI`, Atlas IP not whitelisted, or local `mongod` not running | Check `.env`, check Atlas Network Access, check `mongod` process |
| `401 Unauthorized` on every request | Missing/expired JWT, or forgot `Authorization: Bearer <token>` header | Re-login, copy the fresh token |
| Frontend loads but API calls fail / CORS error | Backend not running, or `VITE_API_BASE_URL` misconfigured | Confirm backend is up on port 5000; for local dev leave `VITE_API_BASE_URL=/api` |
| `404 pincode not serviceable` | No Zone covers that pincode yet | Add/expand a Zone via `PATCH /api/zones/:id/assign` |
| No email arriving | Wrong `SMTP_*` values, or `SMTP_PROVIDER` mismatch | Re-copy exact values from Mailtrap inbox settings |
| `400 Invalid status transition` | Trying to skip a step or move backwards | Follow the state machine order: Created → Picked Up → In Transit → Out for Delivery → Delivered/Failed |
| Agent can't update a status | Order isn't assigned to that agent | Assign it first (Step 6), or use admin override |

---

## Part F — Once everything above passes

You now have functional proof for every "Evaluation Focus" line in the
assignment PDF (rate engine, auto-assignment, status lifecycle + tracking,
schema/API design). Move on to **Part 10's** `.gitignore` + git-push
checklist (already in this repo root and in your earlier Part 10 zip) to
get it onto GitHub.
