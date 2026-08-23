<div align="center">

# 📦 LastMile Tracker

**A full-stack, zone-based last-mile delivery platform** — auto-calculated charges, smart agent assignment, immutable tracking history, and real-time customer notifications, built end-to-end with no hardcoded business rules.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#-tech-stack)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](#-tech-stack)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](#-tech-stack)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](#-tech-stack)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](#-tech-stack)

[**🚀 Live App**](https://lastmile-frontend-iaj4.onrender.com) · [**🔗 API**](https://lastmile-backend-bpts.onrender.com) · [System Design Write-up](./SYSTEM_DESIGN.md)

</div>

<br/>

<p align="center">
  <img src="docs/screenshots/01-landing.png" width="850" alt="LastMile Tracker landing page" />
</p>

---

## 📖 Table of Contents

- [What this is](#-what-this-is)
- [Roles & Features](#-roles--features)
- [How a Charge Gets Calculated](#-how-a-charge-gets-calculated)
- [Product Walkthrough (Screenshots)](#️-product-walkthrough-screenshots)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Order Status Lifecycle](#-order-status-lifecycle)
- [Deployment](#-deployment)
- [Live Demo](#-live-demo)

---

## 🧭 What this is

Logistics platforms need three things to actually work in production: **pricing that isn't hardcoded**, **agent assignment that scales**, and **a tracking history nobody can quietly edit**. LastMile Tracker is built around exactly those three ideas.

There are three roles — **Customer**, **Delivery Agent**, and **Admin** — each with a dedicated dashboard behind JWT-based, role-scoped auth.

When an order is created, the backend:

1. **Detects the pickup and drop zone** for each address (by pincode, falling back to area name).
2. **Calculates volumetric weight** — `(L × B × H) / 5000`.
3. **Bills on the higher of actual vs. volumetric weight** — the standard courier-industry rule.
4. **Looks up the correct rate card** — B2B vs. B2C, and intra-zone vs. inter-zone are priced independently.
5. **Adds a COD surcharge** if the payment type is Cash on Delivery (flat or percentage, configurable per order type).
6. **Shows the full charge breakdown before the customer confirms** — the same calculation function prices both the preview and the actual order, so what you see is what you pay.

Nothing above is hardcoded. Zones, rate cards, and COD configs are all managed live from the Admin dashboard — pricing changes need zero deployments.

Once placed, an order can be **manually assigned** by the admin or **auto-assigned** to the least-busy available agent in the pickup zone. The agent then drives the order through its status lifecycle, the customer gets an **email and SMS at every step**, and if a delivery fails, the customer can request a **reschedule** — which reassigns a fresh agent and re-enters the exact same tracked flow, not a special-cased shortcut.

---

## 👥 Roles & Features

<table>
<tr><td width="33%" valign="top">

### 🧑 Customer
- Register with email OTP verification, or sign in with Google
- Live charge preview before confirming an order
- Place orders — Prepaid or COD
- Track every order on a full status timeline
- Request a reschedule after a failed delivery
- Rate & review after delivery

</td><td width="33%" valign="top">

### 🚴 Delivery Agent
- Register with KYC (Aadhaar / Driving License / PAN) — reviewed by an admin before login is allowed
- View orders assigned to them
- Update status: Picked Up → In Transit → Out for Delivery → Delivered / Failed
- Toggle their own availability & set their zone

</td><td width="33%" valign="top">

### 🛠️ Admin
- Configure **zones**, mapping pincodes/areas to each
- Configure **rate cards** (B2B/B2C × intra/inter) and **COD surcharges** — no code changes needed
- Place orders on a customer's behalf
- View, filter (status/zone/agent), reassign, and override any order
- Approve/reject agent KYC submissions
- Manage all users; add other admins

</td></tr>
</table>

---

## 💰 How a Charge Gets Calculated

```
             ┌────────────────────┐
  addresses  │   Zone Detection    │   pincode match → area-name fallback
 ───────────▶│  (pickup + drop)     │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
 dimensions  │  Volumetric Weight   │   (L × B × H) / 5000
 ───────────▶│                      │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │  Chargeable Weight   │   max(actual, volumetric)
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
 orderType   │  Rate Card Lookup    │   B2B/B2C × intra/inter × zone pair
 ───────────▶│                      │   → baseRate + (weight × ratePerKg)
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
 paymentType │   COD Surcharge      │   flat ₹ or % — only if COD
 ───────────▶│  (if applicable)     │
             └──────────┬──────────┘
                        │
                 ┌──────▼──────┐
                 │ Total Charge │ ── shown to customer before confirm
                 └─────────────┘
```

This entire pipeline is one function — `backend/src/utils/rateCalculator.js` — called by both the `/calculate-charge` preview endpoint and the real order-creation endpoint, so there's no second implementation that can silently drift out of sync.

---

## 🖼️ Product Walkthrough (Screenshots)

### Admin — configuring the business rules

Zones, rate cards, and COD surcharges are all admin-managed — this is what makes the rate engine "no hardcoding" in practice, not just in theory.

<table>
<tr>
<td width="50%">

**Zones** — pincode + area coverage per zone
<img src="docs/screenshots/03-admin-zones.png" width="100%" alt="Admin zones configuration" />
</td>
<td width="50%">

**Rate Cards** — B2B/B2C, intra/inter pricing
<img src="docs/screenshots/04-admin-ratecards.png" width="100%" alt="Admin rate cards" />
</td>
</tr>
<tr>
<td width="50%">

**COD Surcharge Config** — flat ₹ or % per order type
<img src="docs/screenshots/05-admin-codconfig.png" width="100%" alt="Admin COD config" />
</td>
<td width="50%">

**Agent KYC Approvals** — manual review, always required
<img src="docs/screenshots/06-admin-agent-approvals.png" width="100%" alt="Admin agent approvals" />
</td>
</tr>
</table>

### Placing an order & seeing the rate engine work

<img src="docs/screenshots/07-admin-create-order-charge.png" width="850" alt="Admin creating an order with live charge summary" />

<p align="center"><em>Live charge summary — base rate, weight charge, and total — calculated the moment the form is filled, before the order is confirmed.</em></p>

<table>
<tr>
<td width="50%">

**Customer placing their own order**
<img src="docs/screenshots/08-customer-place-order.png" width="100%" alt="Customer place order" />
</td>
<td width="50%">

**Order history + post-delivery feedback**
<img src="docs/screenshots/09-customer-my-orders-feedback.png" width="100%" alt="Customer orders and feedback" />
</td>
</tr>
</table>

### Agent assignment & the admin control tower

<table>
<tr>
<td width="50%">

**Agent dashboard** — availability toggle & assigned deliveries
<img src="docs/screenshots/10-agent-dashboard.png" width="100%" alt="Agent dashboard" />
</td>
<td width="50%">

**Admin — all orders**, with reassign & status override
<img src="docs/screenshots/11-admin-all-orders.png" width="100%" alt="Admin all orders" />
</td>
</tr>
</table>

### Notifications on every status change

<table>
<tr>
<td width="50%">

**Email**
<img src="docs/screenshots/12-email-notification.png" width="100%" alt="Email notification" />
</td>
<td width="50%">

**SMS**
<img src="docs/screenshots/13-sms-notification.png" width="100%" alt="SMS notification" />
</td>
</tr>
</table>

### Agent onboarding (KYC)

<img src="docs/screenshots/02-agent-kyc-register.png" width="850" alt="Delivery agent registration with KYC documents" />

<p align="center"><em>Agents submit Aadhaar, Driving License, and (optionally) PAN at signup — their account can't log in until an admin manually approves it.</em></p>

---

## 🏗️ Architecture

```
┌──────────────────┐      HTTPS / JWT      ┌───────────────────┐      Mongoose      ┌─────────────┐
│   React (Vite)    │ ────────────────────▶ │   Express REST API  │ ─────────────────▶ │  MongoDB     │
│   Frontend         │ ◀──────────────────── │   (Node.js)          │ ◀───────────────── │  (Atlas)     │
└──────────────────┘                       └─────────┬─────────┘                    └─────────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    ▼                  ▼                  ▼
                          ┌──────────────┐   ┌──────────────────┐  ┌──────────────┐
                          │ rateCalculator │   │  agentAssigner    │  │ notification  │
                          │  (pricing)     │   │  (zone + workload)│  │  (email + SMS)│
                          └──────────────┘   └──────────────────┘  └──────────────┘
```

- **Frontend (React + Vite)** — role-aware routing (`ProtectedRoute`), separate page trees for customer/agent/admin, Axios API clients per resource.
- **Backend (Express)** — layered as routes → controllers → utils/models, with JWT auth + role middleware guarding every protected route.
- **Rate Calculator & Agent Assigner** — pure, reusable utility modules (not duplicated per controller) so pricing and assignment logic each have exactly one source of truth.
- **TrackingHistory** — append-only by schema design (see [Database Schema](#-database-schema)); it's not just convention, updates/deletes are blocked in Mongoose hooks.
- **Notifications** — Nodemailer (Gmail OAuth2) for email, plus an SMS service hook, fired on every status transition.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), React Router |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcrypt, Google Identity Services (Google Sign-In) |
| Email | Nodemailer (Gmail API via OAuth2) |
| File uploads | Multer (agent KYC documents) |
| Hosting | Render (backend + frontend), MongoDB Atlas |

---

## 📁 Project Structure

```
last-mile-delivery-tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # DB connection, mailer setup
│   │   ├── controllers/     # auth, orders, zones, rate cards, agents, tracking, feedback...
│   │   ├── middleware/      # JWT auth guard, role guard, file upload handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express routers
│   │   ├── templates/       # HTML email templates
│   │   ├── utils/           # rateCalculator, agentAssigner, statusTransitions, otp/notification services
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/              # seedFirstAdmin.js, migration helpers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios clients (one per resource)
│   │   ├── components/        # Navbar, Timeline, ProtectedRoute, GoogleSignInButton...
│   │   ├── context/            # AuthContext (JWT + user state)
│   │   ├── pages/
│   │   │   ├── customer/       # Place order, my orders, order tracking
│   │   │   ├── agent/          # Agent dashboard
│   │   │   └── admin/          # Zones, rate cards, agents, orders, users, COD config
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── docs/screenshots/          # README assets
├── SYSTEM_DESIGN.md
├── DEPLOYMENT.md
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB connection string (Atlas free tier works fine)
- A Google OAuth Client ID (only needed for Google Sign-In)
- A Gmail account with an OAuth2 app configured (for OTP / status emails)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in your own values
npm run dev                # or: npm start
```

API runs on `http://localhost:5000` by default.

Seed the first admin account (there's no public admin signup):

```bash
node scripts/seedFirstAdmin.js
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # fill in your own values
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` calls to the backend locally (see `vite.config.js`).

---

## 🔐 Environment Variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `PORT` | Port the API listens on |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `JWT_EXPIRE` | Token expiry (e.g. `7d`) |
| `GMAIL_API_CLIENT_ID` / `GMAIL_API_CLIENT_SECRET` / `GMAIL_API_REFRESH_TOKEN` / `GMAIL_API_SENDER_EMAIL` | Gmail OAuth2 credentials for OTP & status emails |
| `GOOGLE_CLIENT_ID` | OAuth Client ID to verify Google Sign-In tokens |
| `CLIENT_ORIGIN` | Deployed frontend URL, for CORS |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | `/api` locally (proxied by Vite); full deployed backend URL + `/api` in production |
| `VITE_GOOGLE_CLIENT_ID` | Same Google Client ID as the backend — safe to expose publicly |

Full, commented templates live in `backend/.env.example` and `frontend/.env.example`.

---

## 🗄️ Database Schema

| Collection | Purpose |
|---|---|
| **User** | Customers, agents, and admins in one collection, distinguished by `role`. Agents additionally carry `agentStatus` (pending/approved/rejected), KYC document paths, and `agentDetails` (current zone, availability, `lastAssignedAt` — used for fair auto-assignment). |
| **Zone** | A named service area, matched to orders via `pincodes` and/or `areas`. |
| **RateCard** | One row per `orderType` (B2B/B2C) × `rateType` (intra/inter) × zone pair, holding `baseRate` and `ratePerKg`. Unique-indexed to prevent duplicates. |
| **CODConfig** | One row per `orderType`, holding a `surchargeType` (flat/percentage) and `value`. |
| **Order** | The core record — addresses, package dimensions, computed `volumetricWeight` / `chargeableWeight`, `rateCardUsed`, full `charge` breakdown, current `status`, `assignedAgent`, and a `reschedule` sub-document. |
| **TrackingHistory** | Append-only — one document per status change (status + actor + timestamp). Mongoose hooks block any update/delete, enforcing immutability at the schema level. |
| **AssignmentHistory** | Log of agent assignment/reassignment events per order. |
| **Feedback** | Post-delivery customer rating + comment per order. |
| **Notification** | Record of notifications sent for an order. |

---

## 📡 API Reference

Base URL: `/api`. All routes except registration/login/first-admin-setup require a `Bearer` JWT.

<details>
<summary><strong>Auth — <code>/api/auth</code></strong></summary>

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register a customer or agent (agents submit KYC docs as multipart form data) |
| POST | `/verify-otp` | Public | Confirm the emailed OTP to activate an account |
| POST | `/resend-otp` | Public | Resend the OTP |
| POST | `/login` | Public | Customer/agent login |
| POST | `/admin-login` | Public | Admin login |
| POST | `/google` | Public | Google Sign-In (customer login/signup; admin only if account already exists) |
| GET | `/me` | Authenticated | Current user's profile |
| POST | `/forgot-password` | Public | Request a password reset email |
| POST | `/reset-password/:token` | Public | Reset password with emailed token |
| POST | `/create-admin` | Admin | Create another admin account |
| GET | `/customers` | Admin | List customers (used when admin creates an order on their behalf) |
| POST | `/setup-first-admin` | Public (one-time) | Bootstrap the very first admin account |
| GET | `/setup-first-admin/status` | Public | Check whether first-admin setup is still available |

</details>

<details>
<summary><strong>Zones — <code>/api/zones</code></strong></summary>

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/` | Admin | Create a zone |
| GET | `/` | Any logged-in user | List zones |
| GET | `/:id` | Any logged-in user | Get a zone |
| PUT | `/:id` | Admin | Update a zone |
| DELETE | `/:id` | Admin | Delete a zone |
| PATCH | `/:id/assign` | Admin | Add pincodes/areas to a zone |

</details>

<details>
<summary><strong>Rate Cards — <code>/api/rate-cards</code></strong> (Admin only)</summary>

| Method | Route | Description |
|---|---|---|
| GET | `/lookup` | Look up a rate card by orderType/rateType/zones |
| POST | `/` | Create a rate card |
| GET | `/` | List rate cards |
| GET / PUT / DELETE | `/:id` | Get / update / delete a rate card |

</details>

<details>
<summary><strong>COD Config — <code>/api/cod-config</code></strong> (Admin only)</summary>

| Method | Route | Description |
|---|---|---|
| GET | `/lookup/:orderType` | Look up the active COD config for a type |
| POST | `/` | Create a COD config |
| GET | `/` | List COD configs |
| GET / PUT / DELETE | `/:id` | Get / update / delete a COD config |

</details>

<details>
<summary><strong>Orders — <code>/api/orders</code></strong></summary>

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/calculate-charge` | Customer, Admin | Preview the charge for a not-yet-created order |
| POST | `/` | Customer, Admin | Create an order |
| GET | `/my` | Customer | Get the logged-in customer's own orders |
| GET | `/` | Admin | List all orders (filterable by status/zone/agent) |
| PATCH | `/:id/assign` | Admin | Manually assign an agent |
| PATCH | `/:id/auto-assign` | Admin | Auto-assign the best available agent |
| PATCH | `/:id/status` | Agent (own order), Admin | Move the order to the next valid status |
| PATCH | `/:id/override-status` | Admin | Force a status change, bypassing transition rules |
| GET | `/:id/tracking` | Owner (customer/agent/admin) | Full immutable tracking timeline |
| PATCH | `/:id/reschedule` | Customer | Request a reschedule on a Failed order |
| PATCH | `/:id/reschedule/reassign` | Admin | Reassign an agent after a reschedule |
| POST | `/:id/feedback` | Customer | Submit feedback after delivery |
| GET | `/:id/feedback` | Customer, Admin | Read feedback for an order |
| GET | `/:id` | Owner (customer/agent/admin) | Get one order |

</details>

<details>
<summary><strong>Agents — <code>/api/agents</code></strong></summary>

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
| GET | `/` | Admin | Browse agents (e.g. for manual-assignment dropdown) |

</details>

---

## 🔄 Order Status Lifecycle

```
Created → Picked Up → In Transit → Out for Delivery → Delivered
                                                       ↘ Failed → Rescheduled → Picked Up (re-enters the flow)
```

Enforced centrally in `backend/src/utils/statusTransitions.js` — every forward move is validated against this map, so an order can't jump straight from `Created` to `Delivered`. `Delivered` is the only true terminal state. Every transition writes a new, **immutable** `TrackingHistory` entry (status + actor + timestamp) and fires an email + SMS to the customer. Admins can bypass the map via the override-status endpoint for manual corrections.

On `Failed`, the customer can submit a reschedule request with a new date; the order moves to `Rescheduled`, a fresh agent is assigned (excluding the one who failed), and once picked up it re-enters the normal lifecycle with full tracking rigor — not a special-cased shortcut.

---

## ☁️ Deployment

- **Backend** → Render (root directory `backend`; build: `npm install`; start: `npm start`)
- **Frontend** → Render Static Site (root directory `frontend`)
- **Database** → MongoDB Atlas (free tier)

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step guide. Remember to set `CLIENT_ORIGIN` on the backend to your deployed frontend URL (for CORS), and `VITE_API_BASE_URL` on the frontend to your deployed backend URL + `/api`.

---

## 🌐 Live Demo

| | Link |
|---|---|
| **Frontend** | [lastmile-frontend-iaj4.onrender.com](https://lastmile-frontend-iaj4.onrender.com) |
| **Backend API** | [lastmile-backend-bpts.onrender.com](https://lastmile-backend-bpts.onrender.com) |

> ⏳ Hosted on Render's free tier — the backend spins down after inactivity, so the first request may take 30–60s to wake up. That's expected, not a bug.

