import { createApp } from "./app";
import { isUsingDevSecrets } from "./config";
import { createContext } from "./context";
import { seedMarkets } from "./services/seed";
import { startSettlementWorker } from "./services/settlement";
import { DEMO_STAFF } from "./services/staff";

const ctx = createContext({ silent: false });
seedMarkets(ctx);

if (isUsingDevSecrets(ctx.config)) {
  ctx.log.warn("Running with development secrets — never use this configuration with real customers or money");
}
if (ctx.config.seedDemoStaff) {
  ctx.log.warn("Demo back-office accounts are enabled", {
    usernames: DEMO_STAFF.map((s) => `${s.username} (${s.role})`),
    passwordEnv: "BENKI_DEMO_STAFF_PASSWORD",
  });
}

const stopWorker = startSettlementWorker(ctx);
const server = createApp(ctx).listen(ctx.config.port, () => {
  ctx.log.info("Benki API listening", { port: ctx.config.port, db: ctx.config.dbPath, env: ctx.config.env });
});

function shutdown(signal: string) {
  ctx.log.info("shutting down", { signal });
  stopWorker();
  server.close(() => {
    ctx.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
