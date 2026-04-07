# Deployment Guide (Portfolio-Friendly)

This guide deploys the app using a free/low-cost split architecture:

- Frontend: **Vercel**
- Backend: **Render** (or Railway/Fly.io)
- Database: **Neon Postgres** (or Supabase/Railway Postgres)

## 1) Create managed Postgres

1. Create a Postgres database in Neon.
2. Copy connection fields:
   - host
   - port
   - database name
   - user
   - password

## 2) Deploy backend (Render)

> If deploying to Railway instead of Render, follow **2b** below.

### Service settings

- Runtime: Python
- Root directory: `backend`
- Build command:
  - `pip install --upgrade pip && pip install -r requirements.txt`
- Start command:
  - `gunicorn -w 2 -t 600 -b 0.0.0.0:$PORT app:app`

### Required environment variables

Set these in Render service settings:

- `ENVIRONMENT=production`
- `DB_HOST=<your_neon_host>`
- `DB_PORT=5432`
- `DB_NAME=<your_db_name>`
- `DB_USER=<your_db_user>`
- `DB_PASS=<your_db_password>`
- `DB_ROW_LIMIT=10000`
- `XGB_TOTAL_TRIALS=10`
- `MLP_TOTAL_EPOCHS=50`

### Verify backend

After deploy, open:

- `https://<your-backend-domain>/health`

Expected response includes `status: "ok"`.

### 2b) Deploy backend (Railway - validated flow)

- Link/deploy from backend root so Railway uses Dockerfile:
  - `railway up . --path-as-root`
- Set backend database URL on service `ML-Powered-Customer-Analytics-Platform`:
  - `DATABASE_URL=postgresql://...@postgres.railway.internal:5432/railway`

Notes:
- Use `DATABASE_URL` (internal Railway host) for the running service.
- From your local machine, `postgres.railway.internal` is not resolvable; use `DATABASE_PUBLIC_URL` for one-off local migration scripts.

### 2c) Initialize schema (required)

After DB wiring, apply `backend/db/churn_database.sql` once.

- If using a local script, strip the `\c` meta-command before execution (it's psql-only).
- Confirm these tables exist after migration:
  - `prediction_batches`
  - `predictions`
  - `devices`
  - `dashboard_devices`
  - `processed_features`

If schema is missing, `/predictions` will return errors like `relation "prediction_batches" does not exist`.

## 3) Deploy frontend (Vercel)

1. Import the GitHub repository in Vercel.
2. Set project root to `frontend`.
3. Framework preset: Vite.
4. Add environment variable:
   - `VITE_ENVIRONMENT=production`
   - `VITE_API_URL=https://<your-backend-domain>`
5. Deploy.

## 4) CORS and networking notes

- Backend currently allows all origins (`*`) for simplicity.
- For production hardening, restrict CORS origins to your Vercel domain.

## 5) Demo-readiness checklist

- [ ] Frontend loads without console errors.
- [ ] `/health` endpoint works on backend.
- [ ] Upload/prediction flow works end-to-end.
- [ ] No secrets in Git history.
- [ ] README has live links + screenshots.

## 6) Optional alternatives

- Backend on Railway/Fly.io works with same environment variables.
- Database can be Supabase Postgres if preferred.
