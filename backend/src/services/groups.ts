import {
  formatAmount,
  MAX_GROUP_MEMBERS,
  MIN_TIER_FOR_SERVICE,
  tierAtLeast,
  type GroupMember,
  type GroupPayoutRequest,
  type SavingsGroup,
} from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { UserRow } from "../db/rows";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { createCustomerAccount } from "./accounts";
import { audit } from "./audit";
import { balanceOf } from "./ledger";
import { currencyOf } from "./limits";
import { notify } from "./notifications";
import { requireWallet, submitPayment, type PaymentDraft } from "./payments";
import { assertActive, getUser, getUserByPhone, maskPhone } from "./users";

const MAX_GROUPS_PER_USER = 5;

interface GroupRow {
  id: string;
  name: string;
  country_code: string;
  account_id: string;
  created_by: string;
  created_at: string;
}

interface MemberRow {
  group_id: string;
  user_id: string;
  role: "ADMIN" | "MEMBER";
  joined_at: string;
}

interface PayoutRow {
  id: string;
  group_id: string;
  recipient_user_id: string;
  amount_minor: number;
  reason: string;
  status: "PENDING" | "EXECUTED" | "REJECTED";
  requested_by: string;
  created_at: string;
  decided_at: string | null;
  transaction_id: string | null;
}

/**
 * Votes needed to release pool money. The recipient never votes on their own
 * payout, so a quorum is drawn from the other members: at least two of them
 * (or the only other member in a pair) and at least half the group.
 */
export function approvalsRequired(memberCount: number): number {
  return Math.min(Math.max(2, Math.ceil(memberCount / 2)), memberCount - 1);
}

function members(ctx: AppContext, groupId: string): MemberRow[] {
  return all<MemberRow>(ctx.db, "SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at", groupId);
}

function displayName(ctx: AppContext, userId: string): string {
  const u = getUser(ctx, userId)!;
  return u.full_name ?? maskPhone(u.phone);
}

/** Members only; anyone else gets a 404 so group ids can't be probed. */
function groupForMember(ctx: AppContext, userId: string, groupId: string): { group: GroupRow; me: MemberRow } {
  const group = one<GroupRow>(ctx.db, "SELECT * FROM savings_groups WHERE id = ?", groupId);
  const me = group && one<MemberRow>(ctx.db, "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?", groupId, userId);
  if (!group || !me) throw notFound("Group not found");
  return { group, me };
}

function toPayout(ctx: AppContext, row: PayoutRow, viewerId: string): GroupPayoutRequest {
  const votes = all<{ user_id: string; vote: "APPROVE" | "REJECT" }>(
    ctx.db,
    "SELECT user_id, vote FROM group_payout_votes WHERE request_id = ?",
    row.id,
  );
  return {
    requestId: row.id,
    recipientUserId: row.recipient_user_id,
    recipientName: displayName(ctx, row.recipient_user_id),
    amountMinor: row.amount_minor,
    reason: row.reason,
    status: row.status,
    approvals: votes.filter((v) => v.vote === "APPROVE").length,
    rejections: votes.filter((v) => v.vote === "REJECT").length,
    myVote: votes.find((v) => v.user_id === viewerId)?.vote ?? null,
    requestedBy: displayName(ctx, row.requested_by),
    createdAt: row.created_at,
    transactionId: row.transaction_id,
  };
}

function toGroup(ctx: AppContext, group: GroupRow, viewerId: string): SavingsGroup {
  const rows = members(ctx, group.id);
  const memberList: GroupMember[] = rows.map((m) => ({
    userId: m.user_id,
    displayName: displayName(ctx, m.user_id),
    role: m.role,
    contributedMinor:
      one<{ total: number | null }>(
        ctx.db,
        `SELECT SUM(amount_minor) AS total FROM transactions
         WHERE type = 'GROUP_CONTRIBUTION' AND status = 'COMPLETED' AND initiator_user_id = ? AND destination_account_id = ?`,
        m.user_id,
        group.account_id,
      )!.total ?? 0,
    joinedAt: m.joined_at,
  }));
  const payouts = all<PayoutRow>(
    ctx.db,
    "SELECT * FROM group_payout_requests WHERE group_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
    group.id,
  );
  return {
    groupId: group.id,
    name: group.name,
    currency: currencyOf({ country_code: group.country_code } as UserRow),
    poolBalanceMinor: balanceOf(ctx, group.account_id),
    approvalsRequired: Math.max(1, approvalsRequired(rows.length)),
    myRole: rows.find((m) => m.user_id === viewerId)!.role,
    members: memberList,
    payoutRequests: payouts.map((p) => toPayout(ctx, p, viewerId)),
    createdAt: group.created_at,
  };
}

