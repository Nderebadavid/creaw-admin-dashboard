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
    expect(cases[0]).toMatchObject({
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
    expect(cases.find((item) => item.id === row.id)).toMatchObject({
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
    delete row.advocate_name;
    const { cases } = await apiFor(1).workspace();
    expect(cases.find((item) => item.id === row.id)!.advocate).toBeNull();
  });

  it("updates court record fields through the legal-case resource", async () => {
    const api = apiFor(1);
    const updated = await api.updateCase(1, { court_name: "Milimani Law Courts" });
    expect(updated.success).toBe(true);
    expect(getMockStore().legal_case[0].court_name).toBe("Milimani Law Courts");
  });

  it("reveals the OB number through the sensitive-field resource", async () => {
    const revealed = await apiFor(1).revealCaseField(1, "ob_number");
    expect(revealed.success).toBe(true);
    expect(revealed.data).toEqual({ value: "OB/44/2026" });
  });

  it("builds cases with survivor, case type, counselling and case files", async () => {
    const { cases, summary, caseTypes, survivors } = await apiFor(1).workspace({
      canViewCounselling: true,
    });
    expect(cases.length).toBe(getMockStore().legal_case.length);
    const first = cases.find((row) => row.id === 1)!;
    expect(first).toMatchObject({ number: "CRW-VAWG-0001", courtStatus: "in_hearing" });
    expect(first.caseType).toMatch(/IPV/);
    expect(first.counselling.length).toBeGreaterThan(1);
    expect(first.advocate).toBe("Judy Muthoni");
    expect(first.counselling[0].counsellor).toBe("Faith Kimani");
    expect(first.documents.map((doc) => doc.name)).toContain("P3 form");
    // A sexual-violence case needs its P3 and PRC forms in the court file.
    const sexualViolence = cases.find((row) => /Sexual violence/.test(row.caseType))!;
    expect(sexualViolence.missing).toEqual(["P3 form", "PRC form"]);
    expect(summary.openCases).toBe(cases.filter((row) => !row.closed).length);
    expect(caseTypes.length).toBeGreaterThan(0);
    expect(survivors.length).toBe(summary.survivors);
  });

  it("groups counselling by survivor, including those with no legal case", async () => {
    const { counselling, counsellors, currentUserId } = await apiFor(1).workspace({
      canViewCounselling: true,
      canLogCounselling: true,
      currentUserId: 1,
    });
    expect(currentUserId).toBe(1);
    const withCase = counselling!.find((row) => row.caseNumber === "CRW-VAWG-0002")!;
    expect(withCase.sessions.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(withCase.sessions[0]).toMatchObject({
      type: "follow_up",
      counsellor: { name: "Cynthia Chelimo", kind: "staff" },
      counsellorRef: { kind: "staff", id: 6 },
    });
    expect(withCase.sessions[0].notes).toContain("•");
    const onlyCounselling = counselling!.filter((row) => row.caseNumber === null);
    expect(onlyCounselling).toHaveLength(1);
    expect(onlyCounselling[0].sessions[0]).toMatchObject({
      type: "psychological_first_aid",
      counsellor: { name: "Faith Kimani", kind: "provider" },
    });
    expect(counsellors.map((row) => row.name)).toEqual(["Cynthia Chelimo", "Faith Kimani"]);
  });

  it("leaves counselling out for users who cannot view it", async () => {
    const workspace = await apiFor(1).workspace();
    expect(workspace.counselling).toBeNull();
    expect(workspace.counsellors).toEqual([]);
    expect(workspace.cases.every((row) => row.counselling.length === 0)).toBe(true);
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
