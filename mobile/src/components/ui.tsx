import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "../theme/colors";

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({
  label,
  ...inputProps
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} autoCapitalize="none" {...inputProps} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export function StatusBanner({ message, error }: { message: string; error?: boolean }) {
  return (
    <View style={[styles.banner, error && styles.bannerError]}>
      <Text style={[styles.bannerText, error && styles.bannerTextError]}>{message}</Text>
    </View>
  );
}

export function TierBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    gap: 12,
    shadowColor: "#10241f",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#2a3a35" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonSecondary: { backgroundColor: colors.secondaryBg },
  buttonDisabled: { backgroundColor: colors.primaryDisabled },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: colors.primary },
  banner: {
    backgroundColor: colors.banner,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bannerError: { backgroundColor: colors.errorBg },
  bannerText: { color: colors.bannerText, fontSize: 13 },
  bannerTextError: { color: colors.errorText },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondaryBg,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
});
