import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
const calls: string[] = [];
vi.mock("@/lib/mock-api/handlers", async (original) => {
  const actual = await original<typeof import("@/lib/mock-api/handlers")>();
  return {
    handleMockRequest: async (request: { method: string; routeTemplate: string }) => {
      calls.push(`${request.method} ${request.routeTemplate}`);
      return actual.handleMockRequest(request as never);
    },
  };
});
import { renderToStaticMarkup } from "react-dom/server";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

// The API contract promises a fixed number of calls per screen, whatever the data
// size: lists page on the server, names arrive with rows, summaries are computed
// server-side. Each page is rendered twice, once with the demo data and once with
// about a thousand extra records, and must make the same number of calls, within
// its budget, both times.

type Page = { default: (props: never) => Promise<React.ReactElement> };
const pages: {
  name: string;
  load: () => Promise<Page>;
  params?: object;
  budget: number;
}[] = [
  {
    name: "dashboard",
    load: () => import("@/app/(portal)/dashboard/page"),
    budget: 3,
  },
  {
    name: "participants",
    load: () => import("@/app/(portal)/participants/page"),
    budget: 4,
  },
  {
    name: "referrals",
    load: () => import("@/app/(portal)/referrals/page"),
    budget: 4,
  },
  { name: "grants", load: () => import("@/app/(portal)/grants/page"), budget: 4 },
  { name: "projects", load: () => import("@/app/(portal)/projects/page"), budget: 4 },
  { name: "donors", load: () => import("@/app/(portal)/donors/page"), budget: 4 },
  {
    name: "grant detail",
    load: () => import("@/app/(portal)/grants/[id]/page"),
    params: { id: "1" },
    budget: 5,
  },
  {
    name: "assessments",
    load: () => import("@/app/(portal)/assessments/page"),
    budget: 4,
  },
  {
    name: "reporting",
    load: () => import("@/app/(portal)/reporting/page"),
    budget: 4,
  },
  { name: "audit", load: () => import("@/app/(portal)/audit/page"), budget: 4 },
  {
    name: "field submissions",
    load: () => import("@/app/(portal)/field-submissions/page"),
    budget: 4,
  },
  {
    name: "admin users",
    load: () => import("@/app/(portal)/admin/users/page"),
    budget: 4,
  },
  {
    name: "admin providers",
    load: () => import("@/app/(portal)/admin/providers/page"),
    budget: 4,
  },
  {
    name: "admin permissions",
    load: () => import("@/app/(portal)/admin/permissions/page"),
    budget: 4,
  },
  {
    name: "admin pipelines",
    load: () => import("@/app/(portal)/admin/pipelines/page"),
    budget: 4,
  },
  {
    name: "admin lookups",
    load: () => import("@/app/(portal)/admin/lookups/[table]/page"),
    params: { table: "ward" },
    budget: 4,
  },
  ...["vawg", "wee", "srhr", "skilling", "wros"].map((pillar) => ({
    name: `pillar ${pillar}`,
    load: () => import("@/app/(portal)/pillars/[pillar]/page"),
    params: { pillar },
    budget: 6,
  })),
];

/** Roughly a thousand extra records spread over the tables the screens list. */
function growData() {
  const store = getMockStore();
  const now = new Date().toISOString();
  const base = {
    created_at: now,
    updated_at: now,
    status: "ACTIVE",
    status_description: null,
    is_deleted: false,
  };
  const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((row) => row.id)) + 1;
  for (let i = 0; i < 300; i += 1) {
    const participant = {
      ...base,
      id: nextId(store.participant),
      first_name: `Load${i}`,
      middle_name: null,
      last_name: "Tester",
      gender: "female",
      date_of_birth: null,
      phone_number: null,
      id_number: null,
      id_number_type: "none",
      ward_id: store.ward[0].id,
      is_person_with_disability: false,
      is_refugee: false,
      is_consent_given: true,
      remarks: null,
      sync_ref: null,
    };
    store.participant.push(participant as never);
    const pillarId = (i % 6) + 1;
    store.enrollment.push({
      ...base,
      id: nextId(store.enrollment),
      participant_id: participant.id,
      organisation_id: null,
      pillar_id: pillarId,
      entry_category: "Load test",
    } as never);
  }
  for (let i = 0; i < 200; i += 1)
    store.audit_logs.push({ ...store.audit_logs[0], id: nextId(store.audit_logs) } as never);
  const session = store.activity_session.find((row) => row.pillar_id === 3)!;
  for (let i = 0; i < 200; i += 1)
    store.activity_session.push({ ...session, id: nextId(store.activity_session) } as never);
}

async function countCalls(page: (typeof pages)[number], grow: boolean) {
  resetMockStore();
  if (grow) growData();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
  calls.length = 0;
  const Page = (await page.load()).default;
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve(page.params ?? {}),
      searchParams: Promise.resolve({}),
    } as never)
  );
  return calls.length;
}

describe("API calls per screen", () => {
  for (const page of pages) {
    it(`${page.name} stays within ${page.budget} calls at any data size`, async () => {
      const small = await countCalls(page, false);
      const large = await countCalls(page, true);
      expect({ small, large }).toEqual({ small: large, large });
      expect(small).toBeLessThanOrEqual(page.budget);
    }, 60000);
  }
});
