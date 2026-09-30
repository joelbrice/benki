import { Router } from "express";
import type {
  InternalTransferRequest,
  InternalTransferResponse,
  MobileMoneyTransferRequest,
  MobileMoneyTransferResponse,
} from "@benki/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireMobileMoneyProvider, transferInternal, transferMobileMoney } from "../ledger";
import { idempotencyCache, usersByPhone, wallets } from "../store";
import { badRequest, notFound } from "../errors";

export const transfersRouter = Router();
transfersRouter.use(requireAuth);

transfersRouter.post("/internal", (req: AuthedRequest, res) => {
  const body = req.body as Partial<InternalTransferRequest>;
  if (!body.idempotencyKey?.trim()) throw badRequest("idempotencyKey is required");
  if (!body.destinationPhoneNumber?.trim()) throw badRequest("destinationPhoneNumber is required");
  if (!body.amountMinor || body.amountMinor <= 0) throw badRequest("amountMinor must be positive");
  if (!body.currency?.trim()) throw badRequest("currency is required");

  const cached = idempotencyCache.get(body.idempotencyKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const sender = req.user!;
  const recipient = usersByPhone.get(body.destinationPhoneNumber);
  if (!recipient) throw notFound(`No Benki user registered at ${body.destinationPhoneNumber}`);
  if (recipient.userId === sender.userId) throw badRequest("Cannot transfer to your own account");

  const result: InternalTransferResponse = transferInternal(
    sender,
    recipient,
    body.amountMinor,
    body.currency,
    body.note,
  );
  idempotencyCache.set(body.idempotencyKey, result);
  res.status(201).json(result);
});

// docs/API_SPECIFICATION.md POST /v1/transfers/mobile-money — payout to a
// mobile money wallet (M-Pesa, MTN MoMo, Orange Money, …) outside Benki,
// simulating the provider adapter contract in section 4 of that doc.
transfersRouter.post("/mobile-money", (req: AuthedRequest, res) => {
  const body = req.body as Partial<MobileMoneyTransferRequest>;
  if (!body.idempotencyKey?.trim()) throw badRequest("idempotencyKey is required");
  if (!body.providerId?.trim()) throw badRequest("providerId is required");
  if (!body.destinationPhoneNumber?.trim()) throw badRequest("destinationPhoneNumber is required");
  if (!body.amountMinor || body.amountMinor <= 0) throw badRequest("amountMinor must be positive");
  if (!body.currency?.trim()) throw badRequest("currency is required");

  const cached = idempotencyCache.get(body.idempotencyKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const sender = req.user!;
  if (!sender.walletId) throw badRequest("Create a wallet first");
  const wallet = wallets.get(sender.walletId);
  if (!wallet) throw notFound(`Unknown wallet ${sender.walletId}`);
  const provider = requireMobileMoneyProvider(sender.countryCode, body.providerId);

  const result: MobileMoneyTransferResponse = transferMobileMoney(
    sender,
    wallet,
    provider.label,
    body.destinationPhoneNumber,
    body.amountMinor,
    body.currency,
    body.note,
  );
  idempotencyCache.set(body.idempotencyKey, result);
  res.status(201).json(result);
});

transfersRouter.get("/:transferId", (req: AuthedRequest, res) => {
  const match = [...idempotencyCache.values()].find((r) => r.transferId === req.params.transferId);
  if (!match) throw notFound(`Unknown transfer ${req.params.transferId}`);
  res.json(match);
});
