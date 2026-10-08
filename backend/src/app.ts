import cors from "cors";
import express, { type Express, type Request } from "express";
import type { AppContext } from "./context";
import { correlationId, errorHandler, rateLimit, requestLogger, securityHeaders } from "./http/middleware";
import { notFound } from "./lib/errors";
import { adminRoutes, reconciliationRoutes } from "./routes/admin";
import { customerRoutes } from "./routes/customer";
import { webhookRoutes } from "./routes/webhooks";

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(correlationId());
  app.use(securityHeaders());
  app.use(requestLogger(ctx));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || ctx.config.corsOrigins.includes(origin)),
      allowedHeaders: ["authorization", "content-type", "x-device-id", "x-correlation-id"],
      exposedHeaders: ["x-correlation-id", "retry-after", "content-disposition"],
      maxAge: 600,
    }),
  );
  app.use(
    express.json({
      limit: "16kb",
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
  );
  app.use(rateLimit(ctx, "global", 300, 60_000));

  app.get("/v1/health", (_req, res) => {
    res.json({ status: "ok", time: ctx.nowIso() });
  });
  app.use("/v1/admin", adminRoutes(ctx));
  app.use("/v1/reconciliation", reconciliationRoutes(ctx));
  app.use("/v1/webhooks", webhookRoutes(ctx));
  app.use("/v1", customerRoutes(ctx));

  app.use((_req, _res, next) => next(notFound("Route not found")));
  app.use(errorHandler(ctx));
  return app;
}
