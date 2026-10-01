/**
 * Typed client for the donors who fund CREAW's projects. Donors are shared across
 * pillars; the API derives each donor's project and award figures for the caller.
 */
import type { ApiClient } from "@/lib/api/client";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  donorDetailSchema,
  donorListSchema,
  donorMutationSchema,
  type DonorDto,
  type DonorInput,
} from "./schemas";

export const DONOR_SORT_KEYS: Record<string, string> = {
  donor: "name",
  projects: "projects_count",
  active: "active_projects_count",
  awarded: "awarded_total",
  record: "status",
  updated: "updated_at",
};

export interface DonorView {
  id: number;
  name: string;
  notes: string | null;
  status: string;
  statusDescription: string | null;
  created: string;
  updated: string;
  projects: number | null;
  activeProjects: number | null;
  awarded: number | null;
}
export interface DonorDetail {
  projects: {
    id: number;
    name: string;
    pillarId: number;
    pillar: string;
    status: string;
    end: string | null;
  }[];
}

export function toDonorView(row: DonorDto): DonorView {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: row.status,
    statusDescription: row.status_description,
    created: row.created_at,
    updated: row.updated_at,
    projects: row.projects_count,
    activeProjects: row.active_projects_count,
    awarded: row.awarded_total,
  };
}

const body = (input: DonorInput) => ({
  name: input.name,
  notes: input.notes || null,
  ...(input.status
    ? { status: input.status, status_description: input.statusDescription || null }
    : {}),
});

export function createDonorsApi(client: ApiClient, token: string) {
  const item = (id: number) => ({
    path: `/donors/${id}`,
    routeTemplate: "/donors/:id" as const,
    token,
  });
  return {
    async list(query: ListQuery = {}): Promise<PaginatedData<DonorView>> {
      const response = await client.request(
        {
          method: "GET",
          path: "/donors",
          routeTemplate: "/donors",
          token,
          query: listParams(query, DONOR_SORT_KEYS, { sort: "name:asc" }),
        },
        donorListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: response.data.items.map(toDonorView) };
    },
    async get(id: number): Promise<DonorView | null> {
      const response = await client.request({ method: "GET", ...item(id) }, donorDetailSchema);
      return response.success && response.data ? toDonorView(response.data) : null;
    },
    /** A donor's projects in the pillars the caller can see, loaded when the drawer opens. */
    async detail(id: number): Promise<DonorDetail | null> {
      const response = await client.request(
        { method: "GET", ...item(id), query: { include: "projects" } },
        donorDetailSchema
      );
      if (!response.success || !response.data) return null;
      return {
        projects: response.data.projects.map((row) => ({
          id: row.id,
          name: row.name,
          pillarId: row.pillar_id,
          pillar: row.pillar_name ?? "Pillar",
          status: row.status,
          end: row.end_date,
        })),
      };
    },
    create(input: DonorInput) {
      return client.request(
        { method: "POST", path: "/donors", routeTemplate: "/donors", token, body: body(input) },
        donorMutationSchema
      );
    },
    update(input: DonorInput & { id: number }) {
      return client.request(
        { method: "PATCH", ...item(input.id), body: body(input) },
        donorMutationSchema
      );
    },
    setStatus(id: number, status: "ACTIVE" | "INACTIVE", reason?: string) {
      return client.request(
        {
          method: "PATCH",
          ...item(id),
          body: { status, status_description: status === "ACTIVE" ? null : reason || null },
        },
        donorMutationSchema
      );
    },
    /** Removes the donor from every list; refused while projects still point at it. */
    remove(id: number) {
      return client.request(
        { method: "PATCH", ...item(id), body: { is_deleted: true } },
        donorMutationSchema
      );
    },
  };
}

export const donorsApi = {
  async list(query: ListQuery = {}) {
    return (await withSessionApi(createDonorsApi)).list(query);
  },
};
