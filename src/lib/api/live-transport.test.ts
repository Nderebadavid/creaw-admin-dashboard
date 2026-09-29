import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiTransportError, LiveApiTransport } from "./live-transport";
import { MockApiTransport } from "./mock-transport";
import { createApiClient } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LiveApiTransport", () => {
  it("serializes query values and forwards auth and correlation headers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ resultCode: 200, success: true, message: "OK", data: { id: 7 } }),
        {
          status: 200,
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const schema = z.object({
      resultCode: z.number(),
      success: z.boolean(),
      message: z.string(),
      data: z.object({ id: z.number() }),
    });

    const result = await new LiveApiTransport("https://example.test/api/v1", 2500).request(
      {
        method: "GET",
        path: "/participants",
        routeTemplate: "/participants",
        query: { page: 1, active: false, missing: undefined },
        token: "secret",
        correlationId: "req-123",
      },
      schema
    );

    expect(result.data.id).toBe(7);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://example.test/api/v1/participants?page=1&active=false");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret",
      "x-correlation-id": "req-123",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("normalizes HTTP errors with their status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status: 503 })));

    await expect(
      new LiveApiTransport("https://example.test").request(
        {
          method: "GET",
          path: "/participants",
          routeTemplate: "/participants",
          correlationId: "req-http",
        },
        z.unknown()
      )
    ).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  it("returns a validated API error envelope from an HTTP 403 response", async () => {
    const envelope = {
      resultCode: 403,
      success: false,
      message: "Invalid credentials",
      data: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 403 }))
    );
    const schema = z.object({
      resultCode: z.number(),
      success: z.boolean(),
      message: z.string(),
      data: z.null(),
    });
    await expect(
      new LiveApiTransport("https://example.test").request(
        {
          method: "POST",
          path: "/auth/login",
          routeTemplate: "/auth/login",
          correlationId: "req-credential",
        },
        schema
      )
    ).resolves.toEqual(envelope);
  });

  it("rejects an HTTP error body that does not match the response schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ detail: "wrong shape" }), { status: 422 }))
    );
    await expect(
      new LiveApiTransport("https://example.test").request(
        {
          method: "POST",
          path: "/auth/login",
          routeTemplate: "/auth/login",
          correlationId: "req-shape",
        },
        z.object({ resultCode: z.number(), success: z.boolean(), message: z.string() })
      )
    ).rejects.toMatchObject({ kind: "invalid-response", status: 422 });
  });

  it("uses the concrete path for fetch but only the route template for logs", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchSpy);

    await new LiveApiTransport("https://example.test").request(
      {
        method: "GET",
        path: "/participants/1",
        routeTemplate: "/participants/:id",
        correlationId: "req-789",
      },
      z.object({ ok: z.boolean() })
    );

    expect(String(fetchSpy.mock.calls[0][0])).toContain("/participants/1");
    expect(JSON.stringify(logSpy.mock.calls)).toContain("/participants/:id");
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("/participants/1");
  });

  it("logs the duration of a live call", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    await new LiveApiTransport("https://api.example.test").request(
      { method: "GET", path: "/dashboard", routeTemplate: "/dashboard", correlationId: "req-live" },
      z.object({ ok: z.boolean() })
    );

    expect(logSpy).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        feature: "dashboard",
        outcome: "success",
        durationMs: expect.any(Number),
      })
    );
  });

  it("normalizes timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"))
    );

    await expect(
      new LiveApiTransport("https://example.test").request(
        {
          method: "GET",
          path: "/participants",
          routeTemplate: "/participants",
          correlationId: "req-timeout",
        },
        z.unknown()
      )
    ).rejects.toMatchObject({ kind: "timeout" } satisfies Partial<ApiTransportError>);
  });

  it("rejects response data that violates its schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "wrong" })))
    );

    await expect(
      new LiveApiTransport("https://example.test").request(
        {
          method: "GET",
          path: "/participants",
          routeTemplate: "/participants",
          correlationId: "req-invalid",
        },
        z.object({ id: z.number() })
      )
    ).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("injected API boundary", () => {
  it("dispatches mock requests through the injected handler without fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const client = createApiClient(
      new MockApiTransport((request) => ({ id: request.path, count: 2 }))
    );

    const result = await client.request(
      {
        method: "POST",
        path: "/participants",
        routeTemplate: "/participants",
        body: { firstName: "Faith" },
      },
      z.object({ id: z.string(), count: z.number() })
    );

    expect(result).toEqual({ id: "/participants", count: 2 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates responses from injected mock handlers", async () => {
    const transport = new MockApiTransport(() => ({ id: "wrong" }));

    await expect(
      transport.request(
        {
          method: "GET",
          path: "/participants",
          routeTemplate: "/participants",
          correlationId: "req-invalid-mock",
        },
        z.object({ id: z.number() })
      )
    ).rejects.toThrow();
  });

  it("logs failed mock operations with their correlation ID", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const transport = new MockApiTransport(() => {
      throw new Error("handler failed");
    });

    await expect(
      transport.request(
        {
          method: "PATCH",
          path: "/participants/1",
          routeTemplate: "/participants/:id",
          correlationId: "req-456",
        },
        z.unknown()
      )
    ).rejects.toThrow("handler failed");
    expect(logSpy).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        correlationId: "req-456",
        routeTemplate: "/participants/:id",
        outcome: "error",
        durationMs: expect.any(Number),
      })
    );
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("/participants/1");
  });

  it("generates a correlation ID before handing a request to a transport", async () => {
    let seenCorrelationId: string | undefined;
    const client = createApiClient(
      new MockApiTransport((request) => {
        seenCorrelationId = request.correlationId;
        return { ok: true };
      })
    );

    await client.request(
      { method: "GET", path: "/participants/1", routeTemplate: "/participants/:id" },
      z.object({ ok: z.boolean() })
    );

    expect(seenCorrelationId).toBeTruthy();
    expect(seenCorrelationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("preserves a caller-supplied correlation ID", async () => {
    let seenCorrelationId: string | undefined;
    const client = createApiClient(
      new MockApiTransport((request) => {
        seenCorrelationId = request.correlationId;
        return { ok: true };
      })
    );

    await client.request(
      {
        method: "GET",
        path: "/participants/1",
        routeTemplate: "/participants/:id",
        correlationId: "upstream-123",
      },
      z.object({ ok: z.boolean() })
    );

    expect(seenCorrelationId).toBe("upstream-123");
  });

  it("never logs an unknown route template passed through the transport", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const transport = new MockApiTransport(() => ({ ok: true }));

    await transport.request(
      {
        method: "GET",
        path: "/participants/abc123",
        routeTemplate: "/participants/abc123" as never,
        correlationId: "req-unknown",
      },
      z.object({ ok: z.boolean() })
    );

    const serialized = JSON.stringify(logSpy.mock.calls);
    expect(serialized).toContain("[invalid-route-template]");
    expect(serialized).not.toContain("/participants/abc123");
  });
});