function assertCanJoin(user: UserRow) {
  assertActive(user);
  if (!tierAtLeast(user.kyc_tier, MIN_TIER_FOR_SERVICE.GROUPS)) throw forbidden("Verify your identity (Tier 1) to use savings groups.");
}

export function listGroups(ctx: AppContext, userId: string): SavingsGroup[] {
  return all<GroupRow>(
    ctx.db,
    `SELECT g.* FROM savings_groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.created_at`,
    userId,
  ).map((g) => toGroup(ctx, g, userId));
}

export function getGroup(ctx: AppContext, userId: string, groupId: string): SavingsGroup {
  return toGroup(ctx, groupForMember(ctx, userId, groupId).group, userId);
}

export function createGroup(ctx: AppContext, user: UserRow, name: string): SavingsGroup {
  assertCanJoin(user);
  requireWallet(user);
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) throw badRequest("Group name must be 2–40 characters");
  const count = one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?", user.id)!.n;
  if (count >= MAX_GROUPS_PER_USER) throw conflict(`You can belong to up to ${MAX_GROUPS_PER_USER} groups`);
  return withTx(ctx.db, () => {
    const id = newId("GRP");
    // The pool is owned by the group, not a person, so it never counts toward anyone's balance cap.
    const account = createCustomerAccount(ctx, "GROUP_POOL", currencyOf(user), id, `Group pool: ${trimmed}`);
    const now = ctx.nowIso();
    run(
      ctx.db,
      "INSERT INTO savings_groups (id, name, country_code, account_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      trimmed,
      user.country_code,
      account.id,
      user.id,
      now,
    );
    run(ctx.db, "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'ADMIN', ?)", id, user.id, now);
    audit(ctx, { actorType: "USER", actorId: user.id, action: "GROUP_CREATED", entityType: "group", entityId: id, details: { name: trimmed } });
    return getGroup(ctx, user.id, id);
  });
}

export function addMember(ctx: AppContext, user: UserRow, groupId: string, phoneNumber: string): SavingsGroup {
  const { group, me } = groupForMember(ctx, user.id, groupId);
  if (me.role !== "ADMIN") throw forbidden("Only the group admin can add members");
  assertActive(user);
  const invitee = getUserByPhone(ctx, phoneNumber);
  // Same message whatever the reason, so the endpoint can't be used to probe accounts.
  const cannotAdd = badRequest("That number can't be added. They need a verified Benki account in your country.");
  if (!invitee || invitee.country_code !== group.country_code || !invitee.wallet_account_id) throw cannotAdd;
  if (invitee.status !== "ACTIVE" || !tierAtLeast(invitee.kyc_tier, MIN_TIER_FOR_SERVICE.GROUPS)) throw cannotAdd;
  if (one(ctx.db, "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", groupId, invitee.id)) {
    throw conflict("They're already in this group");
  }
  if (members(ctx, groupId).length >= MAX_GROUP_MEMBERS) throw conflict(`Groups can have up to ${MAX_GROUP_MEMBERS} members`);
  const theirs = one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?", invitee.id)!.n;
  if (theirs >= MAX_GROUPS_PER_USER) throw conflict("They're already in the maximum number of groups");
  return withTx(ctx.db, () => {
    run(ctx.db, "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'MEMBER', ?)", groupId, invitee.id, ctx.nowIso());
    notify(ctx, invitee.id, "ACCOUNT", `${displayName(ctx, user.id)} added you to the savings group "${group.name}".`);
    audit(ctx, { actorType: "USER", actorId: user.id, action: "GROUP_MEMBER_ADDED", entityType: "group", entityId: groupId, details: { memberId: invitee.id } });
    return getGroup(ctx, user.id, groupId);
  });
}

