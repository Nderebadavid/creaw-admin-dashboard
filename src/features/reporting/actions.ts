"use server";
import type { ViewedDocument } from "@/components/ui/document-viewer";
/**
 * Server Actions for reporting deadlines, submissions and document access.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { sortedPage } from "@/lib/api/sorted-page";
import { reportSortValues } from "./sort-values";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createReportingApi, type ReportQuery } from "./api";
import { deadlineInputSchema, submitInputSchema } from "./schemas";
function api() {
  return withSessionApi(createReportingApi);
}
export async function listReportsAction(query: ReportQuery) {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE") &&
    !hasModulePermission(session.grants, "GRANT_REPORT_VIEW")
  )
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const { list } = await api();
    return {
      ...actionResult(200, "OK"),
      data: await sortedPage((filters: ReportQuery) => list(filters), query, reportSortValues),
    };
  } catch {
    return { ...actionResult(500, "Could not load reports"), data: null };
  }
}
export async function addDeadlineAction(input: unknown) {
  const session = await requireSession();
  const parsed = deadlineInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the deadline details");
  try {
    const client = await api();
    const project = (await client.catalog()).projects.find(
      (item) => item.id === parsed.data.projectId
    );
    if (!project) return actionResult(404, "Project not found");
    if (!hasPermission(session.grants, "NARRATIVE_REPORT_MANAGE", { pillarId: project.pillar_id }))
      return actionResult(403, "Permission denied");
    const response = await client.addDeadline(parsed.data);
    if (response.success) revalidatePath("/reporting");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not add deadline");
  }
}
export async function submitReportAction(input: unknown) {
  const session = await requireSession();
  const parsed = submitInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the submission details");
  try {
    const client = await api();
    const report = await client.get(parsed.data.type, parsed.data.id);
    if (!report) return actionResult(404, "Report not found");
    const permission =
      parsed.data.type === "grant" ? "GRANT_REPORT_MANAGE" : "NARRATIVE_REPORT_MANAGE";
    if (
      !hasPermission(session.grants, permission, { pillarId: report.pillarId }) ||
      (parsed.data.fileUrl &&
        !hasPermission(session.grants, "DOCUMENT_UPLOAD", { pillarId: report.pillarId }))
    )
      return actionResult(403, "Permission denied");
    const response = await client.submit(
      parsed.data.type,
      parsed.data.id,
      parsed.data.date,
      parsed.data.fileUrl
    );
    if (response.success) revalidatePath("/reporting");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not submit report");
  }
}
export async function exportReportsAction(query: ReportQuery) {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "REPORT_EXPORT_CSV") ||
    (!hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE") &&
      !hasModulePermission(session.grants, "GRANT_REPORT_VIEW"))
  )
    return { success: false as const, error: "Permission denied" };
  try {
    const response = await (await api()).export(query);
    return response.success && response.data
      ? { success: true as const, filename: response.data.filename, content: response.data.content }
      : { success: false as const, error: response.message };
  } catch {
    return { success: false as const, error: "Could not export reports" };
  }
}
export async function viewReportDocumentAction(type: "narrative" | "grant", id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1 || !["narrative", "grant"].includes(type))
    return { ...actionResult(422, "Invalid report"), document: null };
  try {
    const client = await api();
    const report = await client.get(type, id);
    if (!report || !report.documentId)
      return { ...actionResult(404, "Document not found"), document: null };
    if (
      !hasPermission(
        session.grants,
        type === "grant" ? "GRANT_REPORT_VIEW" : "NARRATIVE_REPORT_MANAGE",
        { pillarId: report.pillarId }
      ) ||
      !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: report.pillarId })
    )
      return { ...actionResult(403, "Permission denied"), document: null };
    const response = await client.viewDocument(report.documentId);
    const file = response.success ? response.data : null;
    return {
      ...actionResult(response.resultCode, response.message),
      document: file
        ? ({
            id: file.id,
            name: report.title,
            documentType: file.document_type,
            fileUrl: file.file_url,
            linkedRecord: `${report.project} · ${report.type === "grant" ? "Grant compliance" : "Narrative report"}`,
            uploadedAt: report.submittedDate,
          } satisfies ViewedDocument)
        : null,
    };
  } catch {
    return { ...actionResult(500, "Could not open document"), document: null };
  }
}
