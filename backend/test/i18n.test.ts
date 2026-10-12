import { describe, expect, it } from "vitest";
import { CATALOGS, en, LOCALE_CODES, placeholdersOf, t, type MessageKey } from "@benki/shared";

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
});
