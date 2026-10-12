import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { loanFeeMinor, minorToMajorString, parseMajorToMinor, type Loan, type LoanOffer, type SavingsGroup } from "@benki/shared";
import {
  AmountField,
  Badge,
  Banner,
  Card,
  Checkbox,
  ChipSelect,
  EmptyState,
  Field,
  GhostButton,
  Icon,
  Meter,
  Muted,
  PinField,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  SubCard,
  Summary,
  Title,
  useAction,
} from "../components/ui";
import { useI18n } from "../i18n";
import type { Session } from "../session";
import { colors } from "../theme/colors";
import { useIntent } from "./flow";

// --- Nano-loans ---------------------------------------------------------------

export function Loans({ session }: { session: Session }) {
  const { t, money, date, locale } = useI18n();
  const { api, wallet } = session;
  const [offer, setOffer] = useState<LoanOffer | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [repay, setRepay] = useState("");
  const [accepted, setAccepted] = useState(false);
  const { error, setError } = useAction();
  const fmt = (n: number) => money(n, wallet.currency);
  const load = useCallback(async () => {
    const [o, l] = await Promise.all([api.loanOffer(), api.loans()]);
    setOffer(o);
    setLoans(l.loans);
  }, [api]);
  useEffect(() => {
    // Eligibility reasons come back translated, so reload on a language change.
    load().catch(() => setError(t("err.generic")));
  }, [load, setError, t, locale]);
  const { setIntent, screen } = useIntent(session, () => {
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
  const due = offer ? date(new Date(Date.now() + offer.termDays * 86_400_000).toISOString()) : "";
  const repayMinor = parseMajorToMinor(repay, wallet.currency);

  return (
    <>
      <ScreenHeader title={t("nav.loans")} />
      {open ? (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Title>{t("loans.yours")}</Title>
            <Badge label={open.status === "OVERDUE" ? t("loans.overdue") : t("loans.active")} tone={open.status === "OVERDUE" ? "danger" : "brand"} />
          </View>
          <Summary
            rows={[
              [t("loans.borrowed"), fmt(open.principalMinor)],
              [t("common.fee"), fmt(open.feeMinor)],
              [t("loans.left"), fmt(open.outstandingMinor)],
              [t("loans.due"), date(open.dueAt)],
            ]}
          />
          <Meter used={open.repaidMinor} total={open.totalDueMinor} />
          {open.status === "OVERDUE" && <Banner tone="warn">{t("loans.overdueNote")}</Banner>}
          <AmountField label={t("loans.repayLabel")} currency={wallet.currency} value={repay} onChange={setRepay} />
          <GhostButton title={t("loans.repayFull")} onPress={() => setRepay(minorToMajorString(open.outstandingMinor, wallet.currency))} />
          <PrimaryButton
            title={t("loans.reviewRepay")}
            disabled={!repayMinor || repayMinor > open.outstandingMinor}
            onPress={() =>
              setIntent({
                title: t("loans.repayTitle"),
                rows: [
                  [t("loans.repayLabel"), fmt(repayMinor!)],
                  [t("loans.leftAfter"), fmt(open.outstandingMinor - repayMinor!)],
                ],
                currency: wallet.currency,
                amountMinor: repayMinor!,
                requirePin: true,
                submit: (pin, idempotencyKey) => api.repayLoan(open.loanId, { idempotencyKey, pin, amountMinor: repayMinor! }),
              })
            }
          />
        </Card>
      ) : (
        <Card>
          <Title>{t("loans.title")}</Title>
          {error && <Banner tone="error">{error}</Banner>}
          {!offer ? (
            <Muted>{t("common.loading")}</Muted>
          ) : !offer.eligible ? (
            offer.reasons.map((r) => (
              <Banner key={r} tone="info">
                {r}
              </Banner>
            ))
          ) : (
            <>
              <Muted>
                {t("loans.offer", { min: fmt(offer.minPrincipalMinor), max: fmt(offer.maxPrincipalMinor), days: offer.termDays, percent: offer.feeBps / 100 })}
              </Muted>
              <AmountField label={t("loans.howMuch")} currency={wallet.currency} value={amount} onChange={setAmount} />
              {principal && !inRange ? <Muted>{t("loans.range", { min: fmt(offer.minPrincipalMinor), max: fmt(offer.maxPrincipalMinor) })}</Muted> : null}
              {inRange && (
                <SubCard>
                  <Title>{t("loans.before")}</Title>
                  <Summary
                    rows={[
                      [t("loans.receive"), fmt(principal!)],
                      [t("common.fee"), fmt(fee)],
                      [t("loans.dueBy"), due],
                      [t("loans.apr"), `${offer.aprPercent}%`],
                      [t("loans.repay"), fmt(principal! + fee)],
                    ]}
                    totalLast
                  />
                  <Checkbox label={t("loans.consent", { total: fmt(principal! + fee), date: due })} checked={accepted} onToggle={() => setAccepted(!accepted)} />
                </SubCard>
              )}
              <PrimaryButton
                title={t("common.continue")}
                disabled={!inRange || !accepted}
                onPress={() =>
                  setIntent({
                    title: t("loans.take"),
                    rows: [
                      [t("loans.receive"), fmt(principal!)],
                      [t("loans.repay"), fmt(principal! + fee)],
                      [t("loans.dueBy"), due],
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
      )}
      {loans.some((l) => l.status === "REPAID") && (
        <Card>
          <Title>{t("loans.history")}</Title>
          {loans
            .filter((l) => l.status === "REPAID")
            .map((l) => (
              <View key={l.loanId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{fmt(l.principalMinor)}</Text>
                <Badge label={t("loans.repaidOn", { date: l.repaidAt ? date(l.repaidAt) : "" })} tone="neutral" />
              </View>
            ))}
        </Card>
      )}
    </>
  );
}

// --- Savings groups ---------------------------------------------------------------

export function Groups({ session }: { session: Session }) {
  const { t, money } = useI18n();
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
  const { setIntent, screen } = useIntent(session, () => {
    setContribution("");
    void load();
  });
  if (screen) return screen;

  if (user.kycTier === "TIER_0") {
    return (
      <>
        <ScreenHeader title={t("groups.title")} subtitle={t("groups.intro")} />
        <Banner tone="warn">{t("groups.tier")}</Banner>
      </>
    );
  }

  const replace = (g: SavingsGroup) => {
    setGroups(groups.map((x) => (x.groupId === g.groupId ? g : x)));
    setPin("");
    setPayout("");
    setReason("");
  };
  const group = groups.find((g) => g.groupId === openId);

  if (!group) {
    return (
      <>
        <ScreenHeader title={t("groups.title")} subtitle={t("groups.intro")} />
        {groups.length === 0 && <EmptyState icon="users" text={t("groups.empty")} />}
        {groups.map((g) => {
          const waiting = g.payoutRequests.some((p) => p.status === "PENDING" && !p.myVote && p.recipientUserId !== user.userId);
          return (
            <Pressable
              key={g.groupId}
              accessibilityRole="button"
              onPress={() => {
                setOpenId(g.groupId);
                setRecipient(g.members[0]?.userId ?? "");
              }}
            >
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Title>{g.name}</Title>
                  <Icon name="chevron-right" color={colors.subtext} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{money(g.poolBalanceMinor, g.currency)}</Text>
                <Muted>
                  {t("groups.members", { count: g.members.length })} · {g.myRole === "ADMIN" ? t("groups.admin") : t("groups.member")}
                </Muted>
                {waiting && <Badge label={t("groups.votesWaiting")} tone="warn" />}
              </Card>
            </Pressable>
          );
        })}
        <Card>
          <Title>{t("groups.start")}</Title>
          <Field label={t("groups.name")} value={name} maxLength={40} onChangeText={setName} />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            title={t("groups.create")}
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

  const fmt = (n: number) => money(n, group.currency);
  const contributionMinor = parseMajorToMinor(contribution, group.currency);
  const payoutMinor = parseMajorToMinor(payout, group.currency);
  const pending = group.payoutRequests.find((p) => p.status === "PENDING");

  return (
    <>
      <GhostButton title={`← ${t("groups.all")}`} onPress={() => setOpenId(null)} />
      <View style={{ backgroundColor: colors.heroMid, borderRadius: 22, padding: 20, gap: 4 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{group.name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{t("groups.pool")}</Text>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 30 }}>{fmt(group.poolBalanceMinor)}</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{t("groups.quorum", { count: group.approvalsRequired })}</Text>
      </View>

      <Card>
        <Title>{t("groups.contribute")}</Title>
        <AmountField currency={group.currency} value={contribution} onChange={setContribution} />
        <PrimaryButton
          title={t("groups.reviewContribution")}
          disabled={!contributionMinor}
          onPress={() =>
            setIntent({
              title: t("groups.contributeTo", { group: group.name }),
              rows: [[t("common.amount"), fmt(contributionMinor!)]],
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
        <Card highlight>
          <Title>{t("groups.pendingTitle")}</Title>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {t("groups.pendingLine", { amount: fmt(pending.amountMinor), name: pending.recipientName })} — “{pending.reason}”
          </Text>
          <Muted>
            {t("groups.requestedBy", { name: pending.requestedBy })} ·{" "}
            {t("groups.tally", { approvals: pending.approvals, required: group.approvalsRequired, rejections: pending.rejections })}
          </Muted>
          {pending.recipientUserId === user.userId ? (
            <Banner tone="info">{t("groups.toYou")}</Banner>
          ) : pending.myVote ? (
            <Banner tone="info">{t("groups.youVoted")}</Banner>
          ) : (
            <>
              <PinField value={pin} onChange={setPin} />
              <PrimaryButton title={t("groups.approve")} disabled={busy || pin.length < 4} onPress={() => run(async () => replace((await api.votePayout(group.groupId, pending.requestId, true, pin)).group))} />
              <SecondaryButton title={t("groups.reject")} disabled={busy || pin.length < 4} onPress={() => run(async () => replace((await api.votePayout(group.groupId, pending.requestId, false, pin)).group))} />
            </>
          )}
        </Card>
      ) : (
        group.members.length > 1 && (
          <Card>
            <Title>{t("groups.requestPayout")}</Title>
            <ChipSelect
              label={t("groups.payTo")}
              value={recipient}
              onChange={setRecipient}
              options={group.members.map((m) => ({ id: m.userId, label: m.userId === user.userId ? `${m.displayName} (${t("common.you")})` : m.displayName }))}
            />
            <AmountField currency={group.currency} value={payout} onChange={setPayout} />
            <Field label={t("groups.reason")} value={reason} maxLength={140} placeholder={t("groups.reasonHint")} onChangeText={setReason} />
            <PinField value={pin} onChange={setPin} />
            <PrimaryButton
              title={t("groups.ask")}
              disabled={busy || !payoutMinor || reason.trim().length < 3 || pin.length < 4}
              onPress={() => run(async () => replace((await api.requestPayout(group.groupId, { pin, recipientUserId: recipient, amountMinor: payoutMinor!, reason })).group))}
            />
          </Card>
        )
      )}
      {error && <Banner tone="error">{error}</Banner>}

      <Card>
        <Title>{t("groups.membersTitle")}</Title>
        {group.members.map((m) => (
          <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.warn, fontWeight: "800" }}>{m.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={{ flex: 1, color: colors.text }}>
              {m.displayName}
              {m.role === "ADMIN" ? ` · ${t("groups.admin")}` : ""}
            </Text>
            <Muted>{t("groups.contributed", { amount: fmt(m.contributedMinor) })}</Muted>
          </View>
        ))}
        {group.myRole === "ADMIN" && (
          <>
            <Field label={t("groups.addMember")} value={memberPhone} keyboardType="phone-pad" onChangeText={(v) => setMemberPhone(v.replace(/[^\d+]/g, ""))} />
            <SecondaryButton
              title={t("groups.add")}
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

      {group.payoutRequests.some((p) => p.status !== "PENDING") && (
        <Card>
          <Title>{t("groups.past")}</Title>
          {group.payoutRequests
            .filter((p) => p.status !== "PENDING")
            .map((p) => (
              <View key={p.requestId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, color: colors.text }}>{t("groups.pendingLine", { amount: fmt(p.amountMinor), name: p.recipientName })}</Text>
                <Badge label={p.status === "EXECUTED" ? t("groups.paid") : t("groups.notApproved")} tone={p.status === "EXECUTED" ? "brand" : "danger"} />
              </View>
            ))}
        </Card>
      )}
    </>
  );
}
