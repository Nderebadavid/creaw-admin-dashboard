import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/pillars/srhr",
  redirect: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { vawgApi } from "@/features/vawg/api";
import { sessionsApi } from "@/features/sessions/api";
import PillarPage from "./page";

const render = async (pillar: string, period?: string) =>
  renderToStaticMarkup(
    await PillarPage({
      params: Promise.resolve({ pillar }),
      searchParams: Promise.resolve(period ? { period } : {}),
    })
  );

beforeEach(() => {
  vi.restoreAllMocks();
  resetMockStore();
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("pillar route", () => {
  it("composes the dedicated VAWG workspace", async () => {
    const html = await render("vawg");
    expect(html).toContain("Open legal case");
    expect(html).toContain("Survivors supported");
    expect(html).toContain("Open legal cases");
    expect(html).toContain("Counselling sessions");
    expect(html).toContain("Cases concluded");
    expect(html).toContain("Legal case register");
    expect(html).not.toContain("Active records");
  });

  it("keeps the page and shows a banner when the VAWG workspace fails to load", async () => {
    vi.spyOn(vawgApi, "workspace").mockRejectedValue(new Error("timeout"));
    const html = await render("vawg");
    expect(html).toContain("Violence Against Women");
    expect(html).toContain("could not be loaded");
    expect(html).not.toContain("Legal case register");
    expect(html).not.toContain("Survivors supported");
  });

  it("keeps the generic rendering for other pillars", async () => {
    const html = await render("wee");
    expect(html).toContain("Programme records");
    expect(html).not.toContain("Open legal case");
  });

  it("shows the no-access state to a user outside the VAWG pillar", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
    const html = await render("vawg");
    expect(html).toContain("You do not have access to this pillar.");
    expect(html).not.toContain("Open legal case");
  });

  it("composes the SRHR curriculum workspace", async () => {
    const html = await render("srhr");
    for (const text of [
      "Sessions held",
      "People reached",
      "Topics covered",
      "Curriculum coverage",
      "Session register",
      "Log session",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Outreach sessions");
    expect(html).not.toContain("Activity type ID");
  });

  it("adds the sessions workspace beside Skilling's trainee enrollments", async () => {
    const html = await render("skilling");
    expect(html).toContain("Session register");
    expect(html).toContain("Workplace conduct");
    expect(html).toContain("Trainee enrollments");
    expect(html).not.toContain("Facility referral day");
  });

  it("treats an invalid period as this quarter", async () => {
    const spy = vi.spyOn(sessionsApi, "workspace");
    await render("srhr", "decade");
    expect(spy).toHaveBeenCalledWith("srhr", "quarter");
  });

  it("keeps the SRHR page and shows a banner when sessions fail to load", async () => {
    vi.spyOn(sessionsApi, "workspace").mockRejectedValue(new Error("timeout"));
    const html = await render("srhr");
    expect(html).toContain("could not be loaded");
    expect(html).not.toContain("Session register");
  });

  it("never falls back to the raw-ID domain form when sessions fail to load", async () => {
    vi.spyOn(sessionsApi, "workspace").mockRejectedValue(new Error("timeout"));
    cookieStore.get.mockReturnValue({ value: issueMockToken(9) });
    const html = await render("srhr");
    expect(html).toContain("could not be loaded");
    // The raw-ID form sits in a closed modal; its trigger is the "Log session" button.
    expect(html).not.toContain("Log session");
    expect(html).not.toContain("Activity type ID");
  });

  it("keeps the Add record heading button beside Log session", async () => {
    const html = await render("srhr");
    expect(html).toContain("Add SRHR record");
    expect(html).toContain("Log session");
  });
});
