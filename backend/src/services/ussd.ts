import {
  AFRICAN_COUNTRIES,
  COUNTRY_BY_CODE,
  customerFeeMinor,
  formatAmount,
  intlTag,
  LANGUAGES_BY_COUNTRY,
  LOCALES,
  money,
  parseMajorToMinor,
  renderMsg,
  t,
  USSD_SHORT_CODE,
  type FeeBearingType,
  type Locale,
  type MessageKey,
  type MsgParams,
} from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, run } from "../db/query";
import type { TransactionRow, UserRow } from "../db/rows";
import { ApiError } from "../lib/errors";
import { newId } from "../lib/ids";
import { createCustomerAccount } from "./accounts";
import { audit } from "./audit";
import { currencyOf } from "./limits";
import { draftAirtime, draftCashOut, draftP2P, type PaymentDraft } from "./payments";
import { runPayment } from "./pipeline";
import { setPin, verifyPin } from "./pin";
import { getUser, getUserByPhone, maskPhone, walletView } from "./users";
import { directionFor } from "./views";

/**
 * Feature-phone channel (Africa's Talking-style USSD callbacks). The mobile
 * network authenticates the SIM, so the gateway-asserted MSISDN identifies the
 * customer; every money movement still needs the PIN and runs through exactly
 * the same pipeline (limits, AML screening, idempotency, ledger) as the apps.
 *
 * The aggregator re-sends the whole session's input on each step as `text`
 * ("2*0712345678*500*1234"), so menus are a pure function of that string.
 * Responses start with "CON" (expect more input) or "END" (close the session).
 */
export interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
}

const con = (lines: string[]) => `CON ${lines.join("\n")}`;
const end = (lines: string[]) => `END ${lines.join("\n")}`;
const PIN_RE = /^\d{4,6}$/;

function countryForPhone(phone: string) {
  return AFRICAN_COUNTRIES.find((c) => phone.startsWith(c.callingCode));
}

