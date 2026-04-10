# ML-Powered Customer Analytics Platform

End-to-end customer churn analytics platform with a React dashboard, Flask API, machine learning models (XGBoost + MLP), and PostgreSQL-backed data workflows.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A: Full Stack with Docker (Recommended)](#option-a-full-stack-with-docker-recommended)
  - [Option B: Local Development (Without Docker)](#option-b-local-development-without-docker)
- [Environment Variables](#environment-variables)
- [How to Use](#how-to-use)
- [API Reference (Core Endpoints)](#api-reference-core-endpoints)
- [Model Training Notes](#model-training-notes)
- [Deployment](#deployment)
- [Security & Secrets Management](#security--secrets-management)
- [Troubleshooting](#troubleshooting)
- [Project Status / Roadmap](#project-status--roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

This project helps teams upload churn-related datasets, train churn models, run batch predictions, and explore visual analytics in a dashboard.

It is designed as a practical product-style repository:

- **Frontend** for visualization and workflow UX
- **Backend API** for ingestion, analytics, and model operations
- **Database** for persisted predictions and dashboard records
- **ML artifacts** for model metrics and feature importances

---

## Key Features

- Batch churn prediction from uploaded CSV/XLSX data
- Interactive dashboard charts (churn trends, app usage, carrier distribution, return analysis, feature importance, correlation heatmap)
- XGBoost and MLP model support
- Training session/progress endpoints for long-running training workflows
- Dashboard data upload/reset and analytics refresh
- Production split deployment support (Vercel + Railway/Render + managed Postgres)

---

## Architecture

```text
Frontend (React + Vite)
    |
    | HTTP (REST)
    v
Backend (Flask + Gunicorn)
    |
    | SQL
    v
PostgreSQL (predictions, dashboard data, processed features)
```

Runtime flow (high level):

1. Upload data for analytics and/or prediction
2. Backend validates/processes data
3. Data and prediction outputs are persisted to PostgreSQL
4. Frontend fetches analytics + prediction endpoints and renders charts/tables

---

## Repository Structure

```text
backend/                 Flask API, model training/prediction scripts, DB SQL
frontend/                React + Vite dashboard app
data/                    Local sample datasets
docs/                    Deployment and supporting documentation
docker-compose.yml       Multi-service local stack (db/backend/frontend)
SECURITY_CHECKLIST.md    Public-release security checklist
```

Important backend files:

- `backend/app.py` — main Flask app and API routes
- `backend/requirements.txt` — Python dependencies
- `backend/db/churn_database.sql` — database schema script
- `backend/Dockerfile` — backend container build

Important frontend files:

- `frontend/src/pages/Dashboard.jsx` — dashboard orchestration and data fetching
- `frontend/src/components/charts/*` — chart components
- `frontend/package.json` — frontend scripts/dependencies

---

## Tech Stack

### Frontend

- React 19
- Vite 6
- React Router
- React Bootstrap + Bootstrap
- Recharts / Chart.js / D3

### Backend

- Python + Flask
- Gunicorn
- Pandas / NumPy / scikit-learn
- XGBoost
- PyTorch (MLP)
- SQLAlchemy + psycopg2

### Data / Infra

- PostgreSQL
- Docker + Docker Compose
- Vercel (frontend)
- Railway/Render (backend)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Python 3.10 (recommended for backend dependencies)
- PostgreSQL (if not using Docker)
- Docker Desktop (optional, recommended for full-stack local run)

### Option A: Full Stack with Docker (Recommended)

From repo root:

```bash
docker compose up --build
```

Default ports from `docker-compose.yml`:

- Frontend: `http://localhost:4173`
- Backend: `http://localhost:5050`
- Postgres: `localhost:5432`

### Option B: Local Development (Without Docker)

#### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask run --host=0.0.0.0 --port=5000
```

#### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev URL is typically `http://localhost:5173`.

---

## Environment Variables

### Frontend (`frontend/.env`)

Use `frontend/.env.example` as template.

```env
VITE_ENVIRONMENT=local
VITE_API_URL=http://127.0.0.1:5050
```

### Backend

Backend reads DB settings from either:

1. `DATABASE_URL` (preferred in managed platforms), or
2. individual vars:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASS`

Optional operational vars:

- `DB_ROW_LIMIT`
- `XGB_TOTAL_TRIALS`
- `MLP_TOTAL_EPOCHS`
- `FAST_XGB_TOTAL_TRIALS`
- `FAST_MLP_TOTAL_EPOCHS`

---

## How to Use

1. Start backend + frontend.
2. Open dashboard.
3. Upload dashboard data (`CSV`/`XLSX`) through the UI.
4. Generate predictions from uploaded CSV batches.
5. View analytics and prediction history.
6. Optionally run/monitor model training from training endpoints/UI flows.

---

## API Reference (Core Endpoints)

Health & diagnostics:

- `GET /health`
- `GET /config`

Predictions:

- `POST /predict_batch`
- `POST /predict_batch_MLP`
- `GET /predictions?limit=<n>`
- `DELETE /delete_prediction_batch/<batch_id>`
- `DELETE /delete_all_predictions`

Training lifecycle:

- `POST /train_model`
- `POST /train_MLP_model`
- `GET /training_progress_XGB`
- `GET /training_progress_MLP`
- `POST /training_session`
- `GET /training_session/active`
- `GET /training_session/<training_id>`
- `POST /training_session/<training_id>/cancel`

Analytics/dashboard:

- `POST /upload_dashboard_data`
- `POST /reset_dashboard_data`
- `GET /dashboard_data`
- `GET /carrier_distribution`
- `GET /return_analysis`
- `GET /time_analysis`
- `GET /feature_heatmap_data`
- `GET /feature_importance`
- `GET /feature_importance_MLP`

---

## Model Training Notes

- Supports XGBoost and MLP model pipelines.
- Tracks training progress via JSON progress/state files.
- Stores model metrics and feature importance artifacts in backend/model artifact files.
- For faster local iteration, use “fast mode” env vars where applicable.

---

## Deployment

For full deployment details, see `docs/DEPLOYMENT.md`.

Typical production split:

- **Frontend:** Vercel (project root `frontend`)
- **Backend:** Railway or Render (root `backend`)
- **Database:** managed Postgres (Railway/Neon/Supabase)

Critical production checklist:

- Set `VITE_API_URL` in Vercel to backend public URL
- Ensure backend DB schema is initialized (`backend/db/churn_database.sql`)
- Verify `GET /health` and `GET /dashboard_data`

---

## Security & Secrets Management

Read and follow `SECURITY_CHECKLIST.md` before public release.

Minimum requirements:

- Never commit real `.env` files or secrets
- Rotate any leaked credentials immediately
- Keep `.env.example` files with placeholders only
- Use platform-managed environment variables (Vercel/Railway/Render)

---

## Troubleshooting

### Return charts show “No data available”

- Check backend response:

```bash
curl -sS <BACKEND_URL>/return_analysis
```

- If arrays are empty, verify `dashboard_devices` contains return rows and expected columns.

### Frontend shows `ERR_CONNECTION_REFUSED`

- `VITE_API_URL` points to unreachable backend host/port.
- Start backend or update env var and redeploy frontend.

### Build succeeds but app fails in production

- Inspect browser console + network tab for API payload shape mismatches.
- Verify backend endpoints return JSON with expected keys.

### Python dependency issues locally

- Use Python 3.10 where possible.
- Prefer Docker for consistent builds of heavy ML dependencies.

---

## Project Status / Roadmap

Current focus areas:

- Improve test coverage (frontend component tests + backend API tests)
- Harden schema/data validation for uploaded datasets
- Add CI for lint/test/build gates
- Improve dashboard performance via code splitting and optimized payloads

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make focused changes
4. Validate locally
5. Open a PR with:
   - summary of changes
   - validation steps
   - screenshots for UI changes

Suggested contribution standards:

- Keep secrets out of commits
- Prefer small PRs
- Add/update docs when behavior changes

---

## License

No license file is currently included in this repository.

If you plan to make this project public/open-source, add a `LICENSE` file (e.g., MIT/Apache-2.0) and update this section.

---

## Acknowledgements

- Open-source libraries: React, Flask, scikit-learn, PyTorch, XGBoost, Recharts, D3
- Deployment platforms: Vercel, Railway/Render

---

If you want, I can also add a `LICENSE` file, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` to complete the standard public-repo documentation set.
