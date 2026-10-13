import type { Country } from "./types";

/**
 * Equatorial Guinea — live.
 */
export const GQ: Country = {
  code: "GQ",
  name: "Equatorial Guinea",
  flag: "🇬🇶",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+240",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "es", offered: ["es", "fr", "pt"] },
  mobileMoneyProviders: [
    { id: "GETESA_MONEY", label: "GETESA Mobile Money" },
    { id: "MUNI_DINERO", label: "Muni Dinero" },
  ],
  agents: [
    { id: "GQ-01", name: "Tienda La Esperanza", location: "Malabo" },
    { id: "GQ-02", name: "Kiosco Bata Centro", location: "Bata" },
  ],
  billers: [
    { id: "GQ-POWER", name: "Prepaid electricity (SEGESA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GQ-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Smartcard number" },
  ],
  merchants: [
    { code: "GQ150100", name: "Mercado Central de Malabo", category: "Groceries" },
    { code: "GQ150200", name: "Pescadería Bioko", category: "Food" },
  ],
  banks: [
    { id: "GQ-CCEI", name: "CCEI Bank GE", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "GQ-BGFI", name: "BGFIBank Guinea Ecuatorial", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
