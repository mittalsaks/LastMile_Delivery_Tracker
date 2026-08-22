# Last-Mile Delivery Tracker

A logistics platform where customers and admins create delivery orders with
auto-calculated charges, agents are assigned intelligently (manual or
auto), and customers are notified by email at every step.

**Stack:** Node.js + Express + MongoDB (Mongoose) · React (Vite) · JWT
role-based auth (customer / agent / admin) · Nodemailer.

---

## 1. Local setup

### Prerequisites
- Node.js 18+
- A MongoDB connection string (local `mongod`, or a free MongoDB Atlas cluster)
- An SMTP account for email (Mailtrap sandbox is easiest for local dev — see `backend/.env.example`)

### Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, SMTP_* (see below)
npm run dev                # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_BASE_URL=/api is fine for local dev (Vite proxies to the backend)
npm run dev                 # starts on http://localhost:5173
```

Open `http://localhost:5173`, register a customer or agent account (admin
accounts are created directly in MongoDB — see `.env.example` comments),
and use the app.

### Running both together

Two terminals — one `npm run dev` in `backend/`, one in `frontend/`. The
Vite dev server proxies `/api/*` requests to the backend automatically
(see `frontend/vite.config.js`), so no CORS setup is needed for local dev.

For deploying to the internet, see **DEPLOYMENT.md**.

---

## 2. Environment variables

See `backend/.env.example` and `frontend/.env.example` in this repo for the
full, commented list. Summary:

**Backend**
| Variable | Purpose |
|---|---|
| `PORT` | Port the Express server listens on |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `SMTP_PROVIDER` | `mailtrap` or `gmail` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials |
| `SMTP_FROM` | From address on outgoing emails |
| `CLIENT_ORIGIN` | Deployed frontend URL, for CORS (see DEPLOYMENT.md) |

**Frontend**
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL the frontend calls — `/api` locally, full backend URL in production |

---

## 3. API reference

All routes are prefixed `/api`. Protected routes require
`Authorization: Bearer <token>`. Access column: **Public**, **Auth** (any
logged-in user), or a specific role.

