import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope } from "../core";
import { calendarRows, filteredCalendarRows } from "../reporting";
import { makeRow } from "../rows";
import { type ApiEnvelope } from "@/types/api";

/** Reporting catalogue and calendar projections under `/reports`. */
export function handleReportViews(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, query, userId, grants } = ctx;
  if (url.pathname === "/reports" && query.get("catalog") === "true") {
    if (request.method !== "GET" || [...query.keys()].some((key) => key !== "catalog"))
      return envelope(422);
    if (
      !grants.some((grant) =>
        ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"].includes(
          grant.permissionCode
        )
      )
    )
      return envelope(403);
    const projects = store.project
      .filter(
        (project) =>
          !project.is_deleted &&
          hasPermission(grants, "NARRATIVE_REPORT_MANAGE", { pillarId: project.pillar_id })
      )
      .map((project) => ({
        id: project.id,
        pillar_id: project.pillar_id,
        name: project.name,
        donor_id: project.donor_id,
      }));
    const pillarIds = new Set([
      ...calendarRows(store, grants).map((row) => row.pillarId),
      ...projects.map((row) => row.pillar_id),
      ...store.project
        .filter(
          (project) =>
            !project.is_deleted &&
            hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: project.pillar_id })
        )
        .map((row) => row.pillar_id),
    ]);
    const pillars = store.pillar
      .filter((pillar) => !pillar.is_deleted && pillarIds.has(pillar.id))
      .map((pillar) => ({ id: pillar.id, name: pillar.name, lead_user_id: pillar.lead_user_id }));
    const owners = [
      ...new Set(
        pillars.map((pillar) => pillar.lead_user_id).filter((id): id is number => id !== null)
      ),
    ]
      .map((id) => store.user.find((user) => user.id === id && !user.is_deleted))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({ id: user.id, name: `${user.first_name} ${user.last_name}` }));
    const awards = store.grant_award
      .filter((award) => !award.is_deleted)
      .map((award) => ({
        award,
        application: store.grant_application.find(
          (application) => !application.is_deleted && application.id === award.application_id
        ),
      }))
      .filter(
        ({ application }) =>
          application?.status === "APPROVED" &&
          store.project.some(
            (project) =>
              !project.is_deleted &&
              project.id === application.project_id &&
              hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: project.pillar_id })
          )
      )
      .map(({ award, application }) => ({
        id: award.id,
        applicationId: application!.id,
        projectId: application!.project_id,
        pillarId: store.project.find((project) => project.id === application!.project_id)!
          .pillar_id,
      }));
    return envelope(200, { projects, pillars, owners, awards });
  }
  if (url.pathname === "/reports" && query.get("calendar") === "true") {
    if (
      request.method !== "GET" ||
      [...query.keys()].some(
        (key) =>
          ![
            "calendar",
            "format",
            "pillarId",
            "ownerId",
            "status",
            "search",
            "page",
            "pageSize",
          ].includes(key)
      )
    )
      return envelope(422);
    if (
      !grants.some((grant) =>
        ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"].includes(
          grant.permissionCode
        )
      )
    )
      return envelope(403);
    const records = filteredCalendarRows(store, grants, query);
    if (!records) return envelope(422);
    if (!query.has("format")) {
      const page = Number(query.get("page") ?? 1),
        pageSize = Number(query.get("pageSize") ?? 25);
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      )
        return envelope(422);
      return envelope(200, {
        items: records.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        totalItems: records.length,
        totalPages: Math.ceil(records.length / pageSize),
      });
    }
    if (
      query.get("format") !== "csv" ||
      !grants.some((grant) => grant.permissionCode === "REPORT_EXPORT_CSV") ||
      records.some((row) => !hasPermission(grants, "REPORT_EXPORT_CSV", { pillarId: row.pillarId }))
    )
      return envelope(403);
    const cell = (value: unknown) =>
      '"' +
      (/^[=+\-@\t\r\n]/.test(String(value)) ? "'" : "") +
      String(value ?? "").replaceAll('"', '""') +
      '"';
    const content = [
      "type,id,title,programme,pillar_id,owner_id,due_date,status",
      ...records.map((item) =>
        [
          item.type,
          item.id,
          item.title,
          item.project,
          item.pillarId,
          item.ownerId ?? "",
          item.dueDate,
          item.status,
        ]
          .map(cell)
          .join(",")
      ),
    ].join("\r\n");
    const now = new Date().toISOString();
    store.audit_logs.push(
      makeRow(
        "audit_logs",
        {
          entity_type: "narrative_report",
          action: "EXPORT",
          source: "HTTP",
          performed_by: userId,
          performed_at: now,
          endpoint: request.routeTemplate,
        },
        Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1,
        now
      )
    );
    return envelope(200, {
      filename: "reporting-calendar.csv",
      content,
      totalItems: records.length,
    });
  }
  return undefined;
}
