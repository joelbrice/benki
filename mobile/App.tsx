import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { COUNTRY_BY_CODE, type Locale } from "@benki/shared";
import { ApiRequestError, customerApi } from "./src/api";
import { Banner, Icon, Muted, type IconName } from "./src/components/ui";
import { I18nProvider, useI18n } from "./src/i18n";
import { Activity, Profile, Savings } from "./src/screens/Account";
import { Onboarding, SetPin } from "./src/screens/Auth";
import { Groups, Loans } from "./src/screens/Community";
import { Currencies } from "./src/screens/Currencies";
import { Home } from "./src/screens/Home";
import { Cash, Pay, Send } from "./src/screens/Money";
import { More } from "./src/screens/More";
import { Requests } from "./src/screens/Requests";
import type { Preset, Section, Session } from "./src/session";
import { deleteItem, getItem, setItem } from "./src/storage";
import { colors } from "./src/theme/colors";

const TOKEN_KEY = "benki.token";
const TABS: { id: Section; icon: IconName; label: "nav.home" | "nav.send" | "nav.pay" | "nav.activity" | "nav.more" }[] = [
  { id: "home", icon: "home", label: "nav.home" },
  { id: "send", icon: "arrow-up-right", label: "nav.send" },
  { id: "pay", icon: "file-text", label: "nav.pay" },
  { id: "activity", icon: "clock", label: "nav.activity" },
  { id: "more", icon: "grid", label: "nav.more" },
];

function Brand() {
  const { t } = useI18n();
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>B</Text>
      </View>
      <View>
        <Text style={styles.brandName}>Benki</Text>
        <Text style={styles.brandTag}>{t("app.tagline")}</Text>
      </View>
    </View>
  );
}

function BenkiApp() {
  const { t, setLocale } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const api = useMemo(() => (token ? customerApi(token) : null), [token]);
  const [session, setSession] = useState<Omit<Session, "refresh" | "go" | "preset"> | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [section, setSection] = useState<Section>("home");
  const [preset, setPreset] = useState<Preset | undefined>();
  const [error, setError] = useState<string | null>(null);
  const localeSynced = useRef(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    getItem(TOKEN_KEY)
      .then(setToken)
      .finally(() => setBooted(true));
  }, []);

  const signOut = useCallback(() => {
    void deleteItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
    localeSynced.current = false;
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      let { user, wallet } = await api.me();
      if (!wallet && user.status === "ACTIVE") wallet = (await api.createWallet()).wallet;
      setNeedsPin(!user.pinSet);
      if (!wallet) throw new Error("wallet");
      setSession({ api, user, wallet, limits: await api.limits(), country: COUNTRY_BY_CODE[user.countryCode] });
      if (!localeSynced.current) {
        // The account's saved language wins once, at sign-in.
        localeSynced.current = true;
        setLocale(user.locale);
      }
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) signOut();
      else setError(e instanceof ApiRequestError && e.code === "NETWORK_ERROR" ? t("common.offline") : t("err.generic"));
    }
  }, [api, signOut, setLocale, t]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const go = useCallback((next: Section, nextPreset?: Preset) => {
    setSection(next);
    setPreset(nextPreset);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);
  const changeLanguage = (l: Locale) => {
    if (api) void api.setLocale(l).catch(() => undefined);
  };
  const logout = () => {
    if (api) void api.logout().finally(signOut);
  };

  let body;
  if (!booted) body = <Muted>{t("common.loading")}</Muted>;
  else if (!token || !api)
    body = (
      <Onboarding
        onSignedIn={(tok) => {
          void setItem(TOKEN_KEY, tok);
          setToken(tok);
        }}
      />
    );
  else if (needsPin) body = <SetPin api={api} onDone={() => void refresh()} />;
  else if (!session) body = error ? <Banner tone="error">{error}</Banner> : <Muted>{t("common.loading")}</Muted>;
  else {
    const full: Session = { ...session, refresh, go, preset };
    body = (
      <>
        {section === "home" && <Home session={full} />}
        {section === "send" && <Send session={full} />}
        {section === "requests" && <Requests session={full} />}
        {section === "pay" && <Pay session={full} />}
        {section === "cash" && <Cash session={full} />}
        {section === "savings" && <Savings session={full} />}
        {section === "groups" && <Groups session={full} />}
        {section === "loans" && <Loans session={full} />}
        {section === "currencies" && <Currencies session={full} />}
        {section === "activity" && <Activity session={full} />}
        {section === "profile" && <Profile session={full} onLogout={logout} onLanguage={changeLanguage} />}
        {section === "more" && <More session={full} onLogout={logout} />}
      </>
    );
  }

  const signedIn = !!session && !needsPin && !!token;
  const initials = (session?.user.fullName ?? "B")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const moreSections: Section[] = ["requests", "cash", "savings", "groups", "loans", "currencies", "profile", "more"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {signedIn && (
        <View style={styles.header}>
          <Brand />
          <Pressable accessibilityRole="button" accessibilityLabel={t("nav.profile")} onPress={() => go("profile")} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      )}
      <ScrollView ref={scroll} contentContainerStyle={[styles.scroll, signedIn && { paddingBottom: 110 }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {signedIn && (
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const active = section === tab.id || (tab.id === "more" && moreSections.includes(section));
            return (
              <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={t(tab.label)} accessibilityState={{ selected: active }} onPress={() => go(tab.id)} style={styles.tab}>
                <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                  <Icon name={tab.icon} size={20} color={active ? colors.primary : colors.subtext} />
                </View>
                <Text style={[styles.tabText, active && { color: colors.primary }]}>{t(tab.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BenkiApp />
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.heroMid, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: colors.accent },
  brandMarkText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  brandName: { fontSize: 19, fontWeight: "800", color: colors.text },
  brandTag: { fontSize: 11, color: colors.subtext },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.warn, fontWeight: "800" },
  scroll: { padding: 16, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: 14,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999 },
  tabIconActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 11, fontWeight: "700", color: colors.subtext },
});
