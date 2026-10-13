/** Languages the apps, notifications and USSD menus are available in. */
export const LOCALES = [
  { code: "en", name: "English", englishName: "English", intl: "en" },
  { code: "fr", name: "Français", englishName: "French", intl: "fr" },
  { code: "sw", name: "Kiswahili", englishName: "Swahili", intl: "sw" },
  { code: "ha", name: "Hausa", englishName: "Hausa", intl: "ha" },
  { code: "yo", name: "Yorùbá", englishName: "Yoruba", intl: "yo" },
  { code: "wo", name: "Wolof", englishName: "Wolof", intl: "wo" },
  { code: "es", name: "Español", englishName: "Spanish", intl: "es" },
  // Latin digits keep amounts, PINs and phone numbers identical across channels.
  { code: "ar", name: "العربية", englishName: "Arabic", intl: "ar-u-nu-latn" },
  { code: "ln", name: "Lingála", englishName: "Lingala", intl: "ln" },
  { code: "pt", name: "Português", englishName: "Portuguese", intl: "pt" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const LOCALE_CODES = LOCALES.map((l) => l.code) as Locale[];

/** Languages written right-to-left (the apps mirror their layout for these). */
export const RTL_LOCALES: readonly Locale[] = ["ar"];
export const isRtl = (locale: Locale): boolean => RTL_LOCALES.includes(locale);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as string[]).includes(value);
}

/** Picks a supported locale from a BCP-47 tag or Accept-Language header. */
export function negotiateLocale(header: string | null | undefined, fallback: Locale = "en"): Locale {
  if (!header) return fallback;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return fallback;
}
