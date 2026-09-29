import { type EffectiveGrant } from "../auth/permissions";
import { allowed, type Row } from "./core";
import { type MockStore } from "@/types/db";

// Grant sign-off history and the reporting-calendar projection.
export function signoffActors(store: MockStore, applicationId: number) {
  let preparedBy: number | null = null,
    reviewedBy: number | null = null,
    approvedBy: number | null = null;
  for (const entry of store.audit_logs
    .filter(
      (row) =>
        row.entity_type === "grant_application" &&
        row.entity_id === applicationId &&
        row.source === "HTTP" &&
        ((row.action === "UPDATE" && row.endpoint === "/grants/:id") ||
          (row.action === "CREATE" && ["/grants", "/pillars/:pillar"].includes(row.endpoint ?? "")))
    )
    .sort((a, b) => a.id - b.id)) {
    let before: string | undefined, after: string | undefined;
    try {
      before = JSON.parse(entry.previous_state ?? "{}").status;
      after = JSON.parse(entry.new_state ?? "{}").status;
    } catch {
      continue;
    }
    if (
      (entry.action === "CREATE" && after === "PREPARED" && entry.performed_by) ||
      (before === "ACTIVE" && after === "PREPARED" && entry.performed_by)
    ) {
      preparedBy = entry.performed_by;
      reviewedBy = null;
      approvedBy = null;
    }
    if (
      before === "PREPARED" &&
      after === "REVIEWED" &&
      preparedBy &&
      entry.performed_by &&
      entry.performed_by !== preparedBy
    ) {
      reviewedBy = entry.performed_by;
      approvedBy = null;
    }
    if (
      before === "REVIEWED" &&
      after === "APPROVED" &&
      preparedBy &&
      reviewedBy &&
      entry.performed_by &&
      ![preparedBy, reviewedBy].includes(entry.performed_by)
    )
      approvedBy = entry.performed_by;
  }
  return { preparedBy, reviewedBy, approvedBy };
}
export function calendarRows(store: MockStore, grants: EffectiveGrant[]) {
  const projects = new Map(
    store.project.filter((row) => !row.is_deleted).map((row) => [row.id, row])
  );
  const pillars = new Map(
    store.pillar.filter((row) => !row.is_deleted).map((row) => [row.id, row])
  );
  const relationForAward = (awardId: number) => {
    const award = store.grant_award.find((row) => row.id === awardId && !row.is_deleted);
    const application = store.grant_application.find(
      (row) => row.id === award?.application_id && !row.is_deleted
    );
    return {
      applicationId: application?.id ?? null,
      project: application && projects.get(application.project_id),
    };
  };
  const present = (
    type: "narrative" | "grant",
    row: (typeof store.narrative_report)[number] | (typeof store.grant_report)[number],
    project: (typeof store.project)[number] | undefined,
    dueDate: string,
    title: string,
    submittedDate: string | null,
    documentId: number | null,
    storedStatus?: string,
    applicationId: number | null = null
  ) => {
    if (!project) return null;
    const pillar = pillars.get(project.pillar_id);
    if (!pillar) return null;
    const owner = store.user.find((user) => user.id === pillar.lead_user_id && !user.is_deleted);
    const document =
      documentId && store.document.find((item) => item.id === documentId && !item.is_deleted);
    return {
      key: `${type}-${row.id}`,
      id: row.id,
      type,
      applicationId,
      title,
      project: project.name,
      pillarId: project.pillar_id,
      pillar: pillar.name,
      ownerId: pillar.lead_user_id,
      ownerName: owner ? `${owner.first_name} ${owner.last_name}` : null,
      periodStart: row.reporting_period_start,
      periodEnd: row.reporting_period_end,
      dueDate,
      status:
        submittedDate || storedStatus === "submitted"
          ? "submitted"
          : storedStatus === "overdue" || dueDate < new Date().toISOString().slice(0, 10)
            ? "overdue"
            : "pending",
      submittedDate,
      documentId:
        document && allowed(store, grants, "DOCUMENT_VIEW", "document", document as unknown as Row)
          ? document.id
          : null,
    };
  };
  return [
    ...store.narrative_report
      .filter(
        (row) =>
          !row.is_deleted &&
          allowed(
            store,
            grants,
            "NARRATIVE_REPORT_MANAGE",
            "narrative_report",
            row as unknown as Row
          )
      )
      .map((row) =>
        present(
          "narrative",
          row,
          projects.get(row.project_id),
          row.reporting_period_end,
          row.notes ?? `Narrative report #${row.id}`,
          row.submitted_date,
          store.document.find(
            (document) =>
              !document.is_deleted &&
              document.owner_type === "narrative_report" &&
              document.owner_id === row.id
          )?.id ?? null,
          row.report_status
        )
      ),
    ...store.grant_report
      .filter(
        (row) =>
          !row.is_deleted &&
          (allowed(store, grants, "GRANT_REPORT_VIEW", "grant_report", row as unknown as Row) ||
            allowed(store, grants, "GRANT_REPORT_MANAGE", "grant_report", row as unknown as Row))
      )
      .map((row) => {
        const relation = relationForAward(row.grant_award_id);
        return present(
          "grant",
          row,
          relation.project,
          row.due_date,
          row.notes ?? `Grant report #${row.id}`,
          row.submitted_date,
          row.document_id,
          undefined,
          relation.applicationId
        );
      }),
  ]
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
}
export function filteredCalendarRows(
  store: MockStore,
  grants: EffectiveGrant[],
  query: URLSearchParams
) {
  const pillarId = query.has("pillarId") ? Number(query.get("pillarId")) : undefined;
  const ownerId = query.has("ownerId") ? Number(query.get("ownerId")) : undefined;
  if (
    (pillarId !== undefined && (!Number.isSafeInteger(pillarId) || pillarId < 1)) ||
    (ownerId !== undefined && (!Number.isSafeInteger(ownerId) || ownerId < 1))
  )
    return null;
  const search = query.get("search")?.toLowerCase();
  return calendarRows(store, grants).filter(
    (row) =>
      (pillarId === undefined || row.pillarId === pillarId) &&
      (ownerId === undefined || row.ownerId === ownerId) &&
      (!query.get("status") || row.status === query.get("status")) &&
      (!search || `${row.title} ${row.project} ${row.pillar}`.toLowerCase().includes(search))
  );
}
