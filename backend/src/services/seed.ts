import { AFRICAN_COUNTRIES, minorUnitsPerMajor } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { one, run } from "../db/query";
import { newId } from "../lib/ids";
import { agentFloatAccountId, createCustomerAccount, getAccount, systemAccount } from "./accounts";
import { postEntry } from "./ledger";
import { seedDemoStaff } from "./staff";

const AGENT_OPENING_FLOAT_MAJOR = 50_000_000;

/**
 * Seeds the market infrastructure the demo needs: agent e-float (issued
 * against the e-money issuance account, mirroring how agents buy float) and
 * merchant business wallets. Idempotent across restarts.
 */
export function seedMarkets(ctx: AppContext) {
  withTx(ctx.db, () => {
    for (const country of AFRICAN_COUNTRIES) {
      const issuance = systemAccount(ctx, "ISSUANCE", country.currency);
      for (const agent of country.agents) {
        const id = agentFloatAccountId(agent.id);
        if (getAccount(ctx, id)) continue;
        createCustomerAccount(ctx, "AGENT_FLOAT", country.currency, agent.id, `${agent.name} float`, id);
        const float = AGENT_OPENING_FLOAT_MAJOR * minorUnitsPerMajor(country.currency);
        postEntry(ctx, {
          transactionId: null,
          kind: "OPENING",
          description: `Opening e-float for agent ${agent.id}`,
          postings: [
            { accountId: issuance, amountMinor: -float },
            { accountId: id, amountMinor: float },
          ],
        });
      }
      for (const merchant of country.merchants) {
        if (one(ctx.db, "SELECT id FROM users WHERE merchant_code = ?", merchant.code)) continue;
        const userId = newId("MER");
        run(
          ctx.db,
          `INSERT INTO users (id, phone, country_code, kind, kyc_tier, full_name, screening_status, merchant_code, created_at)
           VALUES (?, ?, ?, 'MERCHANT', 'TIER_2', ?, 'CLEAR', ?, ?)`,
          userId,
          `merchant:${merchant.code}`,
          country.code,
          merchant.name,
          merchant.code,
          ctx.nowIso(),
        );
        const wallet = createCustomerAccount(ctx, "MERCHANT_WALLET", country.currency, userId, merchant.name);
        run(ctx.db, "UPDATE users SET wallet_account_id = ? WHERE id = ?", wallet.id, userId);
      }
    }
  });
  seedDemoStaff(ctx);
}
