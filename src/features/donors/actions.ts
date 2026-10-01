"use server";
/**
 * Server Actions for the donors register. Donors are lookup data, so creating, editing,
 * deactivating and deleting them needs the lookup management permission; reading needs
 * dashboard access. The API enforces the same rules again.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { cleanListQuery, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { createDonorsApi } from "./api";
import { donorDeleteInputSchema, donorInputSchema, donorStatusInputSchema } from "./schemas";

const api = () => withSessionApi(createDonorsApi);
const refresh = () => {
  revalidatePath("/donors");
  revalidatePath("/projects");
};

export async function listDonorsAction(query: ListQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const clean = cleanListQuery(query, {
      sort: ["donor", "projects", "active", "awarded", "record", "updated"],
      filters: ["status"],
    });
    return { ...actionResult(200, "OK"), data: await (await api()).list(clean) };
  } catch {
    return { ...actionResult(422, "Could not load donors"), data: null };
  }
}

export async function loadDonorDetailAction(id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1)
    return { ...actionResult(422, "Invalid donor"), data: null };
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const detail = await (await api()).detail(id);
    return detail
      ? { ...actionResult(200, "OK"), data: detail }
      : { ...actionResult(404, "Donor not found"), data: null };
  } catch {
    return { ...actionResult(500, "Could not load this donor"), data: null };
  }
}

const mayManage = (grants: Parameters<typeof hasPermission>[0]) =>
  hasPermission(grants, "LOOKUP_MANAGE");

export async function saveDonorAction(input: unknown) {
  const session = await requireSession();
  const parsed = donorInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the donor details");
  if (!mayManage(session.grants)) return actionResult(403, "You cannot manage donors");
  try {
    const client = await api();
    const { id, ...rest } = parsed.data;
    const response = id ? await client.update({ ...rest, id }) : await client.create(rest);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save the donor");
  }
}

export async function setDonorStatusAction(input: unknown) {
  const session = await requireSession();
  const parsed = donorStatusInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the donor status");
  if (!mayManage(session.grants)) return actionResult(403, "You cannot manage donors");
  try {
    const response = await (
      await api()
    ).setStatus(parsed.data.id, parsed.data.status, parsed.data.reason);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not update the donor");
  }
}

export async function deleteDonorAction(input: unknown) {
  const session = await requireSession();
  const parsed = donorDeleteInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Invalid donor");
  if (!mayManage(session.grants)) return actionResult(403, "You cannot manage donors");
  try {
    const response = await (await api()).remove(parsed.data.id);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not delete the donor");
  }
}
