import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createSubmissionsApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());

describe("submission adapter", () => {
  it("does not expose free-text flagged notes in a list", async () => {
    const rows = await createSubmissionsApi(createPortalApiClient(), issueMockToken(1)).list();
    const flagged = rows.items.find(row => row.status === "Flagged")!;
    expect(flagged.flag).toBe("Requires follow-up");
    expect(flagged.flag).not.toContain("Sauti ya Mama");
  });
});
