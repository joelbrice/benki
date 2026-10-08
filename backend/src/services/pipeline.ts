import type { AppContext } from "../context";
import { withTx } from "../db/database";
import type { TransactionRow, UserRow } from "../db/rows";
import { complianceBlock, providerUnavailable } from "../lib/errors";
import { claimIdempotencyKey, completeIdempotencyKey, requestHashOf, type IdempotencyHandle } from "./idempotency";
import { paymentResponse, submitPayment, type PaymentDraft } from "./payments";
import { verifyPin } from "./pin";
import { dispatchPayout } from "./settlement";
import { getUser } from "./users";

export interface PaymentRequest {
  user: UserRow;
  /** Bound device of the session; null for channels without one (USSD). */
  deviceId: string | null;
  /** Idempotency scope, e.g. "p2p" — keys are unique per user and operation. */
  operation: string;
  body: { idempotencyKey: string; pin?: string } & Record<string, unknown>;
  requirePin: boolean;
  build: (user: UserRow, deviceId: string | null) => PaymentDraft;
  /** Runs in the same DB transaction once a payment has posted; its fields are added to the response. */
  afterPosted?: (tx: TransactionRow) => Record<string, unknown>;
}

export interface PaymentResult {
  status: number;
  body: unknown;
  /** The recorded transaction (absent on an idempotent replay). */
  tx?: TransactionRow;
}

/**
 * Shared pipeline for every money movement, whatever the channel: PIN →
 * idempotency claim → controls + ledger (one DB transaction) → external
 * dispatch if needed. Errors thrown before the commit roll everything back.
 */
export async function runPayment(ctx: AppContext, request: PaymentRequest): Promise<PaymentResult> {
  const { user, body, operation, deviceId } = request;
  if (request.requirePin) verifyPin(ctx, user, body.pin);
  const handle: IdempotencyHandle = {
    scope: `${user.id}:${operation}`,
    key: body.idempotencyKey,
    requestHash: requestHashOf({ ...body, operation }),
  };

  type Phase1 =
    | { kind: "replay"; status: number; body: unknown }
    | { kind: "outcome"; outcome: ReturnType<typeof submitPayment>; responseBody: unknown };
  const phase1 = withTx(ctx.db, (): Phase1 => {
    const claim = claimIdempotencyKey(ctx, handle);
    if (claim.replay) return { kind: "replay", status: claim.status, body: claim.body };
    const outcome = submitPayment(ctx, request.build(getUser(ctx, user.id)!, deviceId));
    let responseBody: unknown;
    if (outcome.blocked) {
      responseBody = complianceBlock().toBody();
    } else {
      const extra = outcome.tx.status === "COMPLETED" && request.afterPosted ? request.afterPosted(outcome.tx) : {};
      responseBody = { ...paymentResponse(ctx, outcome.tx, user.id, outcome.message), ...extra };
    }
    if (!outcome.needsDispatch) completeIdempotencyKey(ctx, handle, outcome.status, responseBody);
    return { kind: "outcome", outcome, responseBody };
  });

  if (phase1.kind === "replay") return { status: phase1.status, body: phase1.body };
  const { outcome } = phase1;
  if (!outcome.needsDispatch) return { status: outcome.status, body: phase1.responseBody, tx: outcome.tx };

  const tx = await dispatchPayout(ctx, outcome.tx.id);
  if (tx.status === "FAILED") {
    const failure = providerUnavailable(
      `${tx.counterparty_label} couldn't be reached and your money has been refunded. Please try again later.`,
    ).toBody();
    completeIdempotencyKey(ctx, handle, 502, failure);
    return { status: 502, body: failure, tx };
  }
  const message = tx.status === "COMPLETED" ? `Delivered to ${tx.counterparty_label}.` : outcome.message;
  const success = paymentResponse(ctx, tx, user.id, message);
  completeIdempotencyKey(ctx, handle, 201, success);
  return { status: 201, body: success, tx };
}
