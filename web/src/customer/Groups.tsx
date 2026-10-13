import { useCallback, useEffect, useState } from "react";
import { parseMajorToMinor, type SavingsGroup } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, EmptyState, PageHeader, PinField, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import { Icon } from "../ui/icons";
import type { Session } from "./session";

/** Chama / tontine / susu: pooled savings released only by a member vote. */
export function Groups({ session }: { session: Session }) {
  const { t, money } = useI18n();
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
      <div className="stack">
        <PageHeader title={t("groups.title")} subtitle={t("groups.intro")} />
        <Banner tone="warn">{t("groups.tier")}</Banner>
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
            title: t("groups.contributeTo", { group: group.name }),
            rows: [
              [t("groups.name"), group.name],
              [t("common.amount"), money(amountMinor, wallet.currency)],
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
    <div className="stack">
      <PageHeader title={t("groups.title")} subtitle={t("groups.intro")} />
      {groups.length === 0 && <EmptyState icon="groups" text={t("groups.empty")} />}
      <div className="card-grid">
        {groups.map((g) => {
          const waiting = g.payoutRequests.some((p) => p.status === "PENDING" && !p.myVote && p.recipientUserId !== user.userId);
          return (
            <button key={g.groupId} className="card group-card" onClick={() => setOpenId(g.groupId)}>
              <div className="spread">
                <strong>{g.name}</strong>
                <Icon name="chevron" />
              </div>
              <span className="currency-amount">{money(g.poolBalanceMinor, g.currency)}</span>
              <span className="muted small">
                {t("groups.members", { count: g.members.length })} · {g.myRole === "ADMIN" ? t("groups.admin") : t("groups.member")}
              </span>
              {waiting && <span className="badge warn">{t("groups.votesWaiting")}</span>}
            </button>
          );
        })}
      </div>
      <section className="card">
        <h3>{t("groups.start")}</h3>
        <label htmlFor="group-name">
          {t("groups.name")}
          <input id="group-name" maxLength={40} value={name} placeholder={country.code === "SN" ? "Tontine des amies" : "Umoja Chama"} onChange={(e) => setName(e.target.value)} />
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
          {t("groups.create")}
        </button>
      </section>
    </div>
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
  const { t, money } = useI18n();
  const { api, user, country } = session;
  const [contribution, setContribution] = useState("");
  const [memberPhone, setMemberPhone] = useState(country.callingCode);
  const [recipient, setRecipient] = useState(group.members[0]?.userId ?? "");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();
  const fmt = (n: number) => money(n, group.currency);
  const contributionMinor = parseMajorToMinor(contribution, group.currency);
  const payoutMinor = parseMajorToMinor(payoutAmount, group.currency);
  const pending = group.payoutRequests.find((p) => p.status === "PENDING");
  const act = (fn: () => Promise<{ group: SavingsGroup }>) =>
    run(async () => {
      onChanged((await fn()).group);
      setPin("");
      setPayoutAmount("");
      setReason("");
    });

  return (
    <div className="stack">
      <button className="link-back" onClick={onBack}>
        <span className="back-arrow" aria-hidden="true">←</span> {t("groups.all")}
      </button>
      <section className="balance-card compact">
        <span className="greeting">{group.name}</span>
        <span className="balance-label">{t("groups.pool")}</span>
        <div className="balance">{fmt(group.poolBalanceMinor)}</div>
        <span className="balance-note">{t("groups.quorum", { count: group.approvalsRequired })}</span>
      </section>

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <h3>{t("groups.contribute")}</h3>
            <AmountField id="group-contribution" currency={group.currency} value={contribution} onChange={setContribution} />
            <button disabled={!contributionMinor} onClick={() => onContribute(contributionMinor!)}>
              {t("groups.reviewContribution")}
            </button>
          </section>

          {pending ? (
            <section className="card highlight">
              <h3>{t("groups.pendingTitle")}</h3>
              <p>
                <strong>{t("groups.pendingLine", { amount: fmt(pending.amountMinor), name: pending.recipientName })}</strong> — “{pending.reason}”
              </p>
              <p className="muted small">
                {t("groups.requestedBy", { name: pending.requestedBy })} ·{" "}
                {t("groups.tally", { approvals: pending.approvals, required: group.approvalsRequired, rejections: pending.rejections })}
              </p>
              {pending.recipientUserId === user.userId ? (
                <Banner tone="info">{t("groups.toYou")}</Banner>
              ) : pending.myVote ? (
                <Banner tone="info">{t("groups.youVoted")}</Banner>
              ) : (
                <>
                  <PinField id="group-pin" value={pin} onChange={setPin} />
                  <div className="button-pair">
                    <button disabled={busy || pin.length < 4} onClick={() => act(() => api.votePayout(group.groupId, pending.requestId, true, pin))}>
                      {t("groups.approve")}
                    </button>
                    <button className="secondary" disabled={busy || pin.length < 4} onClick={() => act(() => api.votePayout(group.groupId, pending.requestId, false, pin))}>
                      {t("groups.reject")}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : (
            group.members.length > 1 && (
              <section className="card">
                <h3>{t("groups.requestPayout")}</h3>
                <label htmlFor="payout-recipient">
                  {t("groups.payTo")}
                  <select id="payout-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
                    {group.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName}
                        {m.userId === user.userId ? ` (${t("common.you")})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <AmountField id="payout-amount" currency={group.currency} value={payoutAmount} onChange={setPayoutAmount} />
                <label htmlFor="payout-reason">
                  {t("groups.reason")}
                  <input id="payout-reason" maxLength={140} value={reason} placeholder={t("groups.reasonHint")} onChange={(e) => setReason(e.target.value)} />
                </label>
                <PinField id="group-pin" value={pin} onChange={setPin} />
                <button
                  disabled={busy || !payoutMinor || reason.trim().length < 3 || pin.length < 4}
                  onClick={() => act(() => api.requestPayout(group.groupId, { pin, recipientUserId: recipient, amountMinor: payoutMinor!, reason }))}
                >
                  {t("groups.ask")}
                </button>
              </section>
            )
          )}
          {error && <Banner tone="error">{error}</Banner>}
        </div>

        <div className="stack">
          <section className="card">
            <h3>{t("groups.membersTitle")}</h3>
            <ul className="member-list">
              {group.members.map((m) => (
                <li key={m.userId}>
                  <span className="avatar small">{m.displayName.slice(0, 1).toUpperCase()}</span>
                  <span className="grow">
                    {m.displayName} {m.role === "ADMIN" && <span className="badge neutral">{t("groups.admin")}</span>}
                  </span>
                  <span className="muted small">{t("groups.contributed", { amount: fmt(m.contributedMinor) })}</span>
                </li>
              ))}
            </ul>
            {group.myRole === "ADMIN" && (
              <>
                <label htmlFor="member-phone">
                  {t("groups.addMember")}
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
                  {t("groups.add")}
                </button>
              </>
            )}
          </section>

          {group.payoutRequests.some((p) => p.status !== "PENDING") && (
            <section className="card">
              <h3>{t("groups.past")}</h3>
              <ul className="plain-list">
                {group.payoutRequests
                  .filter((p) => p.status !== "PENDING")
                  .map((p) => (
                    <li key={p.requestId}>
                      <div className="spread">
                        <span>
                          {t("groups.pendingLine", { amount: fmt(p.amountMinor), name: p.recipientName })} <span className="muted small">· {p.reason}</span>
                        </span>
                        <span className={`badge ${p.status === "EXECUTED" ? "" : "danger"}`}>{p.status === "EXECUTED" ? t("groups.paid") : t("groups.notApproved")}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
