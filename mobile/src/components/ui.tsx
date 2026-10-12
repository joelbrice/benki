import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LANGUAGES_BY_COUNTRY, LOCALES, minorUnitsPerMajor, parseMajorToMinor, type Locale, type TransactionStatus, type UserTransaction } from "@benki/shared";
import { ApiRequestError } from "../api";
import { useI18n, type I18n } from "../i18n";
import { colors } from "../theme/colors";

export type IconName = ComponentProps<typeof Feather>["name"];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  // Decorative: the surrounding control carries the accessible name.
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function Card({ children, highlight = false }: { children: ReactNode; highlight?: boolean }) {
  return <View style={[styles.card, highlight && styles.cardHighlight]}>{children}</View>;
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

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.h1}>{title}</Text>
      {subtitle && <Muted>{subtitle}</Muted>}
    </View>
  );
}

export function Field({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} autoCapitalize="none" accessibilityLabel={label} placeholderTextColor={colors.subtext} {...inputProps} />
    </View>
  );
}

export function AmountField({ currency, value, onChange, label }: { currency: string; value: string; onChange: (v: string) => void; label?: string }) {
  const { t } = useI18n();
  const invalid = value.trim() !== "" && parseMajorToMinor(value, currency) === null;
  const whole = minorUnitsPerMajor(currency) === 1;
  const text = t("common.amountIn", { label: label ?? t("common.amount"), currency });
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{text}</Text>
      <View>
        <TextInput
          style={[styles.input, styles.amountInput, invalid && { borderColor: colors.danger }]}
          accessibilityLabel={text}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={whole ? "5 000" : "150.00"}
          placeholderTextColor={colors.subtext}
        />
        <Text style={styles.amountSuffix}>{currency}</Text>
      </View>
      {invalid && <Text style={styles.fieldError}>{whole ? t("common.invalidAmountWhole", { currency }) : t("common.invalidAmount")}</Text>}
    </View>
  );
}

export function PinField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { t } = useI18n();
  return (
    <Field
      label={label ?? t("common.pin")}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      style={[styles.input, styles.pinInput]}
    />
  );
}

type Variant = "primary" | "secondary" | "ghost";
function Button({ title, onPress, disabled, variant, icon }: { title: string; onPress: () => void; disabled?: boolean; variant: Variant; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, styles[`button_${variant}`], disabled && styles.buttonDisabled, pressed && !disabled && { transform: [{ scale: 0.98 }] }]}
    >
      {icon && <Icon name={icon} size={16} color={variant === "primary" ? "#fff" : variant === "secondary" ? colors.primary : colors.text2} />}
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

type ButtonProps = { title: string; onPress: () => void; disabled?: boolean; icon?: IconName };
export const PrimaryButton = (p: ButtonProps) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: ButtonProps) => <Button {...p} variant="secondary" />;
export const GhostButton = (p: ButtonProps) => <Button {...p} variant="ghost" />;

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

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

const STATUS_TONE: Record<TransactionStatus, "brand" | "warn" | "danger" | "neutral"> = {
  COMPLETED: "brand",
  PENDING: "warn",
  PENDING_REVIEW: "warn",
  FAILED: "danger",
  REJECTED: "danger",
  BLOCKED: "danger",
  REVERSED: "neutral",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { t } = useI18n();
  return <Badge label={t(`status.${status}`)} tone={STATUS_TONE[status]} />;
}

export function Meter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <View style={styles.meter}>
      <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? colors.accent : colors.primary }]} />
    </View>
  );
}

