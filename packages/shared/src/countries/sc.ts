import type { Country } from "./types";

/**
 * Seychelles — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const SC: Country = {
  code: "SC",
  name: "Seychelles",
  flag: "🇸🇨",
  region: "EAST",
  currency: "SCR",
  callingCode: "+248",
  launch: "PLANNED",
  regulator: "Central Bank of Seychelles",
  languages: { default: "en", offered: ["en", "fr"] },
  mobileMoneyProviders: [],
  networks: [
    { id: "CWS", label: "Cable & Wireless" },
    { id: "AIRTEL_SC", label: "Airtel" },
  ],
  agents: [
    { id: "SC-01", name: "Benki Point Victoria Centre", location: "Central market, Victoria" },
    { id: "SC-02", name: "Benki Point Beau Vallon", location: "Beau Vallon" },
  ],
  billers: [
    { id: "SC-POWER", name: "Prepaid electricity (PUC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SC-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SC-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SC900100", name: "Victoria Central Market Grocers", category: "Groceries" },
    { code: "SC900200", name: "Beau Vallon Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "SC-BANK1", name: "Nouvobanq", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SC-BANK2", name: "Absa Seychelles", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 48_000, dailyMinor: 120_000, monthlyMinor: 480_000, maxBalanceMinor: 480_000 },
    TIER_1: { perTransactionMinor: 1_200_000, dailyMinor: 2_400_000, monthlyMinor: 12_000_000, maxBalanceMinor: 4_800_000 },
    TIER_2: { perTransactionMinor: 12_000_000, dailyMinor: 24_000_000, monthlyMinor: 120_000_000, maxBalanceMinor: 48_000_000 },
  },
};
