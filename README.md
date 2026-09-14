# Ledger

A personal finance tracker: log income/expenses/debts, and get a recommended
monthly split across 401(k) (with Roth/Traditional), high-interest debt
payoff, an emergency fund, brokerage/IRA, and checking.

This is a monorepo — one git history for both pieces, since they evolve
together (a change to the allocation logic or a settings field usually
touches both at once).

```
ledger/
  backend/     FastAPI + SQLAlchemy API — owns the data and the allocation math
  frontend/    React + Vite web app — talks to the backend over HTTP
```

Each has its own README with full details. Quick start for both:

```bash
# 1. Backend — in one terminal
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# 2. Frontend — in a second terminal
cd frontend
npm install
cp .env.example .env            # Windows: copy .env.example .env
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Why `venv` and `node_modules` aren't at the repo root

They live inside `backend/` and `frontend/` respectively because that's
where each one's manifest file is (`requirements.txt`, `package.json`).
Python and Node tooling both expect the dependency folder next to the file
that declares the dependencies — that's not a git decision, and moving them
to the repo root wouldn't work cleanly with either toolchain. Both are
gitignored either way, so they never end up in the repo itself.

## Roadmap

- [x] Backend API (auth, settings, transactions, debts, allocation waterfall)
- [x] Web frontend
- [ ] React Native mobile app, reusing `frontend/src/api.js` almost unchanged
- [ ] Deploy the backend somewhere real (Postgres instead of SQLite, proper
      secrets, HTTPS) once this is more than a local dev project
