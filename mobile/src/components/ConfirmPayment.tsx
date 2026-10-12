import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { PaymentResponse } from "@benki/shared";
import { newIdempotencyKey, type CustomerApi } from "../api";
import { useI18n } from "../i18n";
import { colors } from "../theme/colors";
import { Banner, Card, GhostButton, Icon, Muted, PinField, PrimaryButton, SubCard, Summary, Title, useAction } from "./ui";

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
  const { t, money } = useI18n();
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
      <Card>
        <View style={{ alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ok ? colors.primarySoft : failed ? colors.dangerSoft : colors.accentSoft,
            }}
          >
            <Icon name={ok ? "check" : failed ? "x" : "clock"} size={30} color={ok ? colors.primary : failed ? colors.danger : colors.warn} />
          </View>
          <Title>{intent.title}</Title>
          <Text style={{ textAlign: "center", color: colors.text, fontSize: 15, lineHeight: 21 }}>{result.message}</Text>
        </View>
        {result.transaction.token && (
          <SubCard>
            <Muted>{t("pay.meterToken")}</Muted>
            <Text style={{ fontSize: 18, fontWeight: "800", fontFamily: "monospace" }}>{result.transaction.token}</Text>
          </SubCard>
        )}
        <Muted>{t("common.reference", { ref: result.transaction.id })}</Muted>
        <PrimaryButton title={t("common.done")} onPress={onDone} />
      </Card>
    );
  }

  const rows: [string, string][] = [...intent.rows];
  if (intent.feeType) {
    rows.push([t("common.fee"), fee === null ? "…" : fee === 0 ? t("common.free") : money(fee, intent.currency)]);
    if (fee !== null) rows.push([t("common.total"), money(intent.amountMinor + fee, intent.currency)]);
  }

  return (
    <Card>
      <Title>{t("confirm.review", { title: intent.title })}</Title>
      <Summary rows={rows} totalLast={!!intent.feeType && fee !== null} />
      {intent.requirePin && <PinField value={pin} onChange={setPin} />}
      {error && <Banner tone="error">{error}</Banner>}
      <PrimaryButton
        title={busy ? t("common.sending") : t("common.confirm")}
        disabled={busy || (intent.requirePin && pin.length < 4) || fee === null}
        onPress={() => run(async () => setResult(await intent.submit(pin, key.current)))}
      />
      <GhostButton title={t("common.back")} disabled={busy} onPress={onCancel} />
    </Card>
  );
}
