import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createPillarsApi } from "@/features/pillars/api";
import { createWrosApi } from "./api";

beforeEach(() => resetMockStore());
const clientFor = () => createApiClient(new MockApiTransport(handleMockRequest));
const apiFor = (userId: number) => createWrosApi(clientFor(), issueMockToken(userId));
/** The WRO pipeline's stages, as the pillar summary gives them to the page. */
const stagesFor = async (userId: number) =>
  (await createPillarsApi(clientFor(), issueMockToken(userId)).get("wros")).pipelineStages;

describe("WRO organisations", () => {
  it("lists partner organisations with their place and pipeline progress on each row", async () => {
    const page = await apiFor(1).list();
    expect(page.totalItems).toBe(getMockStore().organisation.length);
    const first = page.items[0];
    expect(first.enrollmentId).toBeTypeOf("number");
    expect(first.stageCount).toBe(7);
    // Bank-account status is sensitive and stays masked in the list.
    expect(["Yes", "No"]).not.toContain(first.bankAccount);
    expect((await stagesFor(1)).map((stage) => stage.name)).toEqual([
      "Onboarding",
      "Capacity assessment",
      "Due diligence",
      "Grant application",
      "Committee decision",
      "Contract",
      "Disbursement",
    ]);
  });

  it("filters to contracted organisations and those still in due diligence on the server", async () => {
    const api = apiFor(1);
    const everyone = await api.list({ pageSize: 100 });
    const contracted = await api.list({ filters: { is_contracted: "true" } });
    expect(contracted.items.every((row) => row.contracted === true)).toBe(true);
    const diligence = await api.list({ filters: { in_due_diligence: "true" } });
    expect(diligence.items.every((row) => row.contracted === false)).toBe(true);
    expect(diligence.items.every((row) => row.dueDiligence !== "passed")).toBe(true);
    expect(contracted.totalItems + diligence.totalItems).toBeLessThanOrEqual(everyone.totalItems);
    const sorted = await api.list({ pageSize: 100, sort: { by: "stage", order: "desc" } });
    const stages = sorted.items.map((row) => row.currentStage);
    expect(stages).toEqual([...stages].sort((a, b) => b - a));
  });

  it("loads an organisation's stage dates when its drawer opens, or nothing for a missing one", async () => {
    const api = apiFor(1);
    const first = (await api.list()).items[0];
    expect(await api.detail(first.id)).toEqual({ reachedAt: expect.any(Object) });
    expect(await api.detail(9999)).toBeNull();
  });

  it("offers wards labelled with their county when registering", async () => {
    const options = await apiFor(1).formOptions();
    expect(options.wards.length).toBeGreaterThan(0);
    expect(options.wards[0].name).toMatch(/·/);
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
    const find = async () =>
      (await api.list({ pageSize: 100 })).items.find(
        (row) => row.name === "Imara Women Collective"
      )!;
    const imara = await find();
    expect(imara).toMatchObject({
      legalForm: "Community-based organisation",
      registrationNumber: "CBO/2019/04471",
      currentStage: -1,
    });
    const stages = await stagesFor(1);
    const moved = await api.moveToStage({
      enrollmentId: imara.enrollmentId!,
      stageId: stages[0].id,
      notes: "Onboarding visit done",
    });
    expect(moved.success).toBe(true);
    expect((await find()).currentStage).toBe(0);
    expect((await api.detail(imara.id))!.reachedAt[stages[0].id]).toBeTruthy();
  });

  it("refuses the register to users without the organisation grant", async () => {
    // Otieno Were (user 8) leads WROs but holds no organisation grant here.
    await expect(apiFor(8).list()).rejects.toThrow();
  });
});
