/* eslint-disable @typescript-eslint/no-explicit-any -- loose envelope shapes in a contract test */
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());
const client = createApiClient(new MockApiTransport(handleMockRequest));
const get = (
  path: string,
  routeTemplate: string,
  query: Record<string, unknown> = {},
  userId = 1
) =>
  client.request(
    { method: "GET", path, routeTemplate, query, token: issueMockToken(userId) } as never,
    { parse: (value: unknown) => value } as never
  ) as Promise<{ success: boolean; resultCode: number; data: any; message: string }>;
const pillarTable = (pillar: string, table: string, query: Record<string, unknown> = {}) =>
  get(`/pillars/${pillar}`, "/pillars/:pillar", { table, ...query });
const STANDARD = ["id", "status", "status_description", "created_at", "updated_at"];

describe("standard record fields", () => {
  it("returns the standard block and notes on every list row", async () => {
    for (const [pillar, table, notes] of [
      ["vawg", "legal_case", "outcome_notes"],
      ["vawg", "counselling_session", "notes"],
      ["srhr", "activity_session", "notes"],
      ["skilling", "training_enrollment", null],
    ] as const) {
      const row = (await pillarTable(pillar, table)).data.items[0];
      for (const key of STANDARD) expect(row, `${table}.${key}`).toHaveProperty(key);
      if (notes) expect(row).toHaveProperty(notes);
    }
    const participant = (await get("/participants", "/participants")).data.items[0];
    for (const key of [...STANDARD, "remarks"]) expect(participant).toHaveProperty(key);
  });

  it("returns counselling notes in full", async () => {
    const row = (await pillarTable("vawg", "counselling_session")).data.items[0];
    expect(row.notes).toBe(getMockStore().counselling_session[0].notes);
  });
});

describe("reference names", () => {
  it("names each linked record beside its id", async () => {
    const legalCase = (await pillarTable("vawg", "legal_case")).data.items[0];
    expect(legalCase).toMatchObject({
      case_type_name: expect.any(String),
      participant_id: expect.any(Number),
      participant_name: expect.stringMatching(/^[A-Z]/),
    });
    const session = (await pillarTable("srhr", "activity_session")).data.items[0];
    expect(session.activity_type_name).toEqual(expect.any(String));
    const enrollment = (await pillarTable("wee", "enrollment")).data.items[0];
    expect(enrollment).toMatchObject({
      pillar_name: expect.any(String),
      participant_name: expect.any(String),
    });
    const participant = (await get("/participants", "/participants")).data.items[0];
    expect(participant).toHaveProperty("ward_name");
  });

  it("never copies a linked person's contacts", async () => {
    const rows = (await pillarTable("srhr", "activity_session")).data.items;
    expect(JSON.stringify(rows)).not.toMatch(/@creaw\.org|phone_number/);
  });
});

describe("list query conventions", () => {
  it("sorts, searches and filters on derived names on the server", async () => {
    const sorted = (
      await get("/participants", "/participants", {
        table: "enrollment",
        sort: "participant_name:desc",
      })
    ).data.items.map((row: any) => row.participant_name ?? "");
    expect(sorted).toEqual([...sorted].sort((a: string, b: string) => b.localeCompare(a)));

    const name = getMockStore().participant[0].first_name;
    const found = (await pillarTable("vawg", "legal_case", { search: name.toLowerCase() })).data
      .items;
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.every((row: any) => JSON.stringify(row).toLowerCase().includes(name.toLowerCase()))
    ).toBe(true);

    const typeName = (await pillarTable("srhr", "activity_session")).data.items[0]
      .activity_type_name;
    const filtered = (
      await pillarTable("srhr", "activity_session", { activity_type_name: typeName })
    ).data.items;
    expect(filtered.every((row: any) => row.activity_type_name === typeName)).toBe(true);
  });

  it("supports several sort keys and rejects unknown ones and allows id_number", async () => {
    const result = await pillarTable("srhr", "activity_session", {
      sort: "activity_type_name:asc,session_date:desc",
    });
    expect(result.success).toBe(true);
    expect((await pillarTable("srhr", "activity_session", { sort: "nope:asc" })).resultCode).toBe(
      422
    );
    expect(
      (await get("/participants", "/participants", { sort: "id_number:asc" })).resultCode
    ).toBe(200);
  });

  it("reads a batch of records by id in one call", async () => {
    const ids = getMockStore()
      .participant.slice(0, 3)
      .map((row) => row.id);
    const result = await get("/participants", "/participants", { ids: ids.join(",") });
    expect(result.data.items.map((row: any) => row.id).sort()).toEqual([...ids].sort());
    const tooMany = Array.from({ length: 101 }, (_, i) => i + 1).join(",");
    expect((await get("/participants", "/participants", { ids: tooMany })).resultCode).toBe(422);
  });

  it("embeds child collections or their counts with include", async () => {
    const pipelines = await get("/admin/pipelines", "/admin/pipelines", { include: "stages" });
    const stages = pipelines.data.items[0].stages;
    expect(stages.length).toBeGreaterThan(1);
    expect(stages.map((row: any) => row.step_no)).toEqual(
      [...stages.map((row: any) => row.step_no)].sort((a: number, b: number) => a - b)
    );

    const sessions = await pillarTable("srhr", "activity_session", {
      include: "attendees:count,documents",
    });
    expect(sessions.data.items[0]).toHaveProperty("attendees_count");
    expect(Array.isArray(sessions.data.items[0].documents)).toBe(true);

    const one = await get("/grants/1", "/grants/:id", {
      include: "awards,disbursements,reports,documents",
    });
    expect(one.data.awards.length).toBe(1);
    expect(one.data.awards[0].amount_awarded).toBe(getMockStore().grant_award[0].amount_awarded);

    expect((await pillarTable("srhr", "activity_session", { include: "bogus" })).resultCode).toBe(
      422
    );
  });

  it("filters embedded children by the caller's own permission", async () => {
    // Lilian Otieno (user 5) reads VAWG cases but not counselling.
    const cases = await get(
      "/pillars/vawg",
      "/pillars/:pillar",
      { table: "legal_case", include: "counselling" },
      5
    );
    expect(cases.data.items.every((row: any) => row.counselling.length === 0)).toBe(true);
  });
});

