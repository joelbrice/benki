import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CurrencyPocket, MessageKey, Notification, PaymentRequest, UserTransaction } from "@benki/shared";
import { Badge, Banner, Card, Icon, LinkButton, Meter, Muted, PrimaryButton, Title, TxRow, type IconName } from "../components/ui";
import { useI18n } from "../i18n";
import type { Preset, Section, Session } from "../session";
import { getItem, setItem } from "../storage";
import { colors } from "../theme/colors";

const QUICK: { key: MessageKey; icon: IconName; to: Section; preset?: Preset }[] = [
  { key: "quick.send", icon: "arrow-up-right", to: "send", preset: "benki" },
  { key: "quick.request", icon: "arrow-down-left", to: "requests" },
  { key: "quick.bills", icon: "file-text", to: "pay", preset: "bills" },
  { key: "quick.airtime", icon: "zap", to: "pay", preset: "airtime" },
  { key: "quick.cash", icon: "dollar-sign", to: "cash" },
  { key: "quick.save", icon: "target", to: "savings" },
  { key: "quick.borrow", icon: "pocket", to: "loans" },
  { key: "quick.convert", icon: "repeat", to: "currencies" },
];

export function Home({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { wallet, limits, user, api, go } = session;
  const fmt = (n: number) => money(n, wallet.currency);
  const [hidden, setHidden] = useState(false);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [recent, setRecent] = useState<UserTransaction[]>([]);
  const [pockets, setPockets] = useState<CurrencyPocket[]>([]);
  const [incoming, setIncoming] = useState<PaymentRequest[]>([]);

  useEffect(() => {
    void getItem("benki.hideBalance").then((v) => setHidden(v === "1"));
  }, []);
  useEffect(() => {
    api.notifications().then((r) => setNotes(r.notifications), () => undefined);
    api.transactions(wallet.walletId).then((r) => setRecent(r.transactions.slice(0, 5)), () => undefined);
    api.pockets().then((r) => setPockets(r.pockets), () => undefined);
    api.requests().then((r) => setIncoming(r.requests.filter((q) => q.direction === "INCOMING" && q.status === "PENDING")), () => undefined);
  }, [api, wallet.walletId, wallet.ledgerBalanceMinor]);

  const mask = (s: string) => (hidden ? "•••••" : s);
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "home.morning" : hour < 18 ? "home.afternoon" : "home.evening", { name: user.fullName?.split(/\s+/)[0] ?? "" }).replace(/,\s*$/, "");

  return (
    <>
      {user.status === "FROZEN" && <Banner tone="error">{t("home.restricted")}</Banner>}
      {user.kycReviewPending && <Banner tone="warn">{t("home.kycPending")}</Banner>}

      <View style={styles.balanceCard}>
        <View style={styles.decorGold} />
        <View style={styles.decorRing} />
        <View style={styles.row}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("common.showBalance") : t("common.hideBalance")}
            onPress={() => {
              setHidden(!hidden);
              void setItem("benki.hideBalance", hidden ? "0" : "1");
            }}
            style={styles.eye}
          >
            <Icon name={hidden ? "eye" : "eye-off"} size={18} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.balanceLabel}>{t("home.available")}</Text>
        <Text style={styles.balance} adjustsFontSizeToFit numberOfLines={1}>
          {mask(fmt(wallet.availableBalanceMinor))}
        </Text>
        <View style={styles.stats}>
          {(
            [
              ["home.ledger", wallet.ledgerBalanceMinor],
              ["home.reserved", wallet.reservedBalanceMinor],
              ["home.inFlight", wallet.pendingBalanceMinor],
            ] as const
          ).map(([k, v]) => (
            <View key={k} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>{t(k)}</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {mask(fmt(v))}
              </Text>
            </View>
          ))}
        </View>
        {pockets.length > 0 && (
          <View style={styles.chips}>
            {pockets.map((p) => (
              <Pressable key={p.pocketId} onPress={() => go("currencies")} style={styles.pocketChip}>
                <Text style={styles.pocketText}>{mask(money(p.balanceMinor, p.currency))}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.quickGrid}>
        {QUICK.map((q, i) => (
          <Pressable key={q.key} accessibilityRole="button" accessibilityLabel={t(q.key)} onPress={() => go(q.to, q.preset)} style={styles.quick}>
            <View style={[styles.quickIcon, i % 2 === 1 && { backgroundColor: colors.accentSoft }]}>
              <Icon name={q.icon} size={20} color={i % 2 === 1 ? colors.warn : colors.primary} />
            </View>
            <Text style={styles.quickText} numberOfLines={2}>
              {t(q.key)}
            </Text>
          </Pressable>
        ))}
      </View>

      {incoming.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={t("home.requestsWaiting")} onPress={() => go("requests")} style={styles.alert}>
          <Icon name="inbox" color={colors.warn} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: colors.text }}>{t("home.requestsWaiting")}</Text>
            <Muted>{incoming.slice(0, 2).map((r) => `${r.counterparty} · ${money(r.amountMinor, r.currency)}`).join(" — ")}</Muted>
          </View>
          <Icon name="chevron-right" color={colors.warn} />
        </Pressable>
      )}

      {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
        <View style={styles.nudge}>
          <Icon name="star" color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: "800", color: colors.text }}>{t("home.verifyTitle")}</Text>
            <Muted>{t("home.verifyBody")}</Muted>
          </View>
          <PrimaryButton title={t("home.verifyNow")} onPress={() => go("profile")} />
        </View>
      )}

      <Card>
        <View style={styles.row}>
          <Title>{t("home.recent")}</Title>
          <LinkButton title={t("home.seeAll")} onPress={() => go("activity")} />
        </View>
        {recent.length === 0 ? <Muted>{t("home.noActivity")}</Muted> : recent.map((tx) => <TxRow key={tx.id} tx={tx} />)}
      </Card>

      <Card>
        <View style={styles.row}>
          <Title>{t("home.limits")}</Title>
          <Badge label={t(`tier.${user.kycTier}`)} />
        </View>
        {(
          [
            ["home.today", limits.dailyUsedMinor, limits.dailyLimitMinor],
            ["home.last30", limits.monthlyUsedMinor, limits.monthlyLimitMinor],
            ["home.holdings", limits.totalHoldingsMinor, limits.maxBalanceMinor],
          ] as const
        ).map(([k, used, total]) => (
          <View key={k} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={{ color: colors.text2, fontSize: 13 }}>{t(k)}</Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>{t("home.usedOf", { used: fmt(used), limit: fmt(total) })}</Text>
            </View>
            <Meter used={used} total={total} />
          </View>
        ))}
        <Muted>{t("home.perPayment", { amount: fmt(limits.perTransactionMinor) })}</Muted>
      </Card>

      <Card>
        <View style={styles.row}>
          <Title>{t("home.notifications")}</Title>
          {notes.some((n) => !n.read) && (
            <LinkButton title={t("home.markRead")} onPress={() => void api.markNotificationsRead().then(() => setNotes(notes.map((n) => ({ ...n, read: true }))))} />
          )}
        </View>
        {notes.length === 0 ? (
          <Muted>{t("common.nothingYet")}</Muted>
        ) : (
          notes.slice(0, 5).map((n) => (
            <View key={n.id} style={styles.note}>
              <View style={[styles.dot, { backgroundColor: n.kind === "SECURITY" ? colors.danger : n.kind === "ACCOUNT" ? colors.accent : colors.primary }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: n.read ? "400" : "700", fontSize: 13 }}>{n.message}</Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>{date(n.createdAt, true)}</Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  balanceCard: { backgroundColor: colors.heroMid, borderRadius: 26, padding: 22, gap: 6, overflow: "hidden" },
  decorGold: { position: "absolute", right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.accent, opacity: 0.4 },
  decorRing: { position: "absolute", left: -70, bottom: -90, width: 220, height: 220, borderRadius: 110, borderWidth: 26, borderColor: colors.heroLight, opacity: 0.5 },
  greeting: { color: "#fff", fontWeight: "800", fontSize: 16 },
  eye: { padding: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  balance: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: -0.5 },
  stats: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
  statLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  statValue: { color: "#fff", fontWeight: "800", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  pocketChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  pocketText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: { width: "22.8%", flexGrow: 1, alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  quickText: { fontSize: 11, fontWeight: "700", color: colors.text, textAlign: "center" },
  alert: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  nudge: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.primarySoft },
  note: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
});
