import { formatAmount } from "../money";
import { LOCALES, type Locale } from "./locales";
import { serverEn } from "./server.en";
import { uiEn } from "./ui.en";
import { fr } from "./fr";
import { ha } from "./ha";
import { sw } from "./sw";
import { wo } from "./wo";
import { yo } from "./yo";

export * from "./locales";

export const en = { ...serverEn, ...uiEn };
export type MessageKey = keyof typeof en;
/** Every locale must translate every key (enforced by the type and by tests). */
export type Catalog = Record<MessageKey, string>;

export const CATALOGS: Record<Locale, Catalog> = { en, fr, sw, ha, yo, wo };

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

/** Translates a key, falling back to English for anything missing. */
export function t(locale: Locale, key: MessageKey, params?: MsgParams): string {
  const template = CATALOGS[locale]?.[key] || en[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? render(params[name], locale) : match));
}

export function renderMsg(locale: Locale, message: Msg | string): string {
  return typeof message === "string" ? message : t(locale, message.key, message.params);
}

/** The {placeholders} a template uses — tests check every locale keeps them. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
