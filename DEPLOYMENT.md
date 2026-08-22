# Deployment Guide

This covers hosting the backend on **Render** (Railway steps are nearly
identical, noted inline) and the frontend on **Vercel**.

## 1. Database — MongoDB Atlas (free tier)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database Access → add a user with a password (not your Atlas login).
3. Network Access → add `0.0.0.0/0` (allow from anywhere) so Render/Railway
   can reach it — fine for an assignment submission; tighten later for
   production use.
4. Get the connection string from "Connect → Drivers": looks like
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/lastmile?retryWrites=true&w=majority`.

## 2. Backend — Render

1. Push your code to GitHub first (public repo, `main` branch, no
   `node_modules`/`.env` — see submission guidelines).
2. [render.com](https://render.com) → New → Web Service → connect your GitHub repo.
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start` (or `node src/server.js` — match your `package.json`)
   - **Instance type:** Free
4. Environment → add all vars from `backend/.env.example` with real values:
   `MONGO_URI` (from step 1), `JWT_SECRET` (any long random string),
   `JWT_EXPIRES_IN`, `SMTP_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Leave
   `CLIENT_ORIGIN` empty for now — you'll fill it in after deploying the
   frontend (step 4 below).
5. Deploy. Render gives you a URL like `https://lastmile-backend.onrender.com`.
   Test it: `GET https://lastmile-backend.onrender.com/api/auth/me` should
   return a 401 (expected — no token), confirming the server is up.

**Railway equivalent:** New Project → Deploy from GitHub repo → set root
directory to `backend` → Railway auto-detects `npm install`/`npm start` →
add the same environment variables under the Variables tab → deploy.

## 3. Enable CORS for the deployed frontend

Your Express app needs to accept requests from the Vercel domain (browsers
block cross-origin requests otherwise). In `backend/src/app.js`, if you
don't already have CORS configured:

```js
const cors = require('cors');

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
```

Install if needed: `npm install cors` (inside `backend/`).

## 4. Frontend — Vercel

1. [vercel.com](https://vercel.com) → New Project → import the same GitHub repo.
2. Settings:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite (auto-detected)
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Environment Variables → add:
   - `VITE_API_BASE_URL` = `https://lastmile-backend.onrender.com/api` (your Render URL from step 2, with `/api` appended)
4. Deploy. Vercel gives you a URL like `https://lastmile-tracker.vercel.app`.

## 5. Close the loop: update CORS with the real frontend URL

Go back to Render (or Railway) → Environment → set
`CLIENT_ORIGIN=https://lastmile-tracker.vercel.app` (your actual Vercel
URL, no trailing slash) → redeploy the backend so the CORS change takes
effect.

## 6. Verify end-to-end

1. Open the Vercel URL.
2. Register a customer account — confirms frontend → backend → MongoDB write works.
3. Place an order and check charge calculation — confirms the rate engine works in production.
4. Move an order through a status change and check the configured SMTP
   inbox (Mailtrap sandbox, or the Gmail inbox) for the notification email —
   confirms Part 7 works in production.

## Notes on free-tier limitations

- **Render free tier** spins down after inactivity; the first request after
  idling can take 30–60s to wake up. This is expected — not a bug.
- **Mailtrap sandbox** never sends real emails (by design, for safe testing)
  — everything lands in your Mailtrap inbox. Switch `SMTP_PROVIDER=gmail`
  with a Gmail App Password if you want real delivery for a demo.
