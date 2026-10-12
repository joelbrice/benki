import { useCallback, useEffect, useState } from "react";
import { loanFeeMinor, minorToMajorString, parseMajorToMinor, type Loan, type LoanOffer } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, Meter, PageHeader, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import { Icon } from "../ui/icons";
import type { Session } from "./session";

export function Loans({ session }: { session: Session }) {
  const { t, money, date, locale } = useI18n();
  const { api, wallet } = session;
  const [offer, setOffer] = useState<LoanOffer | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { error, setError } = useAction();
  const fmt = (n: number) => money(n, wallet.currency);

  const load = useCallback(async () => {
    const [o, l] = await Promise.all([api.loanOffer(), api.loans()]);
    setOffer(o);
    setLoans(l.loans);
  }, [api]);
  useEffect(() => {
    // Reasons come back translated, so reload when the language changes.
    load().catch(() => setError(t("err.generic")));
  }, [load, setError, t, locale]);

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
  const due = offer ? date(new Date(Date.now() + offer.termDays * 86_400_000).toISOString()) : "";
  const repayMinor = parseMajorToMinor(repayAmount, wallet.currency);

  return (
    <div className="stack">
      <PageHeader title={t("nav.loans")} />
      {open && (
        <section className="card">
          <div className="spread">
            <h2>{t("loans.yours")}</h2>
            <span className={`badge ${open.status === "OVERDUE" ? "danger" : ""}`}>{open.status === "OVERDUE" ? t("loans.overdue") : t("loans.active")}</span>
          </div>
          <dl className="summary">
            <dt>{t("loans.borrowed")}</dt>
            <dd>{fmt(open.principalMinor)}</dd>
            <dt>{t("common.fee")}</dt>
            <dd>{fmt(open.feeMinor)}</dd>
            <dt>{t("loans.left")}</dt>
            <dd>
              <strong>{fmt(open.outstandingMinor)}</strong>
            </dd>
            <dt>{t("loans.due")}</dt>
            <dd>{date(open.dueAt)}</dd>
          </dl>
          <Meter used={open.repaidMinor} total={open.totalDueMinor} />
          {open.status === "OVERDUE" && <Banner tone="warn">{t("loans.overdueNote")}</Banner>}
          <AmountField id="repay-amount" label={t("loans.repayLabel")} currency={wallet.currency} value={repayAmount} onChange={setRepayAmount} />
          <div className="button-pair">
            <button className="secondary" onClick={() => setRepayAmount(minorToMajorString(open.outstandingMinor, wallet.currency))}>
              {t("loans.repayFull")}
            </button>
            <button
              disabled={!repayMinor || repayMinor > open.outstandingMinor}
              onClick={() =>
                setIntent({
                  title: t("loans.repayTitle"),
                  rows: [
                    [t("loans.repayLabel"), fmt(repayMinor!)],
                    [t("loans.leftAfter"), fmt(open.outstandingMinor - repayMinor!)],
                  ],
                  currency: wallet.currency,
                  amountMinor: repayMinor!,
                  requirePin: true,
                  submit: (pin, idempotencyKey) => api.repayLoan(open.loanId, { idempotencyKey, pin, amountMinor: repayMinor! }),
                })
              }
            >
              {t("loans.reviewRepay")}
            </button>
          </div>
        </section>
      )}

      {!open && offer && (
        <section className="card">
          <div className="loan-hero">
            <span className="tile-icon">
              <Icon name="loans" />
            </span>
            <h2>{t("loans.title")}</h2>
          </div>
          {offer.eligible ? (
            <>
              <p className="muted">
                {t("loans.offer", {
                  min: fmt(offer.minPrincipalMinor),
                  max: fmt(offer.maxPrincipalMinor),
                  days: offer.termDays,
                  percent: offer.feeBps / 100,
                })}
              </p>
              <AmountField id="loan-amount" label={t("loans.howMuch")} currency={wallet.currency} value={amount} onChange={setAmount} />
              {principal && !inRange && <p className="field-error">{t("loans.range", { min: fmt(offer.minPrincipalMinor), max: fmt(offer.maxPrincipalMinor) })}</p>}
              {inRange && (
                <div className="subcard">
                  <strong>{t("loans.before")}</strong>
                  <dl className="summary">
                    <dt>{t("loans.receive")}</dt>
                    <dd>{fmt(principal!)}</dd>
                    <dt>{t("common.fee")}</dt>
                    <dd>{fmt(fee)}</dd>
                    <dt>{t("loans.repay")}</dt>
                    <dd>
                      <strong>{fmt(principal! + fee)}</strong>
                    </dd>
                    <dt>{t("loans.dueBy")}</dt>
                    <dd>{due}</dd>
                    <dt>{t("loans.apr")}</dt>
                    <dd>{offer.aprPercent}%</dd>
                  </dl>
                  <label className="inline">
                    <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    <span className="small">{t("loans.consent", { total: fmt(principal! + fee), date: due })}</span>
                  </label>
                </div>
              )}
              <button
                className="block"
                disabled={!inRange || !accepted}
                onClick={() =>
                  setIntent({
                    title: t("loans.take"),
                    rows: [
                      [t("loans.receive"), fmt(principal!)],
                      [t("loans.repay"), fmt(principal! + fee)],
                      [t("loans.dueBy"), due],
                    ],
                    currency: wallet.currency,
                    amountMinor: principal!,
                    requirePin: true,
                    submit: (pin, idempotencyKey) => api.applyLoan({ idempotencyKey, pin, principalMinor: principal! }),
                  })
                }
              >
                {t("common.continue")}
              </button>
            </>
          ) : (
            offer.reasons.map((r) => (
              <Banner key={r} tone="info">
                {r}
              </Banner>
            ))
          )}
        </section>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      {loans.some((l) => l.status === "REPAID") && (
        <section className="card">
          <h3>{t("loans.history")}</h3>
          <ul className="plain-list">
            {loans
              .filter((l) => l.status === "REPAID")
              .map((l) => (
                <li key={l.loanId}>
                  <div className="spread">
                    <span>
                      {fmt(l.principalMinor)} <span className="muted small">· {date(l.disbursedAt)}</span>
                    </span>
                    <span className="badge neutral">{t("loans.repaidOn", { date: l.repaidAt ? date(l.repaidAt) : "" })}</span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
