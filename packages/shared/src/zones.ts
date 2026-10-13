import { COUNTRY_BY_CODE } from "./catalog";
import type { KycTier } from "./limits";

/**
 * Monetary-zone and jurisdiction rules for cross-border payments.
 *
 * - Members of the same currency union pay each other at par: no exchange
 *   margin, and a lower regional fee. CEMAC (XAF) and WAEMU (XOF) share one
 *   currency; in the Common Monetary Area the rand, loti, lilangeni and
 *   Namibian dollar are separate currencies pegged one-to-one.
 * - CEMAC applies BEAC exchange control (Règlement n°02/18/CEMAC/UMAC/CM):
 *   transfers leaving the zone go through approved intermediaries with
 *   supporting documents, so they require full verification (Tier 2), and
 *   residents can't hold foreign-currency balances without authorisation, so
 *   USD/EUR pockets are not offered there.
 * - Conflict-affected jurisdictions flagged in their country module need
 *   enhanced due diligence (Tier 2) on every corridor, in or out.
 */
export function sameCurrencyZone(fromCountry: string, toCountry: string): boolean {
  const a = COUNTRY_BY_CODE[fromCountry];
  const b = COUNTRY_BY_CODE[toCountry];
  if (!a?.zone || a.zone !== b?.zone) return false;
  return a.currency === b.currency || a.zone === "CMA";
}

export function isExchangeControlled(countryCode: string): boolean {
  return COUNTRY_BY_CODE[countryCode]?.zone === "CEMAC";
}

export type CorridorReason = "EXCHANGE_CONTROL" | "ENHANCED_DUE_DILIGENCE";

export interface CorridorPolicy {
  /** Same currency (or a one-to-one peg) on both sides: rate 1, no margin. */
  atPar: boolean;
  /** Minimum verification level for the sender on this corridor. */
  minTier: KycTier;
  /** Why the corridor needs more than the standard Tier 1, if it does. */
  reason?: CorridorReason;
}

export function corridorPolicy(fromCountry: string, toCountry: string): CorridorPolicy {
  const atPar = sameCurrencyZone(fromCountry, toCountry);
  if (COUNTRY_BY_CODE[fromCountry]?.enhancedDueDiligence || COUNTRY_BY_CODE[toCountry]?.enhancedDueDiligence) {
    return { atPar, minTier: "TIER_2", reason: "ENHANCED_DUE_DILIGENCE" };
  }
  if (isExchangeControlled(fromCountry) && !atPar) return { atPar, minTier: "TIER_2", reason: "EXCHANGE_CONTROL" };
  return { atPar, minTier: "TIER_1" };
}

/** Foreign-currency pockets are unavailable where exchange control forbids resident FX balances. */
export function pocketsAllowed(countryCode: string): boolean {
  return !isExchangeControlled(countryCode);
}