### Auth — Part 1
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ name, email, password, role }` | `{ token, user }` |
| POST | `/auth/login` | Public | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | Auth | — | `{ user }` |

### Zones — Part 2
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| GET | `/zones` | Auth | — | `[Zone]` |
| POST | `/zones` | admin | `{ name, pincodes[], areas[] }` | `Zone` |
| PUT | `/zones/:id` | admin | `{ name, pincodes[], areas[] }` | `Zone` |
| DELETE | `/zones/:id` | admin | — | `{ success }` |

### Rate cards — Part 2
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| GET | `/ratecards` | Auth | — | `[RateCard]` |
| POST | `/ratecards` | admin | `{ orderType, rateType, fromZone, toZone, baseRate, ratePerKg }` | `RateCard` |
| PUT | `/ratecards/:id` | admin | same as above | `RateCard` |
| DELETE | `/ratecards/:id` | admin | — | `{ success }` |

### COD config — Part 2
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| GET | `/codconfig` | Auth | — | `[CODConfig]` |
| POST | `/codconfig` | admin | `{ orderType, surchargeType, value }` | `CODConfig` |
| PUT | `/codconfig/:id` | admin | same as above | `CODConfig` |
| DELETE | `/codconfig/:id` | admin | — | `{ success }` |

### Orders — Parts 3, 4, 5, 6
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| POST | `/orders/calculate-charge` | customer/admin | order details (see below) | `{ chargeableWeight, baseCharge, codSurcharge, totalCharge }` |
| POST | `/orders` | customer/admin | order details | `Order` (status `Created`) |
| GET | `/orders/mine` | customer | — | `[Order]` (own orders) |
| GET | `/orders` | admin | `?status=&zone=&agent=` | `[Order]` |
| GET | `/orders/:id/tracking` | owner/agent/admin | — | `{ order, history }` |
| PATCH | `/orders/:id/assign` | admin | `{ agentId }` | `Order` |
| PATCH | `/orders/:id/auto-assign` | admin | — | `Order` |
| PATCH | `/orders/:id/status` | agent (assigned)/admin | `{ status }` | `Order` |
| PATCH | `/orders/:id/reschedule` | customer (owner) | `{ newDate, reason? }` | `Order` |
| PATCH | `/orders/:id/reschedule/reassign` | admin | `{ mode: 'auto'\|'manual', agentId? }` | `Order` |

**Order creation body** (used by both `calculate-charge` and `POST /orders`):
```json
{
  "pickupAddress": { "line1": "...", "city": "...", "pincode": "..." },
  "dropAddress": { "line1": "...", "city": "...", "pincode": "..." },
  "dimensions": { "length": 30, "breadth": 20, "height": 15 },
  "actualWeight": 2.5,
  "orderType": "B2C",
  "paymentType": "COD"
}
```

### Agents — Part 4
| Method | Route | Access | Body | Response |
|---|---|---|---|---|
| GET | `/agents` | admin | — | `[User]` (role: agent) |
| GET | `/agents/me/orders` | agent | — | `[Order]` assigned to self |
| PATCH | `/agents/me/availability` | agent | `{ isAvailable }` | `{ success }` |

---

## 4. Database schema summary

| Model | Key fields |
|---|---|
| **User** | `name, email, passwordHash, role (customer/agent/admin)`, `agentDetails { isAvailable, currentZone, currentLocation{lat,lng}, lastAssignedAt }` (agents only) |
| **Zone** | `name, pincodes[], areas[]` |
| **RateCard** | `orderType (B2B/B2C), rateType (intra/inter), fromZone, toZone, baseRate, ratePerKg` |
| **CODConfig** | `orderType, surchargeType (flat/percentage), value` |
| **Order** | `customer, pickupAddress, dropAddress, dimensions{L,B,H}, actualWeight, volumetricWeight, chargeableWeight, orderType, paymentType, charge{baseCharge, codSurcharge, totalCharge}, assignedAgent, status (Created/Picked Up/In Transit/Out for Delivery/Delivered/Failed/Rescheduled), reschedule{isRescheduled, newDate, reason, rescheduledAt, previousAgent}` |
| **TrackingHistory** | `order, status, changedBy, timestamp, note` — append-only, one entry per status change |
| **AssignmentHistory** | `order, agent, assignedBy, assignmentType, timestamp` — append-only, one entry per (re)assignment |
| **Notification** | `order, recipient, channel (email/sms/system), event, message, status (pending/sent/failed), sentAt, error, attempts` |

Relationships: `Order.customer` → User, `Order.assignedAgent` → User,
`RateCard.fromZone`/`toZone` → Zone, `TrackingHistory.order` → Order,
`TrackingHistory.changedBy` → User.

---

## 5. Rate calculation logic

Implemented in `backend/src/utils/rateCalculator.js` (Part 3), fully
admin-configurable — nothing here is hardcoded.

1. **Zone detection** — pickup and drop addresses are matched against each
   `Zone`'s `pincodes[]`/`areas[]` to find the pickup zone and drop zone.
2. **Volumetric weight** — `(Length × Breadth × Height) / 5000` (dimensions
   in cm, result in kg).
3. **Chargeable weight** — the higher of `actualWeight` and `volumetricWeight`.
4. **Rate card lookup** — using `orderType` (B2B/B2C) and whether pickup
   zone equals drop zone (`intra`) or not (`inter`), the matching
   `RateCard` is fetched: `baseRate + (chargeableWeight × ratePerKg)`.
5. **COD surcharge** — if `paymentType` is `COD`, the matching `CODConfig`
   for that `orderType` is applied on top: either a flat amount or a
   percentage of the base charge.
6. **Total** — `baseCharge + codSurcharge`, returned to the frontend for
   preview via `POST /orders/calculate-charge` *before* the customer
   confirms, then persisted on `POST /orders`.

---

## 6. Submission notes

Per the assignment's submission guidelines: this repo excludes
`node_modules/`, `.env`, and build artifacts (`dist/`, etc.) via
`.gitignore`. Only `.env.example` files (no real secrets) are committed.
See `DEPLOYMENT.md` for hosting instructions and `SYSTEM_DESIGN.md` for the
800-word design write-up.
