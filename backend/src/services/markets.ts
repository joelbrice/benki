import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, msg, t, USSD_SHORT_CODE, type AdminMarket, type Locale, type MessageKey } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, run } from "../db/query";
import { badRequest, notFound } from "../lib/errors";
import { encryptField, hmacHex } from "../lib/crypto";
import { newId } from "../lib/ids";
import type { StaffRow } from "../db/rows";
import { audit } from "./audit";

const countryMsg = (code: string) => msg(`country.${code}` as MessageKey);

/**
 * Registers interest in a planned market. Idempotent, and the response never
 * reveals whether the number was already on the list.
 */
export function joinWaitlist(ctx: AppContext, phone: string, countryCode: string, locale: Locale): void {
  const country = COUNTRY_BY_CODE[countryCode];
  if (!country) throw badRequest(msg("err.unsupportedCountry"));
  if (country.launch === "LIVE") throw badRequest(msg("err.marketLive", { country: countryMsg(country.code) }));
  if (!phone.startsWith(country.callingCode)) {
    throw badRequest(msg("err.phonePrefix", { country: countryMsg(country.code), prefix: country.callingCode }));
  }
  const phoneHash = hmacHex(ctx.config.dataKey, `waitlist:${phone}`);
  run(
    ctx.db,
    `INSERT INTO market_waitlist (id, country_code, phone_hash, phone_enc, locale, created_at)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (country_code, phone_hash) DO UPDATE SET locale = excluded.locale`,
    newId("WTL"),
    country.code,
    phoneHash,
    encryptField(ctx.config.dataKey, phone),
    locale,
    ctx.nowIso(),
  );
}

/** Every African market with its stage, customers and launch demand. */
export function listMarkets(ctx: AppContext): AdminMarket[] {
  const customers = new Map(
    all<{ country_code: string; n: number }>(ctx.db, "SELECT country_code, COUNT(*) AS n FROM users WHERE merchant_code IS NULL GROUP BY country_code").map((r) => [r.country_code, r.n]),
  );
  const waitlist = new Map(
    all<{ country_code: string; n: number; pending: number }>(
      ctx.db,
      "SELECT country_code, COUNT(*) AS n, SUM(CASE WHEN notified_at IS NULL THEN 1 ELSE 0 END) AS pending FROM market_waitlist GROUP BY country_code",
    ).map((r) => [r.country_code, r]),
  );
  return AFRICAN_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    region: c.region,
    launch: c.launch,
    currency: c.currency,
    zone: c.zone ?? null,
    regulator: c.regulator,
    enhancedDueDiligence: !!c.enhancedDueDiligence,
    customers: customers.get(c.code) ?? 0,
    waitlist: waitlist.get(c.code)?.n ?? 0,
    waitlistPending: waitlist.get(c.code)?.pending ?? 0,
  }));
}

/**
 * Once a market is live, texts everyone who asked to hear about it — once,
 * in the language they chose — through the SMS outbox, and records who did it.
 */
export function notifyWaitlist(ctx: AppContext, staff: StaffRow, countryCode: string): { queued: number } {
  const country = COUNTRY_BY_CODE[countryCode];
  if (!country) throw notFound("Market not found");
  if (country.launch !== "LIVE") throw badRequest("This market hasn't launched yet. Switch it to LIVE before telling the waitlist.");
  return withTx(ctx.db, () => {
    const pending = all<{ id: string; phone_enc: string; locale: Locale }>(
      ctx.db,
      "SELECT id, phone_enc, locale FROM market_waitlist WHERE country_code = ? AND notified_at IS NULL",
      country.code,
    );
    const now = ctx.nowIso();
    for (const entry of pending) {
      const message = t(entry.locale, "notif.marketLaunched", { country: countryMsg(country.code), code: USSD_SHORT_CODE });
      // The outbox keeps the number encrypted; the SMS gateway worker decrypts it at send time.
      run(
        ctx.db,
        "INSERT INTO sms_outbox (id, phone_enc, purpose, message, created_at) VALUES (?, ?, 'MARKET_LAUNCH', ?, ?)",
        newId("SMS"),
        entry.phone_enc,
        message,
        now,
      );
      run(ctx.db, "UPDATE market_waitlist SET notified_at = ? WHERE id = ?", now, entry.id);
    }
    audit(ctx, {
      actorType: "STAFF",
      actorId: staff.id,
      action: "MARKET_WAITLIST_NOTIFIED",
      entityType: "MARKET",
      entityId: country.code,
      details: { queued: pending.length },
    });
    return { queued: pending.length };
  });
}
