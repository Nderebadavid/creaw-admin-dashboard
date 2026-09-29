import type { z } from "zod";
import type { ApiRequest, ApiTransport } from "./transport";

export type ApiClientRequest<TBody = undefined> = Omit<ApiRequest<TBody>, "correlationId"> & {
  correlationId?: string;
};

export class ApiClient {
  constructor(private readonly transport: ApiTransport) {}

  request<T>(request: ApiClientRequest<unknown>, schema: z.ZodType<T>): Promise<T> {
    return this.transport.request(
      { ...request, correlationId: request.correlationId || crypto.randomUUID() },
      schema
    );
  }
}

export function createApiClient(transport: ApiTransport): ApiClient {
  return new ApiClient(transport);
}
