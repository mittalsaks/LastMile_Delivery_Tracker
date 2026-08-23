# Last-Mile Delivery Tracker

A full-stack logistics platform for managing last-mile deliveries — customers place orders with an auto-calculated shipping charge, admins configure zones and pricing, delivery agents get assigned automatically (or manually) and update delivery status, and everyone stays in the loop through an immutable tracking timeline and email notifications.

---

## Table of Contents

- [Overview](#overview)
- [Roles & Features](#roles--features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Rate Calculation Logic](#rate-calculation-logic)
- [API Reference](#api-reference)
- [Order Status Lifecycle](#order-status-lifecycle)
- [Deployment](#deployment)
- [Live Demo](#live-demo)

---

## Overview

There are three roles in the system — **Customer**, **Delivery Agent**, and **Admin** — each with a separate login and dashboard, protected by JWT-based role authentication.

When a customer (or an admin on a customer's behalf) fills in a pickup address, drop address, package dimensions, and weight, the backend:

1. Detects which **zone** the pickup and drop addresses fall into (by pincode, or by area name as a fallback).
2. Calculates **volumetric weight** — `(L × B × H) / 5000`.
3. Bills on the **higher of actual weight vs. volumetric weight** (the standard courier-industry rule).
4. Looks up the correct **rate card** — separate cards exist for B2B vs. B2C, and for intra-zone vs. inter-zone shipments.
5. Adds a **COD surcharge** if the payment type is Cash on Delivery (flat fee or percentage, configurable per order type).
6. Returns the full charge breakdown to the customer **before** they confirm the order.

None of this is hardcoded — zones, rate cards, and COD surcharges are all managed from the Admin dashboard.

Once an order is placed, an agent can be assigned **manually** by the admin or **auto-assigned** to the best available agent in the pickup zone. The agent then moves the order through its status lifecycle, and the customer gets an email at every step. If a delivery fails, the customer can request a reschedule, and the order is reassigned to an agent for a fresh delivery attempt.

---

## Roles & Features

### Customer
- Register (email OTP verification) or sign in with Google
- Get a live charge preview before confirming an order
- Place orders (Prepaid or COD)
- Track every order on a full status timeline
- Request a reschedule if a delivery fails
- Leave feedback after delivery

### Delivery Agent
- Register with KYC documents (Aadhaar / PAN / Driving License) — approved by admin before login is allowed
- View orders assigned to them
- Update order status (Picked Up → In Transit → Out for Delivery → Delivered / Failed)
- Toggle their own availability

### Admin
- Create/manage **zones** and map pincodes or area names to each zone
- Create/manage **rate cards** (B2B/B2C × intra/inter-zone) and **COD surcharge configs**
- Create orders on behalf of a customer
- View all orders, filter by status / zone / agent
- Manually assign an agent, or trigger auto-assignment
- Override an order's status directly (bypasses the normal forward-only flow)
- Approve / reject pending agent registrations, review their KYC documents
- Manage all users (deactivate / reactivate customers and agents)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), React Router |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcrypt (password hashing), Google Identity Services (Google Sign-In) |
| Email | Nodemailer (Gmail API via OAuth2) |
| File uploads | Multer (agent KYC documents) |

---

## Project Structure

```
last-mile-delivery-tracker/
├── backend/
│   ├── src/
│   │   ├── config/         # DB connection, mailer setup
│   │   ├── controllers/    # Route handlers (auth, orders, zones, rate cards, agents, tracking, feedback...)
│   │   ├── middleware/     # JWT auth guard, role guard, file upload handling
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routers
│   │   ├── templates/      # HTML email templates
│   │   ├── utils/          # Rate calculator, agent assigner, status transitions, OTP/notification services
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/            # seedFirstAdmin.js, migration helpers
│   ├── uploads/             # Agent KYC document storage
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API clients (one per resource)
│   │   ├── components/      # Shared UI (Navbar, Timeline, ProtectedRoute, GoogleSignInButton...)
│   │   ├── context/          # AuthContext (JWT + user state)
│   │   ├── pages/
│   │   │   ├── customer/     # Place order, my orders, order tracking
│   │   │   ├── agent/        # Agent dashboard
│   │   │   └── admin/        # Zones, rate cards, agents, orders, users, COD config
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB connection string (MongoDB Atlas free tier works fine)
- A Google OAuth Client ID (only needed if you want Google Sign-In to work)
- A Gmail account with an OAuth2 app configured (for sending emails) — optional for local testing, but the app expects it for OTP/status emails

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in your own values
npm run dev             # or: npm start
```

The API runs on `http://localhost:5000` by default (`PORT` in `.env`).

Seed the first admin account (there's no self-service admin signup):

```bash
node scripts/seedFirstAdmin.js
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill in your own values
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` calls to the backend during local development (see `vite.config.js`).

---

## Environment Variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `PORT` | Port the API listens on |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `JWT_EXPIRE` | Token expiry (e.g. `7d`) |
| `GMAIL_API_CLIENT_ID` / `GMAIL_API_CLIENT_SECRET` / `GMAIL_API_REFRESH_TOKEN` / `GMAIL_API_SENDER_EMAIL` | Gmail OAuth2 credentials used to send OTP and status-update emails |
| `GOOGLE_CLIENT_ID` | OAuth Client ID used to verify Google Sign-In tokens (no client secret needed — the backend only verifies an ID token) |
| `CLIENT_ORIGIN` | Deployed frontend URL, for CORS |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | `/api` locally (proxied by Vite); the full deployed backend URL + `/api` in production |
| `VITE_GOOGLE_CLIENT_ID` | Same Google Client ID as the backend — safe to expose publicly |

Full, commented templates are in `backend/.env.example` and `frontend/.env.example` — copy those rather than typing this table out by hand.

---

## Database Schema

| Collection | Purpose |
|---|---|
| **User** | Customers, agents, and admins in one collection, distinguished by `role`. Agents additionally carry `agentStatus` (pending/approved/rejected), KYC document paths, and `agentDetails` (current zone, availability, last-assigned timestamp — used for auto-assignment fairness). |
| **Zone** | A named service area, matched to orders via a list of `pincodes` and/or `areas`. |
| **RateCard** | One row per `orderType` (B2B/B2C) × `rateType` (intra/inter) × zone pair, holding `baseRate` and `ratePerKg`. Unique-indexed so duplicates can't be created. |
| **CODConfig** | One row per `orderType`, holding a `surchargeType` (flat/percentage) and `value`. |
| **Order** | The core record — addresses, package dimensions, computed `volumetricWeight`/`chargeableWeight`, the `rateCardUsed`, a full `charge` breakdown, current `status`, `assignedAgent`, and a `reschedule` sub-document. |
| **TrackingHistory** | Append-only log — one document per status change, storing the status, the actor (`changedBy`), and a timestamp. Mongoose hooks block any update/delete on this collection, enforcing immutability at the schema level, not just by convention. |
| **AssignmentHistory** | Log of agent assignment/reassignment events per order. |
| **Feedback** | Post-delivery customer feedback per order. |
| **Notification** | Record of notifications sent for an order. |

---

## Rate Calculation Logic

Implemented once, in `backend/src/utils/rateCalculator.js`, and reused by both the `/calculate-charge` preview endpoint and the actual order-creation endpoint — so the price a customer sees is guaranteed to be the price they're charged.

1. **Zone detection** — each address is matched to a `Zone` by exact pincode first, then by a case-insensitive area name match as a fallback. No match → the request is rejected with a clear error asking the admin to configure that area.
2. **Volumetric weight** — `(length × breadth × height) / 5000`, dimensions in cm.
3. **Chargeable weight** — `max(actualWeight, volumetricWeight)`.
4. **Rate card lookup** — `rateType` is derived automatically (`intra` if pickup zone === drop zone, else `inter`), then a `RateCard` is looked up by `orderType + rateType + fromZone + toZone`.
5. **Weight charge** — `baseRate + (chargeableWeight × ratePerKg)`.
6. **COD surcharge** — only applied when `paymentType === "COD"`; either a flat amount or a percentage of the weight charge, per the active `CODConfig` for that order type.
7. **Total charge** — `weightCharge + codSurcharge`.

Every number involved (base rate, per-kg rate, COD value) comes from the database — there is no hardcoded pricing anywhere in the code, so admins can change pricing at any time without a deployment.

---

## API Reference

Base URL: `/api`. All routes except registration/login/first-admin-setup require a `Bearer` JWT.

### Auth (`/api/auth`)
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register a customer or agent (agents submit KYC docs as multipart form data) |
| POST | `/verify-otp` | Public | Confirm the emailed OTP to activate an account |
| POST | `/resend-otp` | Public | Resend the OTP |
| POST | `/login` | Public | Customer/agent login |
| POST | `/admin-login` | Public | Admin login |
| POST | `/google` | Public | Google Sign-In (customer login/signup; admin login only if `intent: "admin"` and the account already exists) |
| GET | `/me` | Authenticated | Current user's profile |
| POST | `/forgot-password` | Public | Request a password reset email |
| POST | `/reset-password/:token` | Public | Reset password with the emailed token |
| POST | `/create-admin` | Admin | Create another admin account |
| GET | `/customers` | Admin | List customers (used when admin creates an order on a customer's behalf) |
| POST | `/setup-first-admin` | Public (one-time) | Bootstrap the very first admin account |
| GET | `/setup-first-admin/status` | Public | Check whether first-admin setup is still available |

### Zones (`/api/zones`)
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/` | Admin | Create a zone |
| GET | `/` | Any logged-in user | List zones |
| GET | `/:id` | Any logged-in user | Get a zone |
| PUT | `/:id` | Admin | Update a zone |
| DELETE | `/:id` | Admin | Delete a zone |
| PATCH | `/:id/assign` | Admin | Add pincodes/areas to a zone |

### Rate Cards (`/api/rate-cards`) — Admin only
| Method | Route | Description |
|---|---|---|
| GET | `/lookup` | Look up a rate card by orderType/rateType/zones |
| POST | `/` | Create a rate card |
| GET | `/` | List rate cards |
| GET / PUT / DELETE | `/:id` | Get / update / delete a rate card |

### COD Config (`/api/cod-config`) — Admin only
| Method | Route | Description |
|---|---|---|
| GET | `/lookup/:orderType` | Look up the active COD config for a type |
| POST | `/` | Create a COD config |
| GET | `/` | List COD configs |
| GET / PUT / DELETE | `/:id` | Get / update / delete a COD config |

### Orders (`/api/orders`)
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/calculate-charge` | Customer, Admin | Preview the charge for a not-yet-created order |
| POST | `/` | Customer, Admin | Create an order |
| GET | `/my` | Customer | Get the logged-in customer's own orders |
| GET | `/` | Admin | List all orders (filterable by status/zone/agent) |
| PATCH | `/:id/assign` | Admin | Manually assign an agent |
| PATCH | `/:id/auto-assign` | Admin | Auto-assign the best available agent |
| PATCH | `/:id/status` | Agent (own order), Admin | Move the order to the next valid status |
| PATCH | `/:id/override-status` | Admin | Force a status change, bypassing the normal transition rules |
| GET | `/:id/tracking` | Customer/Agent/Admin (ownership enforced) | Full immutable tracking timeline |
| PATCH | `/:id/reschedule` | Customer | Request a reschedule on a Failed order |
| PATCH | `/:id/reschedule/reassign` | Admin | Reassign an agent after a reschedule |
| POST | `/:id/feedback` | Customer | Submit feedback after delivery |
| GET | `/:id/feedback` | Customer, Admin | Read feedback for an order |
| GET | `/:id` | Owner (customer/agent/admin) | Get one order |

### Agents (`/api/agents`)
| Method | Route | Access | Description |
|---|---|---|---|
| PATCH | `/me/availability` | Agent | Toggle own availability |
| GET | `/me/orders` | Agent | Orders assigned to the logged-in agent |
| GET | `/pending` | Admin | List agents awaiting approval |
| PATCH | `/:id/approve` | Admin | Approve an agent |
| PATCH | `/:id/reject` | Admin | Reject an agent |
| GET | `/:id/documents/:docType` | Admin | Download a specific KYC document |
| GET | `/all` | Admin | Full agent roster |
| PATCH | `/:id/deactivate` | Admin | Deactivate an agent |
| PATCH | `/:id/reactivate` | Admin | Reactivate an agent |
| GET | `/:id/feedback` | Admin | Feedback summary for an agent |
| GET | `/` | Admin | Browse agents (e.g. for a manual-assignment dropdown) |

---

## Order Status Lifecycle

```
Created → Picked Up → In Transit → Out for Delivery → Delivered
                                                       ↘ Failed → Rescheduled → Picked Up (re-enters the flow)
```

Enforced centrally in `backend/src/utils/statusTransitions.js` — every forward move is validated against this map, so an order can't, for example, jump straight from `Created` to `Delivered`. `Delivered` is the only true terminal state. Every transition writes a new, immutable `TrackingHistory` entry (status + actor + timestamp) and triggers a status-update email to the customer. Admins can bypass the map entirely via the override-status endpoint when a manual correction is needed.

On `Failed`, the customer can submit a reschedule request with a new date; the order moves to `Rescheduled`, an agent is (re)assigned, and once picked up it re-enters the normal flow.

---

## Deployment

- **Backend** → Render / Railway (root directory `backend`; build: `npm install`; start: `npm start`)
- **Frontend** → Vercel (root directory `frontend`)
- **Database** → MongoDB Atlas (free tier)

Remember to set `CLIENT_ORIGIN` on the backend to your deployed frontend URL (for CORS), and `VITE_API_BASE_URL` on the frontend to your deployed backend URL + `/api`.

---

## Live Demo

| | Link |
|---|---|
| Frontend | `<add your deployed frontend URL here>` |
| Backend API | `<add your deployed backend URL here>` |