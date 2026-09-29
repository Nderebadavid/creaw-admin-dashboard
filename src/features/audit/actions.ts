"use server";
import { requireSession } from "@/lib/auth/session-server";
import { withSessionApi } from "@/lib/api/session-api";
import { hasPermission } from "@/lib/auth/permissions";
import { createAuditApi } from "./api";
import { auditQuerySchema, type AuditQuery } from "./schemas";

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
    return {
      resultCode: 200,
      success: true,
      message: "OK",
      data: await (await api()).list(parsed.data),
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
