import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import {
  createProviderAction,
  revealProviderContactAction,
  setProviderActiveAction,
  updateProviderAction,
} from "./actions";

beforeEach(() => {
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
  });

  it("reveals a contact with an audit entry", async () => {
    const before = getMockStore().audit_logs.length;
    expect(await revealProviderContactAction(1, "phone_number")).toEqual({
      success: true,
      value: "0711 900 221",
    });
    expect(getMockStore().audit_logs.length).toBe(before + 1);
  });

  it("lets a SENSITIVE_REVEAL holder reveal but not manage", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(9) });
    expect(await revealProviderContactAction(1, "email")).toEqual({
      success: true,
      value: "faith.kimani@nwh.example",
    });
    expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(false);
  });

  it("refuses users without PROVIDER_MANAGE", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
    expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(false);
    expect((await createProviderAction(form)).success).toBe(false);
  });
});
