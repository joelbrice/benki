import { useCallback, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { parseMajorToMinor, type TransactionStatus, type TransactionType } from "@benki/shared";
import { ApiRequestError } from "../api";
import { colors } from "../theme/colors";

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SubCard({ children }: { children: ReactNode }) {
  return <View style={styles.subcard}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Field({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} autoCapitalize="none" accessibilityLabel={label} {...inputProps} />
    </View>
  );
}

export function AmountField({ currency, value, onChange, label = "Amount" }: { currency: string; value: string; onChange: (v: string) => void; label?: string }) {
  const invalid = value.trim() !== "" && parseMajorToMinor(value, currency) === null;
  return (
    <View style={styles.field}>
      <Field label={`${label} (${currency})`} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={currency === "XOF" ? "e.g. 5000" : "e.g. 150.00"} />
      {invalid && <Text style={styles.muted}>Enter a valid amount</Text>}
    </View>
  );
}

function Button({ title, onPress, disabled, variant }: { title: string; onPress: () => void; disabled?: boolean; variant: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, styles[`button_${variant}`], disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export const PrimaryButton = (p: { title: string; onPress: () => void; disabled?: boolean }) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: { title: string; onPress: () => void; disabled?: boolean }) => <Button {...p} variant="secondary" />;
export const GhostButton = (p: { title: string; onPress: () => void; disabled?: boolean }) => <Button {...p} variant="ghost" />;

export function Banner({ tone = "info", children }: { tone?: "info" | "success" | "warn" | "error"; children: ReactNode }) {
  return (
    <View style={[styles.banner, styles[`banner_${tone}`]]} accessibilityRole={tone === "error" ? "alert" : "text"}>
      <Text style={[styles.bannerText, styles[`bannerText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function Badge({ label, tone = "brand" }: { label: string; tone?: "brand" | "warn" | "danger" | "neutral" }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const map: Partial<Record<TransactionStatus, [string, "brand" | "warn" | "danger" | "neutral"]>> = {
    COMPLETED: ["Completed", "brand"],
    PENDING: ["Sending", "warn"],
    PENDING_REVIEW: ["Processing", "warn"],
    FAILED: ["Failed", "danger"],
    REVERSED: ["Reversed", "neutral"],
  };
  const [label, tone] = map[status] ?? [status, "neutral"];
  return <Badge label={label} tone={tone} />;
}

export function Meter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <View style={styles.meter}>
      <View style={[styles.meterFill, { width: `${pct}%` }]} />
    </View>
  );
}

export function ChipSelect<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(o.id)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>{checked && <Text style={styles.checkboxMark}>✓</Text>}</View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <View style={{ gap: 6 }}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.summaryRow}>
          <Text style={styles.muted}>{k}</Text>
          <Text style={styles.summaryValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.";
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

export const TYPE_LABEL: Record<TransactionType, string> = {
  CASH_IN: "Cash deposit",
  CASH_OUT: "Cash withdrawal",
  P2P: "Transfer",
  MOBILE_MONEY_PAYOUT: "Mobile money",
  AIRTIME: "Airtime",
  BILL_PAYMENT: "Bill payment",
  MERCHANT_PAYMENT: "Merchant payment",
  CROSS_BORDER: "International transfer",
  SAVINGS_DEPOSIT: "To savings",
  SAVINGS_WITHDRAWAL: "From savings",
  BANK_TRANSFER: "Bank transfer",
  LOAN_DISBURSEMENT: "Loan received",
  LOAN_REPAYMENT: "Loan repayment",
  GROUP_CONTRIBUTION: "Group contribution",
  GROUP_PAYOUT: "Group payout",
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  subcard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.txBg, borderRadius: 10, padding: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.subtext },
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
    backgroundColor: colors.card,
  },
  button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.secondaryBg },
  button_ghost: { backgroundColor: "transparent", borderColor: colors.border },
  button_danger: { backgroundColor: colors.errorText },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  buttonText_primary: { color: "white" },
  buttonText_secondary: { color: colors.primary },
  buttonText_ghost: { color: colors.subtext },
  buttonText_danger: { color: "white" },
  banner: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  banner_info: { backgroundColor: "#eaf1fb" },
  banner_success: { backgroundColor: colors.secondaryBg },
  banner_warn: { backgroundColor: "#fff4e0" },
  banner_error: { backgroundColor: colors.errorBg },
  bannerText: { fontSize: 13 },
  bannerText_info: { color: "#23518f" },
  bannerText_success: { color: colors.primary },
  bannerText_warn: { color: "#9a5b00" },
  bannerText_error: { color: colors.errorText },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badge_brand: { backgroundColor: colors.secondaryBg },
  badge_warn: { backgroundColor: "#fff4e0" },
  badge_danger: { backgroundColor: colors.errorBg },
  badge_neutral: { backgroundColor: colors.txBg, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeText_brand: { color: colors.primary },
  badgeText_warn: { color: "#9a5b00" },
  badgeText_danger: { color: colors.errorText },
  badgeText_neutral: { color: colors.subtext },
  meter: { height: 6, borderRadius: 999, backgroundColor: colors.txBg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.primary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "white" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkboxBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxBoxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: "white", fontSize: 14, fontWeight: "700" },
  checkboxLabel: { flex: 1, fontSize: 14, color: colors.text },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryValue: { fontWeight: "600", color: colors.text, flexShrink: 1, textAlign: "right" },
});
