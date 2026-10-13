import type { Country } from "./types";

/**
 * Mauritius — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MU: Country = {
  code: "MU",
  name: "Mauritius",
  flag: "🇲🇺",
  region: "EAST",
  currency: "MUR",
  callingCode: "+230",
  launch: "PLANNED",
  regulator: "Bank of Mauritius",
  languages: { default: "en", offered: ["en", "fr"] },
  mobileMoneyProviders: [
    { id: "JUICE", label: "MCB Juice" },
    { id: "MYT_MONEY", label: "my.t money" },
  ],
  networks: [
    { id: "MYT", label: "my.t" },
    { id: "EMTEL", label: "Emtel" },
  ],
  agents: [
    { id: "MU-01", name: "Benki Point Port Louis Centre", location: "Central market, Port Louis" },
    { id: "MU-02", name: "Benki Point Curepipe", location: "Curepipe" },
  ],
  billers: [
    { id: "MU-POWER", name: "Prepaid electricity (CEB)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MU-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MU-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MU900100", name: "Port Louis Central Market Grocers", category: "Groceries" },
    { code: "MU900200", name: "Curepipe Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "MU-BANK1", name: "MCB", accountNumberPattern: "^[0-9]{9,14}$", accountNumberHint: "9–14 digit account number" },
    { id: "MU-BANK2", name: "SBM Bank", accountNumberPattern: "^[0-9]{9,14}$", accountNumberHint: "9–14 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 150_000, dailyMinor: 380_000, monthlyMinor: 1_500_000, maxBalanceMinor: 1_500_000 },
    TIER_1: { perTransactionMinor: 3_800_000, dailyMinor: 7_700_000, monthlyMinor: 38_000_000, maxBalanceMinor: 15_000_000 },
    TIER_2: { perTransactionMinor: 38_000_000, dailyMinor: 77_000_000, monthlyMinor: 380_000_000, maxBalanceMinor: 150_000_000 },
  },
};
