// Market catalog for the demo: a small, illustrative subset of the markets in
// docs/COUNTRY_COMPLIANCE_MATRIX.md. Real launches are governed by the full
// compliance matrix; nothing here is a statement about actual partnerships.

export interface MobileMoneyProvider {
  id: string;
  label: string;
}

export interface Agent {
  id: string;
  name: string;
  location: string;
}

export type BillerCategory = "ELECTRICITY" | "WATER" | "TV" | "SCHOOL_FEES";

export interface Biller {
  id: string;
  name: string;
  category: BillerCategory;
  /** Prepaid electricity returns a meter token the customer types into the meter. */
  issuesToken: boolean;
  accountNumberPattern: string;
  accountNumberHint: string;
}

export interface Merchant {
  code: string;
  name: string;
  category: string;
}

/** CEMAC: Central African CFA franc (XAF, BEAC). WAEMU: West African CFA franc (XOF, BCEAO). */
export type MonetaryZone = "CEMAC" | "WAEMU";

export interface Country {
  code: string;
  name: string;
  currency: string;
  callingCode: string;
  /** Emoji flag for pickers. */
  flag: string;
  /** Monetary union: members share a currency and transfer between themselves at par. */
  zone?: MonetaryZone;
  mobileMoneyProviders: MobileMoneyProvider[];
  agents: Agent[];
  billers: Biller[];
  merchants: Merchant[];
}

const METER = "^[0-9]{11}$";
const ACCOUNT = "^[0-9A-Z]{6,13}$";

