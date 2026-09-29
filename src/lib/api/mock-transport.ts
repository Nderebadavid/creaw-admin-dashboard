import type { z } from "zod";
import { logApiOperation } from "./logger";
import type { ApiRequest, ApiTransport } from "./transport";

export type MockRequestHandler = (request: ApiRequest<unknown>) => unknown | Promise<unknown>;

export class MockApiTransport implements ApiTransport {
  constructor(private readonly handler: MockRequestHandler) {}

  async request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T> {
    const trace = {
      method: request.method,
      path: request.path.split("?")[0],
      correlationId: request.correlationId,
    };
    try {
      const response = await this.handler(request);
      const result = schema.parse(response);
      logApiOperation({ ...trace, outcome: "success" });
      return result;
    } catch (error) {
      logApiOperation({ ...trace, outcome: "error" });
      throw error;
    }
  }
}
