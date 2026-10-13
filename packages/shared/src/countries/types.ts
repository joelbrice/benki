import type { Locale } from "../i18n/locales";
import type { KycTier, TierLimits } from "../limits";

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

export interface Bank {
  id: string;
  name: string;
  accountNumberPattern: string;
  accountNumberHint: string;
}

/**
 * Monetary unions. CEMAC: Central African CFA franc (XAF, BEAC). WAEMU: West
 * African CFA franc (XOF, BCEAO). CMA: Common Monetary Area — the rand, loti,
 * lilangeni and Namibian dollar exchange at par.
 */
export type MonetaryZone = "CEMAC" | "WAEMU" | "CMA";

/** UN geoscheme regions, used to group countries in pickers. */
export type Region = "CENTRAL" | "WEST" | "EAST" | "SOUTHERN" | "NORTH";

/**
 * Expansion stage. LIVE markets accept sign-ups, agents and transfers.
 * PLANNED markets are fully described but closed until launch: customers see
 * them as "coming soon". Launching a market means completing its module
 * (licence, partners, agents, limits) and switching it to LIVE.
 */
export type LaunchStage = "LIVE" | "PLANNED";

/** Everything Benki needs to operate in one country, kept in that country's own module. */
export interface Country {
  code: string;
  /** English name; customers see the translated `country.<code>` message. */
  name: string;
  /** Emoji flag for pickers. */
  flag: string;
  region: Region;
  currency: string;
  callingCode: string;
  /** Monetary union: members transfer between themselves at par. */
  zone?: MonetaryZone;
  launch: LaunchStage;
  /** Prudential supervisor / central bank the licence is held with (illustrative). */
  regulator: string;
  /** The language new customers start in, and the languages offered first (all remain available). */
  languages: { default: Locale; offered: Locale[] };
  /** Conflict-affected jurisdictions: every corridor needs full verification (Tier 2). */
  enhancedDueDiligence?: boolean;
  mobileMoneyProviders: MobileMoneyProvider[];
  /** Mobile networks for airtime, when they differ from the mobile money operators. */
  networks?: MobileMoneyProvider[];
  agents: Agent[];
  billers: Biller[];
  merchants: Merchant[];
  banks: Bank[];
  /** e-money limits by verification level, in this currency's minor units. */
  limits: Record<KycTier, TierLimits>;
}
