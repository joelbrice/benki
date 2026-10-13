import type { ReactNode } from "react";
import type { TransactionType, UserTransaction } from "@benki/shared";
import { useI18n } from "../i18n";
import { StatusBadge } from "./common";
import { Icon, type IconName } from "./icons";

const TYPE_ICON: Record<TransactionType, IconName> = {
  CASH_IN: "cash",
  CASH_OUT: "cash",
  P2P: "send",
  MOBILE_MONEY_PAYOUT: "phone",
  AIRTIME: "zap",
  BILL_PAYMENT: "pay",
  MERCHANT_PAYMENT: "store",
  CROSS_BORDER: "plane",
  SAVINGS_DEPOSIT: "savings",
  SAVINGS_WITHDRAWAL: "savings",
  BANK_TRANSFER: "bank",
  LOAN_DISBURSEMENT: "loans",
  LOAN_REPAYMENT: "loans",
  GROUP_CONTRIBUTION: "groups",
  GROUP_PAYOUT: "groups",
  FX_CONVERSION: "convert",
  REVERSAL: "refresh",
  ADJUSTMENT: "refresh",
};

/** Counterparty labels are stored in English by the server; show the language-neutral part. */
function counterpartyLabel(tx: UserTransaction): string {
  if (tx.type === "GROUP_CONTRIBUTION" || tx.type === "GROUP_PAYOUT") return tx.counterparty.replace(/^Group( payout)?: /, "");
  if (tx.type === "LOAN_DISBURSEMENT" || tx.type === "LOAN_REPAYMENT") return "Benki";
  if (tx.type === "SAVINGS_DEPOSIT" || tx.type === "SAVINGS_WITHDRAWAL") return tx.counterparty.replace(/^Savings: /, "");
  return tx.counterparty;
}

export function TxRow({ tx, children }: { tx: UserTransaction; children?: ReactNode }) {
  const { t, money, date, bidi } = useI18n();
  const credit = tx.direction === "CREDIT";
  // A sold pocket credits the wallet with the converted amount, so show what arrived.
  const shown =
    tx.type === "FX_CONVERSION" && credit && tx.receiveAmountMinor !== null && tx.receiveCurrency
      ? money(tx.receiveAmountMinor, tx.receiveCurrency)
      : money(tx.amountMinor, tx.currency);
  return (
    <li className="tx">
      <span className={`tx-icon ${credit ? "in" : "out"}`}>
        <Icon name={TYPE_ICON[tx.type]} size={18} />
      </span>
      <div className="tx-body">
        <div className="tx-line">
          <strong>{t(`type.${tx.type}`)}</strong>
          {/* Signed amounts read left-to-right in every language, so "+" stays next to the number. */}
          <span className={`amount ${credit ? "credit" : "debit"}`} dir="ltr">
            {credit ? "+" : "−"}
            {shown}
          </span>
        </div>
        <div className="tx-line muted small">
          <span className="ellipsis">{bidi(counterpartyLabel(tx))}</span>
          {tx.status !== "COMPLETED" ? <StatusBadge status={tx.status} /> : <span>{date(tx.createdAt, true)}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}
