// Currencies with no minor subdivision in everyday use. Amounts everywhere in
// the platform are integer minor units; these helpers are the only place that
// converts to and from human-readable major units.
const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "UGX", "RWF"]);

export function minorUnitsPerMajor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
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
  const decimals = scale === 1 ? 0 : 2;
  // Normalize narrow/no-break spaces so the output is predictable in SMS and USSD.
  return `${numberFormat(locale, decimals).format(amountMinor / scale).replace(/[\u202f\u00a0]/g, " ")} ${currency}`;
}

/**
 * Parses a user-typed major amount into minor units, or null if invalid.
 * Accepts English ("1,250.50") and French ("1 250,50") conventions: a single
 * "," or "." followed by one or two final digits is the decimal mark; any
 * other separators are thousands separators. Zero-decimal currencies (XOF)
 * treat every separator as a thousands separator.
 */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const scale = minorUnitsPerMajor(currency);
  const compact = input.replace(/[\s\u202f\u00a0']/g, "");
  if (!/^\d[\d.,]*$/.test(compact)) return null;
  let whole = compact;
  let fraction = "";
  const decimal = compact.match(/^(.*\d)[.,](\d{1,2})$/);
  // The decimal mark must differ from every thousands separator before it.
  const decimalMark = decimal ? compact[decimal[1].length] : "";
  if (scale !== 1 && decimal && !decimal[1].includes(decimalMark)) {
    whole = decimal[1];
    fraction = decimal[2];
  }
  // Remaining separators must be thousands groups of exactly three digits.
  if (/[.,]/.test(whole) && !/^\d{1,3}([.,]\d{3})+$/.test(whole)) return null;
  whole = whole.replace(/[.,]/g, "");
  const maxDecimals = scale === 1 ? 0 : 2;
  const minor = Number(whole) * scale + Number(fraction.padEnd(maxDecimals, "0") || "0");
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function minorToMajorString(amountMinor: number, currency: string): string {
  const scale = minorUnitsPerMajor(currency);
  return scale === 1 ? String(amountMinor) : (amountMinor / scale).toFixed(2);
}
