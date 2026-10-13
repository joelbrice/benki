import type { Country } from "./types";

/**
 * Central African Republic — live.
 */
export const CF: Country = {
  code: "CF",
  name: "Central African Republic",
  flag: "🇨🇫",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+236",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "fr", offered: ["fr"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
  ],
  agents: [
    { id: "CF-01", name: "Kiosque PK5", location: "PK5, Bangui" },
    { id: "CF-02", name: "Boutique Yakité", location: "Berbérati" },
  ],
  billers: [
    { id: "CF-POWER", name: "Prepaid electricity (ENERCA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CF-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "CF120100", name: "Marché Combattant Vivres", category: "Groceries" },
    { code: "CF120200", name: "Pharmacie de l'Oubangui", category: "Pharmacy" },
  ],
  banks: [
    { id: "CF-ECOBANK", name: "Ecobank Centrafrique", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CF-BPMC", name: "Banque Populaire Maroco-Centrafricaine", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
