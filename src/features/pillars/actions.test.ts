import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  createPillarDomainAction,
  createPillarRecordAction,
  updatePillarRecordAction,
} from "./actions";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("pillar mutations", () => {
  it("creates a scoped enrollment and records the change", async () => {
    const before = getMockStore().enrollment.length;
    const result = await createPillarRecordAction("vawg", 1, "Outreach");
    expect(result.success).toBe(true);
    expect(getMockStore().enrollment).toHaveLength(before + 1);
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({
      entity_type: "enrollment",
      action: "CREATE",
    });
  });

  it("updates an existing record in the permitted pillar", async () => {
    const row = getMockStore().enrollment.find((item) => item.pillar_id === 1)!;
    const result = await updatePillarRecordAction("vawg", row.id, "Updated pathway");
    expect(result.success).toBe(true);
    expect(getMockStore().enrollment.find((item) => item.id === row.id)?.entry_category).toBe(
      "Updated pathway"
    );
  });

  it("rejects cross-pillar creation", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(5) });
    const before = getMockStore().enrollment.length;
    const result = await createPillarRecordAction("wee", 1, "Outreach");
    expect(result.success).toBe(false);
    expect(getMockStore().enrollment).toHaveLength(before);
  });
  it("opens a legal case through the scoped domain endpoint", async () => {
    const before = getMockStore().legal_case.length;
    const result = await createPillarDomainAction("vawg", {
      enrollmentId: 1,
      caseTypeId: 2,
      openedDate: "2026-09-29",
    });
    expect(result.success).toBe(true);
    expect(getMockStore().legal_case).toHaveLength(before + 1);
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({
      entity_type: "legal_case",
      action: "CREATE",
    });
  });
  it("creates and enrolls a partner organisation when both grants are present", async () => {
    const before = getMockStore().organisation.length;
    const result = await createPillarDomainAction("wros", {
      name: "Upendo Network",
      legalForm: "ngo",
      entryCategory: "Partner",
    });
    expect(result.success).toBe(true);
    expect(getMockStore().organisation).toHaveLength(before + 1);
    const organisation = getMockStore().organisation.at(-1)!;
    expect(
      getMockStore().enrollment.some(
        (row) => row.organisation_id === organisation.id && row.pillar_id === 5
      )
    ).toBe(true);
  });
  it("rejects a domain create outside the caller's pillar scope", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(5) });
    const before = getMockStore().grant_application.length;
    const result = await createPillarDomainAction("wee", {
      projectId: 1,
      participantId: 2,
      requestedAmount: 1000,
      grantType: "standard",
    });
    expect(result.success).toBe(false);
    expect(getMockStore().grant_application).toHaveLength(before);
  });
  it("creates a grant application in the PREPARED state", async () => {
    const result = await createPillarDomainAction("wee", {
      projectId: 1,
      participantId: 2,
      requestedAmount: 1500,
      grantType: "milestone",
    });
    expect(result.success).toBe(true);
    expect(getMockStore().grant_application.at(-1)?.status).toBe("PREPARED");
  });
  it("requires the existing prepare grant before creating a PREPARED application", async () => {
    const store = getMockStore();
    const preparePermission = store.permission.find(
      (row) => row.code === "GRANT_APPLICATION_PREPARE"
    )!;
    store.role_permission = store.role_permission.filter(
      (row) => !(row.role_id === 7 && row.permission_id === preparePermission.id)
    );
    cookieStore.get.mockReturnValue({ value: issueMockToken(4) });
    const before = store.grant_application.length;
    const result = await createPillarDomainAction("wee", {
      projectId: 1,
      participantId: 2,
      requestedAmount: 1500,
      grantType: "milestone",
    });
    expect(result.success).toBe(false);
    expect(store.grant_application).toHaveLength(before);
  });
  it("creates WEE, SRHR and Skilling records with audited domain writes", async () => {
    const cases = [
      [
        "wee",
        { projectId: 1, participantId: 2, requestedAmount: 1500, grantType: "milestone" },
        "grant_application",
      ],
      [
        "srhr",
        { activityTypeId: 4, sessionDate: "2026-09-29", topic: "Rights outreach", venue: "Clinic" },
        "activity_session",
      ],
      [
        "skilling",
        {
          enrollmentId: 4,
          pathway: "apprenticeship",
          courseName: "Tailoring",
          startDate: "2026-09-29",
        },
        "training_enrollment",
      ],
    ] as const;
    for (const [code, input, table] of cases) {
      const before = getMockStore()[table].length;
      const result = await createPillarDomainAction(code, input);
      expect(result.success, `${code}: ${result.message}`).toBe(true);
      expect(getMockStore()[table]).toHaveLength(before + 1);
      expect(getMockStore().audit_logs.at(-1)).toMatchObject({
        entity_type: table,
        action: "CREATE",
      });
    }
  });
});
