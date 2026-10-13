import {
  type MessageKey,
  convertMinor,
  corridorPolicy,
  COUNTRY_BY_CODE,
  customerFeeMinor,
  displayRate,
  FX_MARGIN_BPS,
  FX_UNITS_PER_USD,
  MIN_TIER_FOR_SERVICE,
  tierAtLeast,
  type FxQuote, msg } from "@benki/shared";
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
    throw forbidden(msg("err.tierRequired"));
  }
  const destination = COUNTRY_BY_CODE[destinationCountryCode];
  // Transfers only go to launched markets, where a local partner pays out.
  if (!destination || destination.launch !== "LIVE") throw badRequest(msg("err.corridorUnavailable"));
  if (destination.code === user.country_code) throw badRequest(msg("err.useLocal"));
  const policy = corridorPolicy(user.country_code, destination.code);
  if (!tierAtLeast(user.kyc_tier, policy.minTier)) {
    if (policy.reason === "ENHANCED_DUE_DILIGENCE") {
      const flagged = COUNTRY_BY_CODE[user.country_code].enhancedDueDiligence ? user.country_code : destination.code;
      throw forbidden(msg("err.eddCorridor", { country: msg(`country.${flagged}` as MessageKey) }));
    }
    throw forbidden(msg("err.cemacOutbound"));
  }

  const sendCurrency = currencyOf(user);
  const receiveCurrency = destination.currency;
  const sendRate = FX_UNITS_PER_USD[sendCurrency];
  const receiveRate = FX_UNITS_PER_USD[receiveCurrency];
  if (!sendRate || !receiveRate) throw badRequest(msg("err.corridorUnavailable"));

  // Multiply everything out before the single division so the result isn't
  // pushed below an integer boundary by a rounded intermediate rate.
  // Inside a currency union the money never changes currency: no margin, rate 1.
  const marginBps = policy.atPar ? 0 : FX_MARGIN_BPS;
  const receiveAmountMinor = convertMinor(sendAmountMinor, sendCurrency, receiveCurrency, marginBps)!;
  if (receiveAmountMinor <= 0) throw badRequest(msg("err.amountTooSmall"));
  const rate = displayRate(sendCurrency, receiveCurrency, marginBps);

  const feeMinor = customerFeeMinor(policy.atPar ? "REGIONAL_TRANSFER" : "CROSS_BORDER", sendAmountMinor);
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
