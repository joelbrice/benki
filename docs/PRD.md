# Product Requirements Document (PRD)

## 1. Product Vision
Benki provides a single, trusted financial account experience for users in Africa and other emerging markets, especially rural and underserved populations. The platform connects fragmented ecosystems (mobile money, local banks, card rails, and compliant PayPal pathways where supported).

## 2. Objectives
- Increase access to essential banking services in low-connectivity and cash-heavy regions.
- Reduce friction for onboarding with tiered KYC.
- Enable domestic and cross-border transfers across multiple rails.
- Provide a secure and compliant fintech platform ready for multi-country scale.

## 3. User Segments
- Rural individuals and households
- Informal workers and gig earners
- Micro and small merchants
- Diaspora users sending remittances
- NGOs and cooperatives

## 4. Core User Outcomes
- Open an account with a phone number and progressively unlock limits.
- Hold and move money from one app across multiple ecosystems.
- Cash-in/cash-out through agents.
- Access statements, bill pay, airtime/data, and merchant payments.

## 5. Functional Scope
### 5.1 Onboarding and Identity
- Phone-first signup
- OTP verification
- Tiered KYC (Tier 0/1/2)
- Assisted onboarding for agent-led registration

### 5.2 Wallet and Accounts
- Multi-currency wallet abstraction
- Available, pending, and reserved balances
- Transaction history and exportable statements

### 5.3 Payments and Transfers
- Internal P2P transfers
- Mobile money interoperability
- Bank transfer interoperability
- Card push/pull integrations (where licensed)
- Cross-border corridor transfers
- PayPal connector interoperability (jurisdiction-dependent)

### 5.4 Cash and Merchant Services
- Agent cash-in/cash-out
- QR merchant acceptance
- Bill pay and airtime/data
- Merchant invoicing

## 6. Non-Functional Requirements
- Low-bandwidth app mode
- Offline-friendly UX with queued retries
- End-to-end security controls
- Full auditability
- Regionalized compliance and data governance

## 7. Success Metrics
- KYC completion by tier
- First successful transaction rate
- Failed transaction and reversal rates
- Cost per transaction by rail
- Fraud loss rate
- Monthly active users in target segments

## 8. Constraints and Assumptions
- Country-specific regulatory requirements vary significantly.
- Not all rails are available in all countries.
- Partner integrations require staged rollout and commercial agreements.
