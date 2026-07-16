export type NianLunErrorCode =
  | "cancelled"
  | "empty_answer"
  | "http_error"
  | "invalid_json"
  | "invalid_response"
  | "invalid_url"
  | "offline"
  | "stream_unavailable"
  | "timeout";

export class NianLunError extends Error {
  readonly code: NianLunErrorCode;
  readonly retryable: boolean;

  constructor(code: NianLunErrorCode, message: string, retryable = true) {
    super(message);
    this.name = "NianLunError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function redactSensitive(value: string, token?: string): string {
  let redacted = value
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:access[_-]?token|authorization|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    );
  if (token) {
    redacted = redacted.split(token).join("[REDACTED]");
  }
  return redacted;
}

export function safeErrorMessage(error: unknown, token?: string): string {
  if (error instanceof NianLunError) {
    return redactSensitive(error.message, token);
  }
  if (error instanceof Error) {
    return redactSensitive(error.message, token);
  }
  return "年轮服务暂时不可用，请检查连接后重试";
}
export function redactSensitiveText(value: string, token?: string): string {
  let safe = value.replace(
    new RegExp("Bearer\\s+[A-Za-z0-9._~+/-]+", "gi"),
    "Bearer [REDACTED]",
  );
  safe = safe.replace(/(token\s*[=:]\s*)[^\s;,]+/gi, "$1[REDACTED]");
  if (token) safe = safe.split(token).join("[REDACTED]");
  return safe;
}