/** Accepts local ("0712 345 678") or international numbers; returns E.164 or null. */
export function toE164(input: string, callingCode: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  const e164 = digits.startsWith("+") ? digits : digits.startsWith("0") ? callingCode + digits.slice(1) : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** One USSD screen's worth of context: who is dialling and in which language. */
interface Screen {
  ctx: AppContext;
  locale: Locale;
  tr: (key: MessageKey, params?: MsgParams) => string;
}

function screen(ctx: AppContext, locale: Locale): Screen {
  return { ctx, locale, tr: (key, params) => t(locale, key, params) };
}

export async function handleUssd(ctx: AppContext, req: UssdRequest): Promise<string> {
  const country = countryForPhone(req.phoneNumber);
  if (!country) return end([t("en", "ussd.notAvailable")]);
  const steps = req.text === "" ? [] : req.text.split("*");
  const user = getUserByPhone(ctx, req.phoneNumber);
  const s = screen(ctx, user?.locale ?? LANGUAGES_BY_COUNTRY[country.code]?.[0] ?? "en");
  try {
    if (!user || !user.pin_hash || !user.wallet_account_id) return register(s, req.phoneNumber, country.code, user, steps);
    if (user.status === "CLOSED") return end([s.tr("ussd.closed")]);
    return await menu(s, user, req.sessionId, steps);
  } catch (error) {
    if (error instanceof ApiError) return end([renderMsg(s.locale, error.text)]);
    throw error;
  }
}

/**
 * Registration offers the market's languages (plus English). The menu adds
 * French too, but not every language: a USSD screen holds 182 GSM-7
 * characters, and one non-Latin name (Arabic) switches the whole screen to
 * UCS-2, which halves that. The apps offer every language.
 */
function languageOptions(countryCode: string, all: boolean): Locale[] {
  const local = LANGUAGES_BY_COUNTRY[countryCode] ?? ["en"];
  if (all) return LOCALES.map((l) => l.code).filter((code) => code === "en" || code === "fr" || local.includes(code));
  return local.includes("en") ? local : [...local, "en"];
}

const languageLines = (options: Locale[]) => options.map((code, i) => `${i + 1}. ${LOCALES.find((l) => l.code === code)!.name}`);

/** Registration: language → PIN → confirm PIN. The SIM proves possession of the number. */
function register(s0: Screen, phone: string, countryCode: string, existing: UserRow | undefined, steps: string[]): string {
  const options = languageOptions(countryCode, false);
  if (steps.length === 0) return con([s0.tr("ussd.welcome"), ...languageLines(options)]);
  const locale = options[Number(steps[0]) - 1];
  if (!locale) return end([s0.tr("ussd.invalidChoice")]);
  const s = screen(s0.ctx, locale);
  const [, pin, confirm] = steps;
  if (steps.length === 1) return con([s.tr("ussd.createAccount"), s.tr("ussd.choosePin")]);
  if (!PIN_RE.test(pin)) return end([s.tr("ussd.pinFormat")]);
  if (steps.length === 2) return con([s.tr("ussd.confirmPin")]);
  if (confirm !== pin) return end([s.tr("ussd.pinMismatch")]);

  const ctx = s.ctx;
  withTx(ctx.db, () => {
    let user = existing;
    const now = ctx.nowIso();
    if (!user) {
      const id = newId("USR");
      run(ctx.db, "INSERT INTO users (id, phone, country_code, locale, created_at) VALUES (?, ?, ?, ?, ?)", id, phone, countryCode, locale, now);
      audit(ctx, { actorType: "USER", actorId: id, action: "USER_REGISTERED", entityType: "user", entityId: id, details: { countryCode, channel: "USSD" } });
      user = getUser(ctx, id)!;
    } else {
      run(ctx.db, "UPDATE users SET locale = ? WHERE id = ?", locale, user.id);
    }
    if (!user.wallet_account_id) {
      const account = createCustomerAccount(ctx, "WALLET", currencyOf(user), user.id, `Wallet ${user.phone}`);
      run(ctx.db, "UPDATE users SET wallet_account_id = ? WHERE id = ?", account.id, user.id);
      audit(ctx, { actorType: "USER", actorId: user.id, action: "WALLET_CREATED", entityType: "account", entityId: account.id });
      user = getUser(ctx, user.id)!;
    }
    if (!user.pin_hash) setPin(ctx, user, pin);
  });
  return end([s.tr("ussd.ready"), s.tr("ussd.dialAgain", { code: USSD_SHORT_CODE })]);
}

async function menu(s: Screen, user: UserRow, sessionId: string, steps: string[]): Promise<string> {
  if (steps.length === 0) {
    return con([
      "Benki",
      `1. ${s.tr("ussd.menuBalance")}`,
      `2. ${s.tr("ussd.menuSend")}`,
      `3. ${s.tr("ussd.menuAirtime")}`,
      `4. ${s.tr("ussd.menuWithdraw")}`,
      `5. ${s.tr("ussd.menuStatement")}`,
      `6. ${s.tr("ussd.menuLanguage")}`,
      `0. ${s.tr("ussd.menuExit")}`,
    ]);
  }
  const [choice, ...rest] = steps;
  switch (choice) {
    case "1":
      return balance(s, user, rest);
    case "2":
      return sendMoney(s, user, sessionId, rest);
    case "3":
      return airtime(s, user, sessionId, rest);
    case "4":
      return withdraw(s, user, sessionId, rest);
    case "5":
      return miniStatement(s, user, rest);
    case "6":
      return language(s, user, rest);
    case "0":
      return end([s.tr("ussd.thanks")]);
    default:
      return end([s.tr("ussd.invalidChoice")]);
  }
}

function language(s: Screen, user: UserRow, rest: string[]): string {
  const options = languageOptions(user.country_code, true);
  if (rest.length === 0) return con([s.tr("ussd.chooseLanguage"), ...languageLines(options)]);
  const locale = options[Number(rest[0]) - 1];
  if (!locale) return end([s.tr("ussd.invalidChoice")]);
  run(s.ctx.db, "UPDATE users SET locale = ? WHERE id = ?", locale, user.id);
  return end([t(locale, "ussd.languageSaved")]);
}

function balance(s: Screen, user: UserRow, rest: string[]): string {
  if (rest.length === 0) return con([s.tr("ussd.enterPin")]);
  verifyPin(s.ctx, user, rest[0]);
  const wallet = walletView(s.ctx, user.wallet_account_id!);
  return end([s.tr("ussd.available", { amount: money(wallet.availableBalanceMinor, wallet.currency) }), s.ctx.nowIso().slice(0, 16).replace("T", " ")]);
}

function confirmLines(s: Screen, type: FeeBearingType, amountMinor: number, currency: string, what: string): string[] {
  const fee = customerFeeMinor(type, amountMinor);
  return [
    `${what}: ${formatAmount(amountMinor, currency, intlTag(s.locale))}`,
    fee ? s.tr("ussd.fee", { fee: money(fee, currency), total: money(amountMinor + fee, currency) }) : s.tr("ussd.noFee"),
    s.tr("ussd.confirmWithPin"),
  ];
}

async function pay(
  s: Screen,
  user: UserRow,
  sessionId: string,
  operation: string,
  pin: string,
  body: Record<string, unknown>,
  build: (u: UserRow) => PaymentDraft,
): Promise<string> {
  const result = await runPayment(s.ctx, {
    user,
    deviceId: null,
    operation: `ussd-${operation}`,
    // One payment per USSD session: a gateway retry replays instead of paying twice.
    body: { ...body, idempotencyKey: `ussd:${sessionId}`, pin },
    requirePin: true,
    build,
    locale: s.locale,
  });
  const payload = result.body as { message?: string; transaction?: { id: string }; error?: { message: string } };
  if (payload.error) return end([payload.error.message]);
  return end([payload.message ?? s.tr("ussd.done"), payload.transaction ? s.tr("ussd.ref", { ref: payload.transaction.id }) : ""].filter(Boolean));
}

async function sendMoney(s: Screen, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const country = COUNTRY_BY_CODE[user.country_code];
  const currency = currencyOf(user);
  const [phoneInput, amountInput, pin] = rest;
  if (rest.length === 0) return con([s.tr("ussd.recipientPhone")]);
  const phone = toE164(phoneInput, country.callingCode);
  if (!phone) return end([s.tr("ussd.invalidPhone")]);
  const recipient = getUserByPhone(s.ctx, phone);
  if (!recipient || recipient.id === user.id || recipient.country_code !== user.country_code) return end([s.tr("ussd.noRecipient")]);
  const name = recipient.full_name ?? maskPhone(recipient.phone);
  if (rest.length === 1) return con([s.tr("ussd.sendTo", { name }), s.tr("ussd.enterAmount", { currency })]);
  const amountMinor = parseMajorToMinor(amountInput, currency);
  if (!amountMinor) return end([s.tr("ussd.invalidAmount")]);
  if (rest.length === 2) return con(confirmLines(s, "P2P", amountMinor, currency, s.tr("ussd.sendTo", { name })));
  return pay(s, user, sessionId, "p2p", pin, { destinationPhoneNumber: phone, amountMinor }, (u) =>
    draftP2P(s.ctx, u, { destinationPhoneNumber: phone, amountMinor }, null),
  );
}

async function airtime(s: Screen, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const networks = COUNTRY_BY_CODE[user.country_code].mobileMoneyProviders;
  const currency = currencyOf(user);
  const [networkInput, amountInput, pin] = rest;
  if (rest.length === 0) return con([s.tr("ussd.chooseNetwork"), ...networks.map((n, i) => `${i + 1}. ${n.label}`)]);
  const network = networks[Number(networkInput) - 1];
  if (!network) return end([s.tr("ussd.invalidChoice")]);
  if (rest.length === 1) return con([s.tr("ussd.airtimeFor", { phone: user.phone }), s.tr("ussd.enterAmount", { currency })]);
  const amountMinor = parseMajorToMinor(amountInput, currency);
  if (!amountMinor) return end([s.tr("ussd.invalidAmount")]);
  if (rest.length === 2) return con(confirmLines(s, "AIRTIME", amountMinor, currency, s.tr("ussd.airtimeOf", { network: network.label })));
  return pay(s, user, sessionId, "airtime", pin, { providerId: network.id, amountMinor }, (u) =>
    draftAirtime(s.ctx, u, { providerId: network.id, amountMinor }, null),
  );
}

async function withdraw(s: Screen, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const agents = COUNTRY_BY_CODE[user.country_code].agents;
  const currency = currencyOf(user);
  const [agentInput, amountInput, pin] = rest;
  if (rest.length === 0) return con([s.tr("ussd.chooseAgent"), ...agents.map((a, i) => `${i + 1}. ${a.name}`)]);
  const agent = agents[Number(agentInput) - 1];
  if (!agent) return end([s.tr("ussd.invalidChoice")]);
  if (rest.length === 1) return con([agent.name, s.tr("ussd.enterAmount", { currency })]);
  const amountMinor = parseMajorToMinor(amountInput, currency);
  if (!amountMinor) return end([s.tr("ussd.invalidAmount")]);
  if (rest.length === 2) return con(confirmLines(s, "CASH_OUT", amountMinor, currency, s.tr("ussd.withdrawAt", { agent: agent.name })));
  return pay(s, user, sessionId, "cash-out", pin, { agentId: agent.id, amountMinor }, (u) =>
    draftCashOut(u, { agentId: agent.id, amountMinor }, null),
  );
}

function miniStatement(s: Screen, user: UserRow, rest: string[]): string {
  if (rest.length === 0) return con([s.tr("ussd.enterPin")]);
  verifyPin(s.ctx, user, rest[0]);
  const rows = all<TransactionRow>(
    s.ctx.db,
    `SELECT * FROM transactions
     WHERE (initiator_user_id = ? OR (counterparty_user_id = ? AND status IN ('COMPLETED', 'REVERSED')))
       AND status IN ('COMPLETED', 'REVERSED', 'PENDING', 'PENDING_REVIEW')
     ORDER BY created_at DESC, rowid DESC LIMIT 5`,
    user.id,
    user.id,
  );
  if (!rows.length) return end([s.tr("ussd.noTransactions")]);
  const tag = intlTag(s.locale);
  return end([
    s.tr("ussd.lastTransactions"),
    ...rows.map((tx) => {
      const sign = directionFor(tx, user.id) === "CREDIT" ? "+" : "-";
      const receiving = tx.initiator_user_id !== user.id && tx.receive_amount_minor !== null;
      const amount = receiving ? formatAmount(tx.receive_amount_minor!, tx.receive_currency!, tag) : formatAmount(tx.amount_minor, tx.currency, tag);
      return `${tx.created_at.slice(5, 10)} ${sign}${amount}`;
    }),
  ]);
}
