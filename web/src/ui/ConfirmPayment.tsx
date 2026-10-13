import { useEffect, useRef, useState } from "react";
import type { PaymentResponse } from "@benki/shared";
import { newIdempotencyKey, type CustomerApi } from "../api";
import { useI18n } from "../i18n";
import { Banner, PinField, useAction } from "./common";
import { Icon } from "./icons";

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
export function ConfirmPayment({ api, intent, onDone, onCancel }: { api: CustomerApi; intent: PaymentIntent; onDone: () => void; onCancel: () => void }) {
  const { t, money, bidi } = useI18n();
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
    const status = result.transaction.status;
    const ok = status === "COMPLETED";
    const failed = status === "FAILED";
    return (
      <div className="card result">
        <div className={`result-icon ${ok ? "ok" : failed ? "bad" : "wait"}`}>
          <Icon name={ok ? "check" : failed ? "x" : "activity"} size={30} />
        </div>
        <h2>{intent.title}</h2>
        <p className="result-message">{result.message}</p>
        {result.transaction.token && (
          <div className="subcard token">
            <span className="muted">{t("pay.meterToken")}</span>
            <strong className="mono">{result.transaction.token}</strong>
          </div>
        )}
        <p className="muted small mono">{t("common.reference", { ref: result.transaction.id })}</p>
        <button onClick={onDone}>{t("common.done")}</button>
      </div>
    );
  }

  const rows: [string, string][] = [...intent.rows];
  if (intent.feeType) {
    rows.push([t("common.fee"), fee === null ? "…" : fee === 0 ? t("common.free") : money(fee, intent.currency)]);
    if (fee !== null) rows.push([t("common.total"), money(intent.amountMinor + fee, intent.currency)]);
  }

  return (
    <div className="card">
      <button className="link-back" onClick={onCancel} disabled={busy}>
        <span className="back-arrow" aria-hidden="true">←</span> {t("common.back")}
      </button>
      <h2>{t("confirm.review", { title: intent.title })}</h2>
      <dl className="summary">
        {rows.map(([k, v], i) => (
          <div key={k} className={i === rows.length - 1 && intent.feeType ? "summary-total" : undefined} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{bidi(v)}</dd>
          </div>
        ))}
      </dl>
      {intent.requirePin && <PinField id="confirm-pin" value={pin} onChange={setPin} />}
      {error && <Banner tone="error">{error}</Banner>}
      <button
        className="block"
        disabled={busy || (intent.requirePin && pin.length < 4) || fee === null}
        onClick={() => run(async () => setResult(await intent.submit(pin, key.current)))}
      >
        {busy ? t("common.sending") : t("common.confirm")}
      </button>
    </div>
  );
}
