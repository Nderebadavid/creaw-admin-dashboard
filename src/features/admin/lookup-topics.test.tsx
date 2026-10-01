import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./lookup-actions", () => ({
  createLookupAction: vi.fn(),
  updateLookupAction: vi.fn(),
  setLookupActiveAction: vi.fn(),
  exportLookupAction: vi.fn(),
}));
import { LookupContent } from "./lookup-components";
import { labelFor, lookupConfig, lookupTabs } from "./lookups/config";

const topic = {
  id: 7,
  name: "Contraception",
  activity_type_id: 4,
  sequence_no: 2,
  description: null,
  status: "ACTIVE",
  is_deleted: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  status_description: null,
} as never;

describe("activity topic lookup", () => {
  it("is listed as its own lookup tab with type, order, name and description", () => {
    expect(lookupTabs.map((tab) => tab.table)).toContain("activity_topic");
    expect(lookupConfig.activity_topic.columns.map((column) => column.label)).toEqual([
      "Activity type",
      "Order",
      "Name",
      "Description",
    ]);
  });

  it("resolves the activity type id to its name", () => {
    expect(labelFor(topic, "activity_type_id", [], [], [], [{ id: 4, name: "Health Talk" }])).toBe(
      "Health Talk"
    );
  });

  it("renders topics with their activity type name", () => {
    render(
      <LookupContent
        table="activity_topic"
        rows={[topic]}
        parent={null}
        counties={[]}
        subCounties={[]}
        pillars={[]}
        activityTypes={[{ id: 4, name: "Health Talk" }]}
        canViewAudit={false}
        canExport={false}
      />
    );
    const row = screen.getByRole("row", { name: /Contraception/ });
    expect(within(row).getByText("Health Talk")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });
});
