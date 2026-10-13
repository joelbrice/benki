import type { Country } from "./types";

/**
 * Ghana — live.
 */
export const GH: Country = {
  code: "GH",
  name: "Ghana",
  flag: "🇬🇭",
  region: "WEST",
  currency: "GHS",
  callingCode: "+233",
  launch: "LIVE",
  regulator: "Bank of Ghana",
  languages: { default: "en", offered: ["en", "ha"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "AIRTELTIGO", label: "AirtelTigo Money" },
  ],
  agents: [
    { id: "GH-01", name: "Abena's Corner Shop", location: "Accra" },
    { id: "GH-02", name: "Kwame Electronics", location: "Kumasi" },
  ],
  billers: [
    { id: "GH-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GH-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "GH600100", name: "Akwaaba Chop Bar", category: "Food" },
    { code: "GH600200", name: "Kente Weavers Cooperative", category: "Crafts" },
  ],
  banks: [
    { id: "GH-GCB", name: "GCB Bank", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
    { id: "GH-ECOBANK", name: "Ecobank Ghana", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 15_000, dailyMinor: 50_000, monthlyMinor: 150_000, maxBalanceMinor: 100_000 },
    TIER_1: { perTransactionMinor: 300_000, dailyMinor: 1_000_000, monthlyMinor: 3_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 3_000_000, dailyMinor: 10_000_000, monthlyMinor: 30_000_000, maxBalanceMinor: 20_000_000 },
  },
};
