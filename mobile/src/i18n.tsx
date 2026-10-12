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
import { getItem, setItem } from "./storage";

const STORAGE_KEY = "benki.locale";

function deviceLocale(): Locale {
  try {
    return negotiateLocale(Intl.DateTimeFormat().resolvedOptions().locale, "en");
  } catch {
    return "en";
  }
}

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MsgParams) => string;
  money: (amountMinor: number, currency: string) => string;
  date: (iso: string, withTime?: boolean) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    void getItem(STORAGE_KEY).then((saved) => {
      if (isLocale(saved)) setLocaleState(saved);
    });
  }, []);

  useEffect(() => {
    setRequestLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18n>(() => {
    const tag = intlTag(locale);
    const dateTag = Intl.DateTimeFormat.supportedLocalesOf([tag]).length ? tag : "en";
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      money: (amountMinor, currency) => formatAmount(amountMinor, currency, tag),
      date: (iso, withTime = false) =>
        new Date(iso).toLocaleString(dateTag, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
