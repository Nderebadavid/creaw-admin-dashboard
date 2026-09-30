import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import PillarPage from "./page";

const render = async (pillar: string) =>
  renderToStaticMarkup(await PillarPage({ params: Promise.resolve({ pillar }) }));

beforeEach(() => {
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

  it("keeps the generic rendering for other pillars", async () => {
    const html = await render("wee");
    expect(html).toContain("Programme records");
    expect(html).not.toContain("Open legal case");
  });
});
