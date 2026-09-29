import type { z } from "zod";

export interface ApiRequest<TBody = undefined> {
  method: "GET" | "POST" | "PATCH";
  path: string;
  routeTemplate: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  token?: string;
  correlationId: string;
}

export interface ApiTransport {
  request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T>;
}
