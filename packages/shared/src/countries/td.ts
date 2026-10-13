import type { Country } from "./types";

/**
 * Chad — live.
 */
export const TD: Country = {
  code: "TD",
  name: "Chad",
  flag: "🇹🇩",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+235",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "fr", offered: ["fr", "ar"] },
  mobileMoneyProviders: [
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
  ],
  agents: [
    { id: "TD-01", name: "Boutique Al-Amal", location: "Grand Marché, N'Djamena" },
    { id: "TD-02", name: "Kiosque Moundou Centre", location: "Moundou" },
  ],
  billers: [
    { id: "TD-POWER", name: "Prepaid electricity (SNE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "TD-WATER", name: "Water utility (STE)", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "TD130100", name: "Marché à Mil Céréales", category: "Groceries" },
    { code: "TD130200", name: "Boucherie du Chari", category: "Food" },
  ],
  banks: [
    { id: "TD-ECOBANK", name: "Ecobank Tchad", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "TD-CBT", name: "Commercial Bank Tchad", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
