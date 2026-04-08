# API Specification (Platform Contracts)

## 1. Conventions
- REST/JSON with versioned paths `/v1/*`
- Idempotency required for money-moving endpoints
- Correlation ID for tracing
- OAuth2/JWT for client and service auth

## 2. Key API Domains
### Identity and KYC
- `POST /v1/auth/otp/send`
- `POST /v1/auth/otp/verify`
- `POST /v1/kyc/tier0`
- `POST /v1/kyc/tier1`
- `POST /v1/kyc/tier2`
- `GET /v1/kyc/status`

### Wallet and Ledger
- `POST /v1/wallets`
- `GET /v1/wallets/{walletId}`
- `GET /v1/wallets/{walletId}/balances`
- `GET /v1/wallets/{walletId}/transactions`

### Transfers
- `POST /v1/transfers/internal`
- `POST /v1/transfers/mobile-money`
- `POST /v1/transfers/bank`
- `POST /v1/transfers/cross-border`
- `GET /v1/transfers/{transferId}`

### Reconciliation and Reporting
- `GET /v1/reconciliation/settlements`
- `GET /v1/reconciliation/exceptions`

## 3. Transfer Request Contract (Example)
- `idempotencyKey`
- `sourceAccountId`
- `destination`
- `amount`
- `currency`
- `railPreference` (optional)
- `purposeCode` (where required)

## 4. Provider Adapter Contract
- `authorize()`
- `quote()`
- `initiateTransfer()`
- `fetchStatus()`
- `handleWebhook()`
- `reconcileBatch()`

All adapters must return normalized status values:
- `PENDING`
- `COMPLETED`
- `FAILED`
- `REVERSED`

## 5. Error Taxonomy
- Validation errors
- Authentication/authorization errors
- Provider unavailable/retryable errors
- Compliance block errors
- Insufficient funds/limit breach errors
