import { useState } from "react";
import type { JourneyStep, UserProfile, WalletAccount, WalletTransaction } from "@benki/shared";
import { api, ApiRequestError } from "./api";
import { Onboarding } from "./components/Onboarding";
import { Kyc } from "./components/Kyc";
import { Wallet } from "./components/Wallet";
import { Transfer } from "./components/Transfer";
import { History } from "./components/History";

const STEPS: JourneyStep[] = ["ONBOARDING", "KYC", "WALLET", "TRANSFER", "HISTORY"];

export default function App() {
  const [step, setStep] = useState<JourneyStep>("ONBOARDING");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Low-bandwidth mode ready.");
  const [error, setError] = useState<string | null>(null);

  async function guarded<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Unexpected error — check the backend is running.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function refreshTransactions(walletId: string, authToken: string) {
    const { transactions } = await api.transactions(authToken, walletId);
    setTransactions(transactions);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Benki — Bank Without Borders</h1>
        <p>Focused for rural access, assisted onboarding, and interoperable transfers.</p>
      </header>

      <div className="step-indicator">
        {STEPS.map((s) => (
          <span key={s} className={s === step ? "active" : undefined}>
            {s}
            {s !== "HISTORY" ? " ›" : ""}
          </span>
        ))}
      </div>

      {error && <div className="status-banner error">{error}</div>}
      {!error && <div className="status-banner">{status}</div>}

      {step === "ONBOARDING" && (
        <Onboarding
          busy={busy}
          otpSent={otpSent}
          onRequestOtp={async (phoneNumber, countryCode) => {
            await guarded(async () => {
              const res = await api.sendOtp(phoneNumber, countryCode);
              setPendingPhone(phoneNumber);
              setOtpSent(true);
              setStatus(`OTP sent. Dev shortcut — your code is ${res.devOtp}.`);
            });
          }}
          onVerify={async (otp) => {
            await guarded(async () => {
              const res = await api.verifyOtp(pendingPhone, otp);
              setToken(res.token);
              setUser(res.user);
              setStatus("Signed in. Proceed to identity verification.");
              setStep("KYC");
            });
          }}
        />
      )}

      {step === "KYC" && user && token && (
        <Kyc
          busy={busy}
          user={user}
          onUpgradeTier1={async (nationalId) => {
            await guarded(async () => {
              const res = await api.upgradeKycTier1(token, nationalId);
              setUser({ ...user, kycTier: res.kycTier, nationalId });
              setStatus(`Upgraded to ${res.kycTier}.`);
            });
          }}
          onUpgradeTier2={async () => {
            await guarded(async () => {
              const res = await api.upgradeKycTier2(token, true);
              setUser({ ...user, kycTier: res.kycTier, proofOfAddressConfirmed: true });
              setStatus(`Upgraded to ${res.kycTier}.`);
            });
          }}
          onContinue={() => setStep("WALLET")}
        />
      )}

      {step === "WALLET" && token && user && (
        <Wallet
          busy={busy}
          user={user}
          wallet={wallet}
          onCreateWallet={async () => {
            await guarded(async () => {
              const res = await api.createWallet(token);
              setWallet(res.wallet);
              setStatus("Wallet created.");
            });
          }}
          onCashIn={async (amountMinor, agentId) => {
            if (!wallet) return;
            await guarded(async () => {
              const res = await api.cashIn(token, wallet.walletId, { amountMinor, agentId });
              setWallet(res.wallet);
              setStatus("Cash-in complete.");
            });
          }}
          onCashOut={async (amountMinor, agentId) => {
            if (!wallet) return;
            await guarded(async () => {
              const res = await api.cashOut(token, wallet.walletId, { amountMinor, agentId });
              setWallet(res.wallet);
              setStatus("Cash-out complete.");
            });
          }}
          onAirtimeTopUp={async (amountMinor, providerId) => {
            if (!wallet) return;
            await guarded(async () => {
              const res = await api.airtimeTopUp(token, wallet.walletId, { amountMinor, providerId });
              setWallet(res.wallet);
              setStatus("Airtime top-up complete.");
            });
          }}
          onContinue={() => setStep("TRANSFER")}
        />
      )}

      {step === "TRANSFER" && token && user && wallet && (
        <Transfer
          busy={busy}
          user={user}
          wallet={wallet}
          onSendInternal={async (destinationPhoneNumber, amountMinor, note) => {
            await guarded(async () => {
              const res = await api.transferInternal(token, {
                idempotencyKey: crypto.randomUUID(),
                destinationPhoneNumber,
                amountMinor,
                currency: wallet.currency,
                note: note || undefined,
              });
              setWallet(res.wallet);
              setStatus("Transfer successful.");
              await refreshTransactions(wallet.walletId, token);
              setStep("HISTORY");
            });
          }}
          onSendMobileMoney={async (providerId, destinationPhoneNumber, amountMinor) => {
            await guarded(async () => {
              const res = await api.transferMobileMoney(token, {
                idempotencyKey: crypto.randomUUID(),
                providerId,
                destinationPhoneNumber,
                amountMinor,
                currency: wallet.currency,
              });
              setWallet(res.wallet);
              setStatus("Mobile money transfer sent.");
              await refreshTransactions(wallet.walletId, token);
              setStep("HISTORY");
            });
          }}
        />
      )}

      {step === "HISTORY" && wallet && (
        <History
          transactions={transactions}
          currency={wallet.currency}
          onBackToTransfer={() => setStep("TRANSFER")}
        />
      )}
    </div>
  );
}