export function ChipSelect<T extends string>({ label, options, value, onChange }: { label?: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
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

/** Pill tabs for switching modes inside one screen. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityLabel={o.label} accessibilityState={{ selected: active }} onPress={() => onChange(o.id)} style={[styles.segment, active && styles.segmentActive]}>
            {o.icon && <Icon name={o.icon} size={14} color={active ? colors.primary : colors.subtext} />}
            <Text style={[styles.segmentText, active && { color: colors.primary }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>{checked && <Icon name="check" size={14} color="#fff" />}</View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function Summary({ rows, totalLast = false }: { rows: [string, string][]; totalLast?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {rows.map(([k, v], i) => {
        const total = totalLast && i === rows.length - 1;
        return (
          <View key={k} style={[styles.summaryRow, total && styles.summaryTotal]}>
            <Text style={[styles.muted, total && { color: colors.text, fontWeight: "800" }]}>{k}</Text>
            <Text style={[styles.summaryValue, total && { fontWeight: "800" }]}>{v}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={26} color={colors.subtext} />
      <Muted>{text}</Muted>
    </View>
  );
}

export function errorMessage(e: unknown, t: I18n["t"]): string {
  if (e instanceof ApiRequestError) return e.code === "NETWORK_ERROR" ? t("common.offline") : e.message || t("err.generic");
  return t("err.generic");
}

export function useAction() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        setError(errorMessage(e, t));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );
  return { busy, error, setError, run };
}

/** Languages for the customer's market first, then the rest. */
export function LanguagePicker({ countryCode, onChange }: { countryCode?: string; onChange?: (l: Locale) => void }) {
  const { locale, setLocale } = useI18n();
  const first = countryCode ? (LANGUAGES_BY_COUNTRY[countryCode] ?? []) : [];
  const ordered = [...LOCALES].sort((a, b) => {
    const ia = first.indexOf(a.code);
    const ib = first.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return (
    <ChipSelect
      value={locale}
      onChange={(l) => {
        setLocale(l);
        onChange?.(l);
      }}
      options={ordered.map((l) => ({ id: l.code, label: l.name }))}
    />
  );
}

const TYPE_ICON: Record<UserTransaction["type"], IconName> = {
  CASH_IN: "dollar-sign",
  CASH_OUT: "dollar-sign",
  P2P: "arrow-up-right",
  MOBILE_MONEY_PAYOUT: "smartphone",
  AIRTIME: "zap",
  BILL_PAYMENT: "file-text",
  MERCHANT_PAYMENT: "shopping-bag",
  CROSS_BORDER: "send",
  SAVINGS_DEPOSIT: "target",
  SAVINGS_WITHDRAWAL: "target",
  BANK_TRANSFER: "briefcase",
  LOAN_DISBURSEMENT: "pocket",
  LOAN_REPAYMENT: "pocket",
  GROUP_CONTRIBUTION: "users",
  GROUP_PAYOUT: "users",
  FX_CONVERSION: "repeat",
  REVERSAL: "rotate-ccw",
  ADJUSTMENT: "rotate-ccw",
};

function counterpartyLabel(tx: UserTransaction): string {
  if (tx.type === "GROUP_CONTRIBUTION" || tx.type === "GROUP_PAYOUT") return tx.counterparty.replace(/^Group( payout)?: /, "");
  if (tx.type === "LOAN_DISBURSEMENT" || tx.type === "LOAN_REPAYMENT") return "Benki";
  if (tx.type === "SAVINGS_DEPOSIT" || tx.type === "SAVINGS_WITHDRAWAL") return tx.counterparty.replace(/^Savings: /, "");
  return tx.counterparty;
}

export function TxRow({ tx, children }: { tx: UserTransaction; children?: ReactNode }) {
  const { t, money, date } = useI18n();
  const credit = tx.direction === "CREDIT";
  const shown =
    tx.type === "FX_CONVERSION" && credit && tx.receiveAmountMinor !== null && tx.receiveCurrency
      ? money(tx.receiveAmountMinor, tx.receiveCurrency)
      : money(tx.amountMinor, tx.currency);
  return (
    <View style={styles.tx}>
      <View style={[styles.txIcon, credit && { backgroundColor: colors.primarySoft }]}>
        <Icon name={TYPE_ICON[tx.type]} size={18} color={credit ? colors.primary : colors.text2} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.txLine}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {t(`type.${tx.type}`)}
          </Text>
          <Text style={[styles.txAmount, credit && { color: colors.primary }]}>
            {credit ? "+" : "−"}
            {shown}
          </Text>
        </View>
        <View style={styles.txLine}>
          <Text style={[styles.muted, { flex: 1 }]} numberOfLines={1}>
            {counterpartyLabel(tx)}
          </Text>
          {tx.status !== "COMPLETED" ? <StatusBadge status={tx.status} /> : <Text style={styles.small}>{date(tx.createdAt, true)}</Text>}
        </View>
        {children}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    shadowColor: "#13201b",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  cardHighlight: { borderColor: colors.accent, borderWidth: 2 },
  subcard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 14, padding: 14, gap: 10 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.subtext, lineHeight: 18 },
  small: { fontSize: 12, color: colors.subtext },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text2 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  amountInput: { fontSize: 20, fontWeight: "700", paddingRight: 64 },
  amountSuffix: { position: "absolute", right: 14, top: 15, fontWeight: "700", color: colors.subtext },
  pinInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700", textAlign: "center" },
  fieldError: { color: colors.danger, fontSize: 12 },
  button: { flexDirection: "row", gap: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft },
  button_ghost: { backgroundColor: "transparent", borderColor: colors.border },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: "700" },
  buttonText_primary: { color: "#fff" },
  buttonText_secondary: { color: colors.primary },
  buttonText_ghost: { color: colors.text2 },
  link: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  banner: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  banner_info: { backgroundColor: colors.infoSoft },
  banner_success: { backgroundColor: colors.primarySoft },
  banner_warn: { backgroundColor: colors.warnSoft },
  banner_error: { backgroundColor: colors.dangerSoft },
  bannerText: { fontSize: 13, lineHeight: 19 },
  bannerText_info: { color: colors.info },
  bannerText_success: { color: colors.primary },
  bannerText_warn: { color: colors.warn },
  bannerText_error: { color: colors.danger },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  badge_brand: { backgroundColor: colors.primarySoft },
  badge_warn: { backgroundColor: colors.warnSoft },
  badge_danger: { backgroundColor: colors.dangerSoft },
  badge_neutral: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontSize: 11, fontWeight: "800" },
  badgeText_brand: { color: colors.primary },
  badgeText_warn: { color: colors.warn },
  badgeText_danger: { color: colors.danger },
  badgeText_neutral: { color: colors.text2 },
  meter: { height: 8, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 999 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.text2, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.primary, fontWeight: "800" },
  segmented: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: 999, borderWidth: 1, borderColor: colors.border, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 12, fontWeight: "700", color: colors.text2 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkboxBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  checkboxBoxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryTotal: { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.border, paddingTop: 10 },
  summaryValue: { fontWeight: "700", color: colors.text, flexShrink: 1, textAlign: "right" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  tx: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  txLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  txTitle: { fontWeight: "700", color: colors.text, flexShrink: 1 },
  txAmount: { fontWeight: "800", color: colors.text },
});
