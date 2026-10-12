/** Languages the apps, notifications and USSD menus are available in. */
export const LOCALES = [
  { code: "en", name: "English", englishName: "English", intl: "en" },
  { code: "fr", name: "Français", englishName: "French", intl: "fr" },
  { code: "sw", name: "Kiswahili", englishName: "Swahili", intl: "sw" },
  { code: "ha", name: "Hausa", englishName: "Hausa", intl: "ha" },
  { code: "yo", name: "Yorùbá", englishName: "Yoruba", intl: "yo" },
  { code: "wo", name: "Wolof", englishName: "Wolof", intl: "wo" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const LOCALE_CODES = LOCALES.map((l) => l.code) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as string[]).includes(value);
}

/** The language a new customer starts in, by country. */
export const DEFAULT_LOCALE_BY_COUNTRY: Record<string, Locale> = {
  KE: "en",
  GH: "en",
  NG: "en",
  TZ: "sw",
  SN: "fr",
};

/** Languages offered first in each market (all remain available everywhere). */
export const LANGUAGES_BY_COUNTRY: Record<string, Locale[]> = {
  KE: ["en", "sw"],
  GH: ["en"],
  NG: ["en", "ha", "yo"],
  TZ: ["sw", "en"],
  SN: ["fr", "wo", "en"],
};

/** Picks a supported locale from a BCP-47 tag or Accept-Language header. */
export function negotiateLocale(header: string | null | undefined, fallback: Locale = "en"): Locale {
  if (!header) return fallback;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return fallback;
}
