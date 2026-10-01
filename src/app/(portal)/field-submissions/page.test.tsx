import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: vi.fn(async () => ({
    user: { firstName: "Lead" },
    grants: [
      { permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: 1 },
      { permissionCode: "FIELD_SUBMISSION_REVIEW", pillarId: 1 },
      { permissionCode: "REPORT_EXPORT_CSV", pillarId: 1 },
    ],
  })),
}));
// The API returns only the submissions the signed-in user may see.
vi.mock("@/features/submissions/api", () => ({
  submissionsApi: {
    list: vi.fn(async () => ({
      items: [
        {
          id: 1,
          title: "Scoped",
          type: "Case update",
          pillarId: 1,
          pillar: "VAWG",
          captured: "2026-09-27",
          source: "mobile",
          status: "Pending review",
          flag: null,
        },
      ],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
      facets: { review_status: { "Pending review": 1 } },
    })),
  },
}));
import FieldSubmissionsPage from "./page";

describe("field submissions route", () => {
  it("composes the page the API returned with scoped review and export", async () => {
    const html = renderToStaticMarkup(await FieldSubmissionsPage());
    expect(html).toContain("Scoped");
    expect(html).toContain("Export CSV");
    expect(html).not.toContain("You do not have review permission");
  });
});
