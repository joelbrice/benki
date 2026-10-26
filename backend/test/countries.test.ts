import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  AFRICAN_COUNTRIES,
  airtimeNetworks,
  corridorPolicy,
  COUNTRY_BY_CODE,
  currencyDecimals,
  DEFAULT_COUNTRY_CODE,
  formatAmount,
  FX_UNITS_PER_USD,
  LIVE_COUNTRIES,
  parseMajorToMinor,
  PLANNED_COUNTRIES,
} from "@benki/shared";
import { harness } from "./harness";

describe("country modules", () => {
  it("covers all 54 African countries, Cameroon first and the default", () => {
    expect(AFRICAN_COUNTRIES).toHaveLength(54);
    expect(new Set(AFRICAN_COUNTRIES.map((c) => c.code)).size).toBe(54);
    expect(AFRICAN_COUNTRIES[0].code).toBe("CM");
    expect(DEFAULT_COUNTRY_CODE).toBe("CM");
    // Central Africa leads every list.
    expect(AFRICAN_COUNTRIES.slice(0, 9).every((c) => c.region === "CENTRAL")).toBe(true);
    expect(LIVE_COUNTRIES.map((c) => c.code)).toEqual(["CM", "GA", "CG", "TD", "CF", "GQ", "CD", "NG", "GH", "SN", "KE", "TZ"]);
    expect(PLANNED_COUNTRIES).toHaveLength(42);
  });

  it("gives every country what it needs to launch on its own", () => {
    for (const c of AFRICAN_COUNTRIES) {
      expect(FX_UNITS_PER_USD[c.currency], c.code).toBeGreaterThan(0);
      expect(c.agents.length, c.code).toBeGreaterThan(0);
      expect(c.billers.length, c.code).toBeGreaterThan(0);
      expect(c.banks.length, c.code).toBeGreaterThan(0);
      expect(airtimeNetworks(c).length, c.code).toBeGreaterThan(0);
      expect(c.languages.offered[0], c.code).toBe(c.languages.default);
      expect(c.regulator, c.code).toBeTruthy();
      const [t0, t1, t2] = [c.limits.TIER_0, c.limits.TIER_1, c.limits.TIER_2];
      for (const key of ["perTransactionMinor", "dailyMinor", "monthlyMinor", "maxBalanceMinor"] as const) {
        expect(t0[key] <= t1[key] && t1[key] <= t2[key], `${c.code} ${key}`).toBe(true);
      }
      for (const pattern of [...c.billers, ...c.banks].map((x) => x.accountNumberPattern)) expect(() => new RegExp(pattern)).not.toThrow();
    }
  });

  it("keeps identifiers unique and dialling codes unambiguous", () => {
    const ids = AFRICAN_COUNTRIES.flatMap((c) => [...c.agents.map((a) => a.id), ...c.billers.map((b) => b.id), ...c.banks.map((b) => b.id), ...c.merchants.map((m) => m.code)]);
    expect(new Set(ids).size).toBe(ids.length);
    const codes = AFRICAN_COUNTRIES.map((c) => c.callingCode);
    for (const a of codes) for (const b of codes) if (a !== b) expect(b.startsWith(a), `${a} / ${b}`).toBe(false);
  });

  it("applies union and due-diligence rules per corridor", () => {
    // WAEMU and CEMAC: same currency, at par. CMA: pegged currencies, at par.
    expect(corridorPolicy("SN", "CI")).toEqual({ atPar: true, minTier: "TIER_1" });
    expect(corridorPolicy("ZA", "NA")).toEqual({ atPar: true, minTier: "TIER_1" });
    expect(corridorPolicy("ZA", "BW").atPar).toBe(false);
    expect(corridorPolicy("CM", "NG")).toEqual({ atPar: false, minTier: "TIER_2", reason: "EXCHANGE_CONTROL" });
    // Conflict-affected jurisdictions need Tier 2 in both directions.
    expect(corridorPolicy("KE", "SS")).toMatchObject({ minTier: "TIER_2", reason: "ENHANCED_DUE_DILIGENCE" });
    expect(corridorPolicy("SD", "EG")).toMatchObject({ minTier: "TIER_2", reason: "ENHANCED_DUE_DILIGENCE" });
  });

  it("handles currencies with 0, 2 and 3 decimals", () => {
    expect(currencyDecimals("XAF")).toBe(0);
    expect(currencyDecimals("ZAR")).toBe(2);
    expect(currencyDecimals("TND")).toBe(3);
    expect(formatAmount(1_250_500, "TND", "fr")).toBe("1 250,500 TND");
    expect(parseMajorToMinor("1250.5", "TND")).toBe(1_250_500);
    expect(parseMajorToMinor("1,250", "TND")).toBe(1_250_000);
    expect(parseMajorToMinor("12,5", "LYD")).toBe(12_500);
    expect(parseMajorToMinor("1 500", "GNF")).toBe(1_500);
  });
});

