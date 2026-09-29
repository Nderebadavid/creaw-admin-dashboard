import type { z } from "zod";
import { logApiOperation } from "./logger";
import type { ApiRequest, ApiTransport } from "./transport";

export type MockRequestHandler = (request: ApiRequest<unknown>) => unknown | Promise<unknown>;

export class MockApiTransport implements ApiTransport {
  constructor(private readonly handler: MockRequestHandler) {}

  async request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T> {
    const trace = {
      method: request.method,
      routeTemplate: request.routeTemplate,
      correlationId: request.correlationId,
    };
    const startedAt = performance.now();
    try {
      const response = await this.handler(request);
      const result = schema.parse(response);
      logApiOperation({ ...trace, outcome: "success", durationMs: performance.now() - startedAt });
      return result;
    } catch (error) {
      logApiOperation({ ...trace, outcome: "error", durationMs: performance.now() - startedAt });
      throw error;
    }
  }
}
