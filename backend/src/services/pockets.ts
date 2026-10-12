import {
  convertMinor,
  displayRate,
  FX_MARGIN_BPS,
  MIN_TIER_FOR_SERVICE,
  POCKET_CURRENCIES,
  tierAtLeast,
  type ConversionQuote,
  type CurrencyPocket,
} from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { UserRow } from "../db/rows";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { createCustomerAccount } from "./accounts";
import { audit } from "./audit";
import { balanceOf } from "./ledger";
import { currencyOf } from "./limits";
import { requireWallet, type PaymentDraft } from "./payments";
import { assertActive } from "./users";

interface PocketRow {
  id: string;
  currency: string;
}

interface ConversionQuoteRow {
  id: string;
  user_id: string;
  from_currency: string;
  to_currency: string;
  sell_amount_minor: number;
  buy_amount_minor: number;
  rate: number;
  expires_at: string;
  used_at: string | null;
}

function pocketRows(ctx: AppContext, userId: string): PocketRow[] {
  return all<PocketRow>(ctx.db, "SELECT id, currency FROM accounts WHERE owner_id = ? AND kind = 'POCKET' ORDER BY currency", userId);
}

function pocketFor(ctx: AppContext, userId: string, currency: string): PocketRow | undefined {
  return one<PocketRow>(ctx.db, "SELECT id, currency FROM accounts WHERE owner_id = ? AND kind = 'POCKET' AND currency = ?", userId, currency);
}

function assertEligible(user: UserRow) {
  assertActive(user);
  if (!tierAtLeast(user.kyc_tier, MIN_TIER_FOR_SERVICE.POCKETS)) {
    throw forbidden("Verify your identity (Tier 1) to hold dollars and euros.");
  }
}

export function listPockets(ctx: AppContext, user: UserRow): CurrencyPocket[] {
  const local = currencyOf(user);
  return pocketRows(ctx, user.id).map((p) => {
    const balance = balanceOf(ctx, p.id);
    return { pocketId: p.id, currency: p.currency, balanceMinor: balance, localEquivalentMinor: convertMinor(balance, p.currency, local) ?? 0 };
  });
}

/** Opens a pocket in a supported hard currency. Idempotent per currency. */
export function openPocket(ctx: AppContext, user: UserRow, currency: string): CurrencyPocket[] {
  assertEligible(user);
  requireWallet(user);
  if (!(POCKET_CURRENCIES as readonly string[]).includes(currency)) throw badRequest("That currency isn't available yet");
  if (!pocketFor(ctx, user.id, currency)) {
    withTx(ctx.db, () => {
      const account = createCustomerAccount(ctx, "POCKET", currency, user.id, `${currency} pocket ${user.phone}`);
      audit(ctx, { actorType: "USER", actorId: user.id, action: "POCKET_OPENED", entityType: "account", entityId: account.id, details: { currency } });
    });
  }
  return listPockets(ctx, user);
}

/**
 * Prices a conversion between the local wallet and a pocket. The margin is
 * the only cost and is disclosed with the rate; the quote is single-use,
 * bound to the customer and short-lived.
 */
export function quoteConversion(
  ctx: AppContext,
  user: UserRow,
  input: { fromCurrency: string; toCurrency: string; sellAmountMinor: number },
): ConversionQuote {
  assertEligible(user);
  const local = currencyOf(user);
  const { fromCurrency, toCurrency } = input;
  const foreign = fromCurrency === local ? toCurrency : toCurrency === local ? fromCurrency : null;
  if (!foreign || foreign === local) throw badRequest("Convert between your wallet and one of your pockets");
  if (!pocketFor(ctx, user.id, foreign)) throw badRequest(`Open a ${foreign} pocket first`);
  const buy = convertMinor(input.sellAmountMinor, fromCurrency, toCurrency, FX_MARGIN_BPS);
  if (!buy || buy <= 0) throw badRequest("That amount is too small to convert");

  const id = newId("CVQ");
  const now = ctx.now();
  const expiresAt = new Date(now.getTime() + ctx.config.quoteTtlMs).toISOString();
  const rate = displayRate(fromCurrency, toCurrency);
  run(
    ctx.db,
    `INSERT INTO conversion_quotes (id, user_id, from_currency, to_currency, sell_amount_minor, buy_amount_minor, rate, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    fromCurrency,
    toCurrency,
    input.sellAmountMinor,
    buy,
    rate,
    now.toISOString(),
    expiresAt,
  );
  return { quoteId: id, fromCurrency, toCurrency, sellAmountMinor: input.sellAmountMinor, buyAmountMinor: buy, rate, marginBps: FX_MARGIN_BPS, expiresAt };
}

export function draftConversion(ctx: AppContext, user: UserRow, quoteId: string, deviceId: string | null): PaymentDraft {
  assertEligible(user);
  const quote = one<ConversionQuoteRow>(ctx.db, "SELECT * FROM conversion_quotes WHERE id = ?", quoteId);
  if (!quote || quote.user_id !== user.id) throw notFound("Quote not found");
  if (quote.used_at) throw conflict("This quote was already used. Get a new quote.");
  if (new Date(quote.expires_at) <= ctx.now()) throw conflict("This quote has expired. Get a new quote.");
  const local = currencyOf(user);
  const wallet = requireWallet(user);
  const buying = quote.from_currency === local;
  const pocket = pocketFor(ctx, user.id, buying ? quote.to_currency : quote.from_currency);
  if (!pocket) throw badRequest("Open the pocket first");
  run(ctx.db, "UPDATE conversion_quotes SET used_at = ? WHERE id = ?", ctx.nowIso(), quote.id);

  return {
    type: "FX_CONVERSION",
    userId: user.id,
    amountMinor: quote.sell_amount_minor,
    feeMinor: 0,
    merchantFeeMinor: 0,
    currency: quote.from_currency,
    sourceAccountId: buying ? wallet : pocket.id,
    destinationAccountId: buying ? pocket.id : wallet,
    counterpartyUserId: null,
    counterpartyLabel: `${quote.from_currency} → ${quote.to_currency}`,
    counterpartyKey: `fx:${buying ? quote.to_currency : quote.from_currency}`,
    note: "",
    providerId: null,
    purposeCode: null,
    receiveAmountMinor: quote.buy_amount_minor,
    receiveCurrency: quote.to_currency,
    metadata: { quoteId: quote.id, rate: quote.rate, direction: buying ? "DEBIT" : "CREDIT" },
    minTier: MIN_TIER_FOR_SERVICE.POCKETS,
    // Buying hard currency is an outflow of local money: it counts against
    // limits and is screened (capital-flight and layering typologies).
    outflow: buying,
    checkFunds: true,
    screen: buying,
    recipientCapUserId: null,
    recipientCapAmountMinor: 0,
    deviceId,
  };
}
