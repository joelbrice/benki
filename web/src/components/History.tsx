import { formatAmount, type WalletTransaction } from "@benki/shared";

interface Props {
  transactions: WalletTransaction[];
  currency: string;
  onBackToTransfer: () => void;
}

const CREDIT_TYPES = new Set(["CASH_IN", "TRANSFER_IN"]);

export function History({ transactions, currency, onBackToTransfer }: Props) {
  return (
    <div className="card">
      <h2>Transaction history</h2>
      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <ul className="tx-list">
          {transactions.map((tx) => {
            const isCredit = CREDIT_TYPES.has(tx.type);
            return (
              <li key={`${tx.reference}-${tx.type}`} className="tx-item">
                <div>
                  <strong>{tx.type.replace(/_/g, " ")}</strong>
                  <div>{tx.counterparty}</div>
                  <div>{tx.note}</div>
                </div>
                <span className={`amount ${isCredit ? "credit" : "debit"}`}>
                  {isCredit ? "+" : "-"}
                  {formatAmount(tx.amountMinor, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <button className="secondary" onClick={onBackToTransfer}>
        Send another transfer
      </button>
    </div>
  );
}
