import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nManager, Platform } from "react-native";
import {
  bidiSafe,
  formatAmount,
  intlTag,
  isLocale,
  isRtl,
  negotiateLocale,
  t as translate,
  type Locale,
  type MessageKey,
  type MsgParams,
} from "@benki/shared";
import { setRequestLocale } from "./api";
import { getItem, setItem } from "./storage";

const STORAGE_KEY = "benki.locale";

/**
 * Right-to-left layout for Arabic. On the web the document direction flips
 * immediately; on iOS/Android React Native mirrors layouts from the next app
 * start (I18nManager is read once at launch).
 */
function applyDirection(locale: Locale) {
  const rtl = isRtl(locale);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
    return;
  }
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}

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
  /** The current language is written right-to-left. */
  rtl: boolean;
  t: (key: MessageKey, params?: MsgParams) => string;
  /** Makes raw text (phone numbers) display correctly in the current direction. */
  bidi: (text: string) => string;
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
    applyDirection(locale);
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
      rtl: isRtl(locale),
      t: (key, params) => translate(locale, key, params),
      bidi: (text) => bidiSafe(locale, text),
      money: (amountMinor, currency) => formatAmount(amountMinor, currency, tag),
      date: (iso, withTime = false) =>
        new Date(iso).toLocaleString(dateTag, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Direction without requiring the provider (for low-level components). */
export function useIsRtl(): boolean {
  return useContext(I18nContext)?.rtl ?? false;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
