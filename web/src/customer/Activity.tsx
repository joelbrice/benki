import { useCallback, useEffect, useState } from "react";
import type { Dispute, UserTransaction } from "@benki/shared";
import { useI18n } from "../i18n";
import { Banner, EmptyState, PageHeader, useAction } from "../ui/common";
import { Icon } from "../ui/icons";
import { TxRow } from "../ui/TxRow";
import type { Session } from "./session";

export function Activity({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, wallet } = session;
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(async () => {
    const [tx, d] = await Promise.all([api.transactions(wallet.walletId), api.disputes()]);
    setTransactions(tx.transactions);
    setDisputes(d.disputes);
  }, [api, wallet.walletId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, wallet.ledgerBalanceMinor]);

  return (
    <div className="stack">
      <PageHeader
        title={t("activity.title")}
        actions={
          <>
            <button className="small ghost" onClick={() => load()} aria-label={t("common.refresh")}>
              <Icon name="refresh" size={16} />
            </button>
            <button className="small secondary" onClick={() => run(() => api.downloadStatement(wallet.walletId))}>
              <Icon name="download" size={16} /> {t("activity.statement")}
            </button>
          </>
        }
      />
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      <section className="card">
        {transactions.length === 0 ? (
          <EmptyState icon="activity" text={t("activity.empty")} />
        ) : (
          <ul className="tx-list" data-testid="history">
            {transactions.map((tx) => {
              const dispute = disputes.find((d) => d.transactionId === tx.id);
              const open = expanded === tx.id;
              return (
                <TxRow key={tx.id} tx={tx}>
                  <button className="link small" onClick={() => setExpanded(open ? null : tx.id)} aria-expanded={open}>
                    {date(tx.createdAt, true)} · {tx.id.slice(0, 12)}…
                  </button>
                  {open && (
                    <div className="tx-detail">
                      {tx.feeMinor > 0 && <span className="small">{t("activity.feeLine", { amount: money(tx.feeMinor, tx.currency) })}</span>}
                      {tx.receiveAmountMinor !== null && tx.receiveCurrency && (
                        <span className="small">
                          {t(tx.type === "FX_CONVERSION" ? "activity.youGot" : "activity.recipientGot", { amount: money(tx.receiveAmountMinor, tx.receiveCurrency) })}
                        </span>
                      )}
                      {tx.note && <span className="small">“{tx.note}”</span>}
                      {tx.token && <span className="mono">{t("activity.token", { token: tx.token })}</span>}
                      <span className="mono muted">{tx.id}</span>
                      {dispute && (
                        <span className="small">
                          {t("activity.dispute")}: <span className="badge neutral">{t(`dispute.${dispute.status}`)}</span> {dispute.resolution}
                        </span>
                      )}
                      {tx.disputable && !dispute && disputing !== tx.id && (
                        <button className="small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setDisputing(tx.id)}>
                          {t("activity.report")}
                        </button>
                      )}
                      {disputing === tx.id && (
                        <div className="subcard">
                          <label htmlFor={`reason-${tx.id}`}>
                            {t("activity.whatWrong")}
                            <textarea id={`reason-${tx.id}`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                          </label>
                          <div className="row">
                            <button
                              className="small"
                              disabled={busy || reason.trim().length < 10}
                              onClick={() =>
                                run(async () => {
                                  await api.openDispute(tx.id, reason);
                                  setDisputing(null);
                                  setReason("");
                                  setNotice(t("activity.received"));
                                  await load();
                                })
                              }
                            >
                              {t("activity.submit")}
                            </button>
                            <button className="small ghost" onClick={() => setDisputing(null)}>
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TxRow>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
