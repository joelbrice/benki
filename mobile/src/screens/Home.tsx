import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { formatAmount, type Notification } from "@benki/shared";
import { Badge, Banner, Card, Meter, Muted, SecondaryButton, SubCard, Title } from "../components/ui";
import type { Session } from "../session";

export function Home({ session, onVerify }: { session: Session; onVerify: () => void }) {
  const { wallet, limits, user, api } = session;
  const fmt = (n: number) => formatAmount(n, wallet.currency);
  const [notes, setNotes] = useState<Notification[]>([]);
  useEffect(() => {
    api.notifications().then((r) => setNotes(r.notifications), () => undefined);
  }, [api, wallet.ledgerBalanceMinor]);

  const line = (label: string, used: number, total: number) => (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Muted>{label}</Muted>
        <Muted>
          {fmt(used)} / {fmt(total)}
        </Muted>
      </View>
      <Meter used={used} total={total} />
    </View>
  );

  return (
    <>
      {user.status === "FROZEN" && <Banner tone="error">Your account is restricted. Please contact support.</Banner>}
      {user.kycReviewPending && <Banner tone="warn">We're verifying your identity. We'll notify you when it's done.</Banner>}
      {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
        <SubCard>
          <Muted>You're on basic limits. Verify your identity to send more, save and send abroad.</Muted>
          <SecondaryButton title="Verify your identity" onPress={onVerify} />
        </SubCard>
      )}
      <Card>
        <Muted>Available balance</Muted>
        <Text style={{ fontSize: 32, fontWeight: "700" }} testID="available-balance">
          {fmt(wallet.availableBalanceMinor)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <View>
            <Muted>Ledger</Muted>
            <Text style={{ fontWeight: "700" }}>{fmt(wallet.ledgerBalanceMinor)}</Text>
          </View>
          <View>
            <Muted>Reserved</Muted>
            <Text style={{ fontWeight: "700" }}>{fmt(wallet.reservedBalanceMinor)}</Text>
          </View>
          <View>
            <Muted>Sending</Muted>
            <Text style={{ fontWeight: "700" }}>{fmt(wallet.pendingBalanceMinor)}</Text>
          </View>
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Title>Your limits</Title>
          <Badge label={user.kycTier.replace("_", " ")} />
        </View>
        {line("Today", limits.dailyUsedMinor, limits.dailyLimitMinor)}
        {line("Last 30 days", limits.monthlyUsedMinor, limits.monthlyLimitMinor)}
        {line("Total holdings", limits.totalHoldingsMinor, limits.maxBalanceMinor)}
        <Muted>Single payment limit: {fmt(limits.perTransactionMinor)}</Muted>
      </Card>
      <Card>
        <Title>Notifications</Title>
        {notes.length === 0 && <Muted>Nothing yet.</Muted>}
        {notes.slice(0, 5).map((n) => (
          <SubCard key={n.id}>
            <Badge label={n.kind} tone={n.kind === "SECURITY" ? "danger" : n.kind === "ACCOUNT" ? "warn" : "neutral"} />
            <Text>{n.message}</Text>
            <Muted>{new Date(n.createdAt).toLocaleString()}</Muted>
          </SubCard>
        ))}
      </Card>
    </>
  );
}
