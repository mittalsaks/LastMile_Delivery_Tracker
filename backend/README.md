# Last-Mile Delivery Tracker — Backend (Part 1)

## What's in this part
- Project structure (Express + MongoDB via Mongoose)
- Full DB schema (User, Zone, RateCard, CODConfig, Order, TrackingHistory, Notification)
- Role-based Auth (customer / agent / admin) — Register, Login, Get Profile (JWT)

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` -> your local MongoDB URI or MongoDB Atlas connection string
- `JWT_SECRET` -> any long random string

Run:
```bash
npm run dev
```

Server runs at: `http://localhost:5000`

## API Endpoints (Part 1)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/register | Public | Register user (customer/agent/admin) |
| POST | /api/auth/login | Public | Login, returns JWT |
| GET | /api/auth/me | Private | Get logged-in user profile |

### Register - sample body
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "123456",
  "phone": "9876543210",
  "role": "customer"
}
```

### Login - sample body
```json
{
  "email": "ravi@example.com",
  "password": "123456"
}
```

Use the returned `token` as `Authorization: Bearer <token>` header for private routes.

## DB Schema Overview
- **User** — customer/agent/admin, agent has `agentDetails` (zone, availability, location)
- **Zone** — zone name + mapped pincodes/areas
- **RateCard** — B2B/B2C, intra/inter zone, base rate + per kg rate
- **CODConfig** — COD surcharge config per order type
- **Order** — full order schema (used from Part 3 onwards)
- **TrackingHistory** — immutable append-only status log
- **Notification** — email/sms log

## Next Part
Part 2: Admin Panel Core — Zone CRUD + Rate Card CRUD + COD Config APIs
