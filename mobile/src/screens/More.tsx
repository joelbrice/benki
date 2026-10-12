import { Pressable, Text, View } from "react-native";
import type { MessageKey } from "@benki/shared";
import { Icon, ScreenHeader, type IconName } from "../components/ui";
import { useI18n } from "../i18n";
import type { Section, Session } from "../session";
import { colors } from "../theme/colors";

const ITEMS: { id: Section; icon: IconName }[] = [
  { id: "requests", icon: "inbox" },
  { id: "cash", icon: "dollar-sign" },
  { id: "savings", icon: "target" },
  { id: "groups", icon: "users" },
  { id: "loans", icon: "pocket" },
  { id: "currencies", icon: "globe" },
  { id: "profile", icon: "user" },
];

export function More({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { t } = useI18n();
  const tile = (key: string, icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: "30%", flexGrow: 1, alignItems: "center", gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={colors.primary} />
      </View>
      <Text style={{ fontWeight: "700", fontSize: 12, color: colors.text, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
  return (
    <>
      <ScreenHeader title={t("nav.more")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {ITEMS.map((i) => tile(i.id, i.icon, t(`nav.${i.id}` as MessageKey), () => session.go(i.id)))}
        {tile("signout", "log-out", t("nav.signOut"), onLogout)}
      </View>
    </>
  );
}
