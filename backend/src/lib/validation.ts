import { z, type ZodTypeAny } from "zod";
import { badRequest } from "./errors";

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw badRequest(`${path}${issue.message}`);
  }
  return result.data;
}

export const amountMinor = z
  .number({ invalid_type_error: "must be a number" })
  .int("must be a whole number of minor units")
  .positive("must be positive")
  .max(Number.MAX_SAFE_INTEGER);

export const e164Phone = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "must be an international number like +254712345678");

export const idempotencyKey = z
  .string()
  .min(8, "must be at least 8 characters")
  .max(100)
  .regex(/^[A-Za-z0-9_\-:.]+$/, "contains invalid characters");

export const pin = z.string().regex(/^\d{4,6}$/, "must be 4 to 6 digits");

export const note = z.string().trim().max(140).optional();
