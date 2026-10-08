import { useCallback, useState, type ReactNode } from "react";
import { parseMajorToMinor, type TransactionStatus, type TransactionType } from "@benki/shared";
import { ApiRequestError } from "../api";

export function Banner({ tone = "info", children }: { tone?: "info" | "success" | "warn" | "error"; children: ReactNode }) {
  return (
    <div className={`banner ${tone === "info" ? "" : tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return "Something went wrong. Please try again.";
}

/** Runs an async action with busy/error state, so every screen handles failures the same way. */
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

/** Amount entry in major units ("1,250.50"); the API only ever sees integer minor units. */
export function AmountField({
  label = "Amount",
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
  const invalid = value.trim() !== "" && parseMajorToMinor(value, currency) === null;
  return (
    <label htmlFor={id}>
      {label} ({currency})
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={currency === "XOF" ? "e.g. 5000" : "e.g. 150.00"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      {invalid && <span className="muted small">Enter a valid amount{currency === "XOF" ? " (no decimals for XOF)" : ""}</span>}
    </label>
  );
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
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const map: Partial<Record<TransactionStatus, [string, string]>> = {
    COMPLETED: ["", "Completed"],
    PENDING: ["warn", "Sending"],
    PENDING_REVIEW: ["warn", "Processing"],
    FAILED: ["danger", "Failed"],
    REJECTED: ["danger", "Rejected"],
    BLOCKED: ["danger", "Blocked"],
    REVERSED: ["neutral", "Reversed"],
  };
  const [tone, label] = map[status] ?? ["neutral", status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Meter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="meter" aria-label={`${pct}% used`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
