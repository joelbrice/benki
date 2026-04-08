# Solution Architecture Document (SAD)

## 1. Architecture Principles
- API-first, modular services
- Ledger-centric money movement
- Security and compliance by design
- Country configurability over hardcoded logic
- Resilience for unreliable networks and provider outages

## 2. High-Level Components
- **Android Client**: onboarding, KYC capture, wallet, transfers, support, low-data mode.
- **Backoffice Web**: operations, compliance, disputes, reconciliations.
- **Core Services**:
  - Identity & KYC
  - Wallet/Ledger
  - Payments Orchestration
  - FX/Pricing
  - Risk/Fraud
  - Limits/Compliance Rules
  - Notifications
  - Reconciliation/Reporting
- **Integration Layer**:
  - Provider adapter interfaces
  - Per-rail connector implementations

## 3. Data Architecture
- **Ledger DB (ACID)**: immutable postings and balance snapshots.
- **Operational DB**: users, KYC status, limits, profiles, provider references.
- **Event Stream**: transactional and compliance events.
- **Analytics Warehouse**: BI, monitoring, risk analytics.

## 4. Security Architecture
- Encryption in transit (TLS 1.2+) and at rest.
- Key management via KMS/HSM-backed keys.
- Tokenization of sensitive identifiers.
- Device binding and risk-based authentication.
- RBAC and least-privilege service access.

## 5. Deployment Model
- Cloud-native containers with autoscaling.
- Multi-region strategy where regulation permits.
- Country-based tenancy and data residency controls.
- Blue/green deployments for critical services.

## 6. Integration Strategy
- Normalize provider APIs behind consistent internal contracts.
- Use idempotency keys for all transactional requests.
- Asynchronous webhooks + polling fallback.
- Reconciliation and exception management for all provider states.
