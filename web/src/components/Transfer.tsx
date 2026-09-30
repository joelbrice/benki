import { useState } from "react";
import { COUNTRY_BY_CODE, formatAmount, type UserProfile, type WalletAccount } from "@benki/shared";

interface Props {
  user: UserProfile;
  wallet: WalletAccount;
  busy: boolean;
  onSendInternal: (destinationPhoneNumber: string, amountMinor: number, note: string) => Promise<void>;
  onSendMobileMoney: (providerId: string, destinationPhoneNumber: string, amountMinor: number) => Promise<void>;
}

export function Transfer({ user, wallet, busy, onSendInternal, onSendMobileMoney }: Props) {
  const country = COUNTRY_BY_CODE[user.countryCode];
  const [mode, setMode] = useState<"internal" | "momo">("internal");

  const [destination, setDestination] = useState("+221700000002");
  const [amount, setAmount] = useState("15000");
  const [note, setNote] = useState("");

  const [momoProviderId, setMomoProviderId] = useState(country?.mobileMoneyProviders[0]?.id ?? "");
  const [momoDestination, setMomoDestination] = useState("");
  const [momoAmount, setMomoAmount] = useState("5000");

  const amountMinor = Number(amount);
  const canSubmitInternal = destination.trim().length > 0 && Number.isFinite(amountMinor) && amountMinor > 0;

  const momoAmountMinor = Number(momoAmount);
  const canSubmitMomo =
    momoDestination.trim().length > 0 && Number.isFinite(momoAmountMinor) && momoAmountMinor > 0;

  return (
    <div className="card">
      <h2>Send money</h2>
      <p>
        Available balance: {formatAmount(wallet.availableBalanceMinor, wallet.currency)}
      </p>

      <div className="tabs">
        <button className={mode === "internal" ? "active" : undefined} onClick={() => setMode("internal")}>
          To a Benki user
        </button>
        <button className={mode === "momo" ? "active" : undefined} onClick={() => setMode("momo")}>
          To mobile money
        </button>
      </div>

      {mode === "internal" ? (
        <>
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
          <button
            disabled={busy || !canSubmitInternal}
            onClick={() => onSendInternal(destination, amountMinor, note)}
          >
            Send internal transfer
          </button>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="momoProvider">Mobile money provider</label>
            <select id="momoProvider" value={momoProviderId} onChange={(e) => setMomoProviderId(e.target.value)}>
              {country?.mobileMoneyProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="momoDestination">Recipient phone number</label>
            <input
              id="momoDestination"
              value={momoDestination}
              onChange={(e) => setMomoDestination(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="momoAmount">Amount (minor units)</label>
            <input id="momoAmount" value={momoAmount} onChange={(e) => setMomoAmount(e.target.value)} />
          </div>
          <button
            disabled={busy || !canSubmitMomo}
            onClick={() => onSendMobileMoney(momoProviderId, momoDestination, momoAmountMinor)}
          >
            Send via mobile money
          </button>
        </>
      )}
    </div>
  );
}
