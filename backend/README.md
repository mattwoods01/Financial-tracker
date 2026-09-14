# Ledger API

FastAPI backend for the Ledger personal finance tracker. Owns the data (users,
transactions, debts, settings) and the allocation waterfall logic, so both a
future web app and a React Native mobile app can share one source of truth
instead of duplicating the math client-side.

## What's included

- **Auth** — email/password registration and login, JWT-based sessions
- **Settings** — salary, take-home pay, 401(k) contribution %, employer match,
  emergency fund target, Roth/Traditional split preference
- **Transactions** — income/expense logging by date, category, amount
- **Debts** — balance, APR, minimum payment (flags anything ≥7% APR as "high interest")
- **Allocate** — runs the waterfall (match → high-interest debt → emergency
  fund → 401(k) up to the 2026 IRS limit, split Roth/Traditional → brokerage →
  checking buffer) using the user's current settings, debts, and this month's
  transactions

## Running locally

```bash
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # defaults to a local SQLite file — no setup needed
uvicorn app.main:app --reload
```

The API is now at `http://127.0.0.1:8000`. Interactive docs (Swagger UI) are
at `http://127.0.0.1:8000/docs` — useful for poking at endpoints by hand
before you wire up a frontend.

## Switching to Postgres

Local dev uses SQLite by default so there's zero setup. For anything beyond
your own laptop, install the Postgres driver and switch `.env`:

```bash
pip install -r requirements-postgres.txt
```

```
DATABASE_URL=postgresql://user:password@localhost:5432/ledger
```

`psycopg2-binary` is deliberately kept out of the main `requirements.txt` —
it needs to compile from source on some platforms/Python versions if no
prebuilt wheel is available yet, which fails without PostgreSQL's
`pg_config` installed. Keeping it optional means SQLite-only local dev never
has to deal with that. Once you're on Postgres for real, also replace the
`Base.metadata.create_all` call in `app/main.py` with proper Alembic
migrations — `create_all` is fine for getting started but won't handle
schema changes safely later.

## API overview

| Method | Path                  | Auth | Description |
|--------|-----------------------|------|-------------|
| POST   | `/auth/register`      | no   | Create an account |
| POST   | `/auth/login`         | no   | Get a JWT (form fields: `username`=email, `password`) |
| GET    | `/settings`           | yes  | Get your financial settings |
| PUT    | `/settings`           | yes  | Update your financial settings |
| GET    | `/transactions`       | yes  | List your transactions |
| POST   | `/transactions`       | yes  | Add a transaction |
| DELETE | `/transactions/{id}`  | yes  | Delete a transaction |
| GET    | `/debts`              | yes  | List your debts |
| POST   | `/debts`              | yes  | Add a debt |
| DELETE | `/debts/{id}`         | yes  | Delete a debt |
| GET    | `/allocate`           | yes  | Get the recommended monthly allocation waterfall |

Authenticated requests need `Authorization: Bearer <token>`.

## Project layout

```
app/
  main.py          FastAPI app, CORS, router wiring
  config.py        Settings loaded from environment/.env
  database.py      SQLAlchemy engine/session
  models.py        ORM models: User, UserSettings, Transaction, Debt
  schemas.py       Pydantic request/response shapes
  auth.py          Password hashing (bcrypt) + JWT helpers
  allocation.py    The waterfall calculation (ported from the original
                    React artifact's computeAllocation function)
  routers/
    auth.py
    settings.py
    transactions.py
    debts.py
    allocate.py
```

## Notes on choices made here

- **bcrypt directly, not passlib** — `passlib`'s bcrypt wrapper has a known
  incompatibility with bcrypt 4.1+ that throws a spurious "password cannot be
  longer than 72 bytes" error during its own internal self-test. Hashing with
  `bcrypt` directly sidesteps it entirely and is one less dependency.
- **`create_all` instead of migrations, for now** — fine while the schema is
  still moving. Swap to Alembic before this touches a real user's data.
- **JWTs, not sessions** — works cleanly for both a web frontend and a mobile
  app hitting the same API without cookie/session complications.
