# Ledger and Reconciliation Functional Specification

## 1. Ledger Model
- Immutable, double-entry postings.
- Every financial event creates balanced debit/credit entries.
- No direct balance mutation without postings.

## 2. Balance Types
- **Available**: spendable immediately.
- **Pending**: awaiting external confirmation.
- **Reserved**: held for in-flight operations.

## 3. Transaction Lifecycle
1. Validate request, limits, risk, compliance.
2. Reserve or debit source funds.
3. Dispatch to provider rail.
4. Apply status update from webhook/polling.
5. Finalize posting or reverse/release.

## 4. Idempotency and Consistency
- All transfer initiation endpoints require idempotency keys.
- Duplicate requests must return original transaction reference.
- Global transaction references are immutable and unique.

## 5. Reconciliation Flows
- Intraday reconciliation for high-volume rails.
- End-of-day settlement matching by provider and country.
- Exception queue with categorized break reasons:
  - missing provider reference
  - amount mismatch
  - status mismatch
  - duplicate settlement entry

## 6. Operational Controls
- Four-eyes approval for manual adjustment postings.
- Full audit logs for any correction.
- Daily signed settlement report exports.
