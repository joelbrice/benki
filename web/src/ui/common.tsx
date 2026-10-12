import { useCallback, useState, type ReactNode } from "react";
import { parseMajorToMinor, minorUnitsPerMajor, type TransactionStatus, type TransactionType } from "@benki/shared";
import { ApiRequestError } from "../api";
import { useI18n, type I18n } from "../i18n";
import { Icon, type IconName } from "./icons";

export function Banner({ tone = "info", children }: { tone?: "info" | "success" | "warn" | "error"; children: ReactNode }) {
  return (
    <div className={`banner ${tone === "info" ? "" : tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function errorMessage(e: unknown, t: I18n["t"]): string {
  if (e instanceof ApiRequestError) {
    if (e.code === "NETWORK_ERROR") return t("common.offline");
    return e.message || t("err.generic");
  }
  return t("err.generic");
}

/** Runs an async action with busy/error state, so every screen handles failures the same way. */
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

/** Amount entry in major units ("1,250.50" or "1 250,50"); the API only ever sees integer minor units. */
export function AmountField({
  label,
  currency,
  value,
  onChange,
  id,
}: {
  label?: string;
  currency: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  const { t } = useI18n();
  const invalid = value.trim() !== "" && parseMajorToMinor(value, currency) === null;
  return (
    <label htmlFor={id}>
      {t("common.amountIn", { label: label ?? t("common.amount"), currency })}
      <div className="amount-input">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={minorUnitsPerMajor(currency) === 1 ? "5 000" : "150.00"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
        <span className="amount-currency">{currency}</span>
      </div>
      {invalid && (
        <span className="field-error">
          {minorUnitsPerMajor(currency) === 1 ? t("common.invalidAmountWhole", { currency }) : t("common.invalidAmount")}
        </span>
      )}
    </label>
  );
}

/** Back-office labels (staff work in English); customers see the translated type.* keys. */
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
  FX_CONVERSION: "Currency conversion",
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment",
};

const STATUS_TONE: Record<TransactionStatus, string> = {
  COMPLETED: "",
  PENDING: "warn",
  PENDING_REVIEW: "warn",
  FAILED: "danger",
  REJECTED: "danger",
  BLOCKED: "danger",
  REVERSED: "neutral",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_TONE[status] ?? "neutral"}`}>{t(`status.${status}`)}</span>;
}

export function Meter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className={`meter${pct >= 90 ? " hot" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Segmented control for switching between modes of one screen. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? "active" : undefined} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PinField({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const { t } = useI18n();
  return (
    <label htmlFor={id}>
      {label ?? t("common.pin")}
      <input
        id={id}
        className="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p>{text}</p>
    </div>
  );
}

/** Translates the account-number hints that come from the provider catalog. */
export function hintLabel(hint: string, t: I18n["t"]): string {
  if (hint === "11-digit meter number") return t("hint.meter");
  if (hint === "Account number") return t("hint.account");
  if (hint === "Smartcard number") return t("hint.smartcard");
  if (hint === "Student reference") return t("hint.student");
  if (hint === "10-digit NUBAN") return t("hint.nuban");
  if (hint === "Account number (RIB)") return t("hint.rib");
  const range = hint.match(/^(\d+–\d+) digit account number$/);
  return range ? t("hint.digits", { range: range[1] }) : hint;
}
