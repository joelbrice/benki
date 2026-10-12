import { COUNTRY_BY_CODE } from "./catalog";
import type { KycTier } from "./limits";

/**
 * Monetary-zone rules for cross-border payments.
 *
 * - Members of the same currency union (CEMAC: XAF, WAEMU: XOF) pay each other
 *   at par: no exchange margin, and a lower regional fee.
 * - CEMAC applies BEAC exchange control (Règlement n°02/18/CEMAC/UMAC/CM):
 *   transfers leaving the zone go through approved intermediaries with
 *   supporting documents, so they require full verification (Tier 2), and
 *   residents can't hold foreign-currency balances without authorisation, so
 *   USD/EUR pockets are not offered there.
 */
export function sameCurrencyZone(fromCountry: string, toCountry: string): boolean {
  const a = COUNTRY_BY_CODE[fromCountry];
  const b = COUNTRY_BY_CODE[toCountry];
  return !!a?.zone && a.zone === b?.zone && a.currency === b.currency;
}

export function isExchangeControlled(countryCode: string): boolean {
  return COUNTRY_BY_CODE[countryCode]?.zone === "CEMAC";
}

export interface CorridorPolicy {
  /** Same currency on both sides: rate 1, no margin. */
  atPar: boolean;
  /** Minimum verification level for the sender on this corridor. */
  minTier: KycTier;
}

export function corridorPolicy(fromCountry: string, toCountry: string): CorridorPolicy {
  const atPar = sameCurrencyZone(fromCountry, toCountry);
  const leavingControlledZone = isExchangeControlled(fromCountry) && !atPar;
  return { atPar, minTier: leavingControlledZone ? "TIER_2" : "TIER_1" };
}

/** Foreign-currency pockets are unavailable where exchange control forbids resident FX balances. */
export function pocketsAllowed(countryCode: string): boolean {
  return !isExchangeControlled(countryCode);
}
