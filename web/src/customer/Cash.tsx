import { useState } from "react";
import { parseMajorToMinor } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, PageHeader } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import { Icon } from "../ui/icons";
import type { Session } from "./session";

export function Cash({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, country, wallet } = session;
  const [agentId, setAgentId] = useState(country.agents[0].id);
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const agent = country.agents.find((a) => a.id === agentId)!;

  if (intent) {
    return (
      <ConfirmPayment
        api={api}
        intent={intent}
        onDone={() => {
          setIntent(null);
          setAmount("");
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  const start = (direction: "in" | "out") => {
    if (!amountMinor) return;
    setIntent({
      title: direction === "in" ? t("cash.depositTitle") : t("cash.withdrawTitle"),
      rows: [
        [t("cash.agent"), `${agent.name}, ${agent.location}`],
        [t("common.amount"), money(amountMinor, wallet.currency)],
      ],
      currency: wallet.currency,
      amountMinor,
      feeType: direction === "in" ? "CASH_IN" : "CASH_OUT",
      requirePin: direction === "out",
      submit: (pin, idempotencyKey) =>
        direction === "in"
          ? api.cashIn(wallet.walletId, { idempotencyKey, agentId, amountMinor })
          : api.cashOut(wallet.walletId, { idempotencyKey, pin, agentId, amountMinor }),
    });
  };

  return (
    <div className="stack">
      <PageHeader title={t("cash.title")} subtitle={t("cash.intro")} />
      <div className="card">
        <span className="muted small">{t("cash.agent")}</span>
        <div className="agent-list" role="radiogroup" aria-label={t("cash.agent")}>
          {country.agents.map((a) => (
            <button key={a.id} role="radio" aria-checked={a.id === agentId} className={`agent${a.id === agentId ? " active" : ""}`} onClick={() => setAgentId(a.id)}>
              <Icon name="store" size={18} />
              <span>
                <strong>{a.name}</strong>
                <span className="muted small">{a.location}</span>
              </span>
            </button>
          ))}
        </div>
        <AmountField id="cash-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
        <div className="button-pair">
          <button disabled={!amountMinor} onClick={() => start("in")}>
            {t("cash.deposit")}
          </button>
          <button className="secondary" disabled={!amountMinor} onClick={() => start("out")}>
            {t("cash.withdraw")}
          </button>
        </div>
      </div>
    </div>
  );
}
