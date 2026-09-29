import type { z } from "zod";
import type { ApiRequest, ApiTransport } from "./transport";

export class ApiClient {
  constructor(private readonly transport: ApiTransport) {}

  request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T> {
    return this.transport.request(request, schema);
  }
}

export function createApiClient(transport: ApiTransport): ApiClient {
  return new ApiClient(transport);
}
