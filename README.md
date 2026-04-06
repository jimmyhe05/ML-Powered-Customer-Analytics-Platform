# NuuB Churn Prediction Platform

Full-stack ML application for telecom churn analysis with:

- **Frontend**: React + Vite dashboards and prediction flows
- **Backend**: Flask APIs for ingestion, training, and inference
- **ML**: XGBoost + MLP models
- **Database**: PostgreSQL for uploaded records, predictions, and dashboard data

## Why this project

NuuB helps identify at-risk customers and gives teams a visual decision surface for retention actions.

Core outcomes:

- Batch churn scoring from uploaded datasets
- Dynamic risk-threshold tuning for business review
- Visual analytics for churn trends and feature importance
- API-first architecture ready for hosted deployment

## Architecture

```text
React (Vite) UI  --->  Flask API  --->  PostgreSQL
                         |
                         +--> XGBoost / MLP training + inference
```

## Repository structure

```text
backend/      Flask app, model training/inference, DB integration
frontend/     React/Vite dashboard and prediction UI
docker-compose.yml
```

## Security-first setup

This repo is prepared for public sharing:

- Real secrets should **never** be committed.
- Use `.env.example` and `frontend/.env.example` as templates.
- Keep actual values only in local `.env` files or cloud host environment settings.

Before publishing, follow `SECURITY_CHECKLIST.md`.

## Local development

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (local or managed)
- Optional: Docker Desktop (for container workflow)

### 1) Configure environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Then update values in `.env` and `frontend/.env`.

### 2) Backend setup (venv)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install gunicorn
```

Run backend:

```bash
cd backend
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

Health endpoint:

```bash
curl http://127.0.0.1:5000/health
```

### 3) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Docker workflow (optional)

If Docker is available:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:4173`
- Backend: `http://localhost:5050`
- DB: `localhost:5432`

## Deployment recommendation (free/low-cost)

- **Frontend**: Vercel
- **Backend**: Render / Railway / Fly.io
- **Database**: Neon / Supabase / Railway Postgres

Set all runtime secrets via host environment variable UI.

Detailed guide: `docs/DEPLOYMENT.md`

## Resume-ready highlights

Suggested bullets:

- Built an end-to-end churn prediction platform (React, Flask, PostgreSQL, XGBoost/MLP) with upload-to-inference workflows.
- Implemented dynamic thresholding and analytics dashboards to support retention decision-making.
- Productionized deployment using containerized services and environment-driven configuration.

More resume content (project summary, interview pitch, and skill tags): `docs/RESUME.md`

## Notes

- Do not commit private datasets or production credentials.
- If secrets were previously committed, rotate them and clean Git history before public release.
- See `SECURITY_CHECKLIST.md` for the exact release process.
