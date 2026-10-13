import type { Country } from "./types";

/**
 * Cameroon — Benki's first and priority market. Live.
 *
 * CEMAC member (XAF, issued by the BEAC; banks and payment institutions
 * supervised by COBAC). Officially bilingual: French and English. Agents cover
 * both linguistic regions and the north; billers are the national utilities.
 */
export const CM: Country = {
  code: "CM",
  name: "Cameroon",
  flag: "🇨🇲",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+237",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "EU_MOBILE_MONEY", label: "Express Union Mobile Money" },
  ],
  networks: [
    { id: "MTN_CM", label: "MTN" },
    { id: "ORANGE_CM", label: "Orange" },
    { id: "CAMTEL", label: "Camtel" },
  ],
  agents: [
    { id: "CM-01", name: "Boutique Mama Ngono", location: "Marché Mokolo, Yaoundé" },
    { id: "CM-02", name: "Ets. Tchinda & Fils", location: "Akwa, Douala" },
    { id: "CM-03", name: "Point Cash Bamenda", location: "Commercial Avenue, Bamenda" },
    { id: "CM-04", name: "Alimentation Bonamoussadi", location: "Bonamoussadi, Douala" },
    { id: "CM-05", name: "Kiosque Marché A", location: "Marché A, Bafoussam" },
    { id: "CM-06", name: "Molyko Mobile Point", location: "Molyko, Buea" },
    { id: "CM-07", name: "Boutique Sahel", location: "Grand Marché, Garoua" },
    { id: "CM-08", name: "Kiosque Dang", location: "Dang, Ngaoundéré" },
    { id: "CM-09", name: "Ets. Abba Cash", location: "Marché Central, Maroua" },
    { id: "CM-10", name: "Point Cash Mile 4", location: "Mile 4, Limbe" },
  ],
  billers: [
    { id: "CM-POWER", name: "Prepaid electricity (ENEO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CM-POWER-BILL", name: "Electricity bill (ENEO postpaid)", category: "ELECTRICITY", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "CM-WATER", name: "Water utility (CAMWATER)", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "CM-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Smartcard number" },
    { id: "CM-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "CM110100", name: "Marché Central Tissus", category: "Textiles" },
    { code: "CM110200", name: "Chez Mami Ndolé", category: "Food" },
    { code: "CM110300", name: "Pharmacie du Wouri", category: "Pharmacy" },
    { code: "CM110400", name: "Quincaillerie Mvog-Mbi", category: "Hardware" },
    { code: "CM110500", name: "Buea Town Groceries", category: "Groceries" },
  ],
  // Banks clear through SYSTAC/SYGMA; account numbers are 23-character RIBs.
  banks: [
    { id: "CM-AFRILAND", name: "Afriland First Bank", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-SGC", name: "Société Générale Cameroun", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-BICEC", name: "BICEC", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-SCB", name: "SCB Cameroun", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-ECOBANK", name: "Ecobank Cameroun", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-UBA", name: "UBA Cameroon", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CM-CCA", name: "CCA Bank", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
