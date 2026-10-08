# Platform Guardrails

How Benki's controls are implemented and verified. Paths are relative to `backend/src` unless noted; tests live in `backend/test`.

## 1. Money integrity

| Control | Implementation | Verified by |
| --- | --- | --- |
| Double-entry: every entry nets to zero per currency | `services/ledger.ts` `postEntry` | `ledger.test.ts` |
| Postings, journal entries and audit log are append-only | SQLite triggers in `db/schema.ts` | `ledger.test.ts` |
| Posting currency must match its account | Trigger `postings_currency_matches_account` | `ledger.test.ts` |
| Customer wallets, vaults and agent float never go negative or into held funds | `postEntry` available-balance check, rolled back atomically | `ledger.test.ts`, `payments.test.ts` |
| Balances are derived from postings, never stored | `balanceOf` / `walletView` | `ledger.test.ts` |
| Every money movement is atomic | `withTx` (`BEGIN IMMEDIATE`, savepoints); handlers are synchronous so requests can't interleave | all payment tests |
| Held payments post exactly what was assessed | Postings derived from the stored transaction row (`postingsFor`) | `aml.test.ts` (approve flow) |
| Idempotency, with conflict detection on key reuse | `services/idempotency.ts`; the claim rolls back with the payment on failure | `payments.test.ts` |
| Corrections only by compensating entries | `reverseEntry`; reversals and adjustments go through four-eyes approval | `backoffice.test.ts` |
| Trial balance check | `GET /v1/admin/ledger/trial-balance` | `ledger.test.ts`, `payments.test.ts` |
| Integer minor units only; strict amount validation | `lib/validation.ts` | `security.test.ts` |

## 2. AML / CFT

| Control | Implementation | Verified by |
| --- | --- | --- |
| Sanctions & PEP screening at KYC (fuzzy name match + DOB) | `services/screening.ts`, `services/kyc.ts` | `aml.test.ts` |
| Confirmed match → frozen + critical alert; potential match/PEP → held for human decision | `kyc.ts` | `aml.test.ts` |
| Only supervisors can clear a watchlist hit | `resolveScreeningAlert` | `aml.test.ts` |
| A confirmed sanctions match can never be unfrozen | `compliance.ts`, `approvals.ts` | `backoffice.test.ts` |
| One identity, one account (keyed hash of national ID) | `kyc.ts` | `aml.test.ts` |
| Minimum age 18 | `kyc.ts` | API smoke |
| Transaction monitoring (structuring, velocity, mule pass-through, dormant reactivation, cross-border EDD, first-time high-value payee) | `services/risk.ts` | `aml.test.ts`, `payments.test.ts` |
| Payments to frozen/sanctioned counterparties blocked, attempt recorded | `risk.ts` `RESTRICTED_COUNTERPARTY` | `aml.test.ts` |
| Alerts grouped into cases; notes; closure needs held payments decided first | `services/compliance.ts` | `aml.test.ts` |
| STR filing (goAML-style payload), supervisor-only, narrative required | `fileStr` | `aml.test.ts` |
| No tipping off: customers only ever see "processing" or a generic failure; STRs are never notified | `views.ts` `customerStatus`, `lib/errors.ts` | `aml.test.ts` |

Rule thresholds live in `RISK_RULES` (`services/risk.ts`). Per `docs/KYC_AML_POLICY_AND_RISK.md` §4, production tuning must go through a versioned, approved rules store.

## 3. Limits and service gating

Per-country, per-tier limits in `packages/shared/src/limits.ts`: per transaction, rolling 24 h, rolling 30 days, and maximum total holdings (wallet + savings). Recipients are capped too, without revealing their tier. Cross-border sending needs Tier 1. Enforced in `services/limits.ts` and verified in `payments.test.ts`.

## 4. Fraud and account security

| Control | Implementation | Verified by |
| --- | --- | --- |
| OTP: hashed, 5-minute expiry, 5 attempts, 30 s resend cooldown, 5 sends/hour | `services/auth.ts` | `security.test.ts` |
| Sessions bound to device ID, 12 h expiry, hashed at rest, revoked on freeze | `auth.ts`, `http/auth.ts` | `security.test.ts`, `backoffice.test.ts` |
| New-device sign-in alerts the customer; high-value payments from a new device are held | `auth.ts`, `risk.ts` | `aml.test.ts` |
| SIM-swap signal holds outgoing payments | `risk.ts`, `TelcoSignals` | `aml.test.ts` |
| Transaction PIN: scrypt-hashed, weak-PIN rules, 3-attempt lockout persisted outside the payment transaction | `services/pin.ts` | `payments.test.ts` |
| Rate limiting (global, OTP, money movement, staff login) | `http/middleware.ts` | config |
| Staff lockout after 5 failed logins | `services/staff.ts` | `backoffice.test.ts` |

## 5. Data protection

- National IDs are AES-256-GCM encrypted at rest and looked up via a keyed hash (`lib/crypto.ts`, `kyc.ts`). Analysts see them masked; supervisors see them decrypted, and every customer-record view is audited. Verified in `aml.test.ts` and `backoffice.test.ts`.
- Request logs record method, route, status and latency only — no bodies, phone numbers or tokens.
- PINs never reach storage, including idempotency hashes (`requestHashOf`).
- CSV statements neutralize spreadsheet formula injection (`services/statements.ts`).

## 6. Segregation of duties

- **Four-eyes (maker-checker):** reversals, unfreezes and manual adjustments are requested by one staff member and executed only when a *different* supervisor approves (`services/approvals.ts`). Failures are recorded rather than silently retried.
- **Role-based access:** releasing held funds, clearing watchlist hits, filing STRs and reading the audit log need SUPERVISOR or ADMIN.

Verified in `backoffice.test.ts` and `aml.test.ts`.

## 7. Auditability

The audit log is hash-chained: each entry commits to the previous entry's hash, and `GET /v1/admin/audit/verify` recomputes the chain. Even with the database triggers bypassed, any edit is detected (`backoffice.test.ts`). Every audit write happens in the same transaction as the change it records.

## 8. External rails

- Provider adapter contract (`authorize`, `quote`, `initiateTransfer`, `fetchStatus`, `handleWebhook`, `reconcileBatch`) per `docs/API_SPECIFICATION.md` §4, in `services/providers.ts`.
- Payouts post to a settlement account before dispatch; a provider outage or failure triggers a full refund (`services/settlement.ts`).
- Webhooks need an HMAC signature over timestamp + raw body, a timestamp within 5 minutes, and a never-seen event ID (`routes/webhooks.ts`).
- Polling fallback, plus re-dispatch of payouts that never reached the provider (`runSettlementOnce`).
- Reconciliation categorizes missing provider reference, amount mismatch, status mismatch, duplicate settlement and unmatched provider records (`services/reconciliation.ts`).

Verified in `payments.test.ts` and `backoffice.test.ts`.

## 9. Platform hardening

Security headers, no `x-powered-by`, CORS allow-list, 16 KB body limit, JSON errors with correlation IDs, and a generic 500 that never leaks internals (`http/middleware.ts`, `app.ts`). In production, `loadConfig` refuses to boot with a development data key or webhook secret, an exposed OTP, seeded demo staff, or localhost CORS origins. Verified in `security.test.ts`.
