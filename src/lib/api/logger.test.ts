import { afterEach, describe, expect, it, vi } from "vitest";
import { logApiOperation } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("logApiOperation", () => {
  it("redacts sensitive keys at every depth while retaining trace context", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logApiOperation({
      method: "POST",
      routeTemplate: "/participants",
      correlationId: "req-123",
      details: {
        password: "pw",
        accessToken: "token-value",
        id_number: "12345",
        participantPhone: "0700000000",
        salary: 200,
        amount: 300,
        notes: "private",
        nested: [{ phone_number: "0712345678", safe: "visible" }],
      },
    });

    expect(spy).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(spy.mock.calls[0]);
    expect(serialized).toContain("req-123");
    expect(serialized).toContain("visible");
    expect(serialized).not.toContain("0700000000");
    expect(serialized).not.toContain("token-value");
    expect(serialized).not.toContain("private");
    expect(serialized.match(/\[REDACTED\]/g)).toHaveLength(8);
  });

  it.each([
    "/participants/abc123",
    "/participants/1",
    "/participants/p1",
    "/grants/g2",
    "/referrals/f3",
    "/participants/550e8400-e29b-41d4-a716-446655440000",
    "/participants/abcdef0123456789",
    "/admin/lookups/:table",
  ])("replaces unknown route template %s with a fixed marker", (routeTemplate) => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logApiOperation({ method: "GET", routeTemplate: routeTemplate as never });

    const serialized = JSON.stringify(spy.mock.calls[0]);
    expect(serialized).toContain("[invalid-route-template]");
    expect(serialized).not.toContain(routeTemplate);
  });

  it("logs an exact known catalogue route", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logApiOperation({ method: "GET", routeTemplate: "/lookups/:table" });

    expect(JSON.stringify(spy.mock.calls[0])).toContain("/lookups/:table");
  });
});
