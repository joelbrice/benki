import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { formatAmount, type PaymentResponse } from "@benki/shared";
import { newIdempotencyKey, type CustomerApi } from "../api";
import { Banner, Card, Field, GhostButton, Muted, PrimaryButton, SubCard, Summary, Title, useAction } from "./ui";

export interface PaymentIntent {
  title: string;
  rows: [string, string][];
  currency: string;
  amountMinor: number;
  feeType?: string;
  requirePin: boolean;
  submit: (pin: string, idempotencyKey: string) => Promise<PaymentResponse>;
}

/** Review → PIN → submit, with one idempotency key per intent so retries never double-charge. */
export function ConfirmPayment({ api, intent, onDone, onCancel }: { api: CustomerApi; intent: PaymentIntent; onDone: () => void; onCancel: () => void }) {
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
    return (
      <Card>
        <Title>{intent.title}</Title>
        <Banner tone={status === "COMPLETED" ? "success" : status === "FAILED" ? "error" : "warn"}>{result.message}</Banner>
        {result.transaction.token && (
          <SubCard>
            <Muted>Meter token</Muted>
            <Text style={{ fontSize: 18, fontWeight: "700", fontFamily: "monospace" }}>{result.transaction.token}</Text>
          </SubCard>
        )}
        <Muted>Reference {result.transaction.id}</Muted>
        <PrimaryButton title="Done" onPress={onDone} />
      </Card>
    );
  }

  const rows: [string, string][] = [...intent.rows];
  if (intent.feeType) {
    rows.push(["Fee", fee === null ? "…" : fee === 0 ? "Free" : formatAmount(fee, intent.currency)]);
    if (fee !== null) rows.push(["Total", formatAmount(intent.amountMinor + fee, intent.currency)]);
  }

  return (
    <Card>
      <Title>Review: {intent.title}</Title>
      <Summary rows={rows} />
      {intent.requirePin && (
        <Field label="Transaction PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry />
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <PrimaryButton
        title={busy ? "Sending…" : "Confirm"}
        disabled={busy || (intent.requirePin && pin.length < 4) || fee === null}
        onPress={() => run(async () => setResult(await intent.submit(pin, key.current)))}
      />
      <GhostButton title="Back" disabled={busy} onPress={onCancel} />
    </Card>
  );
}
