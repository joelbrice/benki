import { useCallback, useEffect, useState } from "react";
import { parseMajorToMinor, type PaymentRequest } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, EmptyState, PageHeader, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import { Icon } from "../ui/icons";
import type { Session } from "./session";

export function Requests({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, country, wallet } = session;
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();
  const amountMinor = parseMajorToMinor(amount, wallet.currency);

  const load = useCallback(() => api.requests().then((r) => setRequests(r.requests), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);

  if (intent) {
    return (
      <ConfirmPayment
        api={api}
        intent={intent}
        onDone={() => {
          setIntent(null);
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  const incoming = requests.filter((r) => r.direction === "INCOMING");
  const outgoing = requests.filter((r) => r.direction === "OUTGOING");
  const replace = (r: PaymentRequest) => setRequests(requests.map((x) => (x.requestId === r.requestId ? r : x)));
  const tone = (s: PaymentRequest["status"]) => (s === "PAID" ? "" : s === "PENDING" ? "warn" : "neutral");

  const row = (r: PaymentRequest) => (
    <li key={r.requestId} className="request">
      <div className="spread">
        <div>
          <strong>{r.counterparty}</strong>
          <span className="muted small"> · {r.counterpartyPhoneMasked}</span>
        </div>
        <strong>{money(r.amountMinor, r.currency)}</strong>
      </div>
      {r.note && <span className="small">“{r.note}”</span>}
      <div className="spread muted small">
        <span>{r.status === "PENDING" ? t("requests.expires", { date: date(r.expiresAt) }) : date(r.createdAt)}</span>
        <span className={`badge ${tone(r.status)}`}>{t(`requests.status.${r.status}`)}</span>
      </div>
      {r.status === "PENDING" && r.direction === "INCOMING" && (
        <div className="row">
          <button
            className="small"
            onClick={() =>
              setIntent({
                title: t("requests.payTitle", { name: r.counterparty }),
                rows: [
                  [t("common.to"), `${r.counterparty} (${r.counterpartyPhoneMasked})`],
                  [t("common.amount"), money(r.amountMinor, r.currency)],
                  ...(r.note ? ([[t("common.note"), r.note]] as [string, string][]) : []),
                ],
                currency: r.currency,
                amountMinor: r.amountMinor,
                feeType: "P2P",
                requirePin: true,
                submit: (pin, idempotencyKey) => api.payRequest(r.requestId, { idempotencyKey, pin }),
              })
            }
          >
            {t("requests.pay")}
          </button>
          <button className="small ghost" disabled={busy} onClick={() => run(async () => replace((await api.declineRequest(r.requestId)).request))}>
            {t("requests.decline")}
          </button>
        </div>
      )}
      {r.status === "PENDING" && r.direction === "OUTGOING" && (
        <button className="small ghost" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => run(async () => replace((await api.cancelRequest(r.requestId)).request))}>
          {t("requests.cancel")}
        </button>
      )}
    </li>
  );

  return (
    <div className="stack">
      <PageHeader title={t("requests.title")} subtitle={t("requests.intro")} />
      <div className="two-col">
        <section className="card">
          <h3>
            <Icon name="request" size={18} /> {t("quick.request")}
          </h3>
          <label htmlFor="request-phone">
            {t("requests.from")}
            <input id="request-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
          </label>
          <AmountField id="request-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
          <label htmlFor="request-note">
            {t("common.noteOptional")}
            <input id="request-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {notice && <Banner tone="success">{notice}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          <button
            className="block"
            disabled={busy || !amountMinor || phone.length < 9}
            onClick={() =>
              run(async () => {
                const { request } = await api.requestMoney(phone, amountMinor!, note || undefined);
                setNotice(t("requests.sent", { name: request.counterparty }));
                setAmount("");
                setNote("");
                setPhone(country.callingCode);
                await load();
              })
            }
          >
            {t("requests.send")}
          </button>
        </section>
        <div className="stack">
          <section className="card">
            <h3>{t("requests.incoming")}</h3>
            <Banner tone="warn">
              <Icon name="shield" size={16} /> {t("requests.safety")}
            </Banner>
            {incoming.length === 0 ? <EmptyState icon="requests" text={t("requests.empty")} /> : <ul className="plain-list">{incoming.map(row)}</ul>}
          </section>
          <section className="card">
            <h3>{t("requests.outgoing")}</h3>
            {outgoing.length === 0 ? <EmptyState icon="request" text={t("requests.empty")} /> : <ul className="plain-list">{outgoing.map(row)}</ul>}
          </section>
        </div>
      </div>
    </div>
  );
}
