"use server";
/**
 * Server Actions for the projects register: paging, a project's detail, the form
 * options, and creating or editing a project.
 *
 * Each action re-checks the session, validates its input and checks the permission in
 * the project's pillar before calling the API, which enforces the same rules again.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { cleanListQuery, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { createProjectsApi } from "./api";
import { projectDeleteInputSchema, projectInputSchema, projectStatusInputSchema } from "./schemas";

const api = () => withSessionApi(createProjectsApi);

export async function listProjectsAction(query: ListQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const clean = cleanListQuery(query, {
      sort: [
        "project",
        "pillar",
        "donor",
        "period",
        "applications",
        "awarded",
        "disbursed",
        "overdue",
        "record",
        "updated",
      ],
      filters: ["pillar_id", "status"],
    });
    return { ...actionResult(200, "OK"), data: await (await api()).list(clean) };
  } catch {
    return { ...actionResult(422, "Could not load projects"), data: null };
  }
}

export async function loadProjectDetailAction(id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1)
    return { ...actionResult(422, "Invalid project"), data: null };
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const detail = await (await api()).detail(id);
    return detail
      ? { ...actionResult(200, "OK"), data: detail }
      : { ...actionResult(404, "Project not found"), data: null };
  } catch {
    return { ...actionResult(500, "Could not load this project"), data: null };
  }
}

export async function loadProjectOptionsAction() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    return { ...actionResult(200, "OK"), data: await (await api()).options() };
  } catch {
    return { ...actionResult(500, "Could not load the options"), data: null };
  }
}

/** Deactivates or reactivates a project; needs the same permission as editing it. */
export async function setProjectStatusAction(input: unknown) {
  const session = await requireSession();
  const parsed = projectStatusInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the project status");
  try {
    const client = await api();
    const project = await client.get(parsed.data.id);
    if (!project) return actionResult(404, "Project not found");
    if (!hasPermission(session.grants, "NARRATIVE_REPORT_MANAGE", { pillarId: project.pillarId }))
      return actionResult(403, "You cannot manage projects in this pillar");
    const response = await client.setStatus(project.id, parsed.data.status, parsed.data.reason);
    if (response.success) {
      revalidatePath("/projects");
      revalidatePath("/grants");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not update the project");
  }
}

/** Deletes a project nothing depends on; needs the pillar configuration permission. */
export async function deleteProjectAction(input: unknown) {
  const session = await requireSession();
  const parsed = projectDeleteInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Invalid project");
  try {
    const client = await api();
    const project = await client.get(parsed.data.id);
    if (!project) return actionResult(404, "Project not found");
    if (!hasPermission(session.grants, "PILLAR_CONFIG_MANAGE", { pillarId: project.pillarId }))
      return actionResult(403, "You cannot delete projects in this pillar");
    const response = await client.remove(project.id);
    if (response.success) {
      revalidatePath("/projects");
      revalidatePath("/dashboard");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not delete the project");
  }
}

export async function saveProjectAction(input: unknown) {
  const session = await requireSession();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success)
    return actionResult(422, parsed.error.issues[0]?.message ?? "Check the project details");
  if (!hasPermission(session.grants, "NARRATIVE_REPORT_MANAGE", { pillarId: parsed.data.pillarId }))
    return actionResult(403, "You cannot manage projects in this pillar");
  try {
    const client = await api();
    const { id, ...rest } = parsed.data;
    const response = id ? await client.update({ ...rest, id }) : await client.create(rest);
    if (response.success) {
      revalidatePath("/projects");
      revalidatePath("/grants");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save the project");
  }
}
