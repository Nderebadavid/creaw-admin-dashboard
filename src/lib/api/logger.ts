import { API_ROUTE_TEMPLATES, type ApiRouteTemplate } from "./transport";

export interface ApiOperationEvent {
  method: string;
  routeTemplate: ApiRouteTemplate;
  correlationId?: string;
  status?: number;
  outcome?: string;
  durationMs?: number;
  details?: unknown;
}

const sensitiveKey =
  /password|token|id_number|phone|salary|amount|notes|authorization|secret|cookie/i;
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
  const routeTemplate = safeRouteTemplate(event.routeTemplate);
  const feature =
    routeTemplate === "[invalid-route-template]" ? routeTemplate : routeTemplate.split("/")[1];
  console.info(
    "[api]",
    redact({
      feature,
      operation: `${event.method} ${routeTemplate}`,
      method: event.method,
      routeTemplate,
      correlationId: event.correlationId,
      status: event.status,
      outcome: event.outcome,
      durationMs: event.durationMs === undefined ? undefined : Math.round(event.durationMs),
      details: event.details,
    })
  );
}
