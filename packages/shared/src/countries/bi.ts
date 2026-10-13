import type { Country } from "./types";

/**
 * Burundi — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const BI: Country = {
  code: "BI",
  name: "Burundi",
  flag: "🇧🇮",
  region: "EAST",
  currency: "BIF",
  callingCode: "+257",
  launch: "PLANNED",
  regulator: "Banque de la République du Burundi",
  languages: { default: "fr", offered: ["fr", "sw", "en"] },
  mobileMoneyProviders: [
    { id: "LUMICASH", label: "Lumicash" },
    { id: "ECOCASH", label: "EcoCash" },
  ],
  networks: [
    { id: "LUMITEL", label: "Lumitel" },
    { id: "ECONET_LEO", label: "Econet Leo" },
  ],
  agents: [
    { id: "BI-01", name: "Benki Point Bujumbura Centre", location: "Central market, Bujumbura" },
    { id: "BI-02", name: "Benki Point Gitega", location: "Gitega" },
  ],
  billers: [
    { id: "BI-POWER", name: "Prepaid electricity (REGIDESO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "BI-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "BI-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "BI900100", name: "Bujumbura Central Market Grocers", category: "Groceries" },
    { code: "BI900200", name: "Pharmacie Gitega", category: "Pharmacy" },
  ],
  banks: [
    { id: "BI-BANK1", name: "Interbank Burundi", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "BI-BANK2", name: "KCB Burundi", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 98_000, dailyMinor: 250_000, monthlyMinor: 980_000, maxBalanceMinor: 980_000 },
    TIER_1: { perTransactionMinor: 2_500_000, dailyMinor: 4_900_000, monthlyMinor: 25_000_000, maxBalanceMinor: 9_800_000 },
    TIER_2: { perTransactionMinor: 25_000_000, dailyMinor: 49_000_000, monthlyMinor: 250_000_000, maxBalanceMinor: 98_000_000 },
  },
};
