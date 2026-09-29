import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasPermission } from "./grants";

describe("client-safe grant checks", () => {
  it("honours pillar scope", () => {
    const grants = [{ permissionCode: "REFERRAL_ACCEPT", pillarId: 2 }];
    expect(hasPermission(grants, "REFERRAL_ACCEPT", { pillarId: 2 })).toBe(true);
    expect(hasPermission(grants, "REFERRAL_ACCEPT", { pillarId: 3 })).toBe(false);
  });

  it("does not pull server-only modules into client bundles", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/auth/grants.ts"), "utf8");
    expect(source).not.toMatch(/mock-api|server-only|next\/headers/);
  });
});
