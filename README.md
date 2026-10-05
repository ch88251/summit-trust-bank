# Summit Trust Bank — Test Automation Practice App

A simple, fictional online banking app: **React** (Vite) frontend, **FastAPI** backend, **PostgreSQL** database.
It's meant to be a target for UI and API test automation (Playwright, Selenium, Cypress, REST clients, etc.).

> Not a real bank. Do not put real personal or financial data in it.

## Quick start (Docker)

The root `Dockerfile` builds one image (`summit-bank`) holding both the React frontend and the FastAPI backend.
FastAPI serves the web app and the `/api` routes from a single process. Postgres runs in its own container.

```bash
docker compose up -d --build
```

| Service  | URL                                   |
|----------|---------------------------------------|
| Web app  | http://localhost:8080                 |
| API      | http://localhost:8080/api             |
| API docs | http://localhost:8080/docs (Swagger)  |
| Postgres | `localhost:5433`, db/user/pass `bank` |

Stop with `docker compose down`.

**The database is not persisted.** Postgres keeps its data in memory (`tmpfs`), so every `down` → `up` starts
from the default demo data. Restarting only the app container does *not* reset data. Use `POST /api/test/reset`
for that, which is also the fastest way to reset between tests.

### Running the image without compose

```bash
docker build -t summit-bank .
docker run -d -p 8080:8000 \
  -e DATABASE_URL=postgresql+psycopg://bank:bank@<db-host>:5432/bank \
  -e SECRET_KEY=change-me \
  summit-bank
```

(From inside a container, `localhost` refers to the container itself. To reach the Postgres from `docker compose up db`,
use `host.docker.internal:5433` together with `--add-host=host.docker.internal:host-gateway` on Linux.)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://bank:bank@localhost:5433/bank` | Postgres connection |
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing key |
| `TOKEN_TTL_MINUTES` | `60` | Login session length |
| `ENABLE_TEST_ENDPOINTS` | `true` | Enables `POST /api/test/reset` |
| `CORS_ORIGINS` | `http://localhost:5174` | Allowed origins for the Vite dev server |

### Demo users

| Username | Password   | Accounts                              |
|----------|------------|---------------------------------------|
| `demo`   | `Demo@123` | Checking, Savings, Brokerage (+ holdings) |
| `jane`   | `Jane@123` | Checking, Savings (no brokerage — "no brokerage" state on Trade) |

### Resetting data between tests

```bash
curl -X POST http://localhost:8080/api/test/reset
```

This drops every table and restores the seed data. Disable it by setting `ENABLE_TEST_ENDPOINTS=false` on the backend.

## Features

- **Login / Logout** — JWT auth (60 min TTL, stored in `localStorage` as `stb_token`). Profile menu on the right of the nav bar.
- **Accounts** — balances grouped by type; click an account for transaction history with a category filter.
- **Trade** — static market quotes (prices never change, so assertions stay deterministic), holdings with gain/loss,
  an order ticket with a **Review → Place Order** step, and order history.
- **Transfer & Pay** — tabs (`?tab=transfer|deposit|pay|payees`) for transfers between your own accounts,
  deposits/withdrawals, bill pay, and add/remove payees.
- **Deposit & Withdraw** — checking and savings only. Deposits are capped at **$10,000.00 per transaction**;
  withdrawals can't exceed the balance. Checking/savings detail pages have a "Deposit / Withdraw" button that
  opens the tab with the account preselected (`?tab=deposit&account=<id>`).
- Every transfer, deposit, withdrawal, payment and order returns a confirmation number
  (`TRF-…`, `DEP-…`, `WDL-…`, `PAY-…`, `ORD-…`).

## Automation-friendly details

- Key elements have `data-testid` attributes (e.g. `nav-accounts`, `login-username`, `login-submit`, `profile-menu-button`,
  `nav-logout`, `cash-type-deposit`, `cash-type-withdrawal`, `cash-account`, `cash-amount`,
  `cash-submit`, `cash-confirmation`, `deposit-withdraw-link`, `transfer-from`, `transfer-amount`, `transfer-success`, `transfer-confirmation`, `order-review`, `order-place`,
  `account-row-<id>`, `quote-row-<SYMBOL>`, `holding-row-<SYMBOL>`, `payee-delete-<id>`).
- Protected routes redirect to `/login` and return to the original page after login.
- Validation happens on both client and server, so there are negative cases to test at both layers:
  insufficient funds, deposits over $10,000, deposits to a brokerage account, same from/to account, more than 2 decimal places, selling shares you don't own,
  duplicate payees, non-numeric payee account numbers, accessing another user's account (404), missing/expired token (401).

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `{access_token, user}` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | |
| GET | `/api/accounts` | |
| GET | `/api/accounts/{id}` | |
| GET | `/api/accounts/{id}/transactions?category=&limit=` | |
| GET/POST | `/api/transfers` | `{from_account_id, to_account_id, amount, memo?}` |
| GET/POST | `/api/cash-transactions` | `{account_id, type: DEPOSIT\|WITHDRAWAL, amount, memo?}` |
| GET/POST | `/api/payees`, DELETE `/api/payees/{id}` | `{name, account_number, nickname?}` |
| GET/POST | `/api/payments` | `{from_account_id, payee_id, amount, memo?}` |
| GET | `/api/trade/quotes`, `/api/trade/quotes/{symbol}` | |
| GET | `/api/trade/portfolio/{account_id}` | |
| GET/POST | `/api/trade/orders` | GET needs `?account_id=`; POST `{account_id, symbol, side: BUY\|SELL, quantity}` |
| POST | `/api/test/reset` | Restore seed data |
| GET | `/api/health` | |

All endpoints except login, health and reset need `Authorization: Bearer <token>`.

## Local development (without Docker for app code)

```bash
docker compose up -d db                       # Postgres on :5433

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload                 # :8000

cd ../frontend
npm install
npm run dev                                   # http://localhost:5174 (proxies /api to :8000)
```

## Project layout

```
Dockerfile           Single image: builds the frontend, then serves it from FastAPI
docker-compose.yml   App image + in-memory Postgres
backend/app/
  main.py          FastAPI app, CORS, startup seeding, serves the built frontend
  models.py        SQLAlchemy models (users, accounts, transactions, transfers, cash transactions, payees, payments, holdings, orders)
  schemas.py       Pydantic request/response models
  security.py      Password hashing (PBKDF2) and JWT auth
  ledger.py        Shared money-movement helpers
  quotes.py        Static market data
  seed.py          Demo data + reset
  routers/         auth, accounts, payments (transfers, deposits/withdrawals, bill pay), trade, testing
frontend/src/
  App.jsx          Routes + auth guard
  components/      NavBar (menu + profile), Alert
  pages/           Login, Accounts, AccountDetail, Trade, TransferPay
  styles.css       Navy/gold banking theme
```
