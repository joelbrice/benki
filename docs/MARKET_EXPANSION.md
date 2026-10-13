# Market Expansion

Benki is built for Africa, one country at a time. Every one of the 54 African
countries has its own module in `packages/shared/src/countries/` (`cm.ts`,
`ng.ts`, `za.ts`, …) holding everything the platform needs to operate there:

- currency, dialling code and monetary union (CEMAC, WAEMU, Common Monetary Area)
- supervisor, launch stage and enhanced-due-diligence flag
- default and offered languages
- mobile money operators, mobile networks for airtime, agents, billers, merchants and banks
- e-money limits for each verification tier, in local minor units

Cameroon is the first market, and Central Africa (the six CEMAC states and the
DRC) is listed first everywhere. Twelve markets are **live**; the other 42 are
**planned**: fully described, shown to customers as "coming soon", and closed to
sign-ups, transfers and USSD until launch.

## Launching a planned market

1. **Licence and partners.** Confirm the licence route and supervisor with counsel;
   sign the mobile money, bank-rail, biller and agent-network partners. Replace the
   placeholder operators, agents (`Benki Point …`), billers, merchants and banks in
   the country module with the real ones and their account-number formats.
2. **Limits and fees.** Set the tier limits from the regulator's e-money rules (the
   scaffolded figures are USD-equivalent placeholders). Check
   `FX_UNITS_PER_USD` in `catalog.ts` has a rate for the currency from the live
   rates feed.
3. **Languages.** Confirm `languages.default` and `languages.offered`. If a needed
   language is missing (e.g. Amharic, Somali, Kinyarwanda, Malagasy), add a catalog
   in `packages/shared/src/i18n/` — the i18n test enforces every key and placeholder
   — and have it reviewed by native-speaking financial translators.
4. **Compliance.** Add the country's row to `COUNTRY_COMPLIANCE_MATRIX.md` (FIU,
   reporting formats, data residency, consumer-protection rules) and wire its
   screening lists and regulatory reports.
5. **Switch on.** Set `launch: "LIVE"`. Sign-up, agents, merchants, transfers in
   and out, USSD and the apps' country pickers pick it up automatically.
6. **Verify.** `npm test` runs the catalog checks in `backend/test/countries.test.ts`
   (unique identifiers, unambiguous dialling codes, a rate, limits and partners for
   every market) along with the full suite.

## Markets

