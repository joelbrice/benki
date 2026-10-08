// Currencies with no minor subdivision in everyday use. Amounts everywhere in
// the platform are integer minor units; these helpers are the only place that
// converts to and from human-readable major units.
const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "UGX", "RWF"]);

export function minorUnitsPerMajor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function formatAmount(amountMinor: number, currency: string): string {
  const scale = minorUnitsPerMajor(currency);
  const decimals = scale === 1 ? 0 : 2;
  const major = amountMinor / scale;
  return `${major.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

/** Parses a user-typed major amount ("1,250.50") into minor units, or null if invalid. */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const scale = minorUnitsPerMajor(currency);
  const [whole, fraction = ""] = cleaned.split(".");
  const maxDecimals = scale === 1 ? 0 : 2;
  if (fraction.length > maxDecimals) return null;
  const minor = Number(whole) * scale + Number(fraction.padEnd(maxDecimals, "0") || "0");
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function minorToMajorString(amountMinor: number, currency: string): string {
  const scale = minorUnitsPerMajor(currency);
  return scale === 1 ? String(amountMinor) : (amountMinor / scale).toFixed(2);
}
