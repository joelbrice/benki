import type { Country } from "./types";

/**
 * South Africa — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ZA: Country = {
  code: "ZA",
  name: "South Africa",
  flag: "🇿🇦",
  region: "SOUTHERN",
  currency: "ZAR",
  callingCode: "+27",
  zone: "CMA",
  launch: "PLANNED",
  regulator: "South African Reserve Bank",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "FNB_EWALLET", label: "FNB eWallet" },
  ],
  networks: [
    { id: "VODACOM_ZA", label: "Vodacom" },
    { id: "MTN_ZA", label: "MTN" },
    { id: "CELL_C", label: "Cell C" },
    { id: "TELKOM", label: "Telkom" },
  ],
  agents: [
    { id: "ZA-01", name: "Benki Point Johannesburg Centre", location: "Central market, Johannesburg" },
    { id: "ZA-02", name: "Benki Point Durban", location: "Durban" },
  ],
  billers: [
    { id: "ZA-POWER", name: "Prepaid electricity (Eskom)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ZA-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ZA-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ZA900100", name: "Johannesburg Central Market Grocers", category: "Groceries" },
    { code: "ZA900200", name: "Durban Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "ZA-BANK1", name: "Capitec Bank", accountNumberPattern: "^[0-9]{9,11}$", accountNumberHint: "9–11 digit account number" },
    { id: "ZA-BANK2", name: "Standard Bank", accountNumberPattern: "^[0-9]{9,11}$", accountNumberHint: "9–11 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 61_000, dailyMinor: 150_000, monthlyMinor: 610_000, maxBalanceMinor: 610_000 },
    TIER_1: { perTransactionMinor: 1_500_000, dailyMinor: 3_100_000, monthlyMinor: 15_000_000, maxBalanceMinor: 6_100_000 },
    TIER_2: { perTransactionMinor: 15_000_000, dailyMinor: 31_000_000, monthlyMinor: 150_000_000, maxBalanceMinor: 61_000_000 },
  },
};
