import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createProviderAction, setProviderActiveAction, updateProviderAction } from "./actions";

// Lead Counsellor (user 4) holds roles 4 and 7 only: no PROVIDER_MANAGE in any pillar.
const NO_PROVIDER_ACCESS_USER = 4;

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  resetMockStore();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

const form = {
  firstName: "Grace",
  middleName: "",
  lastName: "Wanjiru",
  type: "nurse" as const,
  service: "Outreach",
  institutionId: null,
  phone: "0700 111 222",
  email: "",
  notes: "",
};

describe("provider actions", () => {
  it("creates a provider and keeps blank contacts on update", async () => {
    expect((await createProviderAction(form)).success).toBe(true);
    const grace = getMockStore().external_provider.at(-1)!;
    expect(
      await updateProviderAction({
        ...form,
        id: grace.id,
        service: "Clinical outreach",
        phone: "",
      })
    ).toMatchObject({ success: true });
    expect(grace).toMatchObject({
      service_description: "Clinical outreach",
      phone_number: "0700 111 222",
    });
  });

  it("rejects masked contacts", async () => {
    const result = await updateProviderAction({
      ...form,
      id: 1,
      firstName: "Faith",
      lastName: "Kimani",
      type: "counsellor",
      phone: "••••0221",
    });
    expect(result).toMatchObject({
      success: false,
      message: "Enter the contact in full, or leave it blank to keep it",
    });
  });

  it("rejects a masked email", async () => {
    expect(await createProviderAction({ ...form, email: "f•••@nwh.example" })).toMatchObject({
      success: false,
      message: "Enter the contact in full, or leave it blank to keep it",
    });
  });

  it("revalidates the directory after a write, but not after a denied one", async () => {
    await createProviderAction(form);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/providers");
    vi.mocked(revalidatePath).mockClear();
    cookieStore.get.mockReturnValue({ value: issueMockToken(NO_PROVIDER_ACCESS_USER) });
    await createProviderAction(form);
    await setProviderActiveAction({ id: 2, active: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    expect(await createProviderAction({ ...form, firstName: " " })).toMatchObject({
      success: false,
      resultCode: 422,
    });
    expect((await createProviderAction({ ...form, email: "nope" })).success).toBe(false);
  });

  it("deactivates and reactivates", async () => {
    expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(true);
    expect(getMockStore().external_provider.find((row) => row.id === 2)!.status).toBe("INACTIVE");
    expect((await setProviderActiveAction({ id: 2, active: true })).success).toBe(true);
    expect(getMockStore().external_provider.find((row) => row.id === 2)!.status).toBe("ACTIVE");
  });

  it("refuses users without PROVIDER_MANAGE", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
    expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(false);
    expect((await createProviderAction(form)).success).toBe(false);
  });
});
