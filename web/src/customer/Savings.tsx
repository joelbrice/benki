import { useCallback, useEffect, useState } from "react";
import { parseMajorToMinor, type SavingsVault } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, EmptyState, Meter, PageHeader, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

export function Savings({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, wallet, user } = session;
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();
  const fmt = (n: number) => money(n, wallet.currency);

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
      title: direction === "deposit" ? t("savings.saveTo", { name: vault.name }) : t("savings.withdrawFrom", { name: vault.name }),
      rows: [[t("common.amount"), fmt(amountMinor)]],
      currency: wallet.currency,
      amountMinor,
      requirePin: false,
      submit: (_pin, idempotencyKey) =>
        direction === "deposit" ? api.vaultDeposit(vault.vaultId, { idempotencyKey, amountMinor }) : api.vaultWithdraw(vault.vaultId, { idempotencyKey, amountMinor }),
    });
  };

  const targetMinor = parseMajorToMinor(target, wallet.currency);
  if (user.kycTier === "TIER_0") {
    return (
      <div className="stack">
        <PageHeader title={t("savings.title")} subtitle={t("savings.intro")} />
        <Banner tone="warn">{t("err.tierRequired")}</Banner>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader title={t("savings.title")} subtitle={t("savings.intro")} />
      {vaults.length === 0 && <EmptyState icon="savings" text={t("savings.empty")} />}
      <div className="card-grid">
        {vaults.map((v) => (
          <section key={v.vaultId} className="card vault">
            <div className="spread">
              <strong>{v.name}</strong>
              <span className="badge neutral">{Math.min(100, Math.round((v.balanceMinor / Math.max(1, v.targetMinor)) * 100))}%</span>
            </div>
            <div className="vault-amount">{fmt(v.balanceMinor)}</div>
            <Meter used={v.balanceMinor} total={v.targetMinor} />
            <span className="muted small">{t("savings.progress", { saved: fmt(v.balanceMinor), target: fmt(v.targetMinor) })}</span>
            <AmountField id={`vault-${v.vaultId}`} currency={wallet.currency} value={amounts[v.vaultId] ?? ""} onChange={(val) => setAmounts({ ...amounts, [v.vaultId]: val })} />
            <div className="button-pair">
              <button className="small" onClick={() => move(v, "deposit")}>
                {t("savings.add")}
              </button>
              <button className="small secondary" onClick={() => move(v, "withdraw")}>
                {t("savings.withdraw")}
              </button>
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <h3>{t("savings.new")}</h3>
        <div className="field-row">
          <label htmlFor="vault-name">
            {t("savings.name")}
            <input id="vault-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <AmountField id="vault-target" label={t("savings.target")} currency={wallet.currency} value={target} onChange={setTarget} />
        </div>
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
          {t("savings.create")}
        </button>
      </section>
    </div>
  );
}
