import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { formatAmount, loanFeeMinor, minorToMajorString, parseMajorToMinor, type Loan, type LoanOffer, type SavingsGroup } from "@benki/shared";
import { ConfirmPayment, type PaymentIntent } from "../components/ConfirmPayment";
import {
  AmountField,
  Badge,
  Banner,
  Card,
  Checkbox,
  ChipSelect,
  Field,
  GhostButton,
  Meter,
  Muted,
  PrimaryButton,
  SecondaryButton,
  SubCard,
  Summary,
  Title,
  useAction,
} from "../components/ui";
import type { Session } from "../session";

function useIntentScreen(session: Session, after: () => void) {
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const screen = intent ? (
    <ConfirmPayment
      api={session.api}
      intent={intent}
      onDone={() => {
        setIntent(null);
        after();
        void session.refresh();
      }}
      onCancel={() => setIntent(null)}
    />
  ) : null;
  return { setIntent, screen };
}

// --- Nano-loans ---------------------------------------------------------------

export function Loans({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [offer, setOffer] = useState<LoanOffer | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [repay, setRepay] = useState("");
  const [accepted, setAccepted] = useState(false);
  const { error, setError } = useAction();
  const fmt = (n: number) => formatAmount(n, wallet.currency);
  const load = useCallback(async () => {
    const [o, l] = await Promise.all([api.loanOffer(), api.loans()]);
    setOffer(o);
    setLoans(l.loans);
  }, [api]);
  useEffect(() => {
    load().catch(() => setError("Couldn't load loans"));
  }, [load, setError]);
  const { setIntent, screen } = useIntentScreen(session, () => {
    setAmount("");
    setRepay("");
    setAccepted(false);
    void load();
  });
  if (screen) return screen;

  const open = loans.find((l) => l.status !== "REPAID");
  const principal = parseMajorToMinor(amount, wallet.currency);
  const inRange = !!offer && !!principal && principal >= offer.minPrincipalMinor && principal <= offer.maxPrincipalMinor;
  const fee = principal ? loanFeeMinor(principal) : 0;
  const due = offer ? new Date(Date.now() + offer.termDays * 86_400_000).toLocaleDateString() : "";
  const repayMinor = parseMajorToMinor(repay, wallet.currency);

  if (open) {
    return (
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>Your loan</Title>
          <Badge label={open.status === "OVERDUE" ? "Overdue" : "Active"} tone={open.status === "OVERDUE" ? "danger" : "brand"} />
        </View>
        <Summary
          rows={[
            ["Borrowed", fmt(open.principalMinor)],
            ["Fee", fmt(open.feeMinor)],
            ["Still to repay", fmt(open.outstandingMinor)],
            ["Due", new Date(open.dueAt).toLocaleDateString()],
          ]}
        />
        <Meter used={open.repaidMinor} total={open.totalDueMinor} />
        {open.status === "OVERDUE" && <Banner tone="warn">This loan is past its due date. Repay as soon as you can — no extra fees are added.</Banner>}
        <AmountField label="Repay" currency={wallet.currency} value={repay} onChange={setRepay} />
        <GhostButton title="Repay in full" onPress={() => setRepay(minorToMajorString(open.outstandingMinor, wallet.currency))} />
        <PrimaryButton
          title="Review repayment"
          disabled={!repayMinor || repayMinor > open.outstandingMinor}
          onPress={() =>
            setIntent({
              title: "Repay loan",
              rows: [
                ["Repayment", fmt(repayMinor!)],
                ["Left after this", fmt(open.outstandingMinor - repayMinor!)],
              ],
              currency: wallet.currency,
              amountMinor: repayMinor!,
              requirePin: true,
              submit: (pin, idempotencyKey) => api.repayLoan(open.loanId, { idempotencyKey, pin, amountMinor: repayMinor! }),
            })
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <Title>Borrow a little, when you need it</Title>
      {error && <Banner tone="error">{error}</Banner>}
      {!offer ? (
        <Muted>Loading…</Muted>
      ) : !offer.eligible ? (
        offer.reasons.map((r) => (
          <Banner key={r} tone="info">
            {r}
          </Banner>
        ))
      ) : (
        <>
          <Muted>
            Borrow {fmt(offer.minPrincipalMinor)}–{fmt(offer.maxPrincipalMinor)} for {offer.termDays} days. One flat fee of {offer.feeBps / 100}% — no interest, no
            late fees.
          </Muted>
          <AmountField label="How much?" currency={wallet.currency} value={amount} onChange={setAmount} />
          {inRange && (
            <SubCard>
              <Text style={{ fontWeight: "700" }}>Before you borrow</Text>
              <Summary
                rows={[
                  ["You receive", fmt(principal!)],
                  ["Fee", fmt(fee)],
                  ["You repay", fmt(principal! + fee)],
                  ["Due by", due],
                  ["Equivalent APR", `${offer.aprPercent}%`],
                ]}
              />
              <Checkbox
                label={`I understand I must repay ${fmt(principal! + fee)} by ${due}.`}
                checked={accepted}
                onToggle={() => setAccepted(!accepted)}
              />
            </SubCard>
          )}
          <PrimaryButton
            title="Continue"
            disabled={!inRange || !accepted}
            onPress={() =>
              setIntent({
                title: "Take a loan",
                rows: [
                  ["You receive", fmt(principal!)],
                  ["You repay", fmt(principal! + fee)],
                  ["Due by", due],
                ],
                currency: wallet.currency,
                amountMinor: principal!,
                requirePin: true,
                submit: (pin, idempotencyKey) => api.applyLoan({ idempotencyKey, pin, principalMinor: principal! }),
              })
            }
          />
        </>
      )}
    </Card>
  );
}

// --- Savings groups ---------------------------------------------------------------

export function Groups({ session }: { session: Session }) {
  const { api, wallet, user, country } = session;
  const [groups, setGroups] = useState<SavingsGroup[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contribution, setContribution] = useState("");
  const [memberPhone, setMemberPhone] = useState(country.callingCode);
  const [recipient, setRecipient] = useState("");
  const [payout, setPayout] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();
  const load = useCallback(() => api.groups().then((r) => setGroups(r.groups), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const { setIntent, screen } = useIntentScreen(session, () => {
    setContribution("");
    void load();
  });
  if (screen) return screen;

  if (user.kycTier === "TIER_0") {
    return (
      <Card>
        <Title>Savings groups</Title>
        <Banner tone="warn">Verify your identity (Tier 1) in Profile to join or start a savings group.</Banner>
      </Card>
    );
  }

  const replace = (g: SavingsGroup) => {
    setGroups(groups.map((x) => (x.groupId === g.groupId ? g : x)));
    setPin("");
  };
  const group = groups.find((g) => g.groupId === openId);

  if (!group) {
    return (
      <>
        <Card>
          <Title>Savings groups</Title>
          <Muted>Save together with your chama or tontine. Money is only paid out when enough members approve.</Muted>
          {groups.length === 0 && <Muted>You're not in any groups yet.</Muted>}
          {groups.map((g) => (
            <SubCard key={g.groupId}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700" }}>{g.name}</Text>
                <Text>{formatAmount(g.poolBalanceMinor, g.currency)}</Text>
              </View>
              <Muted>
                {g.members.length} members · {g.myRole === "ADMIN" ? "Admin" : "Member"}
              </Muted>
              <SecondaryButton
                title="Open"
                onPress={() => {
                  setOpenId(g.groupId);
                  setRecipient(g.members[0]?.userId ?? "");
                }}
              />
            </SubCard>
          ))}
        </Card>
        <Card>
          <Title>Start a group</Title>
          <Field label="Group name" value={name} maxLength={40} onChangeText={setName} />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            title="Create group"
            disabled={busy || name.trim().length < 2}
            onPress={() =>
              run(async () => {
                const { group: created } = await api.createGroup(name);
                setName("");
                await load();
                setOpenId(created.groupId);
                setRecipient(created.members[0]?.userId ?? "");
              })
            }
          />
        </Card>
      </>
    );
  }

  const fmt = (n: number) => formatAmount(n, group.currency);
  const contributionMinor = parseMajorToMinor(contribution, group.currency);
  const payoutMinor = parseMajorToMinor(payout, group.currency);
  const pending = group.payoutRequests.find((p) => p.status === "PENDING");
  const pinField = <Field label="Transaction PIN" value={pin} secureTextEntry keyboardType="number-pad" maxLength={6} onChangeText={(v) => setPin(v.replace(/\D/g, ""))} />;

  return (
    <>
      <Card>
        <Title>{group.name}</Title>
        <GhostButton title="← All groups" onPress={() => setOpenId(null)} />
        <SubCard>
          <Muted>Pool balance</Muted>
          <Text style={{ fontSize: 24, fontWeight: "800" }}>{fmt(group.poolBalanceMinor)}</Text>
          <Muted>Payouts need {group.approvalsRequired} member approval{group.approvalsRequired === 1 ? "" : "s"}. Nobody can approve a payout to themselves.</Muted>
        </SubCard>
        <AmountField label="Contribute" currency={group.currency} value={contribution} onChange={setContribution} />
        <PrimaryButton
          title="Review contribution"
          disabled={!contributionMinor}
          onPress={() =>
            setIntent({
              title: `Contribute to ${group.name}`,
              rows: [["Amount", fmt(contributionMinor!)]],
              currency: wallet.currency,
              amountMinor: contributionMinor!,
              feeType: "GROUP_CONTRIBUTION",
              requirePin: true,
              submit: (p, idempotencyKey) => api.contribute(group.groupId, { idempotencyKey, pin: p, amountMinor: contributionMinor! }),
            })
          }
        />
      </Card>

      {pending ? (
        <Card>
          <Title>Payout waiting for votes</Title>
          <Text>
            {fmt(pending.amountMinor)} to {pending.recipientName} — “{pending.reason}”
          </Text>
          <Muted>
            {pending.approvals} of {group.approvalsRequired} approvals · {pending.rejections} against
          </Muted>
          {pending.recipientUserId === user.userId ? (
            <Banner tone="info">This payout is to you, so the other members decide.</Banner>
          ) : pending.myVote ? (
            <Banner tone="info">You voted to {pending.myVote === "APPROVE" ? "approve" : "reject"}.</Banner>
          ) : (
            <>
              {pinField}
              <PrimaryButton title="Approve" disabled={busy || pin.length < 4} onPress={() => run(async () => replace((await api.votePayout(group.groupId, pending.requestId, true, pin)).group))} />
              <SecondaryButton title="Reject" disabled={busy || pin.length < 4} onPress={() => run(async () => replace((await api.votePayout(group.groupId, pending.requestId, false, pin)).group))} />
            </>
          )}
        </Card>
      ) : (
        group.members.length > 1 && (
          <Card>
            <Title>Request a payout</Title>
            <ChipSelect
              label="Pay to"
              value={recipient}
              onChange={setRecipient}
              options={group.members.map((m) => ({ id: m.userId, label: m.userId === user.userId ? `${m.displayName} (you)` : m.displayName }))}
            />
            <AmountField currency={group.currency} value={payout} onChange={setPayout} />
            <Field label="Reason" value={reason} maxLength={140} onChangeText={setReason} />
            {pinField}
            <PrimaryButton
              title="Ask members to approve"
              disabled={busy || !payoutMinor || reason.trim().length < 3 || pin.length < 4}
              onPress={() => run(async () => replace((await api.requestPayout(group.groupId, { pin, recipientUserId: recipient, amountMinor: payoutMinor!, reason })).group))}
            />
          </Card>
        )
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <Card>
        <Title>Members</Title>
        {group.members.map((m) => (
          <View key={m.userId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text>
              {m.displayName}
              {m.role === "ADMIN" ? " · admin" : ""}
            </Text>
            <Muted>{fmt(m.contributedMinor)}</Muted>
          </View>
        ))}
        {group.myRole === "ADMIN" && (
          <>
            <Field label="Add a member by phone number" value={memberPhone} keyboardType="phone-pad" onChangeText={(v) => setMemberPhone(v.replace(/[^\d+]/g, ""))} />
            <SecondaryButton
              title="Add member"
              disabled={busy || memberPhone.length < 9}
              onPress={() =>
                run(async () => {
                  replace((await api.addGroupMember(group.groupId, memberPhone)).group);
                  setMemberPhone(country.callingCode);
                })
              }
            />
          </>
        )}
      </Card>
    </>
  );
}
