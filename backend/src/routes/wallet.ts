import { Router } from "express";
import type {
  CashInRequest,
  WalletBalancesResponse,
  WalletCreateResponse,
  WalletTransactionsResponse,
} from "@benki/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { cashIn, createWallet } from "../ledger";
import { transactionsByWallet, wallets } from "../store";
import { badRequest, notFound } from "../errors";

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.post("/", (req: AuthedRequest, res) => {
  const user = req.user!;
  if (user.walletId) {
    const response: WalletCreateResponse = { wallet: wallets.get(user.walletId)! };
    res.json(response);
    return;
  }
  const wallet = createWallet(user.userId);
  user.walletId = wallet.walletId; // same object referenced by both user indexes
  const response: WalletCreateResponse = { wallet };
  res.status(201).json(response);
});

function walletForRequest(req: AuthedRequest) {
  const walletId = req.params.walletId;
  const wallet = wallets.get(walletId);
  if (!wallet) throw notFound(`Unknown wallet ${walletId}`);
  if (wallet.ownerUserId !== req.user!.userId) throw notFound(`Unknown wallet ${walletId}`);
  return wallet;
}

walletRouter.get("/:walletId/balances", (req: AuthedRequest, res) => {
  const wallet = walletForRequest(req);
  const response: WalletBalancesResponse = { wallet };
  res.json(response);
});

walletRouter.get("/:walletId/transactions", (req: AuthedRequest, res) => {
  const wallet = walletForRequest(req);
  const response: WalletTransactionsResponse = {
    transactions: transactionsByWallet.get(wallet.walletId) ?? [],
  };
  res.json(response);
});

// Demo-only endpoint standing in for agent-assisted cash-in (docs/PRD.md 5.4)
// so the vertical slice has funds to move without a real mobile-money rail.
walletRouter.post("/:walletId/cash-in", (req: AuthedRequest, res) => {
  const wallet = walletForRequest(req);
  const body = req.body as Partial<CashInRequest>;
  if (!body.amountMinor || body.amountMinor <= 0) {
    throw badRequest("amountMinor must be a positive number");
  }
  const tx = cashIn(wallet.walletId, body.amountMinor);
  const response: WalletBalancesResponse = { wallet: wallets.get(wallet.walletId)! };
  res.status(201).json({ ...response, transaction: tx });
});
