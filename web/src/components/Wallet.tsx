import { useState } from "react";
import { COUNTRY_BY_CODE, formatAmount, type UserProfile, type WalletAccount } from "@benki/shared";

interface Props {
  user: UserProfile;
  wallet: WalletAccount | null;
  busy: boolean;
  onCreateWallet: () => Promise<void>;
  onCashIn: (amountMinor: number, agentId: string) => Promise<void>;
  onCashOut: (amountMinor: number, agentId: string) => Promise<void>;
  onAirtimeTopUp: (amountMinor: number, providerId: string) => Promise<void>;
  onContinue: () => void;
}

export function Wallet({ user, wallet, busy, onCreateWallet, onCashIn, onCashOut, onAirtimeTopUp, onContinue }: Props) {
  const country = COUNTRY_BY_CODE[user.countryCode];
  const [agentId, setAgentId] = useState(country?.agents[0]?.id ?? "");
  const [cashAmount, setCashAmount] = useState("10000");
  const [providerId, setProviderId] = useState(country?.mobileMoneyProviders[0]?.id ?? "");
  const [airtimeAmount, setAirtimeAmount] = useState("1000");

  if (!country) return null;

  return (
    <div className="card">
      <h2>Wallet</h2>
      {!wallet ? (
        <button disabled={busy} onClick={onCreateWallet}>
          Create wallet
        </button>
      ) : (
        <>
          <div className="balance">{formatAmount(wallet.availableBalanceMinor, wallet.currency)}</div>
          <p>Wallet ID: {wallet.walletId}</p>

          <div className="sub-card">
            <strong>Cash-in / cash-out via agent</strong>
            <div>
              <label htmlFor="agent">Agent</label>
              <select id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                {country.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.location}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cashAmount">Amount (minor units)</label>
              <input id="cashAmount" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={busy || !Number(cashAmount)}
                onClick={() => onCashIn(Number(cashAmount), agentId)}
              >
                Cash-in
              </button>
              <button
                className="secondary"
                disabled={busy || !Number(cashAmount)}
                onClick={() => onCashOut(Number(cashAmount), agentId)}
              >
                Cash-out
              </button>
            </div>
          </div>

          <div className="sub-card">
            <strong>Airtime / data top-up</strong>
            <div>
              <label htmlFor="provider">Mobile network</label>
              <select id="provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {country.mobileMoneyProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="airtimeAmount">Amount (minor units)</label>
              <input
                id="airtimeAmount"
                value={airtimeAmount}
                onChange={(e) => setAirtimeAmount(e.target.value)}
              />
            </div>
            <button
              disabled={busy || !Number(airtimeAmount)}
              onClick={() => onAirtimeTopUp(Number(airtimeAmount), providerId)}
            >
              Top up airtime
            </button>
          </div>

          <button className="secondary" disabled={busy} onClick={onContinue}>
            Continue to transfer
          </button>
        </>
      )}
    </div>
  );
}
