"use server";
/**
 * Server Actions for the external provider directory: creating and editing a
 * provider, activating or deactivating one.
 *
 * Each action re-checks the session, validates its input and checks the
 * permission before calling the API, which enforces the same rules again and
 * writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { createProvidersApi } from "./api";
import { providerTypes } from "./model";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(80);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const providerInput = z.object({
  id: id.optional(),
  firstName: name,
  middleName: text(80),
  lastName: name,
  type: z.enum(providerTypes),
  service: text(255),
  institutionId: id.nullable(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9+\-() ]{3,30}$/.test(value))
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((value) => value === "" || z.email().safeParse(value).success)
    .transform((value) => value || null),
  notes: text(2000),
});
const activeInput = z.object({ id, active: z.boolean() });
const MASKED = "Enter the contact in full, or leave it blank to keep it";
const api = () => withSessionApi(createProvidersApi);
const canManage = (grants: Parameters<typeof hasPermission>[0]) =>
  hasPermission(grants, "PROVIDER_MANAGE");
const done = (response: { success: boolean; resultCode: number; message: string }) => {
  if (response.success) revalidatePath("/admin/providers");
  return actionResult(response.resultCode, response.message);
};

/** Parses a provider form into API columns, or an error result. */
function providerValues(input: unknown, editing: boolean) {
  const raw = input as { phone?: unknown; email?: unknown } | null;
  if ([raw?.phone, raw?.email].some((value) => typeof value === "string" && value.includes("•")))
    return { error: actionResult(422, MASKED) };
  const parsed = providerInput.safeParse(input);
  if (!parsed.success)
    return { error: actionResult(422, "Check the provider details and try again") };
  const value = parsed.data;
  const body: Record<string, string | number | null> = {
    first_name: value.firstName,
    middle_name: value.middleName,
    last_name: value.lastName,
    provider_type: value.type,
    service_description: value.service,
    affiliated_institution_id: value.institutionId,
    notes: value.notes,
  };
  // On update a blank contact means "keep what is stored", so the key is left out.
  if (!editing || value.phone) body.phone_number = value.phone;
  if (!editing || value.email) body.email = value.email;
  return { value, body };
}

export async function createProviderAction(input: unknown) {
  const session = await requireSession();
  if (!canManage(session.grants)) return actionResult(403, "You cannot manage providers");
  const checked = providerValues(input, false);
  if (checked.error) return checked.error;
  try {
    return done(await (await api()).create(checked.body));
  } catch {
    return actionResult(500, "Could not save the provider");
  }
}

export async function updateProviderAction(input: unknown) {
  const session = await requireSession();
  if (!canManage(session.grants)) return actionResult(403, "You cannot manage providers");
  const checked = providerValues(input, true);
  if (checked.error) return checked.error;
  if (!checked.value.id) return actionResult(422, "Check the provider details and try again");
  try {
    return done(await (await api()).update(checked.value.id, checked.body));
  } catch {
    return actionResult(500, "Could not save the provider");
  }
}

export async function setProviderActiveAction(input: unknown) {
  const session = await requireSession();
  if (!canManage(session.grants)) return actionResult(403, "You cannot manage providers");
  const parsed = activeInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a provider");
  try {
    return done(await (await api()).setActive(parsed.data.id, parsed.data.active));
  } catch {
    return actionResult(500, "Could not update the provider");
  }
}

/** A provider's recent linked work, for its drawer. */
export async function loadProviderWorkloadAction(providerId: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(providerId) || providerId < 1)
    return { success: false, message: "Invalid provider.", data: null };
  if (!canManage(session.grants))
    return { success: false, message: "You cannot manage providers.", data: null };
  try {
    const workload = await (await api()).workload(providerId);
    return workload
      ? { success: true, message: "OK", data: workload }
      : { success: false, message: "Provider not found.", data: null };
  } catch {
    return { success: false, message: "Could not load the linked work.", data: null };
  }
}
