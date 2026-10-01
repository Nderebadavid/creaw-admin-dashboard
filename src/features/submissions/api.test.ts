import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createSubmissionsApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { getMockStore } from "@/lib/mock-api/store";
import { z } from "zod";

beforeEach(() => resetMockStore());

describe("submission adapter", () => {
  it("names the pillar, stage, place and photos on each row, so a list is one call", async () => {
    const client = createPortalApiClient();
    const calls: string[] = [];
    const real = client.request.bind(client);
    vi.spyOn(client, "request").mockImplementation(((
      req: { routeTemplate: string },
      schema: never
    ) => {
      calls.push(req.routeTemplate);
      return real(req as never, schema);
    }) as never);
    const page = await createSubmissionsApi(client, issueMockToken(1)).list({ pageSize: 100 });
    expect(calls).toEqual(["/field-submissions"]);
    const row = page.items.find((item) => (item.photos?.length ?? 0) > 0)!;
    expect(row.pillar).not.toMatch(/#\d/);
    expect(row.type).not.toBe("");
    expect(row.place).toMatch(/·/);
  });
  it("filters by review status and newest first", async () => {
    const api = createSubmissionsApi(createPortalApiClient(), issueMockToken(1));
    const flagged = await api.list({ status: "Flagged", pageSize: 100 });
    expect(flagged.items.length).toBeGreaterThan(0);
    expect(flagged.items.every((row) => row.status === "Flagged")).toBe(true);
    // The tab counts cover every status over the same search, not just the filtered one.
    expect(Object.keys(flagged.facets!.review_status).length).toBeGreaterThan(1);
    const dates = (await api.list({ pageSize: 100 })).items.map((row) => row.captured);
    expect(dates).toEqual([...dates].sort().reverse());
  });
  it("does not expose free-text flagged notes in a list", async () => {
    const rows = await createSubmissionsApi(createPortalApiClient(), issueMockToken(1)).list();
    const flagged = rows.items.find((row) => row.status === "Flagged")!;
    expect(flagged.flag).toBe("Requires follow-up");
    expect(flagged.flag).not.toContain("Sauti ya Mama");
  });
  it("pages the authorized events on the server and resolves a late enrollment by id", async () => {
    const store = getMockStore();
    const enrollment = store.enrollment.find((row) => row.pillar_id === 1)!;
    const event = store.participant_stage_event.find((row) => row.enrollment_id === enrollment.id)!;
    for (let index = 0; index < 110; index += 1) {
      store.enrollment.push({ ...enrollment, id: 1000 + index });
      store.participant_stage_event.push({
        ...event,
        id: 1000 + index,
        enrollment_id: 1000 + index,
        notes: "Late update",
      });
    }
    const api = createSubmissionsApi(createPortalApiClient(), issueMockToken(1));
    const fourth = await api.list({ page: 4, pageSize: 25 });
    expect(fourth.totalItems).toBeGreaterThan(100);
    expect(fourth.items).toHaveLength(25);
    expect(fourth.facets?.review_status).toBeDefined();
    expect(await api.get(1109)).toMatchObject({
      id: 1109,
      pillarId: 1,
      // The card names the stage captured; the enrollment's category rides alongside.
      category: enrollment.entry_category,
    });
  });
  it("exports the same searched rows as the UI without raw note identities", async () => {
    const token = issueMockToken(1);
    const client = createPortalApiClient();
    const organisationEvent = getMockStore().participant_stage_event.find((row) =>
      row.notes?.includes("Sauti ya Mama")
    )!;
    getMockStore().enrollment.find(
      (row) => row.id === organisationEvent.enrollment_id
    )!.entry_category = "Zawadi Mwende";
    const visible = (
      await createSubmissionsApi(client, token).list({ search: "organisations", pageSize: 100 })
    ).items;
    const csv = await client.request(
      {
        method: "GET",
        path: "/field-submissions",
        routeTemplate: "/field-submissions",
        token,
        query: { format: "csv", search: "organisations" },
      },
      z.object({
        success: z.boolean(),
        resultCode: z.number(),
        message: z.string(),
        data: z.object({ content: z.string(), filename: z.string() }).nullable(),
      })
    );
    expect(csv.success).toBe(true);
    expect(csv.data?.content).not.toContain("Sauti ya Mama");
    expect(csv.data?.content).not.toContain("Zawadi Mwende");
    expect(csv.data?.content).not.toContain("notes");
    expect(csv.data?.content).toContain(String(visible[0].id));
    expect(csv.data?.content.split("\r\n")).toHaveLength(visible.length + 1);
  });
  it("keeps scoped export and category search aligned with the visible queue", async () => {
    const token = issueMockToken(5);
    const client = createPortalApiClient();
    const visible = (
      await createSubmissionsApi(client, token).list({
        status: "Pending review",
        search: "legal aid",
        pageSize: 100,
      })
    ).items;
    const csv = await client.request(
      {
        method: "GET",
        path: "/field-submissions",
        routeTemplate: "/field-submissions",
        token,
        query: { format: "csv", search: "legal aid", stage_event_status: "recorded" },
      },
      z.object({
        success: z.boolean(),
        resultCode: z.number(),
        message: z.string(),
        data: z.object({ content: z.string() }).nullable(),
      })
    );
    expect(csv.success).toBe(true);
    expect(csv.data?.content.split("\r\n")).toHaveLength(visible.length + 1);
    expect(csv.data?.content).not.toContain("Women's Economic Empowerment");
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({
      action: "EXPORT",
      entity_type: "participant_stage_event",
    });
  });

  it("returns the photos captured with a submission and audits opening one", async () => {
    const api = createSubmissionsApi(createPortalApiClient(), issueMockToken(1));
    const withPhotos = (await api.list({ pageSize: 100 })).items.find(
      (row) => (row.photos?.length ?? 0) > 1
    )!;
    expect(withPhotos.photos![0].name).toBeTruthy();
    const opened = await api.viewDocument(withPhotos.photos![0].id);
    expect(opened.success).toBe(true);
    expect(opened.data?.owner_type).toBe("participant_stage_event");
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({ action: "DOWNLOAD" });
  });
});
