import { ZodError, type z } from "zod";
import { logApiOperation } from "./logger";
import type { ApiRequest, ApiTransport } from "./transport";

export type ApiTransportErrorKind = "http" | "timeout" | "network" | "invalid-response";

export class ApiTransportError extends Error {
  constructor(
    public readonly kind: ApiTransportErrorKind,
    message: string,
    public readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ApiTransportError";
  }
}

export class LiveApiTransport implements ApiTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 10000
  ) {}

  async request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${request.path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {};
    if (request.token) headers.Authorization = `Bearer ${request.token}`;
    headers["x-correlation-id"] = request.correlationId;
    if (request.body !== undefined) headers["Content-Type"] = "application/json";

    const trace = {
      method: request.method,
      routeTemplate: request.routeTemplate,
      correlationId: request.correlationId,
    };

    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new ApiTransportError(response.ok ? "invalid-response" : "http", response.ok ? "API response is not valid JSON" : `API request failed with status ${response.status}`, response.status, {
          cause: error,
        });
      }

      try {
        const parsed = schema.parse(payload);
        logApiOperation({ ...trace, status: response.status, outcome: response.ok ? "success" : "http" });
        return parsed;
      } catch (error) {
        if (!(error instanceof ZodError)) throw error;
        throw new ApiTransportError("invalid-response", "API response does not match its schema", response.status, {
          cause: error,
        });
      }
    } catch (error) {
      const errorName =
        error !== null && typeof error === "object" && "name" in error ? error.name : undefined;
      const normalized =
        error instanceof ApiTransportError
          ? error
          : errorName === "TimeoutError" || errorName === "AbortError"
            ? new ApiTransportError("timeout", "API request timed out", undefined, { cause: error })
            : new ApiTransportError("network", "API request could not be completed", undefined, {
                cause: error,
              });
      logApiOperation({ ...trace, status: normalized.status, outcome: normalized.kind });
      throw normalized;
    }
  }
}
