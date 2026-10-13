import { describe, expect, it } from "vitest";
import { bidiSafe, CATALOGS, DEFAULT_LOCALE_BY_COUNTRY, en, isRtl, LOCALE_CODES, negotiateLocale, parseMajorToMinor, placeholdersOf, t, type MessageKey } from "@benki/shared";

describe("translations", () => {
  const keys = Object.keys(en) as MessageKey[];

  it.each(LOCALE_CODES)("%s translates every message and keeps its placeholders", (locale) => {
    const catalog = CATALOGS[locale];
    const missing = keys.filter((k) => !catalog[k]?.trim());
    expect(missing).toEqual([]);
    const broken = keys.filter((k) => placeholdersOf(catalog[k]).join() !== placeholdersOf(en[k]).join());
    expect(broken).toEqual([]);
  });

  it("formats amounts for the reader and nests translated names", () => {
    expect(t("fr", "pay.converted", { amount: { amountMinor: 125_050, currency: "KES" }, received: { amountMinor: 969, currency: "USD" } })).toBe(
      "1 250,50 KES converti en 9,69 USD.",
    );
    expect(t("sw", "notif.processing", { type: { key: "type.P2P" }, amount: { amountMinor: 500, currency: "XOF" }, ref: "TXN_1" })).toBe(
      "Uhamisho: 500 XOF inashughulikiwa. Kumb. TXN_1.",
    );
  });

  it("covers Central Africa: Spanish, Arabic (right-to-left, Latin digits) and Lingala", () => {
    expect(DEFAULT_LOCALE_BY_COUNTRY.GQ).toBe("es");
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("fr")).toBe(false);
    expect(negotiateLocale("ar-TD,fr;q=0.8")).toBe("ar");
    expect(negotiateLocale("ln-CD")).toBe("ln");
    expect(t("ar", "ussd.available", { amount: { amountMinor: 1_250_000, currency: "XAF" } })).toBe("المتاح: 1,250,000 XAF");
    expect(t("es", "pay.delivered", { name: "Ana" })).toBe("Entregado a Ana.");
    expect(t("ln", "country.CD")).toBe("Kongó-Kinshasa");
    // Phone numbers keep their "+" in front inside Arabic text; other languages are untouched.
    expect(t("ar", "onboarding.codeSent", { phone: "+23566000001" })).toContain("\u200e+23566000001");
    expect(bidiSafe("fr", "+23566000001")).toBe("+23566000001");
  });

  it("reads amounts typed with Arabic-Indic digits", () => {
    expect(parseMajorToMinor("١٢٥٠٠", "XAF")).toBe(12_500);
    expect(parseMajorToMinor("۱۲۵۰٫۵۰", "USD")).toBe(125_050);
    expect(parseMajorToMinor("١٬٢٥٠", "XAF")).toBe(1_250);
  });
});
