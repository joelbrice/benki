import { randomUUID } from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppContext } from "../context";
import { ApiError, rateLimited } from "../lib/errors";
import { LedgerInvariantError } from "../services/ledger";
import "./types";

export function correlationId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header("x-correlation-id");
    req.correlationId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader("x-correlation-id", req.correlationId);
    next();
  };
}

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  };
}

/** Logs method, route, status and latency only — never bodies, phone numbers or tokens. */
export function requestLogger(ctx: AppContext): RequestHandler {
  return (req, res, next) => {
    if (!ctx.config.requestLogging) return next();
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      ctx.log.info("request", {
        method: req.method,
        route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path.replace(/[A-Z]{2,4}_[a-f0-9]{24}/g, ":id"),
        status: res.statusCode,
        ms: Number(process.hrtime.bigint() - started) / 1e6,
        correlationId: req.correlationId,
      });
    });
    next();
  };
}

/** Fixed-window limiter keyed by client IP (and by user once authenticated). */
export function rateLimit(ctx: AppContext, name: string, max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    if (!ctx.config.rateLimitEnabled) return next();
    const key = `${name}:${req.user?.id ?? req.staff?.id ?? req.ip}`;
    const now = Date.now();
    const bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return next();
    }
    bucket.count++;
    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return next(rateLimited());
    }
    next();
  };
}

export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function errorHandler(ctx: AppContext) {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof ApiError) {
      res.status(err.status).json(err.toBody(req.correlationId));
      return;
    }
    const bodyError = err as { type?: string; status?: number };
    if (bodyError?.type === "entity.too.large") {
      res.status(413).json(new ApiError(413, "VALIDATION_ERROR", "Request body too large").toBody(req.correlationId));
      return;
    }
    if (bodyError?.type === "entity.parse.failed") {
      res.status(400).json(new ApiError(400, "VALIDATION_ERROR", "Malformed JSON").toBody(req.correlationId));
      return;
    }
    // Ledger invariant violations are programming errors: fail closed and loudly.
    ctx.log.error(err instanceof LedgerInvariantError ? "ledger invariant violated" : "unhandled error", {
      correlationId: req.correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
    res
      .status(500)
      .json(
        new ApiError(
          500,
          "INTERNAL_ERROR",
          "Something went wrong. Check your transaction history before retrying.",
        ).toBody(req.correlationId),
      );
  };
}
