import type { ApiErrorBody, ApiErrorCode } from "@benki/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }

  toBody(correlationId?: string): ApiErrorBody {
    return { error: { code: this.code, message: this.message, correlationId } };
  }
}

export const badRequest = (message: string) => new ApiError(400, "VALIDATION_ERROR", message);
export const unauthorized = (message = "Missing or invalid credentials") => new ApiError(401, "AUTH_ERROR", message);
export const forbidden = (message = "You don't have permission to do that") => new ApiError(403, "FORBIDDEN", message);
export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
export const rateLimited = (message = "Too many requests — please wait and try again") =>
  new ApiError(429, "RATE_LIMITED", message);
export const pinInvalid = (message: string) => new ApiError(401, "PIN_INVALID", message);
export const pinLocked = (message: string) => new ApiError(423, "PIN_LOCKED", message);
export const limitExceeded = (message: string) => new ApiError(422, "LIMIT_EXCEEDED", message);
export const insufficientFunds = (message = "Insufficient funds") => new ApiError(422, "INSUFFICIENT_FUNDS", message);
export const providerUnavailable = (message = "The provider is unavailable — no money was moved. Please try again later.") =>
  new ApiError(502, "PROVIDER_UNAVAILABLE", message);

// Customer-facing compliance messages are deliberately generic: AML rules
// prohibit "tipping off" a customer that they are under suspicion.
export const complianceBlock = () =>
  new ApiError(422, "COMPLIANCE_BLOCK", "This payment can't be completed. Please contact support if you need help.");
export const accountRestricted = () =>
  new ApiError(403, "ACCOUNT_RESTRICTED", "Your account is restricted. Please contact support.");
