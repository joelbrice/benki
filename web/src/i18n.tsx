import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  formatAmount,
  intlTag,
  isLocale,
  negotiateLocale,
  t as translate,
  type Locale,
  type MessageKey,
  type MsgParams,
} from "@benki/shared";
import { setRequestLocale } from "./api";

const STORAGE_KEY = "benki.locale";

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return negotiateLocale(navigator.languages?.join(",") ?? navigator.language, "en");
}

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MsgParams) => string;
  /** Amount in minor units, formatted for the current language. */
  money: (amountMinor: number, currency: string) => string;
  date: (iso: string, withTime?: boolean) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setRequestLocale(locale);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* storage unavailable */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const value = useMemo<I18n>(() => {
    const tag = intlTag(locale);
    const safeTag = Intl.DateTimeFormat.supportedLocalesOf([tag]).length ? tag : "en";
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      money: (amountMinor, currency) => formatAmount(amountMinor, currency, tag),
      date: (iso, withTime = false) =>
        new Date(iso).toLocaleString(safeTag, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
