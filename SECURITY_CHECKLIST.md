# Security Checklist for Public Release

Use this checklist before making the repository public.

## 1) Rotate credentials first (required)
- [ ] Rotate all database passwords and users that were ever committed.
- [ ] Rotate any API keys/tokens/secrets used by backend, frontend, CI, and cloud providers.
- [ ] Invalidate old credentials after replacement.

## 2) Remove secrets from Git tracking (required)
- [ ] Ensure `.env` and other secret files are ignored in `.gitignore`.
- [ ] Remove already-tracked secret files from Git index:
  - `git rm --cached .env`
  - `git rm --cached frontend/.env`
  - `git rm --cached frontend/.env.production`
- [ ] Remove local virtual environment from Git index if tracked:
  - `git rm --cached -r .venv`

## 3) If secrets were committed, clean history
- [ ] Rewrite Git history to remove secret blobs (`git filter-repo` or BFG).
- [ ] Force-push rewritten history to the public branch/repo.
- [ ] Re-clone and validate secret strings are gone.

## 4) Keep repo runnable without secrets
- [ ] Maintain `.env.example` (root) and `frontend/.env.example` with placeholder values only.
- [ ] Document required environment variables in `README.md`.
- [ ] Use managed host environment variables (Vercel/Render/Railway/Fly/Neon/Supabase).

## 5) Scan before public push
- [ ] Run a secrets scan (e.g., Gitleaks) locally.
- [ ] Enable GitHub secret scanning & push protection in repository settings.
- [ ] Review pull request diff for accidental secrets.

## 6) Data safety
- [ ] Do not commit private production datasets.
- [ ] Use synthetic/anonymized sample data for demo artifacts.
- [ ] Verify model artifacts do not expose sensitive records.

## 7) Final publish gate
- [ ] `README.md` includes architecture, setup, and demo links.
- [ ] Live demo URLs are production-safe and non-sensitive.
- [ ] All credentials now come from runtime environment variables.
