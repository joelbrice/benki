import type { ApiErrorBody } from "@benki/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorBody["error"]["code"];

  constructor(status: number, code: ApiErrorBody["error"]["code"], message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export const badRequest = (message: string) => new ApiError(400, "VALIDATION_ERROR", message);
export const unauthorized = (message = "Missing or invalid auth token") =>
  new ApiError(401, "AUTH_ERROR", message);
export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);
export const complianceBlock = (message: string) => new ApiError(422, "COMPLIANCE_BLOCK", message);
export const insufficientFunds = (message = "Insufficient funds") =>
  new ApiError(422, "INSUFFICIENT_FUNDS", message);
