# Ledger — Web Frontend

React + Vite frontend for the Ledger personal finance tracker. This is a
direct port of the original Claude.ai artifact — same look, same panels
(Overview, Transactions, Debts, Allocate) — but it now talks to the FastAPI
backend over HTTP instead of the artifact's local `window.storage`.

## What changed from the artifact

- **Auth screen added.** The artifact never needed login; the API does. See
  `src/components/Login.jsx`.
- **`window.storage.get/set` → `fetch()` calls.** All API calls live in
  `src/api.js`. Every component fetches its own data on mount instead of one
  big object being loaded once.
- **The allocation waterfall is no longer computed client-side.** The backend
  now owns that logic (`GET /allocate`), so `Allocate.jsx` just displays
  whatever the server returns instead of recalculating it.
- **Field names are `snake_case`** (`gross_annual_salary`, `min_payment`,
  etc.) to match the API's schema exactly, instead of the artifact's
  `camelCase`.
- **The JWT is stored in `localStorage`.** This is a real deployed app now,
  not a Claude.ai artifact sandbox, so this is fine — it wasn't allowed
  inside the artifact specifically because that preview environment doesn't
  support browser storage APIs.

## Running locally

You need the backend running first (see `../backend/README.md`). By default
this expects it at `http://127.0.0.1:8000`.

```bash
npm install
cp .env.example .env    # points at your local backend; edit if it's elsewhere
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Building for production

```bash
npm run build
```

Outputs static files to `dist/` — deployable to any static host (Vercel,
Netlify, GitHub Pages, S3, etc.). Remember to set `VITE_API_URL` to your
deployed backend's URL before building, since Vite bakes environment
variables in at build time, not runtime.

## Project layout

```
src/
  main.jsx              Entry point
  App.jsx                Top-level auth gate + tab routing
  api.js                 All backend API calls
  index.css              Global styles (ledger theme, ported from the artifact)
  components/
    Login.jsx             Login / register screen
    Sidebar.jsx            Nav + logout
    Overview.jsx           Income/expense summary, spending chart
    Transactions.jsx       Add/list/delete transactions
    Debts.jsx               Add/list/delete debts
    Allocate.jsx            Settings form + server-computed waterfall
```

## Known gaps (worth doing next)

- No automatic logout on an expired/invalid token — a 401 just shows an
  error message inline instead of bouncing back to the login screen.
- No loading skeletons — panels show a plain "Loading…" line while fetching.
- No shared state cache — switching tabs re-fetches data every time instead
  of caching it. Fine for personal use, worth revisiting if this gets slow.
