import type { WalletTransaction } from "@benki/shared";

interface Props {
  transactions: WalletTransaction[];
  onBackToTransfer: () => void;
}

export function History({ transactions, onBackToTransfer }: Props) {
  return (
    <div className="card">
      <h2>Transaction history</h2>
      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <ul className="tx-list">
          {transactions.map((tx) => {
            const isCredit = tx.type !== "TRANSFER_OUT";
            return (
              <li key={`${tx.reference}-${tx.type}`} className="tx-item">
                <div>
                  <strong>{tx.type.replace("_", " ")}</strong>
                  <div>{tx.counterparty}</div>
                  <div>{tx.note}</div>
                </div>
                <span className={`amount ${isCredit ? "credit" : "debit"}`}>
                  {isCredit ? "+" : "-"}
                  {tx.amountMinor.toLocaleString()}
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
