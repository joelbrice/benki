import { Router } from "express";
import type {
  AirtimeTopUpRequest,
  CashInRequest,
  CashOutRequest,
  WalletActionResponse,
  WalletBalancesResponse,
  WalletCreateResponse,
  WalletTransactionsResponse,
} from "@benki/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import {
  airtimeTopUp,
  cashIn,
  cashOut,
  createWallet,
  currencyForCountry,
  requireAgent,
  requireMobileMoneyProvider,
} from "../ledger";
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
  const wallet = createWallet(user.userId, currencyForCountry(user.countryCode));
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
  if (!body.agentId?.trim()) throw badRequest("agentId is required");
  const agent = requireAgent(req.user!.countryCode, body.agentId);

  const tx = cashIn(wallet.walletId, body.amountMinor, agent.name);
  const response: WalletActionResponse = { wallet: wallets.get(wallet.walletId)!, transaction: tx };
  res.status(201).json(response);
});

walletRouter.post("/:walletId/cash-out", (req: AuthedRequest, res) => {
  const wallet = walletForRequest(req);
  const body = req.body as Partial<CashOutRequest>;
  if (!body.amountMinor || body.amountMinor <= 0) {
    throw badRequest("amountMinor must be a positive number");
  }
  if (!body.agentId?.trim()) throw badRequest("agentId is required");
  const agent = requireAgent(req.user!.countryCode, body.agentId);

  const response = cashOut(wallet, req.user!, body.amountMinor, agent.name);
  res.status(201).json(response);
});

walletRouter.post("/:walletId/airtime-topup", (req: AuthedRequest, res) => {
  const wallet = walletForRequest(req);
  const body = req.body as Partial<AirtimeTopUpRequest>;
  if (!body.amountMinor || body.amountMinor <= 0) {
    throw badRequest("amountMinor must be a positive number");
  }
  if (!body.providerId?.trim()) throw badRequest("providerId is required");
  const provider = requireMobileMoneyProvider(req.user!.countryCode, body.providerId);
  const phoneNumber = body.phoneNumber?.trim() || req.user!.phoneNumber;

  const response = airtimeTopUp(wallet, req.user!, body.amountMinor, provider.label, phoneNumber);
  res.status(201).json(response);
});
