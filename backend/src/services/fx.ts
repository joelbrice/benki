import {
  COUNTRY_BY_CODE,
  customerFeeMinor,
  FX_MARGIN_BPS,
  FX_UNITS_PER_USD,
  MIN_TIER_FOR_SERVICE,
  minorUnitsPerMajor,
  tierAtLeast,
  type FxQuote,
} from "@benki/shared";
import type { AppContext } from "../context";
import { run } from "../db/query";
import type { UserRow } from "../db/rows";
import { badRequest, forbidden } from "../lib/errors";
import { newId } from "../lib/ids";
import { currencyOf } from "./limits";
import { assertActive } from "./users";

/**
 * Prices a cross-border transfer and locks the rate for a short window. The
 * quote is single-use and bound to the customer, so the rate they confirmed is
 * exactly the rate that posts — even if the payment is held for review.
 */
export function createFxQuote(ctx: AppContext, user: UserRow, destinationCountryCode: string, sendAmountMinor: number): FxQuote {
  assertActive(user);
  if (!tierAtLeast(user.kyc_tier, MIN_TIER_FOR_SERVICE.CROSS_BORDER)) {
    throw forbidden("Verify your identity (Tier 1) to send money abroad.");
  }
  const destination = COUNTRY_BY_CODE[destinationCountryCode];
  if (!destination) throw badRequest("We don't send to that country yet");
  if (destination.code === user.country_code) throw badRequest("For payments within your country, use a local transfer");

  const sendCurrency = currencyOf(user);
  const receiveCurrency = destination.currency;
  const sendRate = FX_UNITS_PER_USD[sendCurrency];
  const receiveRate = FX_UNITS_PER_USD[receiveCurrency];
  if (!sendRate || !receiveRate) throw badRequest("This corridor isn't available right now");

  // Multiply everything out before the single division so the result isn't
  // pushed below an integer boundary by a rounded intermediate rate.
  const numerator = sendAmountMinor * receiveRate * minorUnitsPerMajor(receiveCurrency) * (10_000 - FX_MARGIN_BPS);
  const denominator = sendRate * minorUnitsPerMajor(sendCurrency) * 10_000;
  const receiveAmountMinor = Math.floor(numerator / denominator + 1e-9);
  if (receiveAmountMinor <= 0) throw badRequest("That amount is too small to send abroad");
  const rate = Math.round((receiveRate / sendRate) * (1 - FX_MARGIN_BPS / 10_000) * 1e6) / 1e6;

  const feeMinor = customerFeeMinor("CROSS_BORDER", sendAmountMinor);
  const quoteId = newId("FXQ");
  const now = ctx.now();
  const expiresAt = new Date(now.getTime() + ctx.config.quoteTtlMs).toISOString();
  run(
    ctx.db,
    `INSERT INTO fx_quotes (id, user_id, destination_country, send_currency, receive_currency, send_amount_minor, fee_minor,
       receive_amount_minor, rate, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    quoteId,
    user.id,
    destination.code,
    sendCurrency,
    receiveCurrency,
    sendAmountMinor,
    feeMinor,
    receiveAmountMinor,
    rate,
    now.toISOString(),
    expiresAt,
  );
  return {
    quoteId,
    sendCurrency,
    sendAmountMinor,
    feeMinor,
    totalDebitMinor: sendAmountMinor + feeMinor,
    receiveCurrency,
    receiveAmountMinor,
    rate,
    expiresAt,
  };
}
