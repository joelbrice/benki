// Amounts everywhere in the platform are integer minor units; these helpers
// are the only place that converts to and from human-readable major units.
// Most currencies use 2 decimals. These have none in everyday use (ISO 4217
// or market practice), and the Tunisian and Libyan dinars use 3.
const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "UGX", "RWF", "CDF", "BIF", "DJF", "GNF", "KMF", "MGA"]);
const THREE_DECIMAL_CURRENCIES = new Set(["TND", "LYD"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : THREE_DECIMAL_CURRENCIES.has(currency) ? 3 : 2;
}

export function minorUnitsPerMajor(currency: string): number {
  return 10 ** currencyDecimals(currency);
}

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    // Not every runtime ships data for every African locale; fall back to English digits.
    const tag = Intl.NumberFormat.supportedLocalesOf([locale]).length ? locale : "en-US";
    f = new Intl.NumberFormat(tag, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(key, f);
  }
  return f;
}

/** "1,250.50 KES" in English, "1 250,50 KES" in French — the currency code always follows. */
export function formatAmount(amountMinor: number, currency: string, locale = "en-US"): string {
  const scale = minorUnitsPerMajor(currency);
  const decimals = currencyDecimals(currency);
  // Normalize narrow/no-break spaces so the output is predictable in SMS and USSD.
  return `${numberFormat(locale, decimals).format(amountMinor / scale).replace(/[\u202f\u00a0]/g, " ")} ${currency}`;
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits and separators → ASCII, as Arabic keyboards type them. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, ".")
    .replace(/\u066c/g, ",");
}

/**
 * Parses a user-typed major amount into minor units, or null if invalid.
 * Accepts English ("1,250.50") and French ("1 250,50") conventions: a single
 * "," or "." followed by up to the currency's number of decimals is the
 * decimal mark; any other separators are thousands separators. Zero-decimal
 * currencies (XOF) treat every separator as a thousands separator, and for
 * 3-decimal currencies (TND) a lone "1,250" is read as one thousand two hundred.
 */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const scale = minorUnitsPerMajor(currency);
  const compact = normalizeDigits(input).replace(/[\s\u202f\u00a0'\u200f\u200e]/g, "");
  if (!/^\d[\d.,]*$/.test(compact)) return null;
  let whole = compact;
  let fraction = "";
  const maxDecimals = currencyDecimals(currency);
  const decimal = maxDecimals > 0 ? compact.match(new RegExp(`^(.*\\d)[.,](\\d{1,${maxDecimals}})$`)) : null;
  // The decimal mark must differ from every thousands separator before it.
  const decimalMark = decimal ? compact[decimal[1].length] : "";
  // "1,250" is ambiguous for 3-decimal currencies; thousands grouping wins.
  const groupingOnly = decimal && decimal[2].length === 3 && /^\d{1,3}$/.test(decimal[1]);
  if (decimal && !groupingOnly && !decimal[1].includes(decimalMark)) {
    whole = decimal[1];
    fraction = decimal[2];
  }
  // Remaining separators must be thousands groups of exactly three digits.
  if (/[.,]/.test(whole) && !/^\d{1,3}([.,]\d{3})+$/.test(whole)) return null;
  whole = whole.replace(/[.,]/g, "");
  const minor = Number(whole) * scale + Number(fraction.padEnd(maxDecimals, "0") || "0");
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function minorToMajorString(amountMinor: number, currency: string): string {
  const scale = minorUnitsPerMajor(currency);
  return scale === 1 ? String(amountMinor) : (amountMinor / scale).toFixed(currencyDecimals(currency));
}
