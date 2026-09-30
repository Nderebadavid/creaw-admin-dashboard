import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createWrosApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createWrosApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("WRO organisations", () => {
  it("lists partner organisations with the WRO pipeline", async () => {
    const organisations = await apiFor(1).list();
    expect(organisations.length).toBe(getMockStore().organisation.length);
    expect(organisations[0].stages.map((stage) => stage.name)).toEqual([
      "Onboarding",
      "Capacity assessment",
      "Due diligence",
      "Grant application",
      "Committee decision",
      "Contract",
      "Disbursement",
    ]);
    expect(organisations[0].enrollmentId).toBeTypeOf("number");
    // Bank-account status is sensitive and stays masked in the list.
    expect(["Yes", "No"]).not.toContain(organisations[0].bankAccount);
  });

  it("registers an organisation into the WRO pillar and moves it along the pipeline", async () => {
    const api = apiFor(1);
    const created = await api.register({
      name: "Imara Women Collective",
      legalForm: "cbo",
      registrationNumber: "CBO/2019/04471",
      hasBankAccount: true,
      entryCategory: "Sub-grant applicant",
      dataSharingAgreed: true,
    });
    expect(created.success).toBe(true);
    const imara = (await api.list()).find((row) => row.name === "Imara Women Collective")!;
    expect(imara).toMatchObject({
      legalForm: "Community-based organisation",
      registrationNumber: "CBO/2019/04471",
      currentStage: -1,
    });
    const moved = await api.moveToStage({
      enrollmentId: imara.enrollmentId!,
      stageId: imara.stages[0].id,
      notes: "Onboarding visit done",
    });
    expect(moved.success).toBe(true);
    const after = (await api.list()).find((row) => row.id === imara.id)!;
    expect(after.currentStage).toBe(0);
    expect(after.stages[0].reachedAt).not.toBeNull();
  });
});