export const AFRICAN_COUNTRIES: Country[] = [
  {
    code: "KE",
    flag: "🇰🇪",
    name: "Kenya",
    currency: "KES",
    callingCode: "+254",
    mobileMoneyProviders: [{ id: "MPESA", label: "M-Pesa (Safaricom)" }],
    agents: [
      { id: "KE-01", name: "Amani Mobile Money Kiosk", location: "Kibera, Nairobi" },
      { id: "KE-02", name: "Baraka General Store", location: "Kisumu" },
    ],
    billers: [
      { id: "KE-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "KE-WATER", name: "Nairobi water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "KE500100", name: "Mama Mboga Fresh Produce", category: "Groceries" },
      { code: "KE500200", name: "Upendo Community Pharmacy", category: "Pharmacy" },
    ],
  },
  {
    code: "GH",
    flag: "🇬🇭",
    name: "Ghana",
    currency: "GHS",
    callingCode: "+233",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "AIRTELTIGO", label: "AirtelTigo Money" },
    ],
    agents: [
      { id: "GH-01", name: "Abena's Corner Shop", location: "Accra" },
      { id: "GH-02", name: "Kwame Electronics", location: "Kumasi" },
    ],
    billers: [
      { id: "GH-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "GH-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "GH600100", name: "Akwaaba Chop Bar", category: "Food" },
      { code: "GH600200", name: "Kente Weavers Cooperative", category: "Crafts" },
    ],
  },
  {
    code: "NG",
    flag: "🇳🇬",
    name: "Nigeria",
    currency: "NGN",
    callingCode: "+234",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "OPAY", label: "OPay" },
    ],
    agents: [
      { id: "NG-01", name: "Chidinma Provisions", location: "Lagos" },
      { id: "NG-02", name: "Ibrahim Mobile Money", location: "Kano" },
    ],
    billers: [
      { id: "NG-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "NG-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Smartcard number" },
    ],
    merchants: [
      { code: "NG700100", name: "Iya Basira Foodstuff", category: "Groceries" },
      { code: "NG700200", name: "Oluwaseun Tailoring", category: "Clothing" },
    ],
  },
  {
    code: "TZ",
    flag: "🇹🇿",
    name: "Tanzania",
    currency: "TZS",
    callingCode: "+255",
    mobileMoneyProviders: [
      { id: "MPESA", label: "M-Pesa (Vodacom)" },
      { id: "TIGOPESA", label: "Tigo Pesa" },
    ],
    agents: [
      { id: "TZ-01", name: "Neema Duka", location: "Dar es Salaam" },
      { id: "TZ-02", name: "Juma's Kiosk", location: "Arusha" },
    ],
    billers: [
      { id: "TZ-POWER", name: "Prepaid electricity (LUKU)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "TZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Student reference" },
    ],
    merchants: [
      { code: "TZ800100", name: "Kariakoo Spices", category: "Groceries" },
      { code: "TZ800200", name: "Bahari Fish Market", category: "Food" },
    ],
  },
  {
    code: "SN",
    flag: "🇸🇳",
    name: "Senegal",
    currency: "XOF",
    callingCode: "+221",
    zone: "WAEMU",
    mobileMoneyProviders: [
      { id: "ORANGE_MONEY", label: "Orange Money" },
      { id: "WAVE", label: "Wave" },
    ],
    agents: [
      { id: "SN-01", name: "Boutique Fatou", location: "Dakar" },
      { id: "SN-02", name: "Kiosque Moussa", location: "Thiès" },
    ],
    billers: [
      { id: "SN-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "SN-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "SN900100", name: "Marché Sandaga Tissus", category: "Textiles" },
      { code: "SN900200", name: "Dibiterie Teranga", category: "Food" },
    ],
  },
  // --- Central Africa: the six CEMAC states share the CFA franc (XAF), issued by
  // the BEAC and supervised by COBAC; the DRC is the region's largest market.
  {
    code: "CM",
    flag: "🇨🇲",
    name: "Cameroon",
    currency: "XAF",
    callingCode: "+237",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "ORANGE_MONEY", label: "Orange Money" },
    ],
    agents: [
      { id: "CM-01", name: "Boutique Mama Ngono", location: "Marché Mokolo, Yaoundé" },
      { id: "CM-02", name: "Ets. Tchinda & Fils", location: "Akwa, Douala" },
      { id: "CM-03", name: "Point Cash Bamenda", location: "Commercial Avenue, Bamenda" },
    ],
    billers: [
      { id: "CM-POWER", name: "Prepaid electricity (ENEO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "CM-WATER", name: "Water utility (CAMWATER)", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
      { id: "CM-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Smartcard number" },
    ],
    merchants: [
      { code: "CM110100", name: "Marché Central Tissus", category: "Textiles" },
      { code: "CM110200", name: "Chez Mami Ndolé", category: "Food" },
    ],
  },
  {
    code: "CF",
    flag: "🇨🇫",
    name: "Central African Republic",
    currency: "XAF",
    callingCode: "+236",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "ORANGE_MONEY", label: "Orange Money" },
      { id: "MOOV_MONEY", label: "Moov Money" },
    ],
    agents: [
      { id: "CF-01", name: "Kiosque PK5", location: "PK5, Bangui" },
      { id: "CF-02", name: "Boutique Yakité", location: "Berbérati" },
    ],
    billers: [
      { id: "CF-POWER", name: "Prepaid electricity (ENERCA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "CF-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Student reference" },
    ],
    merchants: [
      { code: "CF120100", name: "Marché Combattant Vivres", category: "Groceries" },
      { code: "CF120200", name: "Pharmacie de l'Oubangui", category: "Pharmacy" },
    ],
  },
  {
    code: "TD",
    flag: "🇹🇩",
    name: "Chad",
    currency: "XAF",
    callingCode: "+235",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "AIRTEL_MONEY", label: "Airtel Money" },
      { id: "MOOV_MONEY", label: "Moov Money" },
    ],
    agents: [
      { id: "TD-01", name: "Boutique Al-Amal", location: "Grand Marché, N'Djamena" },
      { id: "TD-02", name: "Kiosque Moundou Centre", location: "Moundou" },
    ],
    billers: [
      { id: "TD-POWER", name: "Prepaid electricity (SNE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "TD-WATER", name: "Water utility (STE)", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "TD130100", name: "Marché à Mil Céréales", category: "Groceries" },
      { code: "TD130200", name: "Boucherie du Chari", category: "Food" },
    ],
  },
  {
    code: "CG",
    flag: "🇨🇬",
    name: "Republic of the Congo",
    currency: "XAF",
    callingCode: "+242",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "AIRTEL_MONEY", label: "Airtel Money" },
    ],
    agents: [
      { id: "CG-01", name: "Ets. Mabiala", location: "Marché Total, Brazzaville" },
      { id: "CG-02", name: "Point Cash Tié-Tié", location: "Pointe-Noire" },
    ],
    billers: [
      { id: "CG-POWER", name: "Prepaid electricity (E²C)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "CG-WATER", name: "Water utility (LCDE)", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "CG140100", name: "Saka-Saka de Poto-Poto", category: "Food" },
      { code: "CG140200", name: "Couture La Sapeuse", category: "Clothing" },
    ],
  },
  {
    code: "GQ",
    flag: "🇬🇶",
    name: "Equatorial Guinea",
    currency: "XAF",
    callingCode: "+240",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "GETESA_MONEY", label: "GETESA Mobile Money" },
      { id: "MUNI_DINERO", label: "Muni Dinero" },
    ],
    agents: [
      { id: "GQ-01", name: "Tienda La Esperanza", location: "Malabo" },
      { id: "GQ-02", name: "Kiosco Bata Centro", location: "Bata" },
    ],
    billers: [
      { id: "GQ-POWER", name: "Prepaid electricity (SEGESA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "GQ-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Smartcard number" },
    ],
    merchants: [
      { code: "GQ150100", name: "Mercado Central de Malabo", category: "Groceries" },
      { code: "GQ150200", name: "Pescadería Bioko", category: "Food" },
    ],
  },
  {
    code: "GA",
    flag: "🇬🇦",
    name: "Gabon",
    currency: "XAF",
    callingCode: "+241",
    zone: "CEMAC",
    mobileMoneyProviders: [
      { id: "AIRTEL_MONEY", label: "Airtel Money" },
      { id: "MOOV_MONEY", label: "Moov Money" },
    ],
    agents: [
      { id: "GA-01", name: "Boutique Mont-Bouët", location: "Mont-Bouët, Libreville" },
      { id: "GA-02", name: "Kiosque Port-Gentil", location: "Port-Gentil" },
    ],
    billers: [
      { id: "GA-POWER", name: "Prepaid electricity (SEEG)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "GA-WATER", name: "Water utility (SEEG)", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "GA160100", name: "Marché de Nkembo", category: "Groceries" },
      { code: "GA160200", name: "Atelier Okoumé", category: "Crafts" },
    ],
  },
  {
    code: "CD",
    flag: "🇨🇩",
    name: "DR Congo",
    currency: "CDF",
    callingCode: "+243",
    mobileMoneyProviders: [
      { id: "MPESA", label: "M-Pesa (Vodacom)" },
      { id: "ORANGE_MONEY", label: "Orange Money" },
      { id: "AIRTEL_MONEY", label: "Airtel Money" },
    ],
    agents: [
      { id: "CD-01", name: "Ets. Mbuyi", location: "Marché Gambela, Kinshasa" },
      { id: "CD-02", name: "Cabine Lubumbashi Centre", location: "Lubumbashi" },
      { id: "CD-03", name: "Boutique Neema", location: "Goma" },
    ],
    billers: [
      { id: "CD-POWER", name: "Prepaid electricity (SNEL)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "CD-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Student reference" },
    ],
    merchants: [
      { code: "CD170100", name: "Pagne Wax Matonge", category: "Textiles" },
      { code: "CD170200", name: "Malewa ya Mama Kiese", category: "Food" },
    ],
  },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  AFRICAN_COUNTRIES.map((c) => [c.code, c]),
);

export const DEFAULT_COUNTRY_CODE = "SN";

export function findMerchant(code: string): { country: Country; merchant: Merchant } | undefined {
  for (const country of AFRICAN_COUNTRIES) {
    const merchant = country.merchants.find((m) => m.code === code);
    if (merchant) return { country, merchant };
  }
  return undefined;
}

// Remittance purpose codes (docs/API_SPECIFICATION.md section 3 "purposeCode").
export const PURPOSE_CODES = [
  { id: "FAMILY_SUPPORT", label: "Family support" },
  { id: "EDUCATION", label: "Education" },
  { id: "MEDICAL", label: "Medical" },
  { id: "BUSINESS", label: "Business / trade" },
  { id: "SAVINGS", label: "Savings" },
  { id: "OTHER", label: "Other" },
] as const;

export type PurposeCode = (typeof PURPOSE_CODES)[number]["id"];

/**
 * Illustrative mid-market rates expressed as units of each currency per 1 USD.
 * A real deployment sources these from a rates provider with freshness checks.
 */
export const FX_UNITS_PER_USD: Record<string, number> = {
  KES: 129.0,
  GHS: 15.5,
  NGN: 1550,
  TZS: 2600,
  XOF: 600,
  // XAF and XOF are both pegged at 655.957 per euro, so they trade at par.
  XAF: 600,
  CDF: 2800,
  USD: 1,
  EUR: 0.92,
};

/** Hard currencies customers can hold alongside their local wallet. */
export const POCKET_CURRENCIES = ["USD", "EUR"] as const;
export type PocketCurrency = (typeof POCKET_CURRENCIES)[number];

export interface Bank {
  id: string;
  name: string;
  accountNumberPattern: string;
  accountNumberHint: string;
}

// Illustrative bank rails per market (NIP in Nigeria, PesaLink in Kenya,
// GhIPSS in Ghana, TISS/TIPS in Tanzania, GIM-UEMOA in Senegal, SYSTAC/GIMAC in CEMAC).
const RIB = "^[0-9A-Z]{23}$";

export const BANKS: Record<string, Bank[]> = {
  KE: [
    { id: "KE-EQUITY", name: "Equity Bank", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
    { id: "KE-KCB", name: "KCB Bank", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
  ],
  GH: [
    { id: "GH-GCB", name: "GCB Bank", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
    { id: "GH-ECOBANK", name: "Ecobank Ghana", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
  ],
  NG: [
    { id: "NG-ACCESS", name: "Access Bank", accountNumberPattern: "^[0-9]{10}$", accountNumberHint: "10-digit NUBAN" },
    { id: "NG-GTB", name: "Guaranty Trust Bank", accountNumberPattern: "^[0-9]{10}$", accountNumberHint: "10-digit NUBAN" },
  ],
  TZ: [
    { id: "TZ-CRDB", name: "CRDB Bank", accountNumberPattern: "^[0-9]{10,15}$", accountNumberHint: "10–15 digit account number" },
    { id: "TZ-NMB", name: "NMB Bank", accountNumberPattern: "^[0-9]{10,15}$", accountNumberHint: "10–15 digit account number" },
  ],
  SN: [
    { id: "SN-CBAO", name: "CBAO", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number (RIB)" },
    { id: "SN-ECOBANK", name: "Ecobank Sénégal", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number (RIB)" },
  ],
  // CEMAC banks clear through SYSTAC/SYGMA; account numbers are 23-character RIBs.
  CM: [
    { id: "CM-AFRILAND", name: "Afriland First Bank", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "CM-SGC", name: "Société Générale Cameroun", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  CF: [
    { id: "CF-ECOBANK", name: "Ecobank Centrafrique", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "CF-BPMC", name: "Banque Populaire Maroco-Centrafricaine", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  TD: [
    { id: "TD-ECOBANK", name: "Ecobank Tchad", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "TD-CBT", name: "Commercial Bank Tchad", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  CG: [
    { id: "CG-BGFI", name: "BGFIBank Congo", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "CG-LCB", name: "LCB Bank", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  GQ: [
    { id: "GQ-CCEI", name: "CCEI Bank GE", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "GQ-BGFI", name: "BGFIBank Guinea Ecuatorial", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  GA: [
    { id: "GA-BGFI", name: "BGFIBank Gabon", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
    { id: "GA-ECOBANK", name: "Ecobank Gabon", accountNumberPattern: RIB, accountNumberHint: "Account number (RIB)" },
  ],
  CD: [
    { id: "CD-RAWBANK", name: "Rawbank", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number" },
    { id: "CD-EQUITYBCDC", name: "Equity BCDC", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number" },
  ],
};

export function banksFor(countryCode: string): Bank[] {
  return BANKS[countryCode] ?? [];
}

/** USSD short code shown on feature phones; illustrative. */
export const USSD_SHORT_CODE = "*384*236#";