describe("planned markets", () => {
  it("are listed but closed: no sign-up, no transfers in, no USSD", async () => {
    const h = harness();
    const signUp = await request(h.app).post("/v1/auth/otp/send").set("accept-language", "fr").send({ phoneNumber: "+256700000001", countryCode: "UG" });
    expect(signUp.status).toBe(400);
    expect(signUp.body.error.message).toBe("Benki n'est pas encore ouvert dans ce pays (Ouganda). Bientôt disponible.");

    const sender = await h.customer("+237670000901", { country: "CM", tier: 2 });
    const quote = await sender.call("post", "/v1/transfers/cross-border/quote", { destinationCountryCode: "UG", sendAmountMinor: 10_000 });
    expect(quote.status).toBe(400);

    const ussd = await request(h.app).post("/v1/ussd/simulator").type("form").send({ sessionId: "planned-1", phoneNumber: "+256700000002", text: "" });
    expect(ussd.text).toMatch(/^END /);
    expect(COUNTRY_BY_CODE.UG.launch).toBe("PLANNED");
  });
});

describe("expansion waitlist", () => {
  const join = (h: ReturnType<typeof harness>, phoneNumber: string, countryCode: string, locale?: string) =>
    request(h.app).post("/v1/markets/waitlist").send({ phoneNumber, countryCode, locale });

  it("collects interest in planned markets without revealing who is already on the list", async () => {
    const h = harness();
    expect((await join(h, "+256700000101", "UG", "en")).status).toBe(202);
    expect((await join(h, "+256700000101", "UG", "sw")).body).toEqual({ joined: true });
    expect((await join(h, "+256700000102", "UG")).status).toBe(202);
    expect((await join(h, "+243810000101", "UG")).status).toBe(400);
    const live = await join(h, "+237670000101", "CM");
    expect(live.status).toBe(400);
    expect(live.body.error.code).toBeDefined();
    // Numbers are stored encrypted; the list never holds them in clear.
    const rows = h.ctx.db.prepare("SELECT phone_enc FROM market_waitlist").all() as { phone_enc: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.phone_enc.includes("256700000101"))).toBe(true);

    const supervisor = await h.staff("supervisor");
    const markets = (await supervisor("get", "/v1/admin/markets")).body.markets as { code: string; launch: string; waitlist: number; customers: number }[];
    expect(markets).toHaveLength(54);
    expect(markets[0]).toMatchObject({ code: "CM", launch: "LIVE" });
    expect(markets.find((m) => m.code === "UG")).toMatchObject({ launch: "PLANNED", waitlist: 2 });
  });

  it("texts the waitlist once, in each person's language, after the market goes live", async () => {
    const h = harness();
    await join(h, "+256700000201", "UG", "sw");
    await join(h, "+256700000202", "UG", "en");
    const supervisor = await h.staff("supervisor");
    const analyst = await h.staff("analyst");
    expect((await supervisor("post", "/v1/admin/markets/UG/notify-waitlist")).status).toBe(400);

    COUNTRY_BY_CODE.UG.launch = "LIVE"; // what launching the Uganda module does
    try {
      expect((await analyst("post", "/v1/admin/markets/UG/notify-waitlist")).status).toBe(403);
      expect((await supervisor("post", "/v1/admin/markets/UG/notify-waitlist")).body).toEqual({ queued: 2 });
      expect((await supervisor("post", "/v1/admin/markets/UG/notify-waitlist")).body).toEqual({ queued: 0 });
    } finally {
      COUNTRY_BY_CODE.UG.launch = "PLANNED";
    }
    const sms = h.ctx.db.prepare("SELECT message FROM sms_outbox ORDER BY message").all() as { message: string }[];
    expect(sms.map((s) => s.message)).toEqual([
      "Benki is now open in Uganda! Download the app or dial *384*236# on any phone to open your account.",
      "Benki sasa imefunguliwa nchini Uganda! Pakua programu au piga *384*236# kwenye simu yoyote kufungua akaunti yako.",
    ]);
    const audit = h.ctx.db.prepare("SELECT action FROM audit_log WHERE action = 'MARKET_WAITLIST_NOTIFIED'").all();
    expect(audit).toHaveLength(2);
  });
});
