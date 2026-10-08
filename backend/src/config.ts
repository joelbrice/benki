import { createHash } from "crypto";

export type Environment = "development" | "test" | "production";

export interface AppConfig {
  env: Environment;
  port: number;
  dbPath: string;
  /** 32-byte key for field-level encryption and keyed hashing of identifiers. */
  dataKey: Buffer;
  webhookSecret: string;
  /** Shared secret the USSD aggregator presents on every callback. */
  ussdGatewayKey: string;
  /** Unauthenticated in-browser USSD simulator — development only. */
  ussdSimulator: boolean;
  exposeDevOtp: boolean;
  corsOrigins: string[];
  rateLimitEnabled: boolean;
  requestLogging: boolean;
  sessionTtlMs: number;
  staffSessionTtlMs: number;
  otpTtlMs: number;
  quoteTtlMs: number;
  providerLatencyMs: number;
  settlementIntervalMs: number;
  seedDemoStaff: boolean;
  demoStaffPassword: string;
}

const DEV_DATA_KEY = createHash("sha256").update("benki-development-only-data-key").digest();
const DEV_WEBHOOK_SECRET = "benki-development-only-webhook-secret";
const DEV_USSD_GATEWAY_KEY = "benki-development-only-ussd-key";

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<AppConfig> = {}): AppConfig {
  const environment: Environment =
    env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const isProd = environment === "production";

  const dataKey = env.BENKI_DATA_KEY ? Buffer.from(env.BENKI_DATA_KEY, "base64") : DEV_DATA_KEY;

  const config: AppConfig = {
    env: environment,
    port: int(env.PORT, 4000),
    dbPath: env.BENKI_DB_PATH ?? (environment === "test" ? ":memory:" : "./data/benki.db"),
    dataKey,
    webhookSecret: env.BENKI_WEBHOOK_SECRET ?? DEV_WEBHOOK_SECRET,
    ussdGatewayKey: env.BENKI_USSD_GATEWAY_KEY ?? DEV_USSD_GATEWAY_KEY,
    ussdSimulator: bool(env.BENKI_USSD_SIMULATOR, !isProd),
    exposeDevOtp: bool(env.BENKI_EXPOSE_DEV_OTP, !isProd),
    corsOrigins: (env.BENKI_CORS_ORIGINS ?? "http://localhost:5173,http://localhost:4173,http://localhost:8081")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitEnabled: bool(env.BENKI_RATE_LIMIT, environment !== "test"),
    requestLogging: bool(env.BENKI_REQUEST_LOG, environment === "development"),
    sessionTtlMs: int(env.BENKI_SESSION_TTL_MS, 12 * 60 * 60 * 1000),
    staffSessionTtlMs: int(env.BENKI_STAFF_SESSION_TTL_MS, 8 * 60 * 60 * 1000),
    otpTtlMs: 5 * 60 * 1000,
    quoteTtlMs: int(env.BENKI_QUOTE_TTL_MS, 60 * 1000),
    providerLatencyMs: int(env.BENKI_PROVIDER_LATENCY_MS, environment === "test" ? 0 : 1500),
    settlementIntervalMs: int(env.BENKI_SETTLEMENT_INTERVAL_MS, 2000),
    seedDemoStaff: bool(env.BENKI_SEED_DEMO_STAFF, !isProd),
    demoStaffPassword: env.BENKI_DEMO_STAFF_PASSWORD ?? "Benki-Demo-2026!",
    ...overrides,
  };

  assertSafeConfig(config);
  return config;
}

/** Refuse to boot in production with development-grade secrets or demo shortcuts. */
export function assertSafeConfig(config: AppConfig) {
  if (config.dataKey.length !== 32) throw new Error("BENKI_DATA_KEY must be 32 bytes, base64-encoded");
  if (config.env !== "production") return;
  const problems: string[] = [];
  if (config.dataKey.equals(DEV_DATA_KEY)) problems.push("BENKI_DATA_KEY is not set");
  if (config.webhookSecret === DEV_WEBHOOK_SECRET) problems.push("BENKI_WEBHOOK_SECRET is not set");
  if (config.ussdGatewayKey === DEV_USSD_GATEWAY_KEY) problems.push("BENKI_USSD_GATEWAY_KEY is not set");
  if (config.ussdSimulator) problems.push("BENKI_USSD_SIMULATOR must be off");
  if (config.exposeDevOtp) problems.push("BENKI_EXPOSE_DEV_OTP must be off");
  if (config.seedDemoStaff) problems.push("BENKI_SEED_DEMO_STAFF must be off");
  if (config.corsOrigins.some((o) => o.includes("localhost"))) problems.push("BENKI_CORS_ORIGINS includes localhost");
  if (problems.length) throw new Error(`Unsafe production configuration: ${problems.join("; ")}`);
}

export function isUsingDevSecrets(config: AppConfig): boolean {
  return config.dataKey.equals(DEV_DATA_KEY) || config.webhookSecret === DEV_WEBHOOK_SECRET;
}
