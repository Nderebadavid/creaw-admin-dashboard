"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createReportingApi, type ReportQuery } from "./api";
import { deadlineInputSchema, submitInputSchema } from "./schemas";
const result = (resultCode: number, message: string) => ({ resultCode, success: resultCode < 400, message });
async function api() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createReportingApi(createPortalApiClient(), token); }
export async function listReportsAction(query: ReportQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE") && !hasModulePermission(session.grants, "GRANT_REPORT_VIEW")) return { ...result(403, "Permission denied"), data: null };
  try { return { ...result(200, "OK"), data: await (await api()).list(query) }; } catch { return { ...result(500, "Could not load reports"), data: null }; }
}
export async function addDeadlineAction(input: unknown) {
  const session = await requireSession(); const parsed = deadlineInputSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the deadline details");
  try {
    const client = await api(); const project = (await client.catalog()).projects.find(item => item.id === parsed.data.projectId);
    if (!project) return result(404, "Project not found");
    if (!hasPermission(session.grants, "NARRATIVE_REPORT_MANAGE", { pillarId: project.pillar_id })) return result(403, "Permission denied");
    const response = await client.addDeadline(parsed.data);
    if (response.success) revalidatePath("/reporting");
    return result(response.resultCode, response.message);
  } catch { return result(500, "Could not add deadline"); }
}
export async function submitReportAction(input: unknown) {
  const session = await requireSession(); const parsed = submitInputSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the submission details");
  try {
    const client = await api(); const report = await client.get(parsed.data.type, parsed.data.id);
    if (!report) return result(404, "Report not found");
    const permission = parsed.data.type === "grant" ? "GRANT_REPORT_MANAGE" : "NARRATIVE_REPORT_MANAGE";
    if (!hasPermission(session.grants, permission, { pillarId: report.pillarId }) || parsed.data.fileUrl && !hasPermission(session.grants, "DOCUMENT_UPLOAD", { pillarId: report.pillarId })) return result(403, "Permission denied");
    const response = await client.submit(parsed.data.type, parsed.data.id, parsed.data.date, parsed.data.fileUrl);
    if (response.success) revalidatePath("/reporting");
    return result(response.resultCode, response.message);
  } catch { return result(500, "Could not submit report"); }
}
export async function exportReportsAction(query: ReportQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "REPORT_EXPORT_CSV") || !hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE") && !hasModulePermission(session.grants, "GRANT_REPORT_VIEW")) return { success: false as const, error: "Permission denied" };
  try { const response = await (await api()).export(query); return response.success && response.data ? { success: true as const, filename: response.data.filename, content: response.data.content } : { success: false as const, error: response.message }; }
  catch { return { success: false as const, error: "Could not export reports" }; }
}
export async function viewReportDocumentAction(type: "narrative" | "grant", id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1 || !["narrative", "grant"].includes(type)) return result(422, "Invalid report");
  try {
    const client = await api(); const report = await client.get(type, id);
    if (!report || !report.documentId) return result(404, "Document not found");
    if (!hasPermission(session.grants, type === "grant" ? "GRANT_REPORT_VIEW" : "NARRATIVE_REPORT_MANAGE", { pillarId: report.pillarId }) || !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: report.pillarId })) return result(403, "Permission denied");
    const response = await client.viewDocument(report.documentId);
    return result(response.resultCode, response.message);
  } catch { return result(500, "Could not open document" ); }
}
