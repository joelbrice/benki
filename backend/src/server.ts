import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter } from "./routes/auth";
import { kycRouter } from "./routes/kyc";
import { walletRouter } from "./routes/wallet";
import { transfersRouter } from "./routes/transfers";
import { ApiError } from "./errors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/v1/health", (_req, res) => res.json({ status: "ok" }));

app.use("/v1/auth", authRouter);
app.use("/v1/kyc", kycRouter);
app.use("/v1/wallets", walletRouter);
app.use("/v1/transfers", transfersRouter);

// All route handlers in this app are synchronous, so Express 4 routes thrown
// ApiErrors straight to this handler without extra wrapping.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toBody());
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Benki mock API listening on http://localhost:${port}`);
});
