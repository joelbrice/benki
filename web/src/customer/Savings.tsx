import { useCallback, useEffect, useState } from "react";
import { formatAmount, parseMajorToMinor, type SavingsVault } from "@benki/shared";
import { AmountField, Banner, Meter, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

export function Savings({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();
  const fmt = (n: number) => formatAmount(n, wallet.currency);

  const load = useCallback(() => api.vaults().then((r) => setVaults(r.vaults), () => undefined), [api]);
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
          setAmounts({});
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  const move = (vault: SavingsVault, direction: "deposit" | "withdraw") => {
    const amountMinor = parseMajorToMinor(amounts[vault.vaultId] ?? "", wallet.currency);
    if (!amountMinor) return;
    setIntent({
      title: direction === "deposit" ? `Save to ${vault.name}` : `Withdraw from ${vault.name}`,
      rows: [["Amount", fmt(amountMinor)]],
      currency: wallet.currency,
      amountMinor,
      requirePin: false,
      submit: (_pin, idempotencyKey) =>
        direction === "deposit"
          ? api.vaultDeposit(vault.vaultId, { idempotencyKey, amountMinor })
          : api.vaultWithdraw(vault.vaultId, { idempotencyKey, amountMinor }),
    });
  };

  const targetMinor = parseMajorToMinor(target, wallet.currency);
  return (
    <>
      <div className="card">
        <h2>Savings vaults</h2>
        <p className="muted">Set money aside for school fees, harvest season or emergencies. Savings count towards your total holdings limit.</p>
        {vaults.length === 0 && <p className="muted">No vaults yet.</p>}
        <ul className="list">
          {vaults.map((v) => (
            <li key={v.vaultId}>
              <div className="spread">
                <strong>{v.name}</strong>
                <span>
                  {fmt(v.balanceMinor)} / {fmt(v.targetMinor)}
                </span>
              </div>
              <Meter used={v.balanceMinor} total={v.targetMinor} />
              <div className="row">
                <div style={{ flex: 1, minWidth: 140 }}>
                  <AmountField
                    id={`vault-${v.vaultId}`}
                    currency={wallet.currency}
                    value={amounts[v.vaultId] ?? ""}
                    onChange={(val) => setAmounts({ ...amounts, [v.vaultId]: val })}
                  />
                </div>
                <button className="small" onClick={() => move(v, "deposit")}>
                  Add
                </button>
                <button className="small secondary" onClick={() => move(v, "withdraw")}>
                  Withdraw
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>New vault</h3>
        <label htmlFor="vault-name">
          Name
          <input id="vault-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <AmountField id="vault-target" label="Target" currency={wallet.currency} value={target} onChange={setTarget} />
        {error && <Banner tone="error">{error}</Banner>}
        <button
          disabled={busy || name.trim().length < 2 || !targetMinor}
          onClick={() =>
            run(async () => {
              await api.createVault(name, targetMinor!);
              setName("");
              setTarget("");
              await load();
            })
          }
        >
          Create vault
        </button>
      </div>
    </>
  );
}
