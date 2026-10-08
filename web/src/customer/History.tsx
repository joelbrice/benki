import { useCallback, useEffect, useState } from "react";
import { formatAmount, type Dispute, type UserTransaction } from "@benki/shared";
import { Banner, StatusBadge, TYPE_LABEL, useAction } from "../ui/common";
import type { Session } from "./session";

export function History({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useAction();
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([api.transactions(wallet.walletId), api.disputes()]);
    setTransactions(t.transactions);
    setDisputes(d.disputes);
  }, [api, wallet.walletId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, wallet.ledgerBalanceMinor]);

  const disputeFor = (id: string) => disputes.find((d) => d.transactionId === id);

  return (
    <div className="card">
      <div className="spread">
        <h2>History</h2>
        <div className="row">
          <button className="small ghost" onClick={() => load()}>
            Refresh
          </button>
          <button className="small secondary" onClick={() => run(() => api.downloadStatement(wallet.walletId))}>
            Download statement (CSV)
          </button>
        </div>
      </div>
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {transactions.length === 0 ? (
        <p className="muted">No transactions yet.</p>
      ) : (
        <ul className="list" data-testid="history">
          {transactions.map((t) => {
            const dispute = disputeFor(t.id);
            return (
              <li key={t.id}>
                <div className="spread">
                  <strong>{TYPE_LABEL[t.type]}</strong>
                  <span className={`amount ${t.direction === "CREDIT" ? "credit" : "debit"}`}>
                    {t.direction === "CREDIT" ? "+" : "−"}
                    {formatAmount(t.amountMinor, t.currency)}
                  </span>
                </div>
                <div className="spread small">
                  <span>{t.counterparty}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="spread muted small">
                  <span>{new Date(t.createdAt).toLocaleString()}</span>
                  {t.feeMinor > 0 && <span>Fee {formatAmount(t.feeMinor, t.currency)}</span>}
                </div>
                {t.receiveAmountMinor !== null && t.receiveCurrency && (
                  <span className="muted small">Recipient got {formatAmount(t.receiveAmountMinor, t.receiveCurrency)}</span>
                )}
                {t.note && <span className="small">“{t.note}”</span>}
                {t.token && <span className="mono">Token {t.token}</span>}
                {dispute && (
                  <span className="small">
                    Dispute: <span className="badge neutral">{dispute.status.replace(/_/g, " ").toLowerCase()}</span>{" "}
                    {dispute.resolution}
                  </span>
                )}
                {t.disputable && !dispute && disputing !== t.id && (
                  <button className="small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setDisputing(t.id)}>
                    Report a problem
                  </button>
                )}
                {disputing === t.id && (
                  <div className="subcard">
                    <label htmlFor={`reason-${t.id}`}>
                      What went wrong?
                      <textarea id={`reason-${t.id}`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    <div className="row">
                      <button
                        className="small"
                        disabled={busy || reason.trim().length < 10}
                        onClick={() =>
                          run(async () => {
                            await api.openDispute(t.id, reason);
                            setDisputing(null);
                            setReason("");
                            setNotice("Dispute received. We'll update you within 10 working days.");
                            await load();
                          })
                        }
                      >
                        Submit dispute
                      </button>
                      <button className="small ghost" onClick={() => setDisputing(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <span className="mono muted">{t.id}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
