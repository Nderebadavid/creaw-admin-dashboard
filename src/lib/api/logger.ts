import { API_ROUTE_TEMPLATES, type ApiRouteTemplate } from "./transport";

export interface ApiOperationEvent {
  method: string;
  routeTemplate: ApiRouteTemplate;
  correlationId?: string;
  status?: number;
  outcome?: string;
  details?: unknown;
}

const sensitiveKey = /password|token|id_number|phone|salary|amount|notes|authorization|secret|cookie/i;
const approvedTemplates: ReadonlySet<string> = new Set(API_ROUTE_TEMPLATES);

function safeRouteTemplate(value: unknown): ApiRouteTemplate | "[invalid-route-template]" {
  return typeof value === "string" && approvedTemplates.has(value)
    ? (value as ApiRouteTemplate)
    : "[invalid-route-template]";
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
      routeTemplate: safeRouteTemplate(event.routeTemplate),
      correlationId: event.correlationId,
      status: event.status,
      outcome: event.outcome,
      details: event.details,
    })
  );
}
