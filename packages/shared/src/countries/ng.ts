import type { Country } from "./types";

/**
 * Nigeria — live.
 */
export const NG: Country = {
  code: "NG",
  name: "Nigeria",
  flag: "🇳🇬",
  region: "WEST",
  currency: "NGN",
  callingCode: "+234",
  launch: "LIVE",
  regulator: "Central Bank of Nigeria",
  languages: { default: "en", offered: ["en", "ha", "yo"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "OPAY", label: "OPay" },
  ],
  agents: [
    { id: "NG-01", name: "Chidinma Provisions", location: "Lagos" },
    { id: "NG-02", name: "Ibrahim Mobile Money", location: "Kano" },
  ],
  billers: [
    { id: "NG-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "NG-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Smartcard number" },
  ],
  merchants: [
    { code: "NG700100", name: "Iya Basira Foodstuff", category: "Groceries" },
    { code: "NG700200", name: "Oluwaseun Tailoring", category: "Clothing" },
  ],
  banks: [
    { id: "NG-ACCESS", name: "Access Bank", accountNumberPattern: "^[0-9]{10}$", accountNumberHint: "10-digit NUBAN" },
    { id: "NG-GTB", name: "Guaranty Trust Bank", accountNumberPattern: "^[0-9]{10}$", accountNumberHint: "10-digit NUBAN" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 2_000_000, dailyMinor: 5_000_000, monthlyMinor: 30_000_000, maxBalanceMinor: 30_000_000 },
    TIER_1: { perTransactionMinor: 50_000_000, dailyMinor: 100_000_000, monthlyMinor: 1_000_000_000, maxBalanceMinor: 300_000_000 },
    TIER_2: { perTransactionMinor: 500_000_000, dailyMinor: 1_000_000_000, monthlyMinor: 10_000_000_000, maxBalanceMinor: 5_000_000_000 },
  },
};
