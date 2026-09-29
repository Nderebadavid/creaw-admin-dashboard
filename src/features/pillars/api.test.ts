import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createPillarsApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());

describe("pillar API", () => {
  it("returns not-found for an unsupported pillar code", async () => {
    await expect(createPillarsApi(createPortalApiClient(), issueMockToken(1)).get("unknown"))
      .rejects.toMatchObject({ status: 404 });
  });

  it("shows only the lead's scoped pillar and rows", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(5));
    const vawg = await api.get("vawg");
    expect(vawg.code).toBe("vawg");
    expect(vawg.records.every(row => row.pillarId === vawg.id)).toBe(true);
    await expect(api.get("wee")).rejects.toMatchObject({ status: 403 });
  });
});
