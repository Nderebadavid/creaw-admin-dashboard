"use server";
/**
 * Server Actions for lookup and reference-data maintenance and export.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createAdminApi } from "./api";
import {
  lookupActionSchema,
  lookupActiveActionSchema,
  lookupExportActionSchema,
  lookupTableSchema,
  lookupUpdateActionSchema,
  type LookupTable,
} from "./schemas";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(160);
const shapes = {
  pillar: z.strictObject({
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^[A-Z0-9_]+$/),
    name: name.max(120),
    focus_description: z.string().trim().max(1000).nullable().optional(),
    lead_user_id: id.nullable().optional(),
  }),
  county: z.strictObject({ name: name.max(60) }),
  sub_county: z.strictObject({ name: name.max(80), county_id: id }),
  ward: z.strictObject({ name: name.max(80), sub_county_id: id }),
  donor: z.strictObject({ name, notes: z.string().trim().max(1000).nullable().optional() }),
  business_sector: z.strictObject({ name: name.max(80) }),
  case_type: z.strictObject({
    name: name.max(120),
    pillar_id: id.nullable().optional(),
    requires_p3_prc_forms: z.boolean(),
    default_route: z.enum(["mediation_adr_first", "court_direct"]),
  }),
  partner_institution: z.strictObject({
    name,
    institution_type: z.string().trim().min(1).max(30),
    county_id: id.nullable().optional(),
    contact_details: z.string().trim().max(255).nullable().optional(),
  }),
  activity_type_definition: z.strictObject({
    name: name.max(120),
    pillar_id: id,
    description: z.string().trim().max(1000).nullable().optional(),
  }),
} as const;
function api() {
  return withSessionApi(createAdminApi);
}
function refresh(table: LookupTable) {
  revalidatePath(`/admin/lookups/${table}`);
}
function validateValues(table: LookupTable, values: Record<string, unknown>, updating = false) {
  const schema = shapes[table];
  return (updating ? schema.partial() : schema).safeParse(values);
}
export async function createLookupAction(input: unknown) {
  const session = await requireSession();
  const parsed = lookupActionSchema.safeParse(input);
  if (!parsed.success)
    return actionResult(
      lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404,
      "Unknown lookup or invalid details"
    );
  if (!hasPermission(session.grants, "LOOKUP_MANAGE"))
    return actionResult(403, "Permission denied");
  const values = validateValues(parsed.data.table, parsed.data.values);
  if (!values.success) return actionResult(422, "Check lookup details");
  try {
    const response = await (await api()).createLookup(parsed.data.table, values.data);
    if (response.success) refresh(parsed.data.table);
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not create lookup");
  }
}
export async function updateLookupAction(input: unknown) {
  const session = await requireSession();
  const parsed = lookupUpdateActionSchema.safeParse(input);
  if (!parsed.success)
    return actionResult(
      lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404,
      "Unknown lookup or invalid details"
    );
  if (!hasPermission(session.grants, "LOOKUP_MANAGE"))
    return actionResult(403, "Permission denied");
  const values = validateValues(parsed.data.table, parsed.data.values, true);
  if (!values.success || Object.keys(values.data).length === 0)
    return actionResult(422, "Check lookup details");
  try {
    const response = await (
      await api()
    ).updateLookup(parsed.data.table, parsed.data.id, values.data);
    if (response.success) refresh(parsed.data.table);
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not update lookup");
  }
}
export async function setLookupActiveAction(input: unknown) {
  const session = await requireSession();
  const parsed = lookupActiveActionSchema.safeParse(input);
  if (!parsed.success)
    return actionResult(
      lookupTableSchema.safeParse((input as { table?: unknown } | null)?.table).success ? 422 : 404,
      "Unknown lookup or invalid details"
    );
  if (!hasPermission(session.grants, "LOOKUP_MANAGE"))
    return actionResult(403, "Permission denied");
  try {
    const response = await (
      await api()
    ).updateLookup(parsed.data.table, parsed.data.id, {
      status: parsed.data.active ? "ACTIVE" : "INACTIVE",
      is_deleted: !parsed.data.active,
    });
    if (response.success) refresh(parsed.data.table);
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not update lookup");
  }
}
export async function exportLookupAction(
  input: unknown
): Promise<
  { success: true; filename: string; content: string } | { success: false; error: string }
> {
  const session = await requireSession();
  const parsed = lookupExportActionSchema.safeParse(input);
  if (
    !parsed.success ||
    (parsed.data.parentId && !["sub_county", "ward"].includes(parsed.data.table))
  )
    return { success: false, error: "Invalid export selection." };
  if (
    !hasPermission(session.grants, "LOOKUP_MANAGE") ||
    !hasPermission(session.grants, "REPORT_EXPORT_CSV")
  )
    return { success: false, error: "Export permission required." };
  try {
    const response = await (
      await api()
    ).exportLookup(parsed.data.table, { ids: parsed.data.ids, parentId: parsed.data.parentId });
    return response.success && response.data
      ? { success: true, filename: response.data.filename, content: response.data.content }
      : { success: false, error: response.message };
  } catch {
    return { success: false, error: "Could not export lookup rows." };
  }
}
