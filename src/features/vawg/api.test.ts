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
    const { cases, summary, caseTypes, survivors } = await apiFor(1).workspace();
    expect(cases.length).toBe(getMockStore().legal_case.length);
    const first = cases.find((row) => row.id === 1)!;
    expect(first).toMatchObject({ number: "CRW-VAWG-0001", courtStatus: "in_hearing" });
    expect(first.caseType).toMatch(/IPV/);
    expect(first.counselling.length).toBeGreaterThan(1);
    expect(first.documents.map((doc) => doc.name)).toContain("P3 form");
    // A sexual-violence case needs its P3 and PRC forms in the court file.
    const sexualViolence = cases.find((row) => /Sexual violence/.test(row.caseType))!;
    expect(sexualViolence.missing).toEqual(["P3 form", "PRC form"]);
    expect(summary.openCases).toBe(cases.filter((row) => !row.closed).length);
    expect(caseTypes.length).toBeGreaterThan(0);
    expect(survivors.length).toBe(summary.survivors);
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
