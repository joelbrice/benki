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

## 9. Products added on top of the core

| Control | Implementation | Verified by |
| --- | --- | --- |
| Bank transfers only after the bank confirms the account holder's name, re-checked at send time (catches typos and recycled accounts) | `routes/customer.ts` `resolveBankAccount`, `payments.ts` `draftBankTransfer` | `products.test.ts` |
| Bank payouts settle asynchronously, reconcile like mobile money and refund in full on failure | `EXTERNAL_RAIL_TYPES` in `providers.ts`, `settlement.ts`, `reconciliation.ts` | `products.test.ts` |
| USSD gateway authenticated by shared key; per-phone rate limit; simulator refused in production | `routes/ussd.ts`, `config.ts` | `products.test.ts`, `security.test.ts` |
| USSD payments use the same pipeline (PIN, limits, screening, ledger) and one payment per session (gateway retries replay) | `services/pipeline.ts`, `services/ussd.ts` | `products.test.ts` |
| Group payouts need a quorum of members other than the recipient; executed through the normal payment pipeline in a savepoint | `services/groups.ts` | `products.test.ts` |
| Group pools are owned by the group, not a person, and can't go negative | `GROUP_POOL` account kind | `products.test.ts` |
| Loans: Tier 1, active account, no open case or alert (generic reason, no tipping off), income history, ceiling from limits and inflows, explicit consent, fee-first repayment | `services/loans.ts` | `products.test.ts` |
| Currency pockets: single-use 60 s quotes, disclosed margin; buying counts against local-currency limits and is screened; pockets count toward the balance cap at the reference rate | `services/pockets.ts`, `limits.ts` `LOCAL_CURRENCY_ONLY`, `users.ts` `totalHoldings` | `products.test.ts` |
| Payment requests can't be paid twice, even while the first payment is held for review; anti-spam caps; only the payer can pay or decline | `services/requests.ts`, `approveHeldTransaction` | `products.test.ts` |

## 10. Language and accessibility

Ten languages: English, French, Portuguese, Spanish, Arabic, Kiswahili, Lingala, Hausa, Yorùbá and Wolof. All customer-facing text — app screens, API error messages, payment confirmations, notifications (also the SMS body) and every USSD screen — comes from typed catalogs in `packages/shared/src/i18n`. A test fails if any language misses a key or changes a placeholder (`i18n.test.ts`). Amounts are formatted per language and the apps accept both `1,250.50` and `1 250,50`, and Arabic-Indic digits. Arabic is laid out right-to-left on web and mobile, but amounts, PINs and phone numbers always use Latin digits so they read the same on every channel, and phone numbers are isolated so their `+` stays in front. USSD language menus only list the market's languages plus English and French, so a screen fits in one UCS-2 message. Compliance wording stays generic in every language (no tipping off). The mobile app gives every tab, tile and control an accessible name and hides decorative icons from screen readers.

## 11. Markets, Central Africa (CEMAC) exchange control and due diligence

| Control | Implementation | Verified by |
| --- | --- | --- |
| Transfers inside CEMAC (same XAF) settle at par: no exchange margin, regional fee only | `shared/zones.ts` `corridorPolicy`, `services/fx.ts` | `products.test.ts` |
| Transfers from CEMAC to outside the zone need Tier 2 (BEAC exchange regulation: identified customer and documented purpose) | `corridorPolicy().minTier`, `err.cemacOutbound` | `products.test.ts` |
| No foreign-currency (USD/EUR) pockets for CEMAC residents | `pocketsAllowed`, `services/pockets.ts` | `products.test.ts` |
| XOF ↔ XAF is treated as a foreign exchange (different central banks), with the normal margin | `corridorPolicy` | `products.test.ts` |

| Conflict-affected jurisdictions (flagged per country module) need Tier 2 on every corridor in or out | `enhancedDueDiligence`, `corridorPolicy`, `err.eddCorridor` | `countries.test.ts` |
| Planned markets are closed: no sign-up, no transfers in, no USSD, no seeded agents | `services/auth.ts`, `services/fx.ts`, `services/ussd.ts`, `services/seed.ts` | `countries.test.ts` |
| Every market has a rate, limits that rise by tier, partners, unique identifiers and an unambiguous dialling code | `packages/shared/src/countries/*` | `countries.test.ts` |

These encode our reading of Règlement n°02/18/CEMAC/UMAC/CM (exchange control) and must be confirmed with local counsel before launch.

## 12. Platform hardening

Security headers, no `x-powered-by`, CORS allow-list, 16 KB body limit, JSON errors with correlation IDs, and a generic 500 that never leaks internals (`http/middleware.ts`, `app.ts`). In production, `loadConfig` refuses to boot with a development data key or webhook secret, an exposed OTP, seeded demo staff, or localhost CORS origins. Verified in `security.test.ts`.
