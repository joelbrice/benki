import { formatAmount } from "../money";
import { isRtl, LOCALES, type Locale } from "./locales";
import { serverEn } from "./server.en";
import { uiEn } from "./ui.en";
import { fr } from "./fr";
import { ha } from "./ha";
import { sw } from "./sw";
import { wo } from "./wo";
import { yo } from "./yo";
import { es } from "./es";
import { ar } from "./ar";
import { ln } from "./ln";

export * from "./locales";

export const en = { ...serverEn, ...uiEn };
export type MessageKey = keyof typeof en;
/** Every locale must translate every key (enforced by the type and by tests). */
export type Catalog = Record<MessageKey, string>;

export const CATALOGS: Record<Locale, Catalog> = { en, fr, sw, ha, yo, wo, es, ar, ln };

/** An amount to be formatted in the reader's locale. */
export interface MoneyParam {
  amountMinor: number;
  currency: string;
}
export type MsgParam = string | number | MoneyParam | Msg;
export type MsgParams = Record<string, MsgParam>;

/** A message to be rendered later, in whichever language the reader uses. */
export interface Msg {
  key: MessageKey;
  params?: MsgParams;
}

export const msg = (key: MessageKey, params?: MsgParams): Msg => ({ key, params });

export function intlTag(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.intl ?? "en";
}

export const money = (amountMinor: number, currency: string): MoneyParam => ({ amountMinor, currency });

function render(value: MsgParam, locale: Locale): string {
  if (typeof value === "object" && "key" in value) return t(locale, value.key, value.params);
  if (typeof value === "object") return formatAmount(value.amountMinor, value.currency, intlTag(locale));
  if (typeof value === "number") return value.toLocaleString(intlTag(locale));
  return value;
}

/**
 * Keeps international phone numbers readable inside right-to-left text: without
 * a left-to-right mark the bidi algorithm shows "+23566000000" as
 * "23566000000+". A no-op for left-to-right languages.
 */
export function bidiSafe(locale: Locale, text: string): string {
  return isRtl(locale) ? text.replace(/(^|[^\d\u200e])\+(?=\d)/g, "$1\u200e+") : text;
}

/** Translates a key, falling back to English for anything missing. */
export function t(locale: Locale, key: MessageKey, params?: MsgParams): string {
  const template = CATALOGS[locale]?.[key] || en[key] || key;
  if (!params) return template;
  return bidiSafe(locale, template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? render(params[name], locale) : match)));
}

export function renderMsg(locale: Locale, message: Msg | string): string {
  return typeof message === "string" ? message : t(locale, message.key, message.params);
}

/** The {placeholders} a template uses — tests check every locale keeps them. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
