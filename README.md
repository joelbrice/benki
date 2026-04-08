# Benki — Bank Without Borders

Benki is an African-focused "banking without borders" initiative aimed at enabling simple, safe financial access for rural and underserved users.

This repository now includes:

- a **documentation blueprint** for product, architecture, compliance, and operations
- a **thin Android vertical slice** demonstrating:
  - onboarding
  - tiered KYC progression
  - wallet creation
  - internal transfer
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

## App scope in this repository

This project is currently an Android starter implementation of the user journey and domain concepts.
Provider integrations (mobile money, banks, PayPal connectors), production KYC vendors, and multi-country backend services are documented and intended for subsequent backend modules.
