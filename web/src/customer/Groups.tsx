import { useCallback, useEffect, useState } from "react";
import { formatAmount, parseMajorToMinor, type SavingsGroup } from "@benki/shared";
import { AmountField, Banner, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

/** Chama / tontine / susu: pooled savings released only by a member vote. */
export function Groups({ session }: { session: Session }) {
  const { api, wallet, user, country } = session;
  const [groups, setGroups] = useState<SavingsGroup[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => api.groups().then((r) => setGroups(r.groups), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);

  if (intent) {
    return (
      <ConfirmPayment
        api={api}
        intent={intent}
        onDone={() => {
          setIntent(null);
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  if (user.kycTier === "TIER_0") {
    return (
      <div className="card">
        <h2>Savings groups</h2>
        <Banner tone="warn">Verify your identity (Tier 1) in Profile to join or start a savings group.</Banner>
      </div>
    );
  }

  const group = groups.find((g) => g.groupId === openId);
  if (group) {
    return (
      <GroupDetail
        session={session}
        group={group}
        onBack={() => setOpenId(null)}
        onChanged={(g) => setGroups(groups.map((x) => (x.groupId === g.groupId ? g : x)))}
        onContribute={(amountMinor) =>
          setIntent({
            title: `Contribute to ${group.name}`,
            rows: [
              ["Group", group.name],
              ["Amount", formatAmount(amountMinor, wallet.currency)],
            ],
            currency: wallet.currency,
            amountMinor,
            feeType: "GROUP_CONTRIBUTION",
            requirePin: true,
            submit: (pin, idempotencyKey) => api.contribute(group.groupId, { idempotencyKey, pin, amountMinor }),
          })
        }
      />
    );
  }

  return (
    <>
      <div className="card">
        <h2>Savings groups</h2>
        <p className="muted">
          Save together with family, friends or your chama. Money sits in a shared pool and is only paid out when enough members approve.
        </p>
        {groups.length === 0 && <p className="muted">You're not in any groups yet.</p>}
        <ul className="list">
          {groups.map((g) => {
            const pending = g.payoutRequests.filter((p) => p.status === "PENDING" && !p.myVote && p.recipientUserId !== user.userId).length;
            return (
              <li key={g.groupId}>
                <button className="ghost" style={{ width: "100%", textAlign: "left" }} onClick={() => setOpenId(g.groupId)}>
                  <div className="spread">
                    <strong>{g.name}</strong>
                    <span>{formatAmount(g.poolBalanceMinor, g.currency)}</span>
                  </div>
                  <span className="muted small">
                    {g.members.length} members · {g.myRole === "ADMIN" ? "You're the admin" : "Member"}
                    {pending > 0 && ` · ${pending} vote${pending > 1 ? "s" : ""} waiting for you`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card">
        <h3>Start a group</h3>
        <label htmlFor="group-name">
          Group name
          <input id="group-name" maxLength={40} value={name} placeholder={`e.g. ${country.code === "KE" ? "Umoja Chama" : "Tontine des amies"}`} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <Banner tone="error">{error}</Banner>}
        <button
          disabled={busy || name.trim().length < 2}
          onClick={() =>
            run(async () => {
              const { group: created } = await api.createGroup(name);
              setName("");
              await load();
              setOpenId(created.groupId);
            })
          }
        >
          Create group
        </button>
      </div>
    </>
  );
}

function GroupDetail({
  session,
  group,
  onBack,
  onChanged,
  onContribute,
}: {
  session: Session;
  group: SavingsGroup;
  onBack: () => void;
  onChanged: (g: SavingsGroup) => void;
  onContribute: (amountMinor: number) => void;
}) {
  const { api, user, country } = session;
  const [contribution, setContribution] = useState("");
  const [memberPhone, setMemberPhone] = useState(country.callingCode);
  const [recipient, setRecipient] = useState(group.members[0]?.userId ?? "");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();
  const fmt = (n: number) => formatAmount(n, group.currency);
  const contributionMinor = parseMajorToMinor(contribution, group.currency);
  const payoutMinor = parseMajorToMinor(payoutAmount, group.currency);
  const pending = group.payoutRequests.find((p) => p.status === "PENDING");
  const pinField = (
    <label htmlFor="group-pin">
      Transaction PIN
      <input id="group-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
    </label>
  );
  const act = (fn: () => Promise<{ group: SavingsGroup }>) =>
    run(async () => {
      onChanged((await fn()).group);
      setPin("");
      setPayoutAmount("");
      setReason("");
    });

  return (
    <>
      <div className="card">
        <div className="spread">
          <h2>{group.name}</h2>
          <button className="ghost small" onClick={onBack}>
            ← All groups
          </button>
        </div>
        <div className="subcard stat">
          <span className="muted">Pool balance</span>
          <strong style={{ fontSize: "1.6rem" }}>{fmt(group.poolBalanceMinor)}</strong>
          <span className="muted small">Payouts need {group.approvalsRequired} member approval{group.approvalsRequired === 1 ? "" : "s"}. Nobody can approve a payout to themselves.</span>
        </div>
        <AmountField id="group-contribution" label="Contribute" currency={group.currency} value={contribution} onChange={setContribution} />
        <button disabled={!contributionMinor} onClick={() => onContribute(contributionMinor!)}>
          Review contribution
        </button>
      </div>

      {pending && (
        <div className="card">
          <h3>Payout waiting for votes</h3>
          <p>
            <strong>{fmt(pending.amountMinor)}</strong> to <strong>{pending.recipientName}</strong> — “{pending.reason}”
          </p>
          <p className="muted small">
            Requested by {pending.requestedBy} · {pending.approvals} of {group.approvalsRequired} approvals · {pending.rejections} against
          </p>
          {pending.recipientUserId === user.userId ? (
            <Banner tone="info">This payout is to you, so the other members decide.</Banner>
          ) : pending.myVote ? (
            <Banner tone="info">You voted to {pending.myVote === "APPROVE" ? "approve" : "reject"}.</Banner>
          ) : (
            <>
              {pinField}
              <div className="row">
                <button disabled={busy || pin.length < 4} onClick={() => act(() => api.votePayout(group.groupId, pending.requestId, true, pin))}>
                  Approve
                </button>
                <button className="secondary" disabled={busy || pin.length < 4} onClick={() => act(() => api.votePayout(group.groupId, pending.requestId, false, pin))}>
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!pending && group.members.length > 1 && (
        <div className="card">
          <h3>Request a payout</h3>
          <label htmlFor="payout-recipient">
            Pay to
            <select id="payout-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {group.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                  {m.userId === user.userId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
          <AmountField id="payout-amount" currency={group.currency} value={payoutAmount} onChange={setPayoutAmount} />
          <label htmlFor="payout-reason">
            Reason
            <input id="payout-reason" maxLength={140} value={reason} placeholder="e.g. Merry-go-round: March turn" onChange={(e) => setReason(e.target.value)} />
          </label>
          {pinField}
          <button
            disabled={busy || !payoutMinor || reason.trim().length < 3 || pin.length < 4}
            onClick={() => act(() => api.requestPayout(group.groupId, { pin, recipientUserId: recipient, amountMinor: payoutMinor!, reason }))}
          >
            Ask members to approve
          </button>
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <div className="card">
        <h3>Members</h3>
        <ul className="list">
          {group.members.map((m) => (
            <li key={m.userId}>
              <div className="spread">
              <span>
                {m.displayName} {m.role === "ADMIN" && <span className="badge neutral">Admin</span>}
              </span>
              <span className="muted small">contributed {fmt(m.contributedMinor)}</span>
              </div>
            </li>
          ))}
        </ul>
        {group.myRole === "ADMIN" && (
          <>
            <label htmlFor="member-phone">
              Add a member by phone number
              <input id="member-phone" inputMode="tel" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value.replace(/[^\d+]/g, ""))} />
            </label>
            <button
              className="secondary"
              disabled={busy || memberPhone.length < 9}
              onClick={() =>
                run(async () => {
                  onChanged((await api.addGroupMember(group.groupId, memberPhone)).group);
                  setMemberPhone(country.callingCode);
                })
              }
            >
              Add member
            </button>
          </>
        )}
      </div>

      {group.payoutRequests.some((p) => p.status !== "PENDING") && (
        <div className="card">
          <h3>Past payouts</h3>
          <ul className="list">
            {group.payoutRequests
              .filter((p) => p.status !== "PENDING")
              .map((p) => (
                <li key={p.requestId}>
                  <div className="spread">
                  <span>
                    {fmt(p.amountMinor)} to {p.recipientName} <span className="muted small">· {p.reason}</span>
                  </span>
                  <span className={`badge ${p.status === "EXECUTED" ? "" : "danger"}`}>{p.status === "EXECUTED" ? "Paid" : "Not approved"}</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}
