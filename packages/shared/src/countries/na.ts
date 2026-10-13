import type { Country } from "./types";

/**
 * Namibia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const NA: Country = {
  code: "NA",
  name: "Namibia",
  flag: "🇳🇦",
  region: "SOUTHERN",
  currency: "NAD",
  callingCode: "+264",
  zone: "CMA",
  launch: "PLANNED",
  regulator: "Bank of Namibia",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "FNB_EWALLET", label: "FNB eWallet" },
  ],
  networks: [
    { id: "MTC", label: "MTC" },
    { id: "TN_MOBILE", label: "TN Mobile" },
  ],
  agents: [
    { id: "NA-01", name: "Benki Point Windhoek Centre", location: "Central market, Windhoek" },
    { id: "NA-02", name: "Benki Point Oshakati", location: "Oshakati" },
  ],
  billers: [
    { id: "NA-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "NA-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "NA-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "NA900100", name: "Windhoek Central Market Grocers", category: "Groceries" },
    { code: "NA900200", name: "Oshakati Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "NA-BANK1", name: "Bank Windhoek", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "NA-BANK2", name: "FNB Namibia", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 61_000, dailyMinor: 150_000, monthlyMinor: 610_000, maxBalanceMinor: 610_000 },
    TIER_1: { perTransactionMinor: 1_500_000, dailyMinor: 3_100_000, monthlyMinor: 15_000_000, maxBalanceMinor: 6_100_000 },
    TIER_2: { perTransactionMinor: 15_000_000, dailyMinor: 31_000_000, monthlyMinor: 150_000_000, maxBalanceMinor: 61_000_000 },
  },
};
