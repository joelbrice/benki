/**
 * Every African country, one module each (./cm.ts, ./ng.ts, …). Each module is
 * self-contained — currency, regulator, languages, partners, agents, billers,
 * banks and limits — so a market can be prepared and launched on its own.
 *
 * Cameroon is the first market; Central Africa (CEMAC and the DRC) comes first
 * everywhere countries are listed.
 */
import type { Locale } from "../i18n/locales";
import type { Country } from "./types";
import { AO } from "./ao";
import { BF } from "./bf";
import { BI } from "./bi";
import { BJ } from "./bj";
import { BW } from "./bw";
import { CD } from "./cd";
import { CF } from "./cf";
import { CG } from "./cg";
import { CI } from "./ci";
import { CM } from "./cm";
import { CV } from "./cv";
import { DJ } from "./dj";
import { DZ } from "./dz";
import { EG } from "./eg";
import { ER } from "./er";
import { ET } from "./et";
import { GA } from "./ga";
import { GH } from "./gh";
import { GM } from "./gm";
import { GN } from "./gn";
import { GQ } from "./gq";
import { GW } from "./gw";
import { KE } from "./ke";
import { KM } from "./km";
import { LR } from "./lr";
import { LS } from "./ls";
import { LY } from "./ly";
import { MA } from "./ma";
import { MG } from "./mg";
import { ML } from "./ml";
import { MR } from "./mr";
import { MU } from "./mu";
import { MW } from "./mw";
import { MZ } from "./mz";
import { NA } from "./na";
import { NE } from "./ne";
import { NG } from "./ng";
import { RW } from "./rw";
import { SC } from "./sc";
import { SD } from "./sd";
import { SL } from "./sl";
import { SN } from "./sn";
import { SO } from "./so";
import { SS } from "./ss";
import { ST } from "./st";
import { SZ } from "./sz";
import { TD } from "./td";
import { TG } from "./tg";
import { TN } from "./tn";
import { TZ } from "./tz";
import { UG } from "./ug";
import { ZA } from "./za";
import { ZM } from "./zm";
import { ZW } from "./zw";

export * from "./types";

/** Display order: Central Africa first (Cameroon at the top), then by region. */
export const AFRICAN_COUNTRIES: Country[] = [
  // Central Africa
  CM, GA, CG, TD, CF, GQ, CD, AO, ST,
  // West Africa
  NG, GH, SN, CI, BJ, BF, ML, NE, TG, GW, GN, MR, GM, SL, LR, CV,
  // East Africa
  KE, TZ, UG, RW, BI, ET, SO, SS, DJ, ER, MG, KM, MU, SC, MW, MZ, ZM, ZW,
  // Southern Africa
  ZA, NA, BW, SZ, LS,
  // North Africa
  EG, MA, DZ, TN, LY, SD,
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(AFRICAN_COUNTRIES.map((c) => [c.code, c]));

/** Markets open to customers today. */
export const LIVE_COUNTRIES: Country[] = AFRICAN_COUNTRIES.filter((c) => c.launch === "LIVE");

/** Markets prepared for a later launch. */
export const PLANNED_COUNTRIES: Country[] = AFRICAN_COUNTRIES.filter((c) => c.launch === "PLANNED");

export function isLive(countryCode: string): boolean {
  return COUNTRY_BY_CODE[countryCode]?.launch === "LIVE";
}

/** Benki's first market; the default in onboarding. */
export const DEFAULT_COUNTRY_CODE = "CM";

/** Mobile networks for airtime: the explicit list, or the mobile money operators. */
export function airtimeNetworks(country: Country) {
  return country.networks ?? country.mobileMoneyProviders;
}

/** The language a new customer starts in, by country. */
export const DEFAULT_LOCALE_BY_COUNTRY: Record<string, Locale> = Object.fromEntries(AFRICAN_COUNTRIES.map((c) => [c.code, c.languages.default]));

/** Languages offered first in each market (all remain available everywhere). */
export const LANGUAGES_BY_COUNTRY: Record<string, Locale[]> = Object.fromEntries(AFRICAN_COUNTRIES.map((c) => [c.code, c.languages.offered]));
