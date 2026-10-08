import { minorToMajorString } from "@benki/shared";
import type { AppContext } from "../context";
import { all } from "../db/query";

/** Neutralizes spreadsheet formula injection (cells starting with = + - @ tab CR). */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Account statement straight from the immutable postings, with a running balance. */
export function statementCsv(ctx: AppContext, accountId: string, currency: string, from: string, to: string): string {
  const opening = all<{ total: number | null }>(
    ctx.db,
    "SELECT SUM(amount_minor) AS total FROM postings WHERE account_id = ? AND created_at < ?",
    accountId,
    from,
  )[0]?.total ?? 0;
  const rows = all<{
    created_at: string;
    amount_minor: number;
    entry_id: string;
    description: string;
    transaction_id: string | null;
    type: string | null;
    counterparty_label: string | null;
  }>(
    ctx.db,
    `SELECT p.created_at, p.amount_minor, p.entry_id, e.description, e.transaction_id, t.type, t.counterparty_label
     FROM postings p JOIN journal_entries e ON e.id = p.entry_id LEFT JOIN transactions t ON t.id = e.transaction_id
     WHERE p.account_id = ? AND p.created_at >= ? AND p.created_at <= ? ORDER BY p.id`,
    accountId,
    from,
    to,
  );
  let balance = opening;
  const lines = [["Date", "Reference", "Type", "Details", "Debit", "Credit", "Balance", "Currency"].join(",")];
  lines.push(["", "", "OPENING", "Opening balance", "", "", minorToMajorString(opening, currency), currency].map(csvCell).join(","));
  for (const r of rows) {
    balance += r.amount_minor;
    lines.push(
      [
        r.created_at,
        r.transaction_id ?? r.entry_id,
        r.type ?? "",
        r.counterparty_label ?? r.description,
        r.amount_minor < 0 ? minorToMajorString(-r.amount_minor, currency) : "",
        r.amount_minor > 0 ? minorToMajorString(r.amount_minor, currency) : "",
        minorToMajorString(balance, currency),
        currency,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
