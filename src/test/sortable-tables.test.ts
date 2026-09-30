import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: async () => ({
    user: { id: state.userId },
    grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId),
  }),
}));
import type { DataColumn } from "@/components/data-table/data-table";
import type { SortState } from "@/components/data-table/sorting";
import { listUsersAction } from "@/features/admin/actions";
import { staffColumns } from "@/features/admin/users/columns";
import { staffLookups } from "@/features/admin/users/sort-values";
import { listAuditAction } from "@/features/audit/actions";
import { auditColumns } from "@/features/audit/trail/columns";
import { listGrantsAction } from "@/features/grants/actions";
import { grantColumns } from "@/features/grants/components";
import { listParticipantsAction } from "@/features/participants/actions";
import { participantColumns } from "@/features/participants/registry/columns";
import { listReferralsAction } from "@/features/referrals/actions";
import { referralColumns } from "@/features/referrals/queue/columns";
import { listReportsAction } from "@/features/reporting/actions";
import { reportColumns } from "@/features/reporting/calendar/columns";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => {
  resetMockStore();
  state.userId = 1;
  state.token = issueMockToken(1);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- column sets of different row types
const tables: Record<string, readonly DataColumn<any>[]> = {
  participants: participantColumns((id) => `Pillar ${id}`),
  referrals: referralColumns,
  grants: grantColumns,
  reports: reportColumns,
  staff: staffColumns(staffLookups([], [], [])),
  audit: auditColumns,
};

describe("API-paged tables", () => {
  it.each(Object.entries(tables))("makes every %s column sortable", (_name, columns) => {
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) expect(column.sortValue, column.id).toBeTypeOf("function");
  });
});

/** Reads every page of a sorted list through its action, as the pager would. */
async function readAll<T>(
  list: (query: { page: number; pageSize: number; sort?: SortState }) => Promise<{
    success: boolean;
    data?: { items: T[]; totalPages: number; totalItems: number } | null;
  }>,
  sort: SortState,
  pageSize = 3
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await list({ page, pageSize, sort });
    expect(result.success).toBe(true);
    rows.push(...result.data!.items);
    if (page >= result.data!.totalPages) {
      expect(rows).toHaveLength(result.data!.totalItems);
      return rows;
    }
  }
}
const ascending = (values: (string | number)[]) =>
  values.every(
    (value, index) =>
      index === 0 ||
      (typeof value === "number"
        ? (values[index - 1] as number) <= value
        : String(values[index - 1]).localeCompare(String(value), "en", {
            numeric: true,
            sensitivity: "base",
          }) <= 0)
  );

describe("sorting across pages", () => {
  it("orders the whole participant registry, not one page at a time", async () => {
    const byCounty = await readAll(listParticipantsAction, { by: "county", order: "asc" });
    expect(byCounty.length).toBeGreaterThan(3);
    expect(ascending(byCounty.map((row) => `${row.county} ${row.ward}`))).toBe(true);
    const newest = await readAll(listParticipantsAction, { by: "registered", order: "desc" });
    expect(ascending(newest.map((row) => Date.parse(row.registered)).reverse())).toBe(true);
    // The same people either way: sorting reorders, it never filters.
    expect(newest.map((row) => row.id).sort()).toEqual(byCounty.map((row) => row.id).sort());
  });

  it("keeps the other filters when sorting", async () => {
    const all = await listParticipantsAction({ page: 1, pageSize: 100 });
    const filtered = await listParticipantsAction({
      page: 1,
      pageSize: 100,
      pillarId: 2,
      sort: { by: "status", order: "asc" },
    });
    expect(filtered.data!.totalItems).toBeLessThan(all.data!.totalItems);
    expect(filtered.data!.items.every((row) => row.pillarIds.includes(2))).toBe(true);
  });

  it("sorts grants by amount and sign-off stage rather than by their text", async () => {
    const byAmount = await readAll(listGrantsAction, { by: "requested", order: "asc" });
    expect(
      ascending(byAmount.map((row) => Number(row.requestedAmount.replace(/[^\d.]/g, ""))))
    ).toBe(true);
    const order = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];
    const byStage = await readAll(listGrantsAction, { by: "stage", order: "asc" });
    expect(
      ascending(byStage.map((row) => (order.includes(row.status) ? order.indexOf(row.status) : 4)))
    ).toBe(true);
  });

  it("sorts referrals, reports and staff by a displayed column", async () => {
    const referrals = await readAll(listReferralsAction, { by: "route", order: "asc" });
    expect(ascending(referrals.map((row) => `${row.fromPillar} ${row.destinationName}`))).toBe(
      true
    );
    const reports = await readAll(listReportsAction, { by: "due", order: "asc" });
    expect(ascending(reports.map((row) => Date.parse(row.dueDate)))).toBe(true);
    const staff = await readAll(listUsersAction, { by: "staff", order: "desc" });
    expect(ascending(staff.map((row) => `${row.first_name} ${row.last_name}`).reverse())).toBe(
      true
    );
  });

  it("sorts staff by the roles they hold", async () => {
    const staff = await readAll(listUsersAction, { by: "roles", order: "asc" }, 100);
    const names = staff.map((row) => row.username);
    // A Case Officer sorts before a System Administrator; accounts with no role come last.
    expect(names.indexOf("cynthia.chelimo")).toBeLessThan(names.indexOf("judy.mwangi"));
  });

  it("sorts the audit trail by time on the API and by other columns here", async () => {
    await listParticipantsAction({ page: 1, pageSize: 1 });
    const oldest = await readAll(listAuditAction, { by: "when", order: "asc" }, 25);
    expect(ascending(oldest.map((row) => Date.parse(row.performed_at)))).toBe(true);
    const byAction = await readAll(listAuditAction, { by: "action", order: "asc" }, 25);
    expect(ascending(byAction.map((row) => row.action))).toBe(true);
    expect(byAction).toHaveLength(oldest.length);
  });

  it("ignores a sort on a column that does not exist", async () => {
    const plain = await listReferralsAction({ page: 1, pageSize: 5 });
    const bogus = await listReferralsAction({
      page: 1,
      pageSize: 5,
      sort: { by: "password_hash", order: "asc" } as never,
    });
    expect(bogus.data!.items.map((row) => row.id)).toEqual(plain.data!.items.map((row) => row.id));
  });

  it("refuses an out-of-range page size when sorting", async () => {
    const result = await listGrantsAction({
      page: 1,
      pageSize: 5000,
      sort: { by: "applicant", order: "asc" },
    });
    expect(result.success).toBe(false);
  });
});
