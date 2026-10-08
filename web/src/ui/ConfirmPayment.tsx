import { useEffect, useRef, useState } from "react";
import { formatAmount, type PaymentResponse } from "@benki/shared";
import { newIdempotencyKey, type CustomerApi } from "../api";
import { Banner, useAction } from "./common";

export interface PaymentIntent {
  title: string;
  rows: [string, string][];
  currency: string;
  amountMinor: number;
  /** Fee type for the published fee schedule lookup; omit when rows already show the fee. */
  feeType?: string;
  requirePin: boolean;
  submit: (pin: string, idempotencyKey: string) => Promise<PaymentResponse>;
}

/**
 * Review → PIN → submit. The idempotency key is created once per intent, so
 * retrying after a timeout or error can't charge the customer twice.
 */
export function ConfirmPayment({
  api,
  intent,
  onDone,
  onCancel,
}: {
  api: CustomerApi;
  intent: PaymentIntent;
  onDone: () => void;
  onCancel: () => void;
}) {
  const key = useRef(newIdempotencyKey());
  const [pin, setPin] = useState("");
  const [fee, setFee] = useState<number | null>(intent.feeType ? null : 0);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!intent.feeType) return;
    api.pricing(intent.feeType, intent.amountMinor).then((q) => setFee(q.feeMinor), () => setFee(0));
  }, [api, intent.feeType, intent.amountMinor]);

  if (result) {
    const tone = result.transaction.status === "COMPLETED" ? "success" : result.transaction.status === "FAILED" ? "error" : "warn";
    return (
      <div className="card">
        <h2>{intent.title}</h2>
        <Banner tone={tone}>{result.message}</Banner>
        {result.transaction.token && (
          <div className="subcard">
            <span className="muted">Meter token</span>
            <strong className="mono" style={{ fontSize: "1.1rem" }}>
              {result.transaction.token}
            </strong>
          </div>
        )}
        <p className="muted small">Reference {result.transaction.id}</p>
        <button onClick={onDone}>Done</button>
      </div>
    );
  }

  const rows: [string, string][] = [...intent.rows];
  if (intent.feeType) {
    rows.push(["Fee", fee === null ? "…" : fee === 0 ? "Free" : formatAmount(fee, intent.currency)]);
    if (fee !== null) rows.push(["Total", formatAmount(intent.amountMinor + fee, intent.currency)]);
  }

  return (
    <div className="card">
      <h2>Review: {intent.title}</h2>
      <dl className="summary">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {intent.requirePin && (
        <label htmlFor="confirm-pin">
          Transaction PIN
          <input
            id="confirm-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row">
        <button
          disabled={busy || (intent.requirePin && pin.length < 4) || fee === null}
          onClick={() => run(async () => setResult(await intent.submit(pin, key.current)))}
        >
          {busy ? "Sending…" : "Confirm"}
        </button>
        <button className="ghost" disabled={busy} onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  );
}
