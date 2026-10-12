import { formatAmount, type PaymentRequest, type PaymentRequestStatus } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { TransactionRow, UserRow } from "../db/rows";
import { DAY } from "../lib/clock";
import { badRequest, conflict, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { audit } from "./audit";
import { currencyOf } from "./limits";
import { notify } from "./notifications";
import { draftP2P, type PaymentDraft } from "./payments";
import { assertActive, getUser, getUserByPhone, maskPhone } from "./users";

const REQUEST_TTL_MS = 7 * DAY;
/** Caps unsolicited requests so the feature can't be used to spam or harass. */
const MAX_PENDING_OUTGOING = 10;
const MAX_PENDING_TO_SAME_PAYER = 2;

interface RequestRow {
  id: string;
  requester_id: string;
  payer_id: string;
  amount_minor: number;
  currency: string;
  note: string;
  status: Exclude<PaymentRequestStatus, "EXPIRED">;
  created_at: string;
  expires_at: string;
  transaction_id: string | null;
}

function statusOf(ctx: AppContext, row: RequestRow): PaymentRequestStatus {
  return row.status === "PENDING" && new Date(row.expires_at) <= ctx.now() ? "EXPIRED" : row.status;
}

function toRequest(ctx: AppContext, row: RequestRow, viewerId: string): PaymentRequest {
  const incoming = row.payer_id === viewerId;
  const other = getUser(ctx, incoming ? row.requester_id : row.payer_id)!;
  return {
    requestId: row.id,
    direction: incoming ? "INCOMING" : "OUTGOING",
    counterparty: other.full_name ?? maskPhone(other.phone),
    counterpartyPhoneMasked: maskPhone(other.phone),
    amountMinor: row.amount_minor,
    currency: row.currency,
    note: row.note,
    status: statusOf(ctx, row),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    transactionId: row.transaction_id,
  };
}

export function listRequests(ctx: AppContext, userId: string): PaymentRequest[] {
  return all<RequestRow>(
    ctx.db,
    "SELECT * FROM payment_requests WHERE requester_id = ? OR payer_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50",
    userId,
    userId,
  ).map((r) => toRequest(ctx, r, userId));
}

export function createRequest(ctx: AppContext, user: UserRow, input: { payerPhoneNumber: string; amountMinor: number; note?: string }): PaymentRequest {
  assertActive(user);
  const payer = getUserByPhone(ctx, input.payerPhoneNumber);
  if (!payer || payer.country_code !== user.country_code || !payer.wallet_account_id) {
    throw notFound("No Benki account in your country is registered to that number");
  }
  if (payer.id === user.id) throw badRequest("You can't request money from yourself");
  const now = ctx.now();
  const pending = (sql: string, ...params: string[]) =>
    one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM payment_requests WHERE status = 'PENDING' AND expires_at > ? AND ${sql}`, now.toISOString(), ...params)!.n;
  if (pending("requester_id = ?", user.id) >= MAX_PENDING_OUTGOING) {
    throw conflict(`You have ${MAX_PENDING_OUTGOING} requests waiting. Cancel some before sending more.`);
  }
  if (pending("requester_id = ? AND payer_id = ?", user.id, payer.id) >= MAX_PENDING_TO_SAME_PAYER) {
    throw conflict("You already have requests waiting with this person.");
  }
  const note = (input.note ?? "").trim().slice(0, 140);
  const id = newId("REQ");
  return withTx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO payment_requests (id, requester_id, payer_id, amount_minor, currency, note, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      id,
      user.id,
      payer.id,
      input.amountMinor,
      currencyOf(user),
      note,
      now.toISOString(),
      new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
    );
    notify(
      ctx,
      payer.id,
      "TRANSACTION",
      `${user.full_name ?? maskPhone(user.phone)} asked you for ${formatAmount(input.amountMinor, currencyOf(user))}${note ? ` — “${note}”` : ""}. Only pay if you know them.`,
    );
    audit(ctx, { actorType: "USER", actorId: user.id, action: "PAYMENT_REQUESTED", entityType: "payment_request", entityId: id, details: { payerId: payer.id, amountMinor: input.amountMinor } });
    return toRequest(ctx, one<RequestRow>(ctx.db, "SELECT * FROM payment_requests WHERE id = ?", id)!, user.id);
  });
}

function pendingFor(ctx: AppContext, requestId: string, userId: string, role: "payer" | "requester"): RequestRow {
  const row = one<RequestRow>(ctx.db, "SELECT * FROM payment_requests WHERE id = ?", requestId);
  if (!row || (role === "payer" ? row.payer_id : row.requester_id) !== userId) throw notFound("Request not found");
  const status = statusOf(ctx, row);
  if (status !== "PENDING") throw conflict(status === "EXPIRED" ? "This request has expired." : "This request has already been answered.");
  return row;
}

/** Paying a request is an ordinary P2P transfer: limits, PIN, screening and the ledger all apply. */
export function draftRequestPayment(ctx: AppContext, payer: UserRow, requestId: string, deviceId: string | null): PaymentDraft {
  const row = pendingFor(ctx, requestId, payer.id, "payer");
  // A payment held for review (or in flight) already answers the request: never pay twice.
  const inFlight = one(
    ctx.db,
    `SELECT id FROM transactions WHERE json_extract(metadata, '$.paymentRequestId') = ?
     AND status IN ('PENDING', 'PENDING_REVIEW', 'COMPLETED')`,
    row.id,
  );
  if (inFlight) throw conflict("You've already paid this request. It's being processed.");
  const requester = getUser(ctx, row.requester_id)!;
  return {
    ...draftP2P(ctx, payer, { destinationPhoneNumber: requester.phone, amountMinor: row.amount_minor, note: row.note }, deviceId),
    metadata: { paymentRequestId: row.id },
  };
}

export function markRequestPaid(ctx: AppContext, tx: TransactionRow): PaymentRequest {
  const { paymentRequestId } = JSON.parse(tx.metadata) as { paymentRequestId: string };
  run(
    ctx.db,
    "UPDATE payment_requests SET status = 'PAID', decided_at = ?, transaction_id = ? WHERE id = ? AND status = 'PENDING'",
    ctx.nowIso(),
    tx.id,
    paymentRequestId,
  );
  return toRequest(ctx, one<RequestRow>(ctx.db, "SELECT * FROM payment_requests WHERE id = ?", paymentRequestId)!, tx.initiator_user_id);
}

export function declineRequest(ctx: AppContext, user: UserRow, requestId: string): PaymentRequest {
  return closeRequest(ctx, pendingFor(ctx, requestId, user.id, "payer"), user, "DECLINED");
}

export function cancelRequest(ctx: AppContext, user: UserRow, requestId: string): PaymentRequest {
  return closeRequest(ctx, pendingFor(ctx, requestId, user.id, "requester"), user, "CANCELLED");
}

function closeRequest(ctx: AppContext, row: RequestRow, user: UserRow, status: "DECLINED" | "CANCELLED"): PaymentRequest {
  return withTx(ctx.db, () => {
    run(ctx.db, "UPDATE payment_requests SET status = ?, decided_at = ? WHERE id = ?", status, ctx.nowIso(), row.id);
    if (status === "DECLINED") {
      notify(ctx, row.requester_id, "TRANSACTION", `Your request for ${formatAmount(row.amount_minor, row.currency)} was declined.`);
    }
    audit(ctx, { actorType: "USER", actorId: user.id, action: `PAYMENT_REQUEST_${status}`, entityType: "payment_request", entityId: row.id });
    return toRequest(ctx, one<RequestRow>(ctx.db, "SELECT * FROM payment_requests WHERE id = ?", row.id)!, user.id);
  });
}
