import { useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { api, ApiRequestError } from "./src/api";
import { Onboarding } from "./src/components/Onboarding";
import { Kyc } from "./src/components/Kyc";
import { Wallet } from "./src/components/Wallet";
import { Transfer } from "./src/components/Transfer";
import { History } from "./src/components/History";
import { StatusBanner } from "./src/components/ui";
import { colors } from "./src/theme/colors";
import type { JourneyStep, UserProfile, WalletAccount, WalletTransaction } from "./src/types";

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Benki — Bank Without Borders</Text>
          <Text style={styles.subtitle}>
            Focused for rural access, assisted onboarding, and interoperable transfers.
          </Text>
        </View>

        <View style={styles.stepIndicator}>
          {STEPS.map((s, i) => (
            <Text key={s} style={s === step ? styles.stepActive : styles.step}>
              {s}
              {i < STEPS.length - 1 ? " › " : ""}
            </Text>
          ))}
        </View>

        {error ? <StatusBanner message={error} error /> : <StatusBanner message={status} />}

        {step === "ONBOARDING" && (
          <Onboarding
            busy={busy}
            otpSent={otpSent}
            onRequestOtp={async (phoneNumber, country) => {
              await guarded(async () => {
                const res = await api.sendOtp(phoneNumber, country);
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
            kycTier={user.kycTier}
            onUpgrade={async (tier) => {
              await guarded(async () => {
                const res = await api.upgradeKyc(token, tier);
                setUser({ ...user, kycTier: res.kycTier });
                setStatus(`Upgraded to ${res.kycTier}.`);
              });
            }}
            onContinue={() => setStep("WALLET")}
          />
        )}

        {step === "WALLET" && token && (
          <Wallet
            busy={busy}
            wallet={wallet}
            onCreateWallet={async () => {
              await guarded(async () => {
                const res = await api.createWallet(token);
                setWallet(res.wallet);
                setStatus("Wallet created.");
              });
            }}
            onCashIn={async (amountMinor) => {
              if (!wallet) return;
              await guarded(async () => {
                const res = await api.cashIn(token, wallet.walletId, amountMinor);
                setWallet(res.wallet);
                setStatus("Cash-in complete.");
              });
            }}
            onContinue={() => setStep("TRANSFER")}
          />
        )}

        {step === "TRANSFER" && token && wallet && (
          <Transfer
            busy={busy}
            wallet={wallet}
            onSend={async (destinationPhoneNumber, amountMinor, note) => {
              await guarded(async () => {
                const res = await api.transferInternal(token, {
                  idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
          />
        )}

        {step === "HISTORY" && (
          <History transactions={transactions} onBackToTransfer={() => setStep("TRANSFER")} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, gap: 16, maxWidth: 480, width: "100%", alignSelf: "center" },
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.subtext },
  stepIndicator: { flexDirection: "row", flexWrap: "wrap" },
  step: { fontSize: 11, color: "#6a7a75" },
  stepActive: { fontSize: 11, color: colors.primary, fontWeight: "700" },
});
