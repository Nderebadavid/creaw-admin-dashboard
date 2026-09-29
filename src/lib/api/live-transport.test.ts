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
      new Response(JSON.stringify({ resultCode: 200, success: true, message: "OK", data: { id: 7 } }), {
        status: 200,
      })
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
        { method: "GET", path: "/participants" },
        z.unknown()
      )
    ).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  it("normalizes timeouts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));

    await expect(
      new LiveApiTransport("https://example.test").request(
        { method: "GET", path: "/participants" },
        z.unknown()
      )
    ).rejects.toMatchObject({ kind: "timeout" } satisfies Partial<ApiTransportError>);
  });

  it("rejects response data that violates its schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "wrong" }))));

    await expect(
      new LiveApiTransport("https://example.test").request(
        { method: "GET", path: "/participants" },
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
      { method: "POST", path: "/participants", body: { firstName: "Faith" } },
      z.object({ id: z.string(), count: z.number() })
    );

    expect(result).toEqual({ id: "/participants", count: 2 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates responses from injected mock handlers", async () => {
    const transport = new MockApiTransport(() => ({ id: "wrong" }));

    await expect(
      transport.request({ method: "GET", path: "/participants" }, z.object({ id: z.number() }))
    ).rejects.toThrow();
  });

  it("logs failed mock operations with their correlation ID", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const transport = new MockApiTransport(() => {
      throw new Error("handler failed");
    });

    await expect(
      transport.request(
        { method: "PATCH", path: "/participants/1", correlationId: "req-456" },
        z.unknown()
      )
    ).rejects.toThrow("handler failed");
    expect(logSpy).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({ correlationId: "req-456", outcome: "error" })
    );
  });
});
