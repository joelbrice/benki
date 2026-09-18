import { Text } from "react-native";
import type { WalletAccount } from "../types";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

interface Props {
  wallet: WalletAccount | null;
  busy: boolean;
  onCreateWallet: () => Promise<void>;
  onCashIn: (amountMinor: number) => Promise<void>;
  onContinue: () => void;
}

export function Wallet({ wallet, busy, onCreateWallet, onCashIn, onContinue }: Props) {
  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Wallet</Text>
      {!wallet ? (
        <PrimaryButton title="Create wallet" disabled={busy} onPress={onCreateWallet} />
      ) : (
        <>
          <Text style={{ fontSize: 32, fontWeight: "700" }}>
            {wallet.availableBalanceMinor.toLocaleString()} {wallet.currency}
          </Text>
          <Text>Wallet ID: {wallet.walletId}</Text>
          <PrimaryButton
            title="Simulate agent cash-in (+50,000)"
            disabled={busy}
            onPress={() => onCashIn(50_000)}
          />
          <SecondaryButton title="Continue to transfer" disabled={busy} onPress={onContinue} />
        </>
      )}
    </Card>
  );
}
