import { useState } from "react";
import type { RuleHit } from "@benki/shared";
import { Banner, useAction } from "../ui/common";

/** Sensitive actions always capture a written justification for the audit trail. */
export function ReasonAction({
  label,
  placeholder = "Reason (recorded in the audit log)",
  minLength = 10,
  tone = "secondary",
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  minLength?: number;
  tone?: "secondary" | "danger" | "primary";
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useAction();
  const cls = tone === "primary" ? "small" : `small ${tone}`;
  if (!open) {
    return (
      <button className={cls} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="subcard" style={{ minWidth: 260 }}>
      <textarea aria-label={placeholder} placeholder={placeholder} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row">
        <button
          className={cls}
          disabled={busy || reason.trim().length < minLength}
          onClick={() =>
            run(async () => {
              await onSubmit(reason.trim());
              setOpen(false);
              setReason("");
            })
          }
        >
          Confirm {label.toLowerCase()}
        </button>
        <button className="small ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <span className="muted small">At least {minLength} characters.</span>
    </div>
  );
}

export function RuleList({ rules }: { rules: RuleHit[] }) {
  if (!rules.length) return <span className="muted small">No rules fired</span>;
  return (
    <ul className="list">
      {rules.map((r, i) => (
        <li key={`${r.code}-${i}`}>
          <div className="spread">
            <span className="mono">{r.code}</span>
            <span className={`badge ${r.outcome === "BLOCK" ? "danger" : r.outcome === "REVIEW" ? "warn" : "neutral"}`}>
              {r.outcome} · {r.score}
            </span>
          </div>
          <span className="small">{r.description}</span>
        </li>
      ))}
    </ul>
  );
}

export function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}
