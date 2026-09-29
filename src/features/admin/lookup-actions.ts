"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createAdminApi } from "./api";
import { lookupActionSchema, lookupActiveActionSchema, lookupTableSchema, lookupUpdateActionSchema, type LookupTable } from "./schemas";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(160);
const shapes = {
  pillar: z.strictObject({ code: z.string().trim().min(1).max(20).regex(/^[A-Z0-9_]+$/), name: name.max(120), focus_description: z.string().trim().max(1000).nullable().optional(), lead_user_id: id.nullable().optional() }),
  county: z.strictObject({ name: name.max(60) }),
  sub_county: z.strictObject({ name: name.max(80), county_id: id }),
  ward: z.strictObject({ name: name.max(80), sub_county_id: id }),
  donor: z.strictObject({ name, notes: z.string().trim().max(1000).nullable().optional() }),
  business_sector: z.strictObject({ name: name.max(80) }),
  case_type: z.strictObject({ name: name.max(120), pillar_id: id.nullable().optional(), requires_p3_prc_forms: z.boolean(), default_route: z.enum(["mediation_adr_first", "court_direct"]) }),
  partner_institution: z.strictObject({ name, institution_type: z.string().trim().min(1).max(30), county_id: id.nullable().optional(), contact_details: z.string().trim().max(255).nullable().optional() }),
  activity_type_definition: z.strictObject({ name: name.max(120), pillar_id: id, description: z.string().trim().max(1000).nullable().optional() }),
} as const;
const outcome = (resultCode: number, message: string, rowId?: number) => ({ resultCode, success: resultCode < 400, message, data: rowId ? { id: rowId } : null });
async function api() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createAdminApi(createPortalApiClient(), token); }
function refresh(table: LookupTable) { revalidatePath(`/admin/lookups/${table}`); }
function validateValues(table: LookupTable, values: Record<string, unknown>, updating = false) {
  const schema = shapes[table];
  return (updating ? schema.partial() : schema).safeParse(values);
}
export async function createLookupAction(input: unknown) {
  const session = await requireSession();
  const parsed = lookupActionSchema.safeParse(input);
  if (!parsed.success) return outcome(lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404, "Unknown lookup or invalid details");
  if (!hasPermission(session.grants, "LOOKUP_MANAGE")) return outcome(403, "Permission denied");
  const values = validateValues(parsed.data.table, parsed.data.values); if (!values.success) return outcome(422, "Check lookup details");
  try { const response = await (await api()).createLookup(parsed.data.table, values.data); if (response.success) refresh(parsed.data.table); return outcome(response.resultCode, response.message, response.data?.id); }
  catch { return outcome(500, "Could not create lookup"); }
}
export async function updateLookupAction(input: unknown) {
  const session = await requireSession(); const parsed = lookupUpdateActionSchema.safeParse(input);
  if (!parsed.success) return outcome(lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404, "Unknown lookup or invalid details");
  if (!hasPermission(session.grants, "LOOKUP_MANAGE")) return outcome(403, "Permission denied");
  const values = validateValues(parsed.data.table, parsed.data.values, true); if (!values.success || Object.keys(values.data).length === 0) return outcome(422, "Check lookup details");
  try { const response = await (await api()).updateLookup(parsed.data.table, parsed.data.id, values.data); if (response.success) refresh(parsed.data.table); return outcome(response.resultCode, response.message, response.data?.id); }
  catch { return outcome(500, "Could not update lookup"); }
}
export async function setLookupActiveAction(input: unknown) {
  const session = await requireSession(); const parsed = lookupActiveActionSchema.safeParse(input);
  if (!parsed.success) return outcome(lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404, "Unknown lookup or invalid details");
  if (!hasPermission(session.grants, "LOOKUP_MANAGE")) return outcome(403, "Permission denied");
  try { const response = await (await api()).updateLookup(parsed.data.table, parsed.data.id, { status: parsed.data.active ? "ACTIVE" : "INACTIVE", is_deleted: !parsed.data.active }); if (response.success) refresh(parsed.data.table); return outcome(response.resultCode, response.message, response.data?.id); }
  catch { return outcome(500, "Could not update lookup"); }
}