| Country | Module | Stage | Region | Currency · union | Supervisor (illustrative) | Languages | Mobile money (sandbox) | Notes |
|---|---|---|---|---|---|---|---|---|
| Cameroon | `cm.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | fr, en | MTN Mobile Money, Orange Money, Express Union Mobile Money | |
| Gabon | `ga.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | fr | Airtel Money, Moov Money | |
| Republic of the Congo | `cg.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | fr, ln | MTN Mobile Money, Airtel Money | |
| Chad | `td.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | fr, ar | Airtel Money, Moov Money | |
| Central African Republic | `cf.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | fr | Orange Money, Moov Money | |
| Equatorial Guinea | `gq.ts` | Live | Central | XAF · CEMAC | COBAC / BEAC | es, fr, pt | GETESA Mobile Money, Muni Dinero | |
| DR Congo | `cd.ts` | Live | Central | CDF | Banque Centrale du Congo | fr, ln, sw | M-Pesa (Vodacom), Orange Money, Airtel Money | |
| Angola | `ao.ts` | Planned | Central | AOA | Banco Nacional de Angola | pt, en | Unitel Money, Afrimoney | |
| São Tomé and Príncipe | `st.ts` | Planned | Central | STN | Banco Central de São Tomé e Príncipe | pt, fr | — (bank-led) | |
| Nigeria | `ng.ts` | Live | West | NGN | Central Bank of Nigeria | en, ha, yo | MTN Mobile Money, OPay | |
| Ghana | `gh.ts` | Live | West | GHS | Bank of Ghana | en, ha | MTN Mobile Money, AirtelTigo Money | |
| Senegal | `sn.ts` | Live | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, wo, en | Orange Money, Wave | |
| Côte d'Ivoire | `ci.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, en | Orange Money, MTN Mobile Money, Moov Money, Wave | |
| Benin | `bj.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, yo, en | MTN Mobile Money, Moov Money | |
| Burkina Faso | `bf.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, en | Orange Money, Moov Money | |
| Mali | `ml.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, en | Orange Money, Moov Money, Wave | |
| Niger | `ne.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, ha, en | Airtel Money, Moov Money, Zamani Cash | |
| Togo | `tg.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | fr, en | TMoney, Flooz (Moov Africa) | |
| Guinea-Bissau | `gw.ts` | Planned | West | XOF · WAEMU | BCEAO / Commission Bancaire de l'UMOA | pt, fr | Orange Money, MTN Mobile Money | |
| Guinea | `gn.ts` | Planned | West | GNF | Banque Centrale de la République de Guinée | fr, en | Orange Money, MTN Mobile Money | |
| Mauritania | `mr.ts` | Planned | West | MRU | Banque Centrale de Mauritanie | ar, fr, wo | Bankily, Masrvi, Sedad | |
| Gambia | `gm.ts` | Planned | West | GMD | Central Bank of The Gambia | en, wo | Africell Money, QMoney, Wave | |
| Sierra Leone | `sl.ts` | Planned | West | SLE | Bank of Sierra Leone | en | Orange Money, Africell Money | |
| Liberia | `lr.ts` | Planned | West | LRD | Central Bank of Liberia | en | MTN Mobile Money, Orange Money | |
| Cabo Verde | `cv.ts` | Planned | West | CVE | Banco de Cabo Verde | pt, en | — (bank-led) | |
| Kenya | `ke.ts` | Live | East | KES | Central Bank of Kenya | en, sw | M-Pesa (Safaricom) | |
| Tanzania | `tz.ts` | Live | East | TZS | Bank of Tanzania | sw, en | M-Pesa (Vodacom), Tigo Pesa | |
| Uganda | `ug.ts` | Planned | East | UGX | Bank of Uganda | en, sw | MTN Mobile Money, Airtel Money | |
| Rwanda | `rw.ts` | Planned | East | RWF | National Bank of Rwanda | en, fr, sw | MTN Mobile Money, Airtel Money | |
| Burundi | `bi.ts` | Planned | East | BIF | Banque de la République du Burundi | fr, sw, en | Lumicash, EcoCash | |
| Ethiopia | `et.ts` | Planned | East | ETB | National Bank of Ethiopia | en | telebirr, M-Pesa (Safaricom Ethiopia) | |
| Somalia | `so.ts` | Planned | East | SOS | Central Bank of Somalia | en, ar | EVC Plus (Hormuud), Zaad (Telesom), Sahal (Golis), e-Dahab (Somtel) | EDD |
| South Sudan | `ss.ts` | Planned | East | SSP | Bank of South Sudan | en, ar | m-Gurush, MTN Mobile Money | EDD |
| Djibouti | `dj.ts` | Planned | East | DJF | Banque Centrale de Djibouti | fr, ar | D-Money, Waafi | |
| Eritrea | `er.ts` | Planned | East | ERN | Bank of Eritrea | en, ar | — (bank-led) | |
| Madagascar | `mg.ts` | Planned | East | MGA | Banky Foiben'i Madagasikara | fr, en | MVola (Telma), Orange Money, Airtel Money | |
| Comoros | `km.ts` | Planned | East | KMF | Banque Centrale des Comores | fr, ar | Huri Money, MVola | |
| Mauritius | `mu.ts` | Planned | East | MUR | Bank of Mauritius | en, fr | MCB Juice, my.t money | |
| Seychelles | `sc.ts` | Planned | East | SCR | Central Bank of Seychelles | en, fr | — (bank-led) | |
| Malawi | `mw.ts` | Planned | East | MWK | Reserve Bank of Malawi | en | Airtel Money, TNM Mpamba | |
| Mozambique | `mz.ts` | Planned | East | MZN | Banco de Moçambique | pt, en, sw | M-Pesa (Vodacom), e-Mola (Movitel), mKesh (Tmcel) | |
| Zambia | `zm.ts` | Planned | East | ZMW | Bank of Zambia | en | MTN Mobile Money, Airtel Money, Zamtel Kwacha | |
| Zimbabwe | `zw.ts` | Planned | East | ZWG | Reserve Bank of Zimbabwe | en | EcoCash, OneMoney, InnBucks | |
| South Africa | `za.ts` | Planned | Southern | ZAR · CMA | South African Reserve Bank | en | FNB eWallet | |
| Namibia | `na.ts` | Planned | Southern | NAD · CMA | Bank of Namibia | en | FNB eWallet | |
| Botswana | `bw.ts` | Planned | Southern | BWP | Bank of Botswana | en | Orange Money, MyZaka (Mascom), Smega (BTC) | |
| Eswatini | `sz.ts` | Planned | Southern | SZL · CMA | Central Bank of Eswatini | en | MTN Mobile Money, e-Mali | |
| Lesotho | `ls.ts` | Planned | Southern | LSL · CMA | Central Bank of Lesotho | en | M-Pesa (Vodacom), EcoCash | |
| Egypt | `eg.ts` | Planned | North | EGP | Central Bank of Egypt | ar, en | Vodafone Cash, Orange Cash, e& cash | |
| Morocco | `ma.ts` | Planned | North | MAD | Bank Al-Maghrib | ar, fr | Orange Money, inwi money | |
| Algeria | `dz.ts` | Planned | North | DZD | Banque d'Algérie | ar, fr | — (bank-led) | |
| Tunisia | `tn.ts` | Planned | North | TND | Banque Centrale de Tunisie | ar, fr | D17 (La Poste) | |
| Libya | `ly.ts` | Planned | North | LYD | Central Bank of Libya | ar, en | — (bank-led) | EDD |
| Sudan | `sd.ts` | Planned | North | SDG | Central Bank of Sudan | ar, en | — (bank-led) | EDD |

The supervisor column names the prudential authority a licence would sit with; it is
illustrative and every launch is confirmed with local counsel. EDD = conflict-affected
jurisdiction: every corridor in or out needs full verification (Tier 2).
