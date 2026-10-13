# Country Compliance Matrix (Template)

This matrix is a governance artifact and must be maintained per country launch.

| Country | License Model | KYC Tiers Allowed | AML Reporting Authority | Data Residency | Consumer Protection Requirements | Mobile Money Partners | Bank Rail Partners | Cross-Border Permissions |
|---|---|---|---|---|---|---|---|---|
| Kenya | E-money / PSP (example) | Tier 0/1/2 | FIU / Central Bank | Local + approved cloud | Disclosure, complaints SLA, fee transparency | TBD | TBD | Corridor-by-corridor |
| Ghana | E-money / PSP (example) | Tier 0/1/2 | FIU / Central Bank | Local constraints | Disclosure + redress process | TBD | TBD | Corridor-by-corridor |
| Nigeria | Switching/PSP/Bank sponsor (example) | Tier 0/1/2 | NFIU / CBN pathways | Jurisdiction-driven | Customer communication and dispute handling | TBD | TBD | Corridor-by-corridor |
| Tanzania | E-money / PSP (example) | Tier 0/1/2 | FIU / Regulator | Local constraints | Transparent fees and records | TBD | TBD | Corridor-by-corridor |
| Senegal (WAEMU) | E-money (EME) under BCEAO (example) | Tier 0/1/2 | CENTIF | WAEMU constraints | BCEAO consumer rules, fee disclosure | Orange Money, Wave | TBD | XOF zone at par; others corridor-by-corridor |
| Cameroon (CEMAC) | Payment-services institution / e-money under COBAC — Règlement n°04/18/CEMAC/UMAC/COBAC (example) | Tier 0/1/2 | ANIF Cameroun; GABAC regional standards | CEMAC / national constraints | Fee disclosure, complaints handling | MTN MoMo, Orange Money | TBD (RIB, 23 characters) | Intra-CEMAC at par; outbound under Règlement n°02/18/CEMAC/UMAC/CM (exchange control) |
| Central African Republic (CEMAC) | As Cameroon (COBAC licence, passportable within CEMAC — confirm) | Tier 0/1/2 | ANIF RCA | As above | As above | Orange Money, Moov Money | TBD | As Cameroon |
| Chad (CEMAC) | As Cameroon | Tier 0/1/2 | ANIF Tchad | As above | As above | Airtel Money, Moov Money | TBD | As Cameroon |
| Republic of the Congo (CEMAC) | As Cameroon | Tier 0/1/2 | ANIF Congo | As above | As above | MTN MoMo, Airtel Money | TBD | As Cameroon |
| Equatorial Guinea (CEMAC) | As Cameroon | Tier 0/1/2 | ANIF Guinea Ecuatorial | As above | As above | GETESA, Muni Dinero | TBD | As Cameroon |
| Gabon (CEMAC) | As Cameroon | Tier 0/1/2 | ANIF Gabon | As above | As above | Airtel Money, Moov Money | TBD | As Cameroon |
| DR Congo | E-money institution licensed by the Banque Centrale du Congo (example) | Tier 0/1/2 | CENAREF | National constraints | BCC consumer protection | M-Pesa, Orange Money, Airtel Money | TBD | Corridor-by-corridor (CDF; USD widely used — needs counsel) |

The 42 planned markets are listed with their supervisor, currency and launch stage in [`MARKET_EXPANSION.md`](MARKET_EXPANSION.md); each gets a full row here as it is prepared for launch.

CEMAC rows are a working assumption for product design, not legal advice: confirm licences, passporting, limits and FIU reporting formats with counsel in each country before launch.

## Required Fields Per Country
- Legal entity and local sponsor details
- Regulator circular references
- Approved onboarding/KYC methods
- Maximum balance and transaction limits by tier
- Prohibited transaction categories
- Complaint handling SLA and escalation
- Reporting obligations (daily/weekly/monthly)

## Governance Cadence
- Monthly legal and compliance review
- Quarterly risk and controls review
- Immediate update after regulatory changes
