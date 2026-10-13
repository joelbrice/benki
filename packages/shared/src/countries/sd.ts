import type { Country } from "./types";

/**
 * Sudan — Planned. Partners, agents and limits are placeholders until launch preparation. Conflict-affected jurisdiction: enhanced due diligence on every corridor.
 */
export const SD: Country = {
  code: "SD",
  name: "Sudan",
  flag: "🇸🇩",
  region: "NORTH",
  currency: "SDG",
  callingCode: "+249",
  launch: "PLANNED",
  regulator: "Central Bank of Sudan",
  languages: { default: "ar", offered: ["ar", "en"] },
  enhancedDueDiligence: true,
  mobileMoneyProviders: [],
  networks: [
    { id: "ZAIN_SD", label: "Zain" },
    { id: "MTN_SD", label: "MTN" },
    { id: "SUDANI", label: "Sudani" },
  ],
  agents: [
    { id: "SD-01", name: "Benki Point Port Sudan Centre", location: "Central market, Port Sudan" },
    { id: "SD-02", name: "Benki Point Kassala", location: "Kassala" },
  ],
  billers: [
    { id: "SD-POWER", name: "Prepaid electricity (SEDC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SD-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SD-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SD900100", name: "Port Sudan Central Market Grocers", category: "Groceries" },
    { code: "SD900200", name: "Pharmacie Kassala", category: "Pharmacy" },
  ],
  banks: [
    { id: "SD-BANK1", name: "Bank of Khartoum", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SD-BANK2", name: "Faisal Islamic Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 2_000_000, dailyMinor: 5_000_000, monthlyMinor: 20_000_000, maxBalanceMinor: 20_000_000 },
    TIER_1: { perTransactionMinor: 50_000_000, dailyMinor: 100_000_000, monthlyMinor: 500_000_000, maxBalanceMinor: 200_000_000 },
    TIER_2: { perTransactionMinor: 500_000_000, dailyMinor: 1_000_000_000, monthlyMinor: 5_000_000_000, maxBalanceMinor: 2_000_000_000 },
  },
};
