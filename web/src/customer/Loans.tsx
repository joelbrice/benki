import { useCallback, useEffect, useState } from "react";
import { formatAmount, loanFeeMinor, minorToMajorString, parseMajorToMinor, type Loan, type LoanOffer } from "@benki/shared";
import { AmountField, Banner, Meter, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

const STATUS_TONE: Record<Loan["status"], string> = { ACTIVE: "", OVERDUE: "danger", REPAID: "neutral" };

export function Loans({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [offer, setOffer] = useState<LoanOffer | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { error, setError } = useAction();
  const fmt = (n: number) => formatAmount(n, wallet.currency);

  const load = useCallback(async () => {
    const [o, l] = await Promise.all([api.loanOffer(), api.loans()]);
    setOffer(o);
    setLoans(l.loans);
  }, [api]);
  useEffect(() => {
    load().catch(() => setError("Couldn't load loans"));
  }, [load, setError]);

  if (intent) {
    return (
      <ConfirmPayment
        api={api}
        intent={intent}
        onDone={() => {
          setIntent(null);
          setAmount("");
          setRepayAmount("");
          setAccepted(false);
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  const open = loans.find((l) => l.status !== "REPAID");
  const principal = parseMajorToMinor(amount, wallet.currency);
  const inRange = !!offer && !!principal && principal >= offer.minPrincipalMinor && principal <= offer.maxPrincipalMinor;
  const fee = principal ? loanFeeMinor(principal) : 0;
  const dueDate = offer ? new Date(Date.now() + offer.termDays * 86_400_000).toLocaleDateString() : "";
  const repayMinor = parseMajorToMinor(repayAmount, wallet.currency);

  return (
    <>
      {open && (
        <div className="card">
          <div className="spread">
            <h2>Your loan</h2>
            <span className={`badge ${STATUS_TONE[open.status]}`}>{open.status === "OVERDUE" ? "Overdue" : "Active"}</span>
          </div>
          <dl className="summary">
            <dt>Borrowed</dt>
            <dd>{fmt(open.principalMinor)}</dd>
            <dt>Fee</dt>
            <dd>{fmt(open.feeMinor)}</dd>
            <dt>Still to repay</dt>
            <dd>
              <strong>{fmt(open.outstandingMinor)}</strong>
            </dd>
            <dt>Due</dt>
            <dd>{new Date(open.dueAt).toLocaleDateString()}</dd>
          </dl>
          <Meter used={open.repaidMinor} total={open.totalDueMinor} />
          {open.status === "OVERDUE" && (
            <Banner tone="warn">This loan is past its due date. Repay as soon as you can — no extra fees are added.</Banner>
          )}
          <AmountField id="repay-amount" label="Repay" currency={wallet.currency} value={repayAmount} onChange={setRepayAmount} />
          <div className="row">
            <button className="small secondary" onClick={() => setRepayAmount(minorToMajorString(open.outstandingMinor, wallet.currency))}>
              Repay in full
            </button>
            <button
              disabled={!repayMinor || repayMinor > open.outstandingMinor}
              onClick={() =>
                setIntent({
                  title: "Repay loan",
                  rows: [
                    ["Repayment", fmt(repayMinor!)],
                    ["Left after this", fmt(open.outstandingMinor - repayMinor!)],
                  ],
                  currency: wallet.currency,
                  amountMinor: repayMinor!,
                  requirePin: true,
                  submit: (pin, idempotencyKey) => api.repayLoan(open.loanId, { idempotencyKey, pin, amountMinor: repayMinor! }),
                })
              }
            >
              Review repayment
            </button>
          </div>
        </div>
      )}

      {!open && offer && (
        <div className="card">
          <h2>Borrow a little, when you need it</h2>
          {offer.eligible ? (
            <>
              <p className="muted">
                Borrow {fmt(offer.minPrincipalMinor)}–{fmt(offer.maxPrincipalMinor)} for {offer.termDays} days. One flat fee of{" "}
                {offer.feeBps / 100}% — no interest, no late fees, no hidden charges.
              </p>
              <AmountField id="loan-amount" label="How much?" currency={wallet.currency} value={amount} onChange={setAmount} />
              {principal && !inRange && (
                <p className="muted small">
                  Choose between {fmt(offer.minPrincipalMinor)} and {fmt(offer.maxPrincipalMinor)}.
                </p>
              )}
              {inRange && (
                <div className="subcard">
                  <strong>Before you borrow</strong>
                  <dl className="summary">
                    <dt>You receive</dt>
                    <dd>{fmt(principal!)}</dd>
                    <dt>Fee</dt>
                    <dd>{fmt(fee)}</dd>
                    <dt>You repay</dt>
                    <dd>
                      <strong>{fmt(principal! + fee)}</strong>
                    </dd>
                    <dt>Due by</dt>
                    <dd>{dueDate}</dd>
                    <dt>Equivalent APR</dt>
                    <dd>{offer.aprPercent}%</dd>
                  </dl>
                  <label className="row" style={{ alignItems: "flex-start" }}>
                    <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ width: "auto" }} />
                    <span className="small">
                      I understand I must repay {fmt(principal! + fee)} by {dueDate}. Only borrow what you can repay.
                    </span>
                  </label>
                </div>
              )}
              <button
                disabled={!inRange || !accepted}
                onClick={() =>
                  setIntent({
                    title: "Take a loan",
                    rows: [
                      ["You receive", fmt(principal!)],
                      ["You repay", fmt(principal! + fee)],
                      ["Due by", dueDate],
                    ],
                    currency: wallet.currency,
                    amountMinor: principal!,
                    requirePin: true,
                    submit: (pin, idempotencyKey) => api.applyLoan({ idempotencyKey, pin, principalMinor: principal! }),
                  })
                }
              >
                Continue
              </button>
            </>
          ) : (
            offer.reasons.map((r) => (
              <Banner key={r} tone="info">
                {r}
              </Banner>
            ))
          )}
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      {loans.some((l) => l.status === "REPAID") && (
        <div className="card">
          <h3>Repaid loans</h3>
          <ul className="list">
            {loans
              .filter((l) => l.status === "REPAID")
              .map((l) => (
                <li key={l.loanId}>
                  <div className="spread">
                  <span>
                    {fmt(l.principalMinor)} <span className="muted small">· {new Date(l.disbursedAt).toLocaleDateString()}</span>
                  </span>
                  <span className="badge neutral">Repaid {l.repaidAt ? new Date(l.repaidAt).toLocaleDateString() : ""}</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}
