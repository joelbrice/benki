import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { COUNTRY_BY_CODE } from "@benki/shared";
import { ApiRequestError, customerApi } from "./src/api";
import { Banner, Muted } from "./src/components/ui";
import { History, Profile, Savings } from "./src/screens/Account";
import { Onboarding, SetPin } from "./src/screens/Auth";
import { Home } from "./src/screens/Home";
import { Cash, Pay, Send } from "./src/screens/Money";
import type { Session } from "./src/session";
import { deleteItem, getItem, setItem } from "./src/storage";
import { colors } from "./src/theme/colors";

const TABS = ["Home", "Send", "Pay", "Cash", "Savings", "History", "Profile"] as const;
type Tab = (typeof TABS)[number];
const TOKEN_KEY = "benki.token";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const api = useMemo(() => (token ? customerApi(token) : null), [token]);
  const [session, setSession] = useState<Omit<Session, "refresh"> | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [tab, setTab] = useState<Tab>("Home");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getItem(TOKEN_KEY)
      .then(setToken)
      .finally(() => setBooted(true));
  }, []);

  const signOut = useCallback(() => {
    void deleteItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      let { user, wallet } = await api.me();
      if (!wallet && user.status === "ACTIVE") wallet = (await api.createWallet()).wallet;
      setNeedsPin(!user.pinSet);
      if (!wallet) throw new Error("Wallet unavailable");
      setSession({ api, user, wallet, limits: await api.limits(), country: COUNTRY_BY_CODE[user.countryCode] });
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) signOut();
      else setError(e instanceof Error ? e.message : "Couldn't load your account");
    }
  }, [api, signOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  let body;
  if (!booted) body = <Muted>Loading…</Muted>;
  else if (!token || !api)
    body = (
      <Onboarding
        onSignedIn={(t) => {
          void setItem(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  else if (needsPin) body = <SetPin api={api} onDone={() => void refresh()} />;
  else if (!session) body = error ? <Banner tone="error">{error}</Banner> : <Muted>Loading your account…</Muted>;
  else {
    const full: Session = { ...session, refresh };
    body = (
      <>
        {tab === "Home" && <Home session={full} onVerify={() => setTab("Profile")} />}
        {tab === "Send" && <Send session={full} />}
        {tab === "Pay" && <Pay session={full} />}
        {tab === "Cash" && <Cash session={full} />}
        {tab === "Savings" && <Savings session={full} />}
        {tab === "History" && <History session={full} />}
        {tab === "Profile" && <Profile session={full} onLogout={() => void api.logout().finally(signOut)} />}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Benki</Text>
          <Text style={styles.subtitle}>
            Bank without borders{session ? ` · ${session.user.fullName ?? session.user.phoneNumber} · ${session.country.name}` : ""}
          </Text>
        </View>
        {session && !needsPin && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === tab }} onPress={() => setTab(t)} style={[styles.tab, t === tab && styles.tabActive]}>
                <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, gap: 14, maxWidth: 520, width: "100%", alignSelf: "center" },
  header: { gap: 2 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.subtext },
  tabs: { gap: 4 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  tabActive: { backgroundColor: colors.card, borderColor: colors.border },
  tabText: { fontWeight: "600", color: colors.subtext },
  tabTextActive: { color: colors.primary },
});
