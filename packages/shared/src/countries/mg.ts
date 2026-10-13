import type { Country } from "./types";

/**
 * Madagascar — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MG: Country = {
  code: "MG",
  name: "Madagascar",
  flag: "🇲🇬",
  region: "EAST",
  currency: "MGA",
  callingCode: "+261",
  launch: "PLANNED",
  regulator: "Banky Foiben'i Madagasikara",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "MVOLA", label: "MVola (Telma)" },
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
  ],
  agents: [
    { id: "MG-01", name: "Benki Point Antananarivo Centre", location: "Central market, Antananarivo" },
    { id: "MG-02", name: "Benki Point Toamasina", location: "Toamasina" },
  ],
  billers: [
    { id: "MG-POWER", name: "Prepaid electricity (JIRAMA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MG-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MG-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MG900100", name: "Antananarivo Central Market Grocers", category: "Groceries" },
    { code: "MG900200", name: "Pharmacie Toamasina", category: "Pharmacy" },
  ],
  banks: [
    { id: "MG-BANK1", name: "BNI Madagascar", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "MG-BANK2", name: "BOA Madagascar", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 150_000, dailyMinor: 380_000, monthlyMinor: 1_500_000, maxBalanceMinor: 1_500_000 },
    TIER_1: { perTransactionMinor: 3_800_000, dailyMinor: 7_500_000, monthlyMinor: 38_000_000, maxBalanceMinor: 15_000_000 },
    TIER_2: { perTransactionMinor: 38_000_000, dailyMinor: 75_000_000, monthlyMinor: 380_000_000, maxBalanceMinor: 150_000_000 },
  },
};
