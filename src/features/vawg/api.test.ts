import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createVawgApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createVawgApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("VAWG legal case register", () => {
  it("maps the court record fields used by the register and drawer", async () => {
    const { cases } = await apiFor(1).workspace();
    expect(cases.items[0]).toMatchObject({
      caseTypeId: getMockStore().legal_case[0].case_type_id,
      court: "Kibera Law Courts",
      assignedOfficer: "Cynthia Chelimo",
      nextCourtDate: "2026-10-03",
      courtFileNumber: "CR 2210/26",
      obNumber: expect.stringMatching(/•+2026$/),
      counsellor: "Mary Achola",
    });
  });

  it("normalises court columns a backend omits to null", async () => {
    const row = getMockStore().legal_case[0] as unknown as Record<string, unknown>;
    for (const key of [
      "court_name",
      "assigned_officer",
      "next_court_date",
      "court_file_number",
      "ob_number",
      "counsellor",
    ])
      delete row[key];
    const { cases } = await apiFor(1).workspace();
    expect(cases.items.find((item) => item.id === row.id)).toMatchObject({
      court: null,
      assignedOfficer: null,
      nextCourtDate: null,
      courtFileNumber: null,
      obNumber: null,
      counsellor: null,
    });
  });

  it("maps a case with no linked advocate to null", async () => {
    const row = getMockStore().legal_case[1] as unknown as Record<string, unknown>;
    delete row.advocate_provider_id;
    const { cases } = await apiFor(1).workspace();
    expect(cases.items.find((item) => item.id === row.id)!.advocate).toBeNull();
  });

  it("updates court record fields through the legal-case resource", async () => {
    const api = apiFor(1);
    const updated = await api.updateCase(1, { court_name: "Milimani Law Courts" });
    expect(updated.success).toBe(true);
    expect(getMockStore().legal_case[0].court_name).toBe("Milimani Law Courts");
  });

  it("names the survivor and case type on each row and pages on the server", async () => {
    const api = apiFor(1);
    const { cases } = await api.workspace();
    expect(cases.totalItems).toBe(getMockStore().legal_case.length);
    const first = cases.items.find((row) => row.id === 1)!;
    expect(first).toMatchObject({ number: "CRW-VAWG-0001", courtStatus: "in_hearing" });
    expect(first.caseType).toMatch(/IPV/);
    expect(first.survivor).toMatch(/^[A-Z][a-z]+ [A-Z]/);
    expect(first.advocate).toBe("Judy Muthoni");
    // Counselling and files load with the case's detail, not with the register.
    expect(first.counselling).toEqual([]);
    expect(first.documents).toEqual([]);

    const hearing = await api.listCases({ filters: { court_status: "in_hearing" } });
    expect(hearing.items.every((row) => row.courtStatus === "in_hearing")).toBe(true);
    expect((await api.listCases({ search: "kibera law" })).items.length).toBeGreaterThan(0);
    const bySurvivor = await api.listCases({ sort: { by: "type", order: "asc" }, pageSize: 100 });
    const types = bySurvivor.items.map((row) => row.caseType);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  });

  it("loads a case's counselling, files and missing forms when its drawer opens", async () => {
    const api = apiFor(1);
    const detail = (await api.caseDetail(1))!;
    expect(detail.counselling.length).toBeGreaterThan(1);
    expect(detail.counselling[0].counsellor).toBe("Faith Kimani");
    expect(detail.documents.map((doc) => doc.name)).toContain("P3 form");
    // A sexual-violence case needs its P3 and PRC forms in the court file.
    const { cases } = await api.workspace();
    const sexualViolence = cases.items.find((row) => /Sexual violence/.test(row.caseType))!;
    expect((await api.caseDetail(sexualViolence.id))!.missing).toEqual(["P3 form", "PRC form"]);
    expect(await api.caseDetail(9999)).toBeNull();
  });

  it("lists survivors with a counselling summary, including those with no legal case", async () => {
    const api = apiFor(1);
    const { counselling, currentUserId } = await api.workspace({
      canViewCounselling: true,
      currentUserId: 1,
    });
    expect(currentUserId).toBe(1);
    const withCase = counselling!.items.find((row) => row.caseNumber === "CRW-VAWG-0002")!;
    expect(withCase).toMatchObject({
      sessionCount: 6,
      lastType: "follow_up",
      lastCounsellor: { name: "Cynthia Chelimo", kind: "staff" },
    });
    const only = await api.listSurvivors({ filters: { has_legal_case: "false" } });
    expect(only.items.every((row) => row.caseNumber === null)).toBe(true);
    // The seeded survivor counselled without a case: first aid by Faith, then a staff follow-up.
    const seeded = only.items.find((row) => row.sessionCount === 2)!;
    expect(seeded).toMatchObject({
      lastType: "follow_up",
      lastCounsellor: { name: "Cynthia Chelimo", kind: "staff" },
    });
    // The sessions load with the survivor's record.
    const sessions = await api.survivorSessions(withCase.enrollmentId);
    expect(sessions.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sessions[0]).toMatchObject({
      type: "follow_up",
      counsellor: { name: "Cynthia Chelimo", kind: "staff" },
      counsellorRef: { kind: "staff", id: 6 },
    });
    expect(sessions[0].notes).toContain("•");
  });

  it("offers the dialogs' options in one call each", async () => {
    const api = apiFor(1);
    const counselling = await api.counsellingOptions();
    expect(counselling.counsellors.map((row) => row.name)).toEqual([
      "Cynthia Chelimo",
      "Faith Kimani",
    ]);
    expect(counselling.survivors.find((row) => row.sessionCount === 6)).toBeDefined();
    const cases = await api.caseOptions();
    expect(cases.caseTypes.length).toBeGreaterThan(0);
    expect(cases.survivors.length).toBeGreaterThan(0);
  });

  it("leaves counselling out for users who cannot view it", async () => {
    const workspace = await apiFor(1).workspace();
    expect(workspace.counselling).toBeNull();
  });

  it("changes a court status, attaches a case file and audits opening it", async () => {
    const api = apiFor(1);
    expect((await api.setCourtStatus(1, "judgment_delivered")).success).toBe(true);
    expect(getMockStore().legal_case[0].court_status).toBe("judgment_delivered");
    const attached = await api.attach(3, "p3_form", "mock://uploads/1/p3.pdf");
    expect(attached.success).toBe(true);
    const opened = await api.viewDocument(attached.data!.id);
    expect(opened.data).toMatchObject({ owner_type: "legal_case", owner_id: 3 });
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({ action: "DOWNLOAD" });
  });
});
