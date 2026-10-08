import { MIN_TIER_FOR_SERVICE, tierAtLeast, type SavingsVault } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { UserRow, VaultRow } from "../db/rows";
import { badRequest, conflict, forbidden } from "../lib/errors";
import { newId } from "../lib/ids";
import { createCustomerAccount, getAccount } from "./accounts";
import { audit } from "./audit";
import { balanceOf } from "./ledger";
import { requireWallet } from "./payments";
import { assertActive } from "./users";

const MAX_VAULTS = 5;

function toVault(ctx: AppContext, v: VaultRow): SavingsVault {
  return {
    vaultId: v.id,
    name: v.name,
    currency: getAccount(ctx, v.account_id)!.currency,
    targetMinor: v.target_minor,
    balanceMinor: balanceOf(ctx, v.account_id),
    createdAt: v.created_at,
  };
}

export function listVaults(ctx: AppContext, userId: string): SavingsVault[] {
  return all<VaultRow>(ctx.db, "SELECT * FROM savings_vaults WHERE user_id = ? ORDER BY created_at", userId).map((v) => toVault(ctx, v));
}

export function createVault(ctx: AppContext, user: UserRow, name: string, targetMinor: number): SavingsVault {
  assertActive(user);
  if (!tierAtLeast(user.kyc_tier, MIN_TIER_FOR_SERVICE.SAVINGS)) throw forbidden("Verify your identity to open a savings vault.");
  const wallet = getAccount(ctx, requireWallet(user))!;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) throw badRequest("Vault name must be 2–40 characters");
  const count = one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM savings_vaults WHERE user_id = ?", user.id)!.n;
  if (count >= MAX_VAULTS) throw conflict(`You can have up to ${MAX_VAULTS} savings vaults`);
  return withTx(ctx.db, () => {
    const account = createCustomerAccount(ctx, "VAULT", wallet.currency, user.id, `Savings: ${trimmed}`);
    const id = newId("VLT");
    run(
      ctx.db,
      "INSERT INTO savings_vaults (id, user_id, account_id, name, target_minor, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      user.id,
      account.id,
      trimmed,
      targetMinor,
      ctx.nowIso(),
    );
    audit(ctx, { actorType: "USER", actorId: user.id, action: "VAULT_CREATED", entityType: "vault", entityId: id });
    return toVault(ctx, one<VaultRow>(ctx.db, "SELECT * FROM savings_vaults WHERE id = ?", id)!);
  });
}
