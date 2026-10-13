import type { Country } from "./types";

/**
 * Gabon — live.
 */
export const GA: Country = {
  code: "GA",
  name: "Gabon",
  flag: "🇬🇦",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+241",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "fr", offered: ["fr"] },
  mobileMoneyProviders: [
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
  ],
  agents: [
    { id: "GA-01", name: "Boutique Mont-Bouët", location: "Mont-Bouët, Libreville" },
    { id: "GA-02", name: "Kiosque Port-Gentil", location: "Port-Gentil" },
  ],
  billers: [
    { id: "GA-POWER", name: "Prepaid electricity (SEEG)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GA-WATER", name: "Water utility (SEEG)", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "GA160100", name: "Marché de Nkembo", category: "Groceries" },
    { code: "GA160200", name: "Atelier Okoumé", category: "Crafts" },
  ],
  banks: [
    { id: "GA-BGFI", name: "BGFIBank Gabon", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "GA-ECOBANK", name: "Ecobank Gabon", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
