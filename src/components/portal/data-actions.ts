"use server";
import { z } from "zod";
import { readSessionToken } from "@/lib/api/session-api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { API_ROUTE_TEMPLATES, type ApiRouteTemplate } from "@/lib/api/transport";
import type { RevealResult } from "@/components/ui/masked-field";
import type { ExportResult } from "@/components/ui/export-button";

export interface PortalDataTarget {
  path: string;
  routeTemplate: ApiRouteTemplate;
  query?: Record<string, string | number | boolean | undefined>;
}
const envelope = z.object({
  success: z.boolean(),
  resultCode: z.number(),
  message: z.string(),
  data: z.unknown(),
});
function validTarget(target: PortalDataTarget) {
  if (
    !target ||
    !API_ROUTE_TEMPLATES.includes(target.routeTemplate) ||
    target.routeTemplate.startsWith("/auth/")
  )
    return false;
  const pattern = "^" + target.routeTemplate.replace(/:[a-z]+/g, "[A-Za-z0-9_-]+") + "$";
  return new RegExp(pattern).test(target.path);
}
async function read(target: PortalDataTarget, extra: Record<string, string>) {
  if (!validTarget(target)) throw new Error("Invalid resource");
  const token = await readSessionToken();
  if (!token) throw new Error("Sign in required");
  return createPortalApiClient().request(
    {
      method: "GET",
      path: target.path,
      routeTemplate: target.routeTemplate,
      query: { ...target.query, ...extra },
      token,
    },
    envelope
  );
}
export async function auditedRevealAction(
  target: PortalDataTarget,
  field: string
): Promise<RevealResult> {
  if (field === "password_hash") return { success: false, error: "This field cannot be revealed." };
  try {
    const result = await read(target, { reveal: field });
    if (!result.success) return { success: false, error: result.message };
    const data = z.record(z.string(), z.unknown()).parse(result.data);
    const value = data[field];
    if (value !== null && !["string", "number", "boolean"].includes(typeof value))
      return { success: false, error: "The field is unavailable." };
    return { success: true, value: value === null ? "—" : String(value) };
  } catch {
    return { success: false, error: "Could not reveal this field. Please try again." };
  }
}
export async function auditedExportAction(target: PortalDataTarget): Promise<ExportResult> {
  try {
    const result = await read(target, { format: "csv" });
    if (!result.success) return { success: false, error: result.message };
    const data = z.object({ filename: z.string(), content: z.string() }).parse(result.data);
    return { success: true, ...data };
  } catch {
    return { success: false, error: "Could not export records. Please try again." };
  }
}
