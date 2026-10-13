import type { Country } from "./types";

/**
 * Malawi — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MW: Country = {
  code: "MW",
  name: "Malawi",
  flag: "🇲🇼",
  region: "EAST",
  currency: "MWK",
  callingCode: "+265",
  launch: "PLANNED",
  regulator: "Reserve Bank of Malawi",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
    { id: "TNM_MPAMBA", label: "TNM Mpamba" },
  ],
  agents: [
    { id: "MW-01", name: "Benki Point Lilongwe Centre", location: "Central market, Lilongwe" },
    { id: "MW-02", name: "Benki Point Blantyre", location: "Blantyre" },
  ],
  billers: [
    { id: "MW-POWER", name: "Prepaid electricity (ESCOM)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MW-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MW-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MW900100", name: "Lilongwe Central Market Grocers", category: "Groceries" },
    { code: "MW900200", name: "Blantyre Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "MW-BANK1", name: "National Bank of Malawi", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "MW-BANK2", name: "Standard Bank Malawi", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 5_800_000, dailyMinor: 15_000_000, monthlyMinor: 58_000_000, maxBalanceMinor: 58_000_000 },
    TIER_1: { perTransactionMinor: 150_000_000, dailyMinor: 290_000_000, monthlyMinor: 1_500_000_000, maxBalanceMinor: 580_000_000 },
    TIER_2: { perTransactionMinor: 1_500_000_000, dailyMinor: 2_900_000_000, monthlyMinor: 15_000_000_000, maxBalanceMinor: 5_800_000_000 },
  },
};
