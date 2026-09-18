# Benki — Bank Without Borders

Benki is an African-focused "banking without borders" initiative aimed at enabling simple, safe financial access for rural and underserved users.

This repository now includes:

- a **documentation blueprint** for product, architecture, compliance, and operations
- a **thin vertical slice**, implemented three times against the same mock backend, all demonstrating:
  - onboarding (phone + OTP)
  - tiered KYC progression (with per-tier transfer limits)
  - wallet creation and agent cash-in
  - internal P2P transfer (ledger-style double-entry postings, idempotent)
  - transaction history

## Documentation

All platform documentation is under `./docs`:

- `./docs/PRD.md`
- `./docs/SOLUTION_ARCHITECTURE.md`
- `./docs/COUNTRY_COMPLIANCE_MATRIX.md`
- `./docs/KYC_AML_POLICY_AND_RISK.md`
- `./docs/API_SPECIFICATION.md`
- `./docs/LEDGER_RECONCILIATION_SPEC.md`
- `./docs/SECURITY_AND_INCIDENT_RUNBOOK.md`
- `./docs/OPERATIONS_PLAYBOOK.md`

## Platform layout

| Path | What it is |
| --- | --- |
| `app/` | Original Android (Kotlin + Jetpack Compose) vertical slice, in-memory only, no network calls. |
| `backend/` | Mock API server (Express + TypeScript) implementing the onboarding/KYC/wallet/transfer subset of `docs/API_SPECIFICATION.md` against an in-memory ledger store. |
| `web/` | Web client (React + Vite + TypeScript) for the same flow, talking to `backend/`. |
| `mobile/` | Cross-platform client (Expo / React Native + TypeScript, iOS + Android + web) for the same flow, talking to `backend/`. |
| `packages/shared/` | TypeScript domain types and API contracts shared by `backend/` and `web/` (mirrored, not imported, into `mobile/` to keep Metro's bundler simple). |

`backend/`, `web/`, and `packages/shared/` are an npm workspace at the repo root. `mobile/` is a standalone Expo project with its own `package.json` and lockfile.

### Running it

```bash
npm install                 # installs backend + web + shared
npm run dev:backend         # http://localhost:4000
npm run dev:web             # http://localhost:5173, in a second terminal

cd mobile && npm install    # separate install
npm run web                 # or `npm run ios` / `npm run android` with a simulator/device
```

The backend is in-memory and resets on restart — it's a demo of the ledger model in `docs/LEDGER_RECONCILIATION_SPEC.md`, not a persistence layer. OTP codes are returned directly in the API response (`devOtp`) since there's no SMS provider wired up.

## App scope in this repository

This is a vertical-slice implementation of the user journey and domain concepts across Android, web, and cross-platform mobile, backed by a mock API.
Provider integrations (mobile money, banks, PayPal connectors), production KYC vendors, persistence, real authentication, and multi-country backend services are documented in `./docs` and intended for subsequent backend modules — see `docs/SOLUTION_ARCHITECTURE.md` for the target architecture this slice is a thin cut of.
