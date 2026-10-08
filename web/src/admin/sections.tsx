import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  formatAmount,
  type AdminCase,
  type AdminDashboard,
  type AdminDispute,
  type AdminTransaction,
  type AdminUserView,
  type Approval,
  type AuditEntry,
  type AuditVerification,
  type ReconciliationException,
  type ReconciliationRun,
  type TrialBalance,
} from "@benki/shared";
import type { AdminApi } from "../api";
import { Banner, StatusBadge, TYPE_LABEL, useAction } from "../ui/common";
import { ReasonAction, RuleList, when } from "./widgets";

export interface StaffInfo {
  username: string;
  role: string;
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="spread">
        <h2>{title}</h2>
        <div className="row">{actions}</div>
      </div>
      {children}
    </div>
  );
}

const money = (n: number | null, c: string | null) => (n === null || !c ? "—" : formatAmount(n, c));

// --- Overview ---------------------------------------------------------------

export function Overview({ api }: { api: AdminApi }) {
  const { data, error, reload } = useLoad<AdminDashboard>(() => api.dashboard(), [api]);
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [audit, setAudit] = useState<AuditVerification | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const action = useAction();
  useEffect(() => {
    api.trialBalance().then(setTb, () => undefined);
  }, [api]);

  return (
    <>
      <Section
        title="Overview"
        actions={
          <>
            <button
              className="small secondary"
              onClick={() =>
                action.run(async () => {
                  const r = await api.runSettlement();
                  setSettled(`Checked ${r.checked} in-flight payouts: ${r.completed} completed, ${r.failed} failed and refunded.`);
                  await reload();
                })
              }
            >
              Poll provider settlements
            </button>
            <button className="small ghost" onClick={() => reload()}>
              Refresh
            </button>
          </>
        }
      >
        {error && <Banner tone="error">{error}</Banner>}
        {settled && <Banner tone="success">{settled}</Banner>}
        {data && (
          <div className="grid">
            {(
              [
                ["Customers", data.users],
                ["Frozen", data.frozenUsers],
                ["Open alerts", data.openAlerts],
                ["Open cases", data.openCases],
                ["Held for review", data.pendingReview],
                ["Awaiting 2nd approval", data.pendingApprovals],
                ["Payouts in flight", data.pendingProviderPayouts],
                ["Open disputes", data.openDisputes],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k} className="subcard stat">
                <span className="muted small">{k}</span>
                <strong style={{ fontSize: "1.4rem" }}>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Integrity checks">
        <div className="grid">
          <div className="subcard">
            <h3>Ledger trial balance</h3>
            {tb ? (
              <Banner tone={tb.balanced ? "success" : "error"}>
                {tb.balanced
                  ? `Balanced across ${tb.currencies.length} currencies; no customer account negative.`
                  : `OUT OF BALANCE — ${tb.unbalancedEntries.length} entries, ${tb.negativeCustomerAccounts.length} negative accounts`}
              </Banner>
            ) : (
              <span className="muted">Checking…</span>
            )}
          </div>
          <div className="subcard">
            <h3>Audit log hash chain</h3>
            {audit ? (
              <Banner tone={audit.valid ? "success" : "error"}>
                {audit.valid ? `Intact (${audit.checked} entries verified)` : `TAMPERED from entry #${audit.firstBrokenSeq}`}
              </Banner>
            ) : (
              <button className="small secondary" onClick={() => action.run(async () => setAudit(await api.verifyAudit()))}>
                Verify chain (supervisors)
              </button>
            )}
            {action.error && <Banner tone="error">{action.error}</Banner>}
          </div>
        </div>
      </Section>
      {data && data.volumeByType.length > 0 && (
        <Section title="Completed volume">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Currency</th>
                  <th>Count</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.volumeByType.map((v) => (
                  <tr key={`${v.type}-${v.currency}`}>
                    <td>{TYPE_LABEL[v.type]}</td>
                    <td>{v.currency}</td>
                    <td>{v.count}</td>
                    <td>{formatAmount(v.amountMinor, v.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

// --- Review queue ---------------------------------------------------------------

function TxSummary({ t }: { t: AdminTransaction }) {
  return (
    <>
      <div className="spread">
        <strong>
          {TYPE_LABEL[t.type]} · {money(t.amountMinor, t.currency)}
          {t.receiveAmountMinor !== null && ` → ${money(t.receiveAmountMinor, t.receiveCurrency)}`}
        </strong>
        <StatusBadge status={t.status} />
      </div>
      <span className="small">
        {t.initiatorPhone} → {t.counterparty}
      </span>
      <span className="muted small">
        {when(t.createdAt)} · risk score {t.riskScore ?? 0} · <span className="mono">{t.id}</span>
      </span>
    </>
  );
}

export function ReviewQueue({ api, staff }: { api: AdminApi; staff: StaffInfo }) {
  const { data, error, reload } = useLoad(() => api.transactions("PENDING_REVIEW"), [api]);
  const action = useAction();
  const canRelease = staff.role !== "ANALYST";
  return (
    <Section title="Held for review" actions={<button className="small ghost" onClick={() => reload()}>Refresh</button>}>
      <p className="muted small">
        Funds are reserved while a payment is held. Releasing funds needs a supervisor; any analyst can reject. Customers only ever see “processing”.
      </p>
      {(error || action.error) && <Banner tone="error">{error ?? action.error}</Banner>}
      {data?.transactions.length === 0 && <p className="muted">Queue is empty.</p>}
      <ul className="list">
        {data?.transactions.map((t) => (
          <li key={t.id}>
            <TxSummary t={t} />
            <RuleList rules={t.ruleHits} />
            <div className="row">
              <button
                className="small"
                disabled={!canRelease || action.busy}
                title={canRelease ? undefined : "Supervisors only"}
                onClick={() =>
                  action.run(async () => {
                    await api.approveTransaction(t.id);
                    await reload();
                  })
                }
              >
                Release funds
              </button>
              <ReasonAction
                label="Reject"
                tone="danger"
                onSubmit={async (reason) => {
                  await api.rejectTransaction(t.id, reason);
                  await reload();
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- Cases ------------------------------------------------------------------------

export function Cases({ api, staff }: { api: AdminApi; staff: StaffInfo }) {
  const [status, setStatus] = useState("OPEN");
  const { data, error, reload } = useLoad(() => api.cases(status || undefined), [api, status]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const action = useAction();
  const current: AdminCase | undefined = data?.cases.find((c) => c.caseId === selected);
  const isSupervisor = staff.role !== "ANALYST";

  return (
    <Section
      title="Alerts & cases"
      actions={
        <select aria-label="Case status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="OPEN">Open</option>
          <option value="CLOSED_NO_ACTION">Closed — no action</option>
          <option value="CLOSED_STR_FILED">Closed — STR filed</option>
          <option value="">All</option>
        </select>
      }
    >
      {(error || action.error) && <Banner tone="error">{error ?? action.error}</Banner>}
      {data?.cases.length === 0 && <p className="muted">No cases.</p>}
      <ul className="list">
        {data?.cases.map((c) => (
          <li key={c.caseId}>
            <div className="spread">
              <strong>
                {c.userPhone} · {c.alerts.length} alert(s)
              </strong>
              <span className={`badge ${c.status === "OPEN" ? "warn" : "neutral"}`}>{c.status.replace(/_/g, " ")}</span>
            </div>
            <span className="muted small">
              Updated {when(c.updatedAt)} · <span className="mono">{c.caseId}</span>
            </span>
            <button className="small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setSelected(selected === c.caseId ? null : c.caseId)}>
              {selected === c.caseId ? "Hide" : "Investigate"}
            </button>
            {current?.caseId === c.caseId && (
              <div className="subcard">
                {c.alerts.map((a) => (
                  <div key={a.alertId} className="subcard" style={{ background: "var(--surface)" }}>
                    <div className="spread">
                      <span className="small">
                        <strong>{a.kind}</strong> · {a.severity} · {when(a.createdAt)}
                      </span>
                      <span className={`badge ${a.status === "OPEN" ? "warn" : "neutral"}`}>{a.status}</span>
                    </div>
                    <RuleList rules={a.rules} />
                    {a.transactionId && <span className="mono">Transaction {a.transactionId}</span>}
                    {a.kind === "SCREENING" && a.status === "OPEN" && (
                      <div className="row">
                        <ReasonAction
                          label="Confirm match & freeze"
                          tone="danger"
                          onSubmit={async (reason) => {
                            await api.resolveScreening(a.alertId, "CONFIRM", reason);
                            await reload();
                          }}
                        />
                        {isSupervisor && (
                          <ReasonAction
                            label="Clear as false positive"
                            onSubmit={async (reason) => {
                              await api.resolveScreening(a.alertId, "CLEAR", reason);
                              await reload();
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <h3>Notes</h3>
                {c.notes.length === 0 && <span className="muted small">No notes yet.</span>}
                {c.notes.map((n, i) => (
                  <span key={i} className="small">
                    <strong>{n.staffUsername}</strong> ({when(n.createdAt)}): {n.note}
                  </span>
                ))}
                {c.status === "OPEN" && (
                  <>
                    <div className="row">
                      <input aria-label="Case note" placeholder="Add an investigation note" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
                      <button
                        className="small"
                        disabled={note.trim().length < 3}
                        onClick={() =>
                          action.run(async () => {
                            await api.caseNote(c.caseId, note);
                            setNote("");
                            await reload();
                          })
                        }
                      >
                        Add note
                      </button>
                    </div>
                    <div className="row">
                      <ReasonAction
                        label="Close — no further action"
                        onSubmit={async (reason) => {
                          await api.closeCase(c.caseId, reason);
                          await reload();
                        }}
                      />
                      {isSupervisor && (
                        <ReasonAction
                          label="File STR with FIU"
                          tone="danger"
                          minLength={30}
                          placeholder="Grounds for suspicion — this narrative goes to the Financial Intelligence Unit"
                          onSubmit={async (narrative) => {
                            await api.fileStr(c.caseId, narrative);
                            await reload();
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
                {c.str && (
                  <Banner tone="warn">
                    STR {c.str.reference} filed by {c.str.filedBy} on {when(c.str.filedAt)}. The customer is not notified.
                  </Banner>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- Customers ----------------------------------------------------------------------

export function Customers({ api }: { api: AdminApi }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<AdminApi["searchUsers"]>>["users"]>([]);
  const [view, setView] = useState<AdminUserView | null>(null);
  const [adjust, setAdjust] = useState("");
  const action = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const open = (id: string) => action.run(async () => setView((await api.user(id)).user));

  return (
    <Section title="Customers">
      <div className="row">
        <input aria-label="Search customers" placeholder="Phone, name or user ID" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
        <button className="small" onClick={() => action.run(async () => setResults((await api.searchUsers(query)).users))}>
          Search
        </button>
      </div>
      {action.error && <Banner tone="error">{action.error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}
      {results.length > 0 && !view && (
        <ul className="list">
          {results.map((u) => (
            <li key={u.userId}>
              <div className="spread">
                <strong>
                  {u.fullName ?? "—"} · {u.phoneNumber}
                </strong>
                <button className="small ghost" onClick={() => open(u.userId)}>
                  Open record
                </button>
              </div>
              <span className="muted small">
                {u.countryCode} · {u.kycTier} · {u.status} · screening {u.screeningStatus}
              </span>
            </li>
          ))}
        </ul>
      )}
      {view && (
        <div className="subcard">
          <div className="spread">
            <h3>
              {view.fullName ?? "Unverified customer"} · {view.phoneNumber}
            </h3>
            <button className="small ghost" onClick={() => setView(null)}>
              Back to results
            </button>
          </div>
          <p className="muted small">Opening this record was logged to the audit trail.</p>
          <dl className="summary">
            <dt>Status</dt>
            <dd>{view.status}</dd>
            <dt>KYC tier</dt>
            <dd>{view.kycTier}</dd>
            <dt>Date of birth</dt>
            <dd>{view.dateOfBirth ?? "—"}</dd>
            <dt>National ID</dt>
            <dd>{view.nationalId ?? "—"}</dd>
            <dt>Screening</dt>
            <dd>{view.screeningStatus}</dd>
            <dt>Wallet balance</dt>
            <dd>{money(view.walletBalanceMinor, view.currency)}</dd>
            <dt>PIN locked</dt>
            <dd>{view.pinLocked ? "Yes" : "No"}</dd>
            <dt>Last activity</dt>
            <dd>{when(view.lastActivityAt)}</dd>
          </dl>
          {view.screeningMatches.length > 0 && (
            <Banner tone="warn">
              Watchlist matches: {view.screeningMatches.map((m) => `${m.matchedName} (${m.listName}, ${m.similarity})`).join("; ")}
            </Banner>
          )}
          <h3>Devices</h3>
          {view.devices.map((d) => (
            <span key={d.deviceId} className="mono">
              {d.deviceId} — first seen {when(d.firstSeenAt)}, last {when(d.lastSeenAt)}
            </span>
          ))}
          <div className="row">
            {view.status === "ACTIVE" ? (
              <ReasonAction
                label="Freeze account"
                tone="danger"
                onSubmit={async (reason) => {
                  await api.freeze(view.userId, reason);
                  setView((await api.user(view.userId)).user);
                }}
              />
            ) : (
              <ReasonAction
                label="Request unfreeze"
                onSubmit={async (reason) => {
                  await api.requestApproval("UNFREEZE", { userId: view.userId }, reason);
                  setNotice("Unfreeze requested — a different supervisor must approve it.");
                }}
              />
            )}
          </div>
          <div className="row">
            <input
              aria-label="Adjustment amount in minor units"
              placeholder="Adjustment in minor units (e.g. 5000 or -5000)"
              value={adjust}
              onChange={(e) => setAdjust(e.target.value.replace(/[^\d-]/g, ""))}
              style={{ flex: 1 }}
            />
            <ReasonAction
              label="Request adjustment"
              onSubmit={async (reason) => {
                await api.requestApproval("MANUAL_ADJUSTMENT", { userId: view.userId, amountMinor: Number(adjust) }, reason);
                setAdjust("");
                setNotice("Adjustment requested — a different supervisor must approve it.");
              }}
            />
          </div>
          <h3>Transactions</h3>
          <ul className="list">
            {view.transactions.map((t) => (
              <li key={t.id}>
                <TxSummary t={t} />
                {t.ruleHits.length > 0 && <RuleList rules={t.ruleHits} />}
                {t.status === "COMPLETED" && (
                  <ReasonAction
                    label="Request reversal"
                    onSubmit={async (reason) => {
                      await api.requestApproval("REVERSAL", { transactionId: t.id }, reason);
                      setNotice("Reversal requested — a different supervisor must approve it.");
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// --- Approvals ----------------------------------------------------------------------

export function Approvals({ api, staff }: { api: AdminApi; staff: StaffInfo }) {
  const [status, setStatus] = useState("PENDING");
  const { data, error, reload } = useLoad(() => api.approvals(status || undefined), [api, status]);
  const action = useAction();
  const canDecide = staff.role !== "ANALYST";
  return (
    <Section
      title="Four-eyes approvals"
      actions={
        <select aria-label="Approval status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="PENDING">Pending</option>
          <option value="">All</option>
        </select>
      }
    >
      <p className="muted small">Reversals, unfreezes and manual adjustments need a second supervisor — the requester can never approve their own request.</p>
      {(error || action.error) && <Banner tone="error">{error ?? action.error}</Banner>}
      {data?.approvals.length === 0 && <p className="muted">Nothing waiting.</p>}
      <ul className="list">
        {data?.approvals.map((a: Approval) => (
          <li key={a.approvalId}>
            <div className="spread">
              <strong>{a.action.replace("_", " ")}</strong>
              <span className={`badge ${a.status === "PENDING" ? "warn" : a.status === "APPROVED" ? "" : "danger"}`}>{a.status}</span>
            </div>
            <span className="mono">{JSON.stringify(a.payload)}</span>
            <span className="small">“{a.reason}”</span>
            <span className="muted small">
              Requested by {a.requestedBy} {when(a.requestedAt)}
              {a.decidedBy && ` · decided by ${a.decidedBy} ${when(a.decidedAt)}`}
            </span>
            {a.failureReason && <Banner tone="error">Execution failed: {a.failureReason}</Banner>}
            {a.status === "PENDING" && (
              <div className="row">
                <button
                  className="small"
                  disabled={!canDecide || a.requestedBy === staff.username || action.busy}
                  title={a.requestedBy === staff.username ? "You requested this — someone else must approve" : undefined}
                  onClick={() =>
                    action.run(async () => {
                      await api.decideApproval(a.approvalId, true);
                      await reload();
                    })
                  }
                >
                  Approve & execute
                </button>
                <button
                  className="small ghost"
                  disabled={!canDecide || a.requestedBy === staff.username || action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api.decideApproval(a.approvalId, false);
                      await reload();
                    })
                  }
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- Disputes -------------------------------------------------------------------------

export function Disputes({ api }: { api: AdminApi }) {
  const { data, error, reload } = useLoad(() => api.disputes("OPEN"), [api]);
  return (
    <Section title="Customer disputes" actions={<button className="small ghost" onClick={() => reload()}>Refresh</button>}>
      {error && <Banner tone="error">{error}</Banner>}
      {data?.disputes.length === 0 && <p className="muted">No open disputes.</p>}
      <ul className="list">
        {data?.disputes.map((d: AdminDispute) => (
          <li key={d.disputeId}>
            {d.transaction && <TxSummary t={d.transaction} />}
            <span className="small">
              <strong>{d.userPhone}:</strong> “{d.reason}”
            </span>
            <span className="muted small">Raised {when(d.createdAt)}</span>
            {d.approvalId ? (
              <Banner tone="warn">Reversal requested — awaiting second approval ({d.approvalId}).</Banner>
            ) : (
            <div className="row">
              <ReasonAction
                label="Uphold (request reversal)"
                onSubmit={async (reason) => {
                  await api.disputeReversal(d.disputeId, reason);
                  await reload();
                }}
              />
              <ReasonAction
                label="Decline"
                tone="danger"
                placeholder="Explanation sent to the customer"
                onSubmit={async (resolution) => {
                  await api.rejectDispute(d.disputeId, resolution);
                  await reload();
                }}
              />
            </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- Ledger ---------------------------------------------------------------------------

export function Ledger({ api }: { api: AdminApi }) {
  const { data, error, reload } = useLoad(() => api.trialBalance(), [api]);
  return (
    <Section title="Ledger" actions={<button className="small ghost" onClick={() => reload()}>Recheck</button>}>
      {error && <Banner tone="error">{error}</Banner>}
      {data && (
        <>
          <Banner tone={data.balanced ? "success" : "error"}>
            {data.balanced ? "Trial balance OK — every entry nets to zero and no customer account is negative." : "Ledger invariant broken — escalate immediately."}
          </Banner>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Total debits</th>
                  <th>Total credits</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.currencies.map((c) => (
                  <tr key={c.currency}>
                    <td>{c.currency}</td>
                    <td>{formatAmount(c.totalDebitsMinor, c.currency)}</td>
                    <td>{formatAmount(c.totalCreditsMinor, c.currency)}</td>
                    <td>{formatAmount(c.netMinor, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Balances by account type</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account type</th>
                  <th>Currency</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.accountsByKind.map((a) => (
                  <tr key={`${a.kind}-${a.currency}`}>
                    <td>{a.kind.replace(/_/g, " ")}</td>
                    <td>{a.currency}</td>
                    <td>{formatAmount(a.balanceMinor, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

// --- Reconciliation -------------------------------------------------------------------

export function Reconciliation({ api }: { api: AdminApi }) {
  const runs = useLoad<{ runs: ReconciliationRun[] }>(() => api.reconRuns(), [api]);
  const exceptions = useLoad<{ exceptions: ReconciliationException[] }>(() => api.reconExceptions(), [api]);
  const action = useAction();
  return (
    <Section
      title="Provider reconciliation"
      actions={
        <button
          className="small"
          disabled={action.busy}
          onClick={() =>
            action.run(async () => {
              await api.runReconciliation();
              await runs.reload();
              await exceptions.reload();
            })
          }
        >
          Run reconciliation
        </button>
      }
    >
      <p className="muted small">Matches dispatched mobile money payouts against each provider's settlement report and categorizes every break.</p>
      {action.error && <Banner tone="error">{action.error}</Banner>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ran at</th>
              <th>Provider</th>
              <th>Matched</th>
              <th>Breaks</th>
              <th>Our settlement</th>
              <th>Provider settlement</th>
            </tr>
          </thead>
          <tbody>
            {runs.data?.runs.slice(0, 15).map((r) => (
              <tr key={r.runId}>
                <td>{when(r.ranAt)}</td>
                <td>
                  {r.providerId} ({r.currency})
                </td>
                <td>{r.matched}</td>
                <td>{r.exceptions > 0 ? <span className="badge danger">{r.exceptions}</span> : 0}</td>
                <td>{formatAmount(r.internalSettlementMinor, r.currency)}</td>
                <td>{formatAmount(r.providerSettlementMinor, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Exceptions</h3>
      {exceptions.data?.exceptions.length === 0 && <p className="muted">No breaks.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Provider</th>
              <th>Transaction</th>
              <th>Ours</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.data?.exceptions.map((e) => (
              <tr key={e.exceptionId}>
                <td>
                  <span className="badge danger">{e.category.replace(/_/g, " ")}</span>
                </td>
                <td>{e.providerId}</td>
                <td className="mono">{e.transactionId ?? e.providerRef}</td>
                <td>
                  {e.internalAmountMinor ?? "—"} {e.internalStatus ?? ""}
                </td>
                <td>
                  {e.providerAmountMinor ?? "—"} {e.providerStatus ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// --- Audit ----------------------------------------------------------------------------

export function Audit({ api }: { api: AdminApi }) {
  const { data, error, reload } = useLoad<{ entries: AuditEntry[] }>(() => api.audit(), [api]);
  const [verdict, setVerdict] = useState<AuditVerification | null>(null);
  const action = useAction();
  return (
    <Section
      title="Audit log"
      actions={
        <>
          <button className="small secondary" onClick={() => action.run(async () => setVerdict(await api.verifyAudit()))}>
            Verify hash chain
          </button>
          <button className="small ghost" onClick={() => reload()}>
            Refresh
          </button>
        </>
      }
    >
      {(error || action.error) && <Banner tone="error">{error ?? action.error}</Banner>}
      {verdict && (
        <Banner tone={verdict.valid ? "success" : "error"}>
          {verdict.valid ? `Chain intact — ${verdict.checked} entries verified.` : `Tampering detected at entry #${verdict.firstBrokenSeq}.`}
        </Banner>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.seq}>
                <td>{e.seq}</td>
                <td>{when(e.at)}</td>
                <td>
                  {e.actorType}
                  <div className="mono muted">{e.actorId}</div>
                </td>
                <td>{e.action}</td>
                <td>
                  {e.entityType}
                  <div className="mono muted">{e.entityId}</div>
                </td>
                <td className="mono">{JSON.stringify(e.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
