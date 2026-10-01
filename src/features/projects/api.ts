/**
 * Typed client for funded projects: one row per initiative with its pillar, donor,
 * dates and the grant figures the API derives for the caller. Reads and writes go
 * through /projects; the API scopes everything to the caller's pillars.
 */
import type { ApiClient } from "@/lib/api/client";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  projectDetailSchema,
  projectListSchema,
  projectMutationSchema,
  projectOptionsSchema,
  type ProjectDto,
  type ProjectInput,
} from "./schemas";

/** The register's column ids and the API fields they sort by. */
export const PROJECT_SORT_KEYS: Record<string, string> = {
  project: "name",
  pillar: "pillar_name",
  donor: "donor_name",
  period: "start_date",
  applications: "applications_count",
  awarded: "awarded_total",
  disbursed: "disbursed_total",
  overdue: "reports_overdue",
  record: "status",
  updated: "updated_at",
};

export interface ProjectView {
  id: number;
  name: string;
  pillarId: number;
  pillar: string;
  donorId: number | null;
  donor: string | null;
  start: string | null;
  end: string | null;
  notes: string | null;
  status: string;
  statusDescription: string | null;
  created: string;
  updated: string;
  /** Null when the caller's grants do not cover that figure. */
  applications: number | null;
  awards: number | null;
  awarded: number | null;
  disbursed: number | null;
  reportsOverdue: number | null;
}
export interface ProjectDetail {
  applications: {
    id: number;
    applicant: string;
    amount: number;
    grantType: string;
    status: string;
  }[];
  reports: { id: number; period: string; due: string; submitted: string | null }[];
}
export interface ProjectOptions {
  pillars: { id: number; name: string }[];
  donors: { id: number; name: string }[];
}

export function toProjectView(row: ProjectDto): ProjectView {
  return {
    id: row.id,
    name: row.name,
    pillarId: row.pillar_id,
    pillar: row.pillar_name ?? "Pillar",
    donorId: row.donor_id,
    donor: row.donor_name,
    start: row.start_date,
    end: row.end_date,
    notes: row.notes,
    status: row.status,
    statusDescription: row.status_description,
    created: row.created_at,
    updated: row.updated_at,
    applications: row.applications_count,
    awards: row.awards_count,
    awarded: row.awarded_total,
    disbursed: row.disbursed_total,
    reportsOverdue: row.reports_overdue,
  };
}

const body = (input: ProjectInput) => ({
  pillar_id: input.pillarId,
  name: input.name,
  donor_id: input.donorId ?? null,
  start_date: input.startDate ?? null,
  end_date: input.endDate ?? null,
  notes: input.notes || null,
  ...(input.status
    ? { status: input.status, status_description: input.statusDescription || null }
    : {}),
});

export function createProjectsApi(client: ApiClient, token: string) {
  return {
    /** One page of projects; the API filters, searches and sorts. */
    async list(query: ListQuery = {}): Promise<PaginatedData<ProjectView>> {
      const response = await client.request(
        {
          method: "GET",
          path: "/projects",
          routeTemplate: "/projects",
          token,
          query: listParams(query, PROJECT_SORT_KEYS, { sort: "start_date:desc" }),
        },
        projectListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: response.data.items.map(toProjectView) };
    },
    /** A project's applications and reporting periods, loaded when its drawer opens. */
    async detail(id: number): Promise<ProjectDetail | null> {
      const response = await client.request(
        {
          method: "GET",
          path: `/projects/${id}`,
          routeTemplate: "/projects/:id",
          token,
          query: { include: "applications,reports" },
        },
        projectDetailSchema
      );
      if (!response.success || !response.data) return null;
      return {
        applications: response.data.applications.map((row) => ({
          id: row.id,
          applicant: row.participant_name ?? row.organisation_name ?? "Applicant",
          amount: row.requested_amount,
          grantType: row.grant_type,
          status: row.status,
        })),
        reports: response.data.reports.map((row) => ({
          id: row.id,
          period: `${row.reporting_period_start} – ${row.reporting_period_end}`,
          due: row.due_date,
          submitted: row.submitted_date,
        })),
      };
    },
    /** Pillars and donors for the project form, in one batched call. */
    async options(): Promise<ProjectOptions> {
      const response = await client.request(
        {
          method: "GET",
          path: "/lookups",
          routeTemplate: "/lookups",
          token,
          query: { tables: "pillar,donor" },
        },
        projectOptionsSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { pillars: response.data.tables.pillar, donors: response.data.tables.donor };
    },
    /** One project as the register shows it, or null when it is missing or out of scope. */
    async get(id: number): Promise<ProjectView | null> {
      const response = await client.request(
        { method: "GET", path: `/projects/${id}`, routeTemplate: "/projects/:id", token },
        projectDetailSchema
      );
      return response.success && response.data ? toProjectView(response.data) : null;
    },
    setStatus(id: number, status: "ACTIVE" | "INACTIVE", reason?: string) {
      return client.request(
        {
          method: "PATCH",
          path: `/projects/${id}`,
          routeTemplate: "/projects/:id",
          token,
          body: { status, status_description: status === "ACTIVE" ? null : reason || null },
        },
        projectMutationSchema
      );
    },
    /** Removes the project from every list; refused while grant applications are attached. */
    remove(id: number) {
      return client.request(
        {
          method: "PATCH",
          path: `/projects/${id}`,
          routeTemplate: "/projects/:id",
          token,
          body: { is_deleted: true },
        },
        projectMutationSchema
      );
    },
    create(input: ProjectInput) {
      return client.request(
        { method: "POST", path: "/projects", routeTemplate: "/projects", token, body: body(input) },
        projectMutationSchema
      );
    },
    update(input: ProjectInput & { id: number }) {
      return client.request(
        {
          method: "PATCH",
          path: `/projects/${input.id}`,
          routeTemplate: "/projects/:id",
          token,
          body: body(input),
        },
        projectMutationSchema
      );
    },
  };
}

export const projectsApi = {
  async list(query: ListQuery = {}) {
    return (await withSessionApi(createProjectsApi)).list(query);
  },
  async options() {
    return (await withSessionApi(createProjectsApi)).options();
  },
};
