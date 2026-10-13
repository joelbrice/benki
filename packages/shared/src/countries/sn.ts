import type { Country } from "./types";

/**
 * Senegal — live.
 */
export const SN: Country = {
  code: "SN",
  name: "Senegal",
  flag: "🇸🇳",
  region: "WEST",
  currency: "XOF",
  callingCode: "+221",
  zone: "WAEMU",
  launch: "LIVE",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "wo", "en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "WAVE", label: "Wave" },
  ],
  agents: [
    { id: "SN-01", name: "Boutique Fatou", location: "Dakar" },
    { id: "SN-02", name: "Kiosque Moussa", location: "Thiès" },
  ],
  billers: [
    { id: "SN-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SN-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "SN900100", name: "Marché Sandaga Tissus", category: "Textiles" },
    { code: "SN900200", name: "Dibiterie Teranga", category: "Food" },
  ],
  banks: [
    { id: "SN-CBAO", name: "CBAO", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number (RIB)" },
    { id: "SN-ECOBANK", name: "Ecobank Sénégal", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
