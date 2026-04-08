# Security Architecture and Incident Response Runbook

## 1. Security Controls Baseline
- Encrypted transport and storage.
- Secrets management via managed vault/KMS.
- Strict service identity and least privilege.
- Device-level risk checks and step-up auth.
- Continuous vulnerability scanning in CI/CD.

## 2. Threat Model Priorities
- Account takeover
- Payment fraud and synthetic identities
- Insider misuse
- API abuse and credential stuffing
- Data exfiltration

## 3. Security Operations
- Centralized audit/event logging
- Alerting for auth anomalies, fraud spikes, and privileged changes
- Regular key rotation and access recertification

## 4. Incident Response Workflow
1. Detect and classify incident severity.
2. Contain (token revocation, account freeze, provider suspension if needed).
3. Eradicate and remediate root cause.
4. Recover services safely.
5. Post-incident review with control improvements.

## 5. Incident Severity Guidance
- **SEV1**: Active financial loss / widespread user impact.
- **SEV2**: Elevated risk with limited financial impact.
- **SEV3**: Localized issue, no confirmed loss.

## 6. Mandatory Artifacts
- Incident timeline
- Affected users and systems
- Loss estimate and exposure assessment
- Regulator/customer notifications where required
- Corrective action tracker
