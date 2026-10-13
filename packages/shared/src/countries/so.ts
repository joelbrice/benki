import type { Country } from "./types";

/**
 * Somalia — Planned. Partners, agents and limits are placeholders until launch preparation. Conflict-affected jurisdiction: enhanced due diligence on every corridor.
 */
export const SO: Country = {
  code: "SO",
  name: "Somalia",
  flag: "🇸🇴",
  region: "EAST",
  currency: "SOS",
  callingCode: "+252",
  launch: "PLANNED",
  regulator: "Central Bank of Somalia",
  languages: { default: "en", offered: ["en", "ar"] },
  enhancedDueDiligence: true,
  mobileMoneyProviders: [
    { id: "EVC_PLUS", label: "EVC Plus (Hormuud)" },
    { id: "ZAAD", label: "Zaad (Telesom)" },
    { id: "SAHAL", label: "Sahal (Golis)" },
    { id: "EDAHAB", label: "e-Dahab (Somtel)" },
  ],
  networks: [
    { id: "HORMUUD", label: "Hormuud" },
    { id: "TELESOM", label: "Telesom" },
    { id: "GOLIS", label: "Golis" },
    { id: "SOMTEL", label: "Somtel" },
  ],
  agents: [
    { id: "SO-01", name: "Benki Point Mogadishu Centre", location: "Central market, Mogadishu" },
    { id: "SO-02", name: "Benki Point Hargeisa", location: "Hargeisa" },
  ],
  billers: [
    { id: "SO-POWER", name: "Prepaid electricity (BECO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SO-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SO-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SO900100", name: "Mogadishu Central Market Grocers", category: "Groceries" },
    { code: "SO900200", name: "Hargeisa Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "SO-BANK1", name: "Premier Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SO-BANK2", name: "Salaam Somali Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 1_900_000, dailyMinor: 4_800_000, monthlyMinor: 19_000_000, maxBalanceMinor: 19_000_000 },
    TIER_1: { perTransactionMinor: 48_000_000, dailyMinor: 95_000_000, monthlyMinor: 480_000_000, maxBalanceMinor: 190_000_000 },
    TIER_2: { perTransactionMinor: 480_000_000, dailyMinor: 950_000_000, monthlyMinor: 4_800_000_000, maxBalanceMinor: 1_900_000_000 },
  },
};
