# Benki — Bank Without Borders

Benki is an African-focused "banking without borders" platform: simple, safe financial access for rural and underserved users across mobile money, agents, local billers, merchants and cross-border corridors.

The repository contains a working sandbox of the whole platform, modeled on five markets from `docs/COUNTRY_COMPLIANCE_MATRIX.md` (Kenya, Ghana, Nigeria, Tanzania, Senegal):

- **`backend/`** — the finance core: an append-only double-entry ledger on SQLite, AML/fraud risk engine, compliance case management, payments orchestration across every rail, and a back-office API. 51 automated tests.
- **`web/`** — the customer web app plus a compliance & operations console at `#/admin`.
- **`mobile/`** — the Expo (iOS + Android) customer app.
- **`packages/shared/`** — one set of API contracts, market catalog, tier limits and fee schedule used by all three.
- **`app/`** — the original Android (Kotlin/Compose) prototype, kept for reference.

Every control and where it's enforced is listed in **[`docs/PLATFORM_GUARDRAILS.md`](docs/PLATFORM_GUARDRAILS.md)**.

## What customers can do

| Feature | Notes |
| --- | --- |
| Sign in with phone + SMS OTP | Country-first; phone must match the country's calling code. Sessions are bound to the device. |
| Transaction PIN | Required for every outgoing payment. Weak PINs rejected; 3 wrong attempts lock it for 30 min. |
| Tiered KYC | Tier 0 on signup; Tier 1 = name, date of birth, national ID (screened against sanctions/PEP lists); Tier 2 = proof of address + liveness. |
| Agent cash-in / cash-out | Named agents per country; agents can't hand out more e-money than their float. |
| Send to a Benki user | Free, instant, idempotent. |
| Send to mobile money | M-Pesa, MTN MoMo, Orange Money, Wave, Tigo Pesa, AirtelTigo, OPay (sandbox adapters). Asynchronous settlement; failed payouts are refunded in full. |
| Send abroad | FX quote locked for 60 s, purpose code, recipient receives in their own currency. Tier 1+. |
| Bills | Prepaid electricity (returns a 20-digit meter token), water, pay-TV, school fees. |
| Merchant payments | Pay a shop by its merchant code; free for customers, merchants pay 1%. |
| Airtime | Any number on a local network. |
| Savings vaults | Up to 5 goals per customer. |
| History, statements, disputes | CSV statement from the ledger; dispute a payment within 120 days. |
| Fee transparency | Every payment shows fee and total before the PIN prompt (`GET /v1/pricing/quote`). |

## What staff can do (back office, `#/admin`)

Review queue for held payments · alert & case investigation · suspicious transaction report (STR) filing · customer 360 view (PII access is audited) · freeze accounts · four-eyes approvals for reversals, unfreezes and manual adjustments · dispute resolution · trial balance · provider reconciliation · tamper-evident audit log with chain verification.

Roles: **ANALYST** (investigate, reject, freeze), **SUPERVISOR** (release held funds, clear watchlist hits, file STRs, approve four-eyes requests), **ADMIN**.

## Running it

Requires Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install                 # backend + web + shared
npm run dev:backend         # API on http://localhost:4000 (SQLite at backend/data/benki.db)
npm run dev:web             # http://localhost:5173 — customers; http://localhost:5173/#/admin — staff

cd mobile && npm install    # separate Expo project
npm run web                 # or npm run ios / npm run android
```

```bash
npm test                    # backend test suite
npm run typecheck           # all workspaces
cd backend && npm run build && npm start   # production bundle
```

### Sandbox data

Development mode exposes the OTP in the API response (no SMS gateway is connected) and seeds demo staff accounts — **`analyst`, `supervisor`, `supervisor2`, `admin`**, password `Benki-Demo-2026!` (override with `BENKI_DEMO_STAFF_PASSWORD`). The server refuses to start with any of this in production.

Deterministic test triggers:

| Input | Behaviour |
| --- | --- |
| KYC name `Viktor Blackwood`, DOB `1968-03-14` | Confirmed sanctions match → account frozen, critical alert |
| KYC name close to a listed name (e.g. `Viktor Blackwod`) or `Octavia Sterling-Vance` | Potential match / PEP → verification held for analyst review |
| Customer phone ending `77` | Telco reports a recent SIM swap → outgoing payments held |
| Mobile money destination ending `4444` | Provider outage at dispatch → refunded, 502 |
| … ending `0000` | Payout fails at the provider → refunded |
| … ending `5555` / `9999` / `8888` | Reconciliation breaks: status mismatch / amount mismatch / duplicate settlement |
| 6th outgoing payment within an hour | Velocity rule → held for review |

### Configuration

| Variable | Purpose |
| --- | --- |
| `BENKI_DB_PATH` | SQLite file (default `./data/benki.db`) |
| `BENKI_DATA_KEY` | 32-byte base64 key for field encryption — **required in production** |
| `BENKI_WEBHOOK_SECRET` | HMAC secret for provider webhooks — **required in production** |
| `BENKI_CORS_ORIGINS` | Comma-separated allowed browser origins |
| `BENKI_EXPOSE_DEV_OTP`, `BENKI_SEED_DEMO_STAFF` | Sandbox conveniences; refused in production |
| `BENKI_PROVIDER_LATENCY_MS`, `BENKI_SETTLEMENT_INTERVAL_MS` | Sandbox provider timing |
| `VITE_API_BASE_URL` (web), `EXPO_PUBLIC_API_BASE_URL` (mobile) | API location for the clients |

## What this is not (yet)

Provider adapters, the watchlist, telco signals and FX rates are sandbox stand-ins behind real interfaces (`backend/src/services/providers.ts`); production needs licensed integrations, a screening vendor with list refresh, an SMS gateway, a rates feed, a managed database with backups, and HSM/KMS-held keys. Limits, fees and the market catalog are illustrative — real values come from the compliance matrix per launch. See `docs/SOLUTION_ARCHITECTURE.md` for the target architecture.

## Documentation

- [`docs/PLATFORM_GUARDRAILS.md`](docs/PLATFORM_GUARDRAILS.md) — every control, where it lives, and the test that proves it
- [`docs/PRD.md`](docs/PRD.md), [`docs/SOLUTION_ARCHITECTURE.md`](docs/SOLUTION_ARCHITECTURE.md), [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md)
- [`docs/COUNTRY_COMPLIANCE_MATRIX.md`](docs/COUNTRY_COMPLIANCE_MATRIX.md), [`docs/KYC_AML_POLICY_AND_RISK.md`](docs/KYC_AML_POLICY_AND_RISK.md), [`docs/LEDGER_RECONCILIATION_SPEC.md`](docs/LEDGER_RECONCILIATION_SPEC.md)
- [`docs/SECURITY_AND_INCIDENT_RUNBOOK.md`](docs/SECURITY_AND_INCIDENT_RUNBOOK.md), [`docs/OPERATIONS_PLAYBOOK.md`](docs/OPERATIONS_PLAYBOOK.md)
