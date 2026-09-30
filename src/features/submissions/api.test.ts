import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createSubmissionsApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { getMockStore } from "@/lib/mock-api/store";
import { z } from "zod";
import { filterSubmissionRows } from "./filter";

beforeEach(() => resetMockStore());

describe("submission adapter", () => {
  it("does not expose free-text flagged notes in a list", async () => {
    const rows = await createSubmissionsApi(createPortalApiClient(), issueMockToken(1)).list();
    const flagged = rows.items.find((row) => row.status === "Flagged")!;
    expect(flagged.flag).toBe("Requires follow-up");
    expect(flagged.flag).not.toContain("Sauti ya Mama");
  });
  it("returns every authorized event and resolves a late enrollment by id", async () => {
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
    expect((await api.listAll()).some((row) => row.id === 1000)).toBe(true);
    expect((await api.list({ page: 5, pageSize: 25 })).totalItems).toBeGreaterThan(100);
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
    const list = await createSubmissionsApi(client, token).list();
    const visible = filterSubmissionRows(list.items, { status: "All", search: "organisations" });
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
    const list = await createSubmissionsApi(client, token).listAll();
    const visible = filterSubmissionRows(list, { status: "Pending review", search: "legal aid" });
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
    const withPhotos = (await api.listAll()).find((row) => (row.photos?.length ?? 0) > 1)!;
    expect(withPhotos.photos![0].name).toBeTruthy();
    const opened = await api.viewDocument(withPhotos.photos![0].id);
    expect(opened.success).toBe(true);
    expect(opened.data?.owner_type).toBe("participant_stage_event");
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({ action: "DOWNLOAD" });
  });
});