describe("batched lookups", () => {
  it("returns several lookup tables in one call with a version", async () => {
    const result = await get("/lookups", "/lookups", { tables: "ward,county,pillar" });
    expect(Object.keys(result.data.tables)).toEqual(["ward", "county", "pillar"]);
    expect(result.data.tables.ward.length).toBeGreaterThan(0);
    expect(result.data.version).toEqual(expect.any(String));
    expect((await get("/lookups", "/lookups", { tables: "participant" })).resultCode).toBe(422);
  });
});

describe("pillar summary", () => {
  it("returns the header, the pipeline with stage counts and the pillar's cards", async () => {
    const result = await get("/pillars/skilling/summary", "/pillars/:pillar/summary", {
      period: "all",
    });
    expect(result.data.pillar).toMatchObject({ code: "skilling", lead_name: "Ann Kamau" });
    expect(result.data.pipeline.stages[0]).toMatchObject({ step_no: 1, count: expect.any(Number) });
    expect(result.data.enrollments.total).toBeGreaterThan(0);
    expect(result.data.cards.trainees).toMatchObject({ enrolled: 5, completion_rate: 75 });
    expect(result.data.cards.sessions.summary.sessionsHeld).toBeGreaterThan(0);
    expect(result.data.cards.vawg).toBeNull();
  });

  it("leaves out blocks the caller cannot see and refuses pillars outside scope", async () => {
    // Lilian Otieno (user 5): VAWG case access but no counselling.
    const vawg = await get("/pillars/vawg/summary", "/pillars/:pillar/summary", {}, 5);
    expect(vawg.data.cards.vawg).toMatchObject({ counselling_sessions: null });
    expect((await get("/pillars/srhr/summary", "/pillars/:pillar/summary", {}, 5)).resultCode).toBe(
      403
    );
  });
});

describe("form options", () => {
  it("returns every option list a form needs in one call", async () => {
    const session = await get("/pillars/srhr/form-options", "/pillars/:pillar/form-options", {
      form: "session",
    });
    expect(session.data).toMatchObject({
      activity_types: expect.any(Array),
      topics: expect.any(Array),
      facilitators: expect.arrayContaining([expect.objectContaining({ kind: "provider" })]),
    });
    const trainee = await get("/pillars/skilling/form-options", "/pillars/:pillar/form-options", {
      form: "trainee",
    });
    expect(trainee.data.trainers).toEqual([
      { id: 3, label: expect.stringMatching(/^James Otieno/) },
    ]);
    const counselling = await get("/pillars/vawg/form-options", "/pillars/:pillar/form-options", {
      form: "counselling",
    });
    expect(counselling.data.counsellors.map((row: any) => row.name)).toEqual([
      "Cynthia Chelimo",
      "Faith Kimani",
    ]);
  });

  it("refuses forms a pillar does not have and users who cannot use them", async () => {
    expect(
      (await get("/pillars/wee/form-options", "/pillars/:pillar/form-options", { form: "session" }))
        .resultCode
    ).toBe(422);
    expect(
      (
        await get(
          "/pillars/vawg/form-options",
          "/pillars/:pillar/form-options",
          { form: "counselling" },
          7
        )
      ).resultCode
    ).toBe(403);
  });
});

describe("dashboard overview", () => {
  it("computes every dashboard panel on the server", async () => {
    const result = await get("/dashboard", "/dashboard", { view: "overview", year: "2026" });
    expect(result.data.pillars.length).toBe(6);
    expect(result.data.monthly).toHaveLength(12);
    expect(result.data.reports.total).toBeGreaterThan(0);
    expect(result.data.recent_activity.length).toBeLessThanOrEqual(5);
    const narrowed = await get("/dashboard", "/dashboard", {
      view: "overview",
      year: "2026",
      pillar: "vawg",
    });
    const sum = (data: any) =>
      data.monthly.reduce((total: number, row: any) => total + row.new_count, 0);
    expect(sum(narrowed.data)).toBeLessThanOrEqual(sum(result.data));
  });
});
