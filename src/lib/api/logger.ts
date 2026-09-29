export interface ApiOperationEvent {
  method: string;
  routeTemplate: string;
  correlationId?: string;
  status?: number;
  outcome?: string;
  details?: unknown;
}

const sensitiveKey = /password|token|id_number|phone|salary|amount|notes|authorization|secret|cookie/i;
const dynamicSegment = /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|[a-z]{1,2}\d+)$/i;

export function sanitizeRouteTemplate(routeTemplate: string): string {
  return routeTemplate
    .split(/[?#]/, 1)[0]
    .split("/")
    .map((segment) => (dynamicSegment.test(segment) ? ":id" : segment))
    .join("/");
}

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
  console.info(
    "[api]",
    redact({
      method: event.method,
      routeTemplate: sanitizeRouteTemplate(event.routeTemplate),
      correlationId: event.correlationId,
      status: event.status,
      outcome: event.outcome,
      details: event.details,
    })
  );
}
