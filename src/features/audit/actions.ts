"use server";
/**
 * Server Actions for audit trail paging and CSV export.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */
import { requireSession } from "@/lib/auth/session-server";
import { withSessionApi } from "@/lib/api/session-api";
import { hasPermission } from "@/lib/auth/permissions";
import { sortedPage } from "@/lib/api/sorted-page";
import { createAuditApi } from "./api";
import { auditQuerySchema, type AuditQuery } from "./schemas";
import { auditSortValues } from "./sort-values";

function api() {
  return withSessionApi(createAuditApi);
}
export async function listAuditAction(query: AuditQuery) {
  const session = await requireSession();
  if (!hasPermission(session.grants, "AUDIT_LOG_VIEW"))
    return { resultCode: 403, success: false, message: "Permission denied", data: null };
  const parsed = auditQuerySchema.safeParse(query);
  if (!parsed.success)
    return { resultCode: 422, success: false, message: "Check audit filters", data: null };
  try {
    const audit = await api();
    const { sort, ...filters } = parsed.data;
    return {
      resultCode: 200,
      success: true,
      message: "OK",
      // The trail can be very long, so the one sort the API supports is left
      // to it; other columns are sorted here across every matching entry.
      data:
        sort?.by === "when"
          ? await audit.list(filters, sort.order)
          : await sortedPage(
              (query: AuditQuery) => audit.list(query),
              parsed.data,
              auditSortValues
            ),
    };
  } catch {
    return { resultCode: 500, success: false, message: "Could not load audit entries", data: null };
  }
}
export async function exportAuditAction(query: AuditQuery) {
  const session = await requireSession();
  if (
    !hasPermission(session.grants, "AUDIT_LOG_VIEW") ||
    !hasPermission(session.grants, "REPORT_EXPORT_CSV")
  )
    return { success: false as const, error: "Permission denied" };
  const parsed = auditQuerySchema.safeParse(query);
  if (!parsed.success) return { success: false as const, error: "Check audit filters" };
  try {
    const data = await (await api()).export(parsed.data);
    return { success: true as const, filename: data.filename, content: data.content };
  } catch {
    return { success: false as const, error: "Could not export audit entries" };
  }
}
