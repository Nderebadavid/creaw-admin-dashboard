export interface ApiOperationEvent {
  method: string;
  path: string;
  correlationId?: string;
  status?: number;
  outcome?: string;
  details?: unknown;
}

const sensitiveKey = /password|token|id_number|phone|salary|amount|notes|authorization|secret|cookie/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : redact(entry),
      ])
    );
  }
  return value;
}

export function logApiOperation(event: ApiOperationEvent): void {
  console.info("[api]", redact(event));
}
