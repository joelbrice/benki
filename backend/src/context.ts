import { AFRICAN_COUNTRIES, BANKS } from "@benki/shared";
import { loadConfig, type AppConfig } from "./config";
import { openDatabase, type Db } from "./db/database";
import { systemClock, type Clock } from "./lib/clock";
import { SandboxRailAdapter, sandboxTelco, type ProviderAdapter, type TelcoSignals } from "./services/providers";

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface AppContext {
  config: AppConfig;
  db: Db;
  clock: Clock;
  providers: Map<string, ProviderAdapter>;
  telco: TelcoSignals;
  log: Logger;
  now(): Date;
  nowIso(): string;
}

function consoleLogger(silent: boolean): Logger {
  const write = (level: string) => (message: string, fields?: Record<string, unknown>) => {
    if (silent) return;
    // Structured, single-line logs; callers must never pass PII in fields.
    console.log(JSON.stringify({ level, message, ...fields, at: new Date().toISOString() }));
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

export interface ContextOptions {
  config?: Partial<AppConfig>;
  env?: NodeJS.ProcessEnv;
  clock?: Clock;
  providers?: Map<string, ProviderAdapter>;
  telco?: TelcoSignals;
  silent?: boolean;
}

export function createContext(options: ContextOptions = {}): AppContext {
  const config = loadConfig(options.env ?? process.env, options.config);
  const clock = options.clock ?? systemClock;
  const db = openDatabase(config.dbPath);

  const providers = options.providers ?? new Map<string, ProviderAdapter>();
  if (!options.providers) {
    const ids = new Set([
      ...AFRICAN_COUNTRIES.flatMap((c) => c.mobileMoneyProviders.map((p) => p.id)),
      ...Object.values(BANKS).flatMap((banks) => banks.map((b) => b.id)),
    ]);
    for (const id of ids) providers.set(id, new SandboxRailAdapter(id, db, clock, config.providerLatencyMs));
  }

  return {
    config,
    db,
    clock,
    providers,
    telco: options.telco ?? sandboxTelco,
    log: consoleLogger(options.silent ?? config.env === "test"),
    now: () => clock.now(),
    nowIso: () => clock.now().toISOString(),
  };
}
