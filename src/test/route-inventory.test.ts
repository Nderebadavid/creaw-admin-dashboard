import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getSession = vi.fn();
vi.mock("@/lib/auth/session-server", () => ({ getSession }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const root = join(process.cwd(), "src");
const app = join(root, "app");

// The designer's 13 authenticated screen types plus the provider directory, projects and donors; dynamic variants count once.
const screenRoutes: Record<string, string[]> = {
  dashboard: ["(portal)/dashboard/page.tsx"],
  fieldSubmissions: ["(portal)/field-submissions/page.tsx"],
  pillar: ["(portal)/pillars/[pillar]/page.tsx"],
  participants: ["(portal)/participants/page.tsx"],
  referrals: ["(portal)/referrals/page.tsx"],
  grants: ["(portal)/grants/page.tsx", "(portal)/grants/[id]/page.tsx"],
  assessments: ["(portal)/assessments/page.tsx"],
  reporting: ["(portal)/reporting/page.tsx"],
  audit: ["(portal)/audit/page.tsx"],
  users: ["(portal)/admin/users/page.tsx"],
  projects: ["(portal)/projects/page.tsx"],
  donors: ["(portal)/donors/page.tsx"],
  providers: ["(portal)/admin/providers/page.tsx"],
  permissions: ["(portal)/admin/permissions/page.tsx"],
  pipelines: ["(portal)/admin/pipelines/page.tsx"],
  lookups: ["(portal)/admin/lookups/[table]/page.tsx"],
};

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return /^(page|route)\.tsx?$/.test(name) ? [relative(app, path).split(sep).join("/")] : [];
  });
}

beforeEach(() => {
  getSession.mockReset();
});

describe("route inventory", () => {
  it("implements exactly the 16 authenticated screen types plus login and root", () => {
    expect(Object.keys(screenRoutes)).toHaveLength(16);
    const expected = [
      ...Object.values(screenRoutes).flat(),
      "(auth)/login/page.tsx",
      "page.tsx",
    ].sort();
    expect(pageFiles(app).sort()).toEqual(expected);
  });

  it("has no VSLA starter routes or session/navigation modules", () => {
    for (const path of [
      "app/(dashboard)",
      "app/api/auth",
      "components/features/member",
      "lib/mock-db",
      "lib/auth/current-user.ts",
      "lib/auth/current-role.tsx",
      "types/navigation.ts",
    ])
      expect(existsSync(join(root, path)), path).toBe(false);
  });
});

describe("root route", () => {
  it("sends a signed-in user to the dashboard", async () => {
    getSession.mockResolvedValue({ user: { id: 1 }, grants: [] });
    const { default: Home } = await import("@/app/page");
    await expect(Home()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sends a visitor without a valid session to login", async () => {
    getSession.mockResolvedValue(null);
    const { default: Home } = await import("@/app/page");
    await expect(Home()).rejects.toThrow("REDIRECT:/login");
  });
});
