import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("not found"); } }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: vi.fn(async () => ({ user: { firstName: "Lead" }, grants: [{ permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: 1 }, { permissionCode: "FIELD_SUBMISSION_REVIEW", pillarId: 1 }, { permissionCode: "REPORT_EXPORT_CSV", pillarId: 1 }] })) }));
vi.mock("@/features/submissions/api", () => ({ submissionsApi: { listAll: vi.fn(async () => [
  { id: 1, title: "Scoped", type: "Case update", pillarId: 1, pillar: "VAWG", captured: "2026-09-27", source: "mobile", status: "Pending review", flag: null },
  { id: 2, title: "Outside", type: "Grant update", pillarId: 2, pillar: "WEE", captured: "2026-09-27", source: "mobile", status: "Pending review", flag: null },
]) } }));
import FieldSubmissionsPage from "./page";

describe("field submissions route", () => {
  it("composes scoped review/export and only authorized rows", async () => {
    const html = renderToStaticMarkup(await FieldSubmissionsPage());
    expect(html).toContain("Scoped");
    expect(html).not.toContain("Outside");
    expect(html).toContain("Export CSV");
    expect(html).not.toContain("You do not have review permission");
  });
});
