export type ErrorCode =
  | "SESSION_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "SESSION_NOT_ANALYZED"
  | "SESSION_NOT_COMPLETED"
  | "INVALID_ANSWER_ID"
  | "MODEL_INVALID_RESPONSE"
  | "TIER_LIMIT_EXCEEDED"
  | "FEATURE_NOT_AVAILABLE";

export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}
