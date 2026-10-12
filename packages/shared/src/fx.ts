import { FX_UNITS_PER_USD } from "./catalog";
import { FX_MARGIN_BPS } from "./fees";
import { minorUnitsPerMajor } from "./money";

/**
 * Converts minor units between currencies at the reference rate less a margin.
 * Everything is multiplied out before one final floor so a rounded
 * intermediate rate can't push the result below an integer boundary.
 */
export function convertMinor(amountMinor: number, from: string, to: string, marginBps = 0): number | null {
  const fromRate = FX_UNITS_PER_USD[from];
  const toRate = FX_UNITS_PER_USD[to];
  if (!fromRate || !toRate) return null;
  const numerator = amountMinor * toRate * minorUnitsPerMajor(to) * (10_000 - marginBps);
  const denominator = fromRate * minorUnitsPerMajor(from) * 10_000;
  return Math.floor(numerator / denominator + 1e-9);
}

/** Customer-facing rate: units of `to` per one unit of `from`, after margin, 6 d.p. */
export function displayRate(from: string, to: string, marginBps = FX_MARGIN_BPS): number {
  return Math.round((FX_UNITS_PER_USD[to] / FX_UNITS_PER_USD[from]) * (1 - marginBps / 10_000) * 1e6) / 1e6;
}
