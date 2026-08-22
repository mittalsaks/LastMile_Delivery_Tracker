# Last-Mile Delivery Tracker — Project Roadmap

Tech Stack: Node.js + Express + MongoDB (Mongoose) + React (frontend) + JWT Auth

## Parts

- [x] Part 1 — Project Setup + DB Schema + Auth (DONE)
- [ ] Part 2 — Admin Panel Core (Zones + Rate Cards + COD Config)
- [ ] Part 3 — Order Creation + Rate Calculation Engine
- [ ] Part 4 — Agent Assignment System (manual + auto)
- [ ] Part 5 — Order Status Lifecycle + Immutable Tracking History
- [ ] Part 6 — Failed Delivery + Reschedule Flow
- [ ] Part 7 — Notifications (Email/SMS)
- [ ] Part 8 — Customer + Admin Frontend Dashboards
- [ ] Part 9 — Deployment + Documentation (README, .env.example, API docs, system design write-up)
- [ ] Part 10 — Final GitHub Submission Cleanup

## Folder Structure
```
lastmile-delivery-tracker/
  backend/
    src/
      config/db.js
      models/ (User, Zone, RateCard, CODConfig, Order, TrackingHistory, Notification)
      middleware/authMiddleware.js
      controllers/authController.js
      routes/authRoutes.js
      app.js
      server.js
    .env.example
    package.json
    README.md
  frontend/   <- will be added in Part 8
  PROJECT_ROADMAP.md
```

## Notes / Decisions Made So Far
- DB: MongoDB with Mongoose
- Auth: JWT, roles = customer / agent / admin
- All models created upfront in Part 1 (schema-first approach) even though some are used in later parts
- Volumetric weight formula: (L x B x H) / 5000
- Chargeable weight = higher of actual vs volumetric weight
- Rate cards are separate for B2B/B2C and intra-zone/inter-zone
- TrackingHistory is append-only (immutable) — never update/delete existing records
