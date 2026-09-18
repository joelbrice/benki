import type { WalletAccount } from "@benki/shared";

interface Props {
  wallet: WalletAccount | null;
  busy: boolean;
  onCreateWallet: () => Promise<void>;
  onCashIn: (amountMinor: number) => Promise<void>;
  onContinue: () => void;
}

export function Wallet({ wallet, busy, onCreateWallet, onCashIn, onContinue }: Props) {
  return (
    <div className="card">
      <h2>Wallet</h2>
      {!wallet ? (
        <button disabled={busy} onClick={onCreateWallet}>
          Create wallet
        </button>
      ) : (
        <>
          <div className="balance">
            {wallet.availableBalanceMinor.toLocaleString()} {wallet.currency}
          </div>
          <p>Wallet ID: {wallet.walletId}</p>
          <button disabled={busy} onClick={() => onCashIn(50_000)}>
            Simulate agent cash-in (+50,000)
          </button>
          <button className="secondary" disabled={busy} onClick={onContinue}>
            Continue to transfer
          </button>
        </>
      )}
    </div>
  );
}
