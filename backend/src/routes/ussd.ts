import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AppContext } from "../context";
import { asyncHandler, rateLimit } from "../http/middleware";
import { safeEqual } from "../lib/crypto";
import { notFound, unauthorized } from "../lib/errors";
import { e164Phone, parse } from "../lib/validation";
import { handleUssd } from "../services/ussd";

const ussdSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_\-:.]{4,80}$/, "invalid session id"),
  phoneNumber: e164Phone,
  text: z.string().max(182).regex(/^[0-9*#+]*$/, "invalid input").default(""),
});

/**
 * USSD aggregator callbacks. The gateway authenticates with a shared key
 * (the aggregator is the only party that can assert a caller's MSISDN), and
 * each phone number is rate limited independently of the gateway's IP.
 */
export function ussdRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: "4kb" }));
  const perPhone = rateLimit(ctx, "ussd", 40, 60_000, (req) => String(req.body?.phoneNumber ?? req.ip));

  const respond = async (req: Request, res: Response) => {
    const body = parse(ussdSchema, req.body);
    const reply = await handleUssd(ctx, body);
    res.type("text/plain").send(reply);
  };

  router.post(
    "/",
    (req, _res, next) => {
      if (!safeEqual(req.header("x-ussd-gateway-key") ?? "", ctx.config.ussdGatewayKey)) return next(unauthorized("Invalid gateway key"));
      next();
    },
    perPhone,
    asyncHandler(respond),
  );

  // Browser phone simulator for demos. Anyone can claim any number here, so it
  // only exists outside production (the config guard refuses it there).
  router.post(
    "/simulator",
    (_req, _res, next) => (ctx.config.ussdSimulator ? next() : next(notFound("Route not found"))),
    perPhone,
    asyncHandler(respond),
  );
  return router;
}
