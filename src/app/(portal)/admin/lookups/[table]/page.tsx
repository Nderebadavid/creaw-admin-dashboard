import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createAdminApi, type LookupView } from "@/features/admin/api";
import { lookupTableSchema, type LookupTable } from "@/features/admin/schemas";
import { LookupContent } from "@/features/admin/lookup-components";

async function allRows(api: ReturnType<typeof createAdminApi>, table: LookupTable) {
  const rows: LookupView[] = [];
  for (let page = 1; ; page++) {
    const result = await api.lookupList(table, { page, pageSize: 100 });
    rows.push(...result.items);
    if (page >= result.totalPages) return rows;
  }
}
export default async function LookupPage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<{ countyId?: string; subCountyId?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.grants, "LOOKUP_MANAGE")) notFound();
  const { table: candidate } = await params;
  const parsed = lookupTableSchema.safeParse(candidate);
  if (!parsed.success) notFound();
  const table = parsed.data;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) notFound();
  const api = createAdminApi(createPortalApiClient(), token);
  const query = await searchParams;
  const countyId = query.countyId ? Number(query.countyId) : null,
    subCountyId = query.subCountyId ? Number(query.subCountyId) : null;
  if (
    (countyId !== null && (!Number.isSafeInteger(countyId) || countyId < 1)) ||
    (subCountyId !== null && (!Number.isSafeInteger(subCountyId) || subCountyId < 1))
  )
    notFound();
  const needsCounties = ["county", "sub_county", "ward", "partner_institution"].includes(table),
    needsSubCounties = table === "ward",
    needsPillars = ["pillar", "case_type", "activity_type_definition"].includes(table);
  const needsActivityTypes = table === "activity_topic";
  const [rows, countyRows, subCountyRows, pillarRows, activityTypeRows] = await Promise.all([
    allRows(api, table),
    needsCounties ? allRows(api, "county") : [],
    needsSubCounties ? allRows(api, "sub_county") : [],
    needsPillars ? allRows(api, "pillar") : [],
    needsActivityTypes ? allRows(api, "activity_type_definition") : [],
  ]);
  const counties = countyRows
    .filter((row) => !row.is_deleted)
    .map((row) => ({ id: row.id, name: row.name }));
  const subCounties = subCountyRows
    .filter((row) => !row.is_deleted)
    .map((row) => ({ id: row.id, name: row.name, countyId: row.county_id ?? null }));
  const pillars = pillarRows
    .filter((row) => !row.is_deleted)
    .map((row) => ({ id: row.id, name: row.name }));
  const activityTypes = activityTypeRows
    .filter((row) => !row.is_deleted)
    .map((row) => ({ id: row.id, name: row.name }));
  const county = countyId ? countyRows.find((row) => row.id === countyId && !row.is_deleted) : null;
  const subCounty = subCountyId
    ? subCountyRows.find((row) => row.id === subCountyId && !row.is_deleted)
    : null;
  if (
    (table === "sub_county" && countyId && !county) ||
    (table === "ward" &&
      subCountyId &&
      (!subCounty || (countyId && subCounty.county_id !== countyId)))
  )
    notFound();
  const parent =
    table === "sub_county" && county
      ? { id: county.id, name: county.name, parentId: null }
      : table === "ward" && subCounty
        ? { id: subCounty.id, name: subCounty.name, parentId: subCounty.county_id ?? null }
        : null;
  const visibleRows =
    table === "sub_county" && county
      ? rows.filter((row) => row.county_id === county.id)
      : table === "ward" && subCounty
        ? rows.filter((row) => row.sub_county_id === subCounty.id)
        : rows;
  return (
    <>
      <PageHeading
        title="Lookup & reference data"
        section="Admin"
        description="County → sub-county → ward, and the reference tables every form points at"
      />
      <LookupContent
        table={table}
        rows={visibleRows}
        parent={parent}
        counties={counties}
        subCounties={subCounties}
        pillars={pillars}
        activityTypes={activityTypes}
        canViewAudit={hasPermission(session.grants, "AUDIT_LOG_VIEW")}
        canExport={hasPermission(session.grants, "REPORT_EXPORT_CSV")}
      />
    </>
  );
}