export function draftContribution(ctx: AppContext, user: UserRow, groupId: string, amountMinor: number, deviceId: string | null): PaymentDraft {
  const { group } = groupForMember(ctx, user.id, groupId);
  return {
    type: "GROUP_CONTRIBUTION",
    userId: user.id,
    amountMinor,
    feeMinor: 0,
    merchantFeeMinor: 0,
    currency: currencyOf(user),
    sourceAccountId: requireWallet(user),
    destinationAccountId: group.account_id,
    counterpartyUserId: null,
    counterpartyLabel: `Group: ${group.name}`,
    counterpartyKey: `group:${group.id}`,
    note: "",
    providerId: null,
    purposeCode: null,
    receiveAmountMinor: null,
    receiveCurrency: null,
    metadata: { groupId },
    minTier: MIN_TIER_FOR_SERVICE.GROUPS,
    outflow: true,
    checkFunds: true,
    screen: true,
    recipientCapUserId: null,
    recipientCapAmountMinor: 0,
    deviceId,
  };
}

export function requestPayout(
  ctx: AppContext,
  user: UserRow,
  groupId: string,
  input: { recipientUserId: string; amountMinor: number; reason: string },
): SavingsGroup {
  const { group } = groupForMember(ctx, user.id, groupId);
  assertActive(user);
  const all_ = members(ctx, groupId);
  if (all_.length < 2) throw conflict("Add at least one more member before requesting a payout");
  if (!all_.some((m) => m.user_id === input.recipientUserId)) throw badRequest("Payouts can only go to a group member");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 140) throw badRequest("Give a reason (3–140 characters)");
  if (input.amountMinor > balanceOf(ctx, group.account_id)) throw badRequest("The group pool doesn't hold that much");
  if (one(ctx.db, "SELECT id FROM group_payout_requests WHERE group_id = ? AND status = 'PENDING'", groupId)) {
    throw conflict("There's already a payout waiting for votes in this group");
  }
  return withTx(ctx.db, () => {
    const id = newId("GPR");
    const now = ctx.nowIso();
    run(
      ctx.db,
      `INSERT INTO group_payout_requests (id, group_id, recipient_user_id, amount_minor, reason, status, requested_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      id,
      groupId,
      input.recipientUserId,
      input.amountMinor,
      reason,
      user.id,
      now,
    );
    audit(ctx, {
      actorType: "USER",
      actorId: user.id,
      action: "GROUP_PAYOUT_REQUESTED",
      entityType: "group",
      entityId: groupId,
      details: { requestId: id, recipientUserId: input.recipientUserId, amountMinor: input.amountMinor },
    });
    const amount = formatAmount(input.amountMinor, currencyOf(user));
    for (const m of all_) {
      if (m.user_id !== user.id) {
        notify(ctx, m.user_id, "ACCOUNT", `"${group.name}": ${displayName(ctx, user.id)} asked to pay ${amount} to ${displayName(ctx, input.recipientUserId)}. Open the group to vote.`);
      }
    }
    // A requester who isn't the recipient implicitly approves their own request.
    if (user.id !== input.recipientUserId) castVote(ctx, user, group, id, true);
    return getGroup(ctx, user.id, groupId);
  });
}

export function votePayout(ctx: AppContext, user: UserRow, groupId: string, requestId: string, approve: boolean): SavingsGroup {
  const { group } = groupForMember(ctx, user.id, groupId);
  assertActive(user);
  return withTx(ctx.db, () => {
    castVote(ctx, user, group, requestId, approve);
    return getGroup(ctx, user.id, groupId);
  });
}

function castVote(ctx: AppContext, user: UserRow, group: GroupRow, requestId: string, approve: boolean) {
  const request = one<PayoutRow>(ctx.db, "SELECT * FROM group_payout_requests WHERE id = ? AND group_id = ?", requestId, group.id);
  if (!request) throw notFound("Payout request not found");
  if (request.status !== "PENDING") throw conflict("Voting on this payout has closed");
  if (request.recipient_user_id === user.id) throw forbidden("You can't vote on a payout to yourself");
  if (one(ctx.db, "SELECT 1 FROM group_payout_votes WHERE request_id = ? AND user_id = ?", requestId, user.id)) {
    throw conflict("You've already voted on this payout");
  }
  run(
    ctx.db,
    "INSERT INTO group_payout_votes (request_id, user_id, vote, voted_at) VALUES (?, ?, ?, ?)",
    requestId,
    user.id,
    approve ? "APPROVE" : "REJECT",
    ctx.nowIso(),
  );
  audit(ctx, {
    actorType: "USER",
    actorId: user.id,
    action: approve ? "GROUP_PAYOUT_APPROVED_VOTE" : "GROUP_PAYOUT_REJECTED_VOTE",
    entityType: "group",
    entityId: group.id,
    details: { requestId },
  });

  const count = members(ctx, group.id).length;
  const required = approvalsRequired(count);
  const votes = all<{ vote: string }>(ctx.db, "SELECT vote FROM group_payout_votes WHERE request_id = ?", requestId);
  const approvals = votes.filter((v) => v.vote === "APPROVE").length;
  const rejections = votes.length - approvals;
  const eligibleVoters = count - 1;

  if (approvals >= required) executePayout(ctx, group, request);
  else if (eligibleVoters - rejections < required) decide(ctx, group, request, "REJECTED", null, "Not enough members approved.");
}

function decide(ctx: AppContext, group: GroupRow, request: PayoutRow, status: "EXECUTED" | "REJECTED", txId: string | null, why: string) {
  run(
    ctx.db,
    "UPDATE group_payout_requests SET status = ?, decided_at = ?, transaction_id = ? WHERE id = ?",
    status,
    ctx.nowIso(),
    txId,
    request.id,
  );
  audit(ctx, { actorType: "SYSTEM", actorId: null, action: `GROUP_PAYOUT_${status}`, entityType: "group", entityId: group.id, details: { requestId: request.id, why } });
  const amount = formatAmount(request.amount_minor, currencyOf({ country_code: group.country_code } as UserRow));
  for (const m of members(ctx, group.id)) {
    notify(
      ctx,
      m.user_id,
      "ACCOUNT",
      status === "EXECUTED"
        ? `"${group.name}": ${amount} was paid out to ${displayName(ctx, request.recipient_user_id)}.`
        : `"${group.name}": the payout of ${amount} to ${displayName(ctx, request.recipient_user_id)} didn't go ahead. ${why}`,
    );
  }
}

