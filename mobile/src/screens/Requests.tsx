import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { parseMajorToMinor, type PaymentRequest } from "@benki/shared";
import { AmountField, Badge, Banner, Card, EmptyState, Field, GhostButton, Muted, PrimaryButton, ScreenHeader, Title, useAction } from "../components/ui";
import { useI18n } from "../i18n";
import type { Session } from "../session";
import { colors } from "../theme/colors";
import { useIntent } from "./flow";

export function Requests({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, country, wallet } = session;
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const load = useCallback(() => api.requests().then((r) => setRequests(r.requests), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const { setIntent, screen } = useIntent(session, () => void load());
  if (screen) return screen;

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const replace = (r: PaymentRequest) => setRequests(requests.map((x) => (x.requestId === r.requestId ? r : x)));
  const tone = (s: PaymentRequest["status"]) => (s === "PAID" ? "brand" : s === "PENDING" ? "warn" : "neutral");

  const row = (r: PaymentRequest) => (
    <View key={r.requestId} style={{ gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>{r.counterparty}</Text>
        <Text style={{ fontWeight: "800", color: colors.text }}>{money(r.amountMinor, r.currency)}</Text>
      </View>
      {r.note ? <Muted>“{r.note}”</Muted> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Muted>{r.status === "PENDING" ? t("requests.expires", { date: date(r.expiresAt) }) : date(r.createdAt)}</Muted>
        <Badge label={t(`requests.status.${r.status}`)} tone={tone(r.status)} />
      </View>
      {r.status === "PENDING" && r.direction === "INCOMING" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title={t("requests.pay")}
              onPress={() =>
                setIntent({
                  title: t("requests.payTitle", { name: r.counterparty }),
                  rows: [
                    [t("common.to"), `${r.counterparty} (${r.counterpartyPhoneMasked})`],
                    [t("common.amount"), money(r.amountMinor, r.currency)],
                  ],
                  currency: r.currency,
                  amountMinor: r.amountMinor,
                  feeType: "P2P",
                  requirePin: true,
                  submit: (pin, idempotencyKey) => api.payRequest(r.requestId, { idempotencyKey, pin }),
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <GhostButton title={t("requests.decline")} disabled={busy} onPress={() => run(async () => replace((await api.declineRequest(r.requestId)).request))} />
          </View>
        </View>
      )}
      {r.status === "PENDING" && r.direction === "OUTGOING" && (
        <GhostButton title={t("requests.cancel")} disabled={busy} onPress={() => run(async () => replace((await api.cancelRequest(r.requestId)).request))} />
      )}
    </View>
  );

  const incoming = requests.filter((r) => r.direction === "INCOMING");
  const outgoing = requests.filter((r) => r.direction === "OUTGOING");
  return (
    <>
      <ScreenHeader title={t("requests.title")} subtitle={t("requests.intro")} />
      <Card>
        <Title>{t("quick.request")}</Title>
        <Field label={t("requests.from")} value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
        <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
        <Field label={t("common.noteOptional")} value={note} maxLength={140} onChangeText={setNote} />
        {notice && <Banner tone="success">{notice}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <PrimaryButton
          title={t("requests.send")}
          disabled={busy || !amountMinor || phone.length < 9}
          onPress={() =>
            run(async () => {
              const { request } = await api.requestMoney(phone, amountMinor!, note || undefined);
              setNotice(t("requests.sent", { name: request.counterparty }));
              setAmount("");
              setNote("");
              await load();
            })
          }
        />
      </Card>
      <Card>
        <Title>{t("requests.incoming")}</Title>
        <Banner tone="warn">{t("requests.safety")}</Banner>
        {incoming.length === 0 ? <EmptyState icon="inbox" text={t("requests.empty")} /> : incoming.map(row)}
      </Card>
      <Card>
        <Title>{t("requests.outgoing")}</Title>
        {outgoing.length === 0 ? <EmptyState icon="arrow-down-left" text={t("requests.empty")} /> : outgoing.map(row)}
      </Card>
    </>
  );
}
