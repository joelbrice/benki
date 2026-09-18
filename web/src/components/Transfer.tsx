import { useState } from "react";
import type { WalletAccount } from "@benki/shared";

interface Props {
  wallet: WalletAccount;
  busy: boolean;
  onSend: (destinationPhoneNumber: string, amountMinor: number, note: string) => Promise<void>;
}

export function Transfer({ wallet, busy, onSend }: Props) {
  const [destination, setDestination] = useState("+221700000002");
  const [amount, setAmount] = useState("15000");
  const [note, setNote] = useState("");

  const amountMinor = Number(amount);
  const canSubmit = destination.trim() && Number.isFinite(amountMinor) && amountMinor > 0;

  return (
    <div className="card">
      <h2>Send money</h2>
      <p>
        Available balance: {wallet.availableBalanceMinor.toLocaleString()} {wallet.currency}
      </p>
      <div>
        <label htmlFor="destination">Recipient phone number</label>
        <input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
      </div>
      <div>
        <label htmlFor="amount">Amount (minor units)</label>
        <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label htmlFor="note">Note (optional)</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button disabled={busy || !canSubmit} onClick={() => onSend(destination, amountMinor, note)}>
        Send internal transfer
      </button>
    </div>
  );
}