/**
 * Moves pool money to the recipient through the normal payment pipeline (the
 * recipient's status, tier and balance cap all apply). A failure there rejects
 * the request instead of losing the votes: it runs in a savepoint.
 */
function executePayout(ctx: AppContext, group: GroupRow, request: PayoutRow) {
  const recipient = getUser(ctx, request.recipient_user_id)!;
  try {
    const outcome = withTx(ctx.db, () =>
      submitPayment(ctx, {
        type: "GROUP_PAYOUT",
        userId: recipient.id,
        amountMinor: request.amount_minor,
        feeMinor: 0,
        merchantFeeMinor: 0,
        currency: currencyOf(recipient),
        sourceAccountId: group.account_id,
        destinationAccountId: requireWallet(recipient),
        counterpartyUserId: null,
        counterpartyLabel: `Group payout: ${group.name}`,
        counterpartyKey: `group:${group.id}`,
        note: request.reason,
        providerId: null,
        purposeCode: null,
        receiveAmountMinor: null,
        receiveCurrency: null,
        metadata: { groupId: group.id, requestId: request.id },
        minTier: MIN_TIER_FOR_SERVICE.GROUPS,
        outflow: false,
        checkFunds: true,
        screen: false,
        recipientCapUserId: recipient.id,
        recipientCapAmountMinor: request.amount_minor,
        deviceId: null,
      }),
    );
    decide(ctx, group, request, "EXECUTED", outcome.tx.id, "");
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    decide(ctx, group, request, "REJECTED", null, "The payout couldn't be completed.");
  }
}

export function groupCount(ctx: AppContext): number {
  return one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM savings_groups")!.n;
}
