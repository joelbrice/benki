import {
  AFRICAN_COUNTRIES,
  COUNTRY_BY_CODE,
  customerFeeMinor,
  formatAmount,
  parseMajorToMinor,
  USSD_SHORT_CODE,
  type FeeBearingType,
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

export async function handleUssd(ctx: AppContext, req: UssdRequest): Promise<string> {
  const country = countryForPhone(req.phoneNumber);
  if (!country) return end(["Benki isn't available on this network yet."]);
  const steps = req.text === "" ? [] : req.text.split("*");
  try {
    const user = getUserByPhone(ctx, req.phoneNumber);
    if (!user || !user.pin_hash || !user.wallet_account_id) return register(ctx, req.phoneNumber, country.code, user, steps);
    if (user.status === "CLOSED") return end(["This account is closed. Please contact support."]);
    return await menu(ctx, user, req.sessionId, steps);
  } catch (error) {
    if (error instanceof ApiError) return end([error.message]);
    throw error;
  }
}

function register(ctx: AppContext, phone: string, countryCode: string, existing: UserRow | undefined, steps: string[]): string {
  if (steps.length === 0) {
    return con(["Welcome to Benki!", "Create your account in seconds.", "Choose a 4-digit PIN:"]);
  }
  const [pin, confirm] = steps;
  if (!PIN_RE.test(pin)) return end(["PIN must be 4 to 6 digits. Dial again to retry."]);
  if (steps.length === 1) return con(["Re-enter your PIN to confirm:"]);
  if (confirm !== pin) return end(["The PINs didn't match. Dial again to retry."]);

  withTx(ctx.db, () => {
    let user = existing;
    const now = ctx.nowIso();
    if (!user) {
      const id = newId("USR");
      run(ctx.db, "INSERT INTO users (id, phone, country_code, created_at) VALUES (?, ?, ?, ?)", id, phone, countryCode, now);
      audit(ctx, { actorType: "USER", actorId: id, action: "USER_REGISTERED", entityType: "user", entityId: id, details: { countryCode, channel: "USSD" } });
      user = getUser(ctx, id)!;
    }
    if (!user.wallet_account_id) {
      const account = createCustomerAccount(ctx, "WALLET", currencyOf(user), user.id, `Wallet ${user.phone}`);
      run(ctx.db, "UPDATE users SET wallet_account_id = ? WHERE id = ?", account.id, user.id);
      audit(ctx, { actorType: "USER", actorId: user.id, action: "WALLET_CREATED", entityType: "account", entityId: account.id });
      user = getUser(ctx, user.id)!;
    }
    if (!user.pin_hash) setPin(ctx, user, pin);
  });
  return end(["Your Benki account is ready.", `Dial ${USSD_SHORT_CODE} to check your balance, send money and more.`]);
}

const MAIN_MENU = ["Benki", "1. Check balance", "2. Send money", "3. Buy airtime", "4. Withdraw cash", "5. Mini statement", "0. Exit"];

async function menu(ctx: AppContext, user: UserRow, sessionId: string, steps: string[]): Promise<string> {
  if (steps.length === 0) return con(MAIN_MENU);
  const [choice, ...rest] = steps;
  switch (choice) {
    case "1":
      return balance(ctx, user, rest);
    case "2":
      return sendMoney(ctx, user, sessionId, rest);
    case "3":
      return airtime(ctx, user, sessionId, rest);
    case "4":
      return withdraw(ctx, user, sessionId, rest);
    case "5":
      return miniStatement(ctx, user, rest);
    case "0":
      return end(["Thank you for using Benki."]);
    default:
      return end(["Invalid choice. Dial again to retry."]);
  }
}

function balance(ctx: AppContext, user: UserRow, rest: string[]): string {
  if (rest.length === 0) return con(["Enter your PIN:"]);
  verifyPin(ctx, user, rest[0]);
  const wallet = walletView(ctx, user.wallet_account_id!);
  return end([`Available: ${formatAmount(wallet.availableBalanceMinor, wallet.currency)}`, `Ref ${new Date(ctx.now()).toISOString().slice(0, 16).replace("T", " ")}`]);
}

function amountOf(input: string, currency: string): number | null {
  return parseMajorToMinor(input, currency);
}

function confirmLines(type: FeeBearingType, amountMinor: number, currency: string, what: string): string[] {
  const fee = customerFeeMinor(type, amountMinor);
  return [
    `${what}: ${formatAmount(amountMinor, currency)}`,
    fee ? `Fee: ${formatAmount(fee, currency)}. Total ${formatAmount(amountMinor + fee, currency)}` : "No fee",
    "Enter PIN to confirm:",
  ];
}

async function pay(
  ctx: AppContext,
  user: UserRow,
  sessionId: string,
  operation: string,
  pin: string,
  body: Record<string, unknown>,
  build: (u: UserRow) => PaymentDraft,
): Promise<string> {
  const result = await runPayment(ctx, {
    user,
    deviceId: null,
    operation: `ussd-${operation}`,
    // One payment per USSD session: a gateway retry replays instead of paying twice.
    body: { ...body, idempotencyKey: `ussd:${sessionId}`, pin },
    requirePin: true,
    build,
  });
  const payload = result.body as { message?: string; transaction?: { id: string }; error?: { message: string } };
  if (payload.error) return end([payload.error.message]);
  return end([payload.message ?? "Done.", payload.transaction ? `Ref ${payload.transaction.id}` : ""].filter(Boolean));
}

async function sendMoney(ctx: AppContext, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const country = COUNTRY_BY_CODE[user.country_code];
  const currency = currencyOf(user);
  const [phoneInput, amountInput, pin] = rest;
  if (rest.length === 0) return con(["Enter the recipient's phone number:"]);
  const phone = toE164(phoneInput, country.callingCode);
  if (!phone) return end(["That phone number isn't valid. Dial again to retry."]);
  const recipient = getUserByPhone(ctx, phone);
  if (!recipient || recipient.id === user.id || recipient.country_code !== user.country_code) {
    return end(["No Benki account in your country is registered to that number."]);
  }
  if (rest.length === 1) return con([`Send to ${recipient.full_name ?? maskPhone(recipient.phone)}`, `Enter amount (${currency}):`]);
  const amountMinor = amountOf(amountInput, currency);
  if (!amountMinor) return end(["That amount isn't valid. Dial again to retry."]);
  if (rest.length === 2) return con(confirmLines("P2P", amountMinor, currency, `Send to ${recipient.full_name ?? maskPhone(recipient.phone)}`));
  return pay(ctx, user, sessionId, "p2p", pin, { destinationPhoneNumber: phone, amountMinor }, (u) =>
    draftP2P(ctx, u, { destinationPhoneNumber: phone, amountMinor }, null),
  );
}

async function airtime(ctx: AppContext, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const networks = COUNTRY_BY_CODE[user.country_code].mobileMoneyProviders;
  const currency = currencyOf(user);
  const [networkInput, amountInput, pin] = rest;
  if (rest.length === 0) return con(["Choose network:", ...networks.map((n, i) => `${i + 1}. ${n.label}`)]);
  const network = networks[Number(networkInput) - 1];
  if (!network) return end(["Invalid choice. Dial again to retry."]);
  if (rest.length === 1) return con([`Airtime for ${user.phone}`, `Enter amount (${currency}):`]);
  const amountMinor = amountOf(amountInput, currency);
  if (!amountMinor) return end(["That amount isn't valid. Dial again to retry."]);
  if (rest.length === 2) return con(confirmLines("AIRTIME", amountMinor, currency, `${network.label} airtime`));
  return pay(ctx, user, sessionId, "airtime", pin, { providerId: network.id, amountMinor }, (u) =>
    draftAirtime(ctx, u, { providerId: network.id, amountMinor }, null),
  );
}

async function withdraw(ctx: AppContext, user: UserRow, sessionId: string, rest: string[]): Promise<string> {
  const agents = COUNTRY_BY_CODE[user.country_code].agents;
  const currency = currencyOf(user);
  const [agentInput, amountInput, pin] = rest;
  if (rest.length === 0) return con(["Choose agent:", ...agents.map((a, i) => `${i + 1}. ${a.name}`)]);
  const agent = agents[Number(agentInput) - 1];
  if (!agent) return end(["Invalid choice. Dial again to retry."]);
  if (rest.length === 1) return con([agent.name, `Enter amount (${currency}):`]);
  const amountMinor = amountOf(amountInput, currency);
  if (!amountMinor) return end(["That amount isn't valid. Dial again to retry."]);
  if (rest.length === 2) return con(confirmLines("CASH_OUT", amountMinor, currency, `Withdraw at ${agent.name}`));
  return pay(ctx, user, sessionId, "cash-out", pin, { agentId: agent.id, amountMinor }, (u) =>
    draftCashOut(u, { agentId: agent.id, amountMinor }, null),
  );
}

function miniStatement(ctx: AppContext, user: UserRow, rest: string[]): string {
  if (rest.length === 0) return con(["Enter your PIN:"]);
  verifyPin(ctx, user, rest[0]);
  const rows = all<TransactionRow>(
    ctx.db,
    `SELECT * FROM transactions
     WHERE (initiator_user_id = ? OR (counterparty_user_id = ? AND status IN ('COMPLETED', 'REVERSED')))
       AND status IN ('COMPLETED', 'REVERSED', 'PENDING', 'PENDING_REVIEW')
     ORDER BY created_at DESC, rowid DESC LIMIT 5`,
    user.id,
    user.id,
  );
  if (!rows.length) return end(["No transactions yet."]);
  return end([
    "Last transactions:",
    ...rows.map((t) => {
      const sign = directionFor(t, user.id) === "CREDIT" ? "+" : "-";
      const receiving = t.initiator_user_id !== user.id && t.receive_amount_minor !== null;
      const amount = receiving ? formatAmount(t.receive_amount_minor!, t.receive_currency!) : formatAmount(t.amount_minor, t.currency);
      return `${t.created_at.slice(5, 10)} ${sign}${amount}`;
    }),
  ]);
}
