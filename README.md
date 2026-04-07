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
# Nuu Mobile — Churn Prediction & Analytics

An end-to-end churn prediction platform built for Nuu Mobile. This repo contains a React dashboard and a Flask backend that together support CSV upload → data ingestion → feature processing → model training → batch prediction → analytics dashboards.


Project summary
---------------
End-to-end churn analytics platform (React + Vite frontend, Flask backend, PostgreSQL) with production-style ingestion, model training (MLP / XGBoost / CatBoost / TabNet variants), batch prediction, and interactive dashboards for retention decisions.

Key features
------------
- Upload CSVs to run batch scoring and populate analytics dashboards
- Automated preprocessing and feature pipelines (sklearn / pandas / custom transforms)
- Multiple model types supported: PyTorch MLP, XGBoost/CatBoost pipelines; TabNet scaffolding available
- Robust ingestion: header normalization, alias mapping, dropping malformed columns
- Training orchestration: background training, progress tokens, and production-safe artifacts
- Predictions API with batch import, persistence, and dashboard integration
- Frontend charts (Chart.js) with graceful fallbacks and friendly messaging

Tech stack
----------
- Frontend: React, Vite, Chart.js, react-bootstrap
- Backend: Python, Flask, pandas, scikit-learn, PyTorch (MLP), XGBoost/CatBoost
- Database: PostgreSQL (psycopg2)
- Dev / Deployment: Docker (optional), Vercel (frontend), Railway / Render / Cloud Run (backend)

Repository layout
-----------------
- `backend/` — Flask app, training scripts, ingestion & DB code (entry: `backend/app.py`)
- `frontend/` — React dashboard application
- `docs/` — deployment and resume material
- `models/` — trained model artifacts and metadata

Running locally (quick)
-----------------------
These are minimal steps for a local demo (zsh):

1) Backend (venv)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# run the Flask app for local testing
flask run --host=0.0.0.0 --port=5000
```

Health check:

```bash
curl http://127.0.0.1:5000/health
```

2) Frontend (dev)

```bash
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

3) Optional: run with Docker Compose

```bash
docker compose up --build
```

Important endpoints
-------------------
- `POST /upload` — upload CSVs for ingestion
- `GET /dashboard_data` — aggregated counts used by dashboard charts
- `POST /train` — start model training; progress tracked via JSON token files
- `POST /predict_batch` — insert a batch of records to score

Recent updates and why they matter
---------------------------------
A few recent changes worth calling out:

- Real-world CSVs are messy. Header normalization and dropping `Unnamed:*` garbage columns prevents runtime SQL errors caused by invalid identifiers.
- SQL identifiers are now quoted securely and upserts are generated to tolerate schema drift so ingestion can accept extra optional columns without breaking.
- Training progress is surfaced via JSON tokens and the frontend now shows backend errors promptly instead of timing out silently.
- Simple alias mapping handles common typos (for example `App Uage (s)` → `app_usage_seconds`), so the dashboard populates without manual CSV fixes.

Overview
--------
This project provides a complete pipeline for churn analytics: data ingestion from CSVs, automated preprocessing and feature extraction, model training, batch prediction, and interactive dashboards. The design emphasizes resiliency at the ingestion boundary and clear separation of responsibilities between frontend and backend.

Suggested demo script (3–5 minutes)
----------------------------------
1. Show the dashboard UI and explain charts (activation counts, age-range, app-usage, feature importance).
2. Upload `UW_Churn_Pred_Data_Full.csv` (or the provided sample) and show how ingestion populates dashboard counts.
3. Start a training run from the UI; open the backend logs or show the training progress displayed by the frontend.
4. Run a batch prediction and show persisted predictions and where they are visible in the dashboard.

Artifacts
---------
- Model metrics (stored under `models/` or `backend/` as JSON; e.g., `MLP_metrics.json`)
- Feature importances (`MLP_importance.json`, `trained_features.json`)
- Example checks to add: smoke tests for ingestion and training (pytest)

Future improvements
-------------------
- Add a schema validation endpoint and a frontend pre-upload validator to give users immediate feedback about required columns.
- Add automated tests (pytest) for ingestion, model training, and the predictions API.
- Add CI/CD to test and deploy the backend automatically and run smoke checks against a staging DB.
- Replace file-based training tokens with a small job queue (Redis / Cloud Tasks / Celery) for scale.

Notes for non-technical reviewers
--------------------------------
- Built for Nuu Mobile to demonstrate the full data → insight lifecycle.
- Highlights practical engineering: production-minded ingestion, DB resilience, model lifecycle handling, and attention to UX (clear errors and graceful charting).

Contact / next steps
--------------------
A short demo recording (2–4 minutes) can be prepared on request to show: upload → train → predict → dashboard updates.

See also
--------
- `docs/DEPLOYMENT.md` — deployment options and recommended steps
- `docs/RESUME.md` — suggested resume bullets and talking points
- `SECURITY_CHECKLIST.md` — steps to prepare repository for public release

---
*Last updated: April 7, 2026 — README revised to reflect ingestion hardening, alias mapping, training UX improvements, and frontend resiliency.*
