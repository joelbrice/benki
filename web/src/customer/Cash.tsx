import { useState } from "react";
import { formatAmount, parseMajorToMinor } from "@benki/shared";
import { AmountField } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

export function Cash({ session }: { session: Session }) {
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
      title: direction === "in" ? "Deposit cash" : "Withdraw cash",
      rows: [
        ["Agent", `${agent.name}, ${agent.location}`],
        ["Amount", formatAmount(amountMinor, wallet.currency)],
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
    <div className="card">
      <h2>Cash in / cash out</h2>
      <p className="muted">Visit a Benki agent to turn cash into e-money or back. Deposits are free; withdrawals cost 0.5%.</p>
      <label htmlFor="agent">
        Agent
        <select id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {country.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.location}
            </option>
          ))}
        </select>
      </label>
      <AmountField id="cash-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
      <div className="row">
        <button disabled={!amountMinor} onClick={() => start("in")}>
          Deposit
        </button>
        <button className="secondary" disabled={!amountMinor} onClick={() => start("out")}>
          Withdraw
        </button>
      </div>
    </div>
  );
}
