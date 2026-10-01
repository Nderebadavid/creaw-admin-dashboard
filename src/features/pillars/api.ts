/**
 * Typed client for per-pillar overviews, programme records and each pillar's domain register.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { ApiClient } from "@/lib/api/client";
import { listParams, type ListQuery } from "@/lib/api/list";
import { readSessionToken } from "@/lib/api/session-api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import {
  pillarCodeSchema,
  pillarDomainMutationSchema,
  pillarEnrollmentListSchema,
  pillarMutationSchema,
  pillarSummarySchema,
  type PillarCode,
  type PillarSummaryDto,
} from "./schemas";
import { loadPillarDomain, type PillarDomainView } from "./domain-api";
import type { PaginatedData } from "@/types/api";

export class PillarApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}
export interface PillarRecord {
  id: number;
  pillarId: number;
  title: string;
  category: string;
  status: string;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  createdAt: string | null;
  updatedAt: string;
}
export interface PillarView {
  id: number;
  code: PillarCode;
  name: string;
  fullName: string;
  leadUserId: number | null;
  color: string;
  tint: string;
  target: number;
  /** The first page of programme records; further pages come from `listRecords`. */
  records: PillarRecord[];
  /** Every record in the pillar, and how many are active. */
  recordCount: number;
  activeCount: number;
  /** The pillar's headline cards, computed by the API for the caller's scope. */
  cards: PillarSummaryDto["cards"];
  /** The pillar's active projects, soonest to end first. */
  projects: PillarSummaryDto["projects"];
  stages: string[];
  /** The pipeline's stages in order, with their ids. */
  pipelineStages: { id: number; name: string }[];
  stageCounts?: { name: string; count: number }[] | null;
  /** The pillar lead's name, when the user may read it. */
  leadName?: string | null;
  /** Counties the pillar's participants live in, most common first. */
  counties?: string[];
  hasPipeline: boolean;
  domain?: PillarDomainView | null;
}

/** The record table column ids and the API fields they sort by. */
export const RECORD_SORT_KEYS: Record<string, string> = {
  record: "record_name",
  category: "entry_category",
  status: "status",
  updated: "updated_at",
};
const presentation: Record<
  PillarCode,
  { dbCode: string; color: string; tint: string; target: number; fullName: string }
> = {
  vawg: {
    dbCode: "VAWG",
    color: "#B4552E",
    tint: "#FBEDE5",
    target: 450,
    fullName: "Violence Against Women & Girls",
  },
  wee: {
    dbCode: "WEE",
    color: "#D9772B",
    tint: "#FDF0E3",
    target: 300,
    fullName: "Women's Economic Empowerment",
  },
  srhr: {
    dbCode: "SRHR",
    color: "#C9921F",
    tint: "#FCF3DF",
    target: 320,
    fullName: "Sexual & Reproductive Health Rights",
  },
  leadership: {
    dbCode: "LEADERSHIP",
    color: "#6E6459",
    tint: "#EFEAE4",
    target: 0,
    fullName: "Leadership",
  },
  wros: {
    dbCode: "WROS",
    color: "#9C6B4E",
    tint: "#F4ECE6",
    target: 16,
    fullName: "Women's Rights Organisations",
  },
  skilling: {
    dbCode: "SKILLING",
    color: "#7A3A1F",
    tint: "#F3E7E0",
    target: 200,
    fullName: "Vocational Skilling",
  },
};

function recordOf(row: {
  id: number;
  pillar_id: number;
  organisation_id: number | null;
  entry_category: string;
  status: string;
  status_description: string | null;
  created_at: string | null;
  updated_at: string;
  record_name: string | null;
}): PillarRecord {
  return {
    id: row.id,
    pillarId: row.pillar_id,
    title: row.record_name ?? (row.organisation_id ? "Organisation record" : "Participant record"),
    category: row.entry_category,
    status: row.status,
    statusDescription: row.status_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPillarsApi(client: ApiClient, token: string) {
  const pathOf = (code: PillarCode) => `/pillars/${presentation[code].dbCode.toLowerCase()}`;
  /** The pillar summary, or a PillarApiError for an unknown, hidden or forbidden pillar. */
  async function summary(code: PillarCode, period?: string) {
    const result = await client.request(
      {
        method: "GET",
        path: `${pathOf(code)}/summary`,
        routeTemplate: "/pillars/:pillar/summary",
        token,
        query: period ? { period } : {},
      },
      pillarSummarySchema
    );
    if (!result.success || !result.data)
      throw new PillarApiError(result.message, result.resultCode);
    return result.data;
  }
  /** One page of the pillar's enrollment records, newest change first unless sorted. */
  async function listRecords(
    code: PillarCode,
    query: ListQuery = {}
  ): Promise<PaginatedData<PillarRecord>> {
    const result = await client.request(
      {
        method: "GET",
        path: pathOf(code),
        routeTemplate: "/pillars/:pillar",
        token,
        query: {
          table: "enrollment",
          ...listParams(query, RECORD_SORT_KEYS, { sort: "updated_at:desc" }),
        },
      },
      pillarEnrollmentListSchema
    );
    if (!result.success || !result.data)
      throw new PillarApiError(result.message, result.resultCode);
    return { ...result.data, items: result.data.items.map(recordOf) };
  }
  return {
    summary,
    listRecords,
    listDomain(code: PillarCode, query: ListQuery = {}) {
      return loadPillarDomain(client, token, code, query);
    },
    /** Whether an enrollment, or a participant's enrollment, exists in the pillar. */
    async hasEnrollment(code: PillarCode, match: { id?: number; participantId?: number }) {
      const result = await client.request(
        {
          method: "GET",
          path: pathOf(code),
          routeTemplate: "/pillars/:pillar",
          token,
          query: {
            table: "enrollment",
            page: 1,
            pageSize: 1,
            ...(match.id ? { ids: String(match.id) } : {}),
            ...(match.participantId ? { participant_id: String(match.participantId) } : {}),
          },
        },
        pillarEnrollmentListSchema
      );
      return !!result.data && result.data.items.length > 0;
    },
    async get(code: string, options: { period?: string } = {}): Promise<PillarView> {
      const parsed = pillarCodeSchema.safeParse(code);
      if (!parsed.success) throw new PillarApiError("Pillar not found", 404);
      const selected = parsed.data;
      const config = presentation[selected];
      const [head, records, domain] = await Promise.all([
        summary(selected, options.period),
        listRecords(selected, { page: 1, pageSize: 25 }),
        this.listDomain(selected, { page: 1, pageSize: 25 }).catch(() => null),
      ]);
      const stages = head.pipeline?.stages ?? [];
      return {
        id: head.pillar.id,
        code: selected,
        name: selected === "wros" ? "WROs" : selected === "skilling" ? "Skilling" : config.dbCode,
        fullName: config.fullName,
        leadUserId: head.pillar.lead_user_id,
        color: config.color,
        tint: config.tint,
        target: config.target,
        records: records.items,
        recordCount: head.enrollments?.total ?? records.totalItems,
        activeCount:
          head.enrollments?.active ?? records.items.filter((row) => row.status === "ACTIVE").length,
        cards: head.cards,
        projects: head.projects,
        hasPipeline: Boolean(head.pipeline),
        stages: stages.map((row) => row.name),
        pipelineStages: stages.map((row) => ({ id: row.id, name: row.name })),
        stageCounts: stages.some((row) => row.count !== null)
          ? stages.map((row) => ({ name: row.name, count: row.count ?? 0 }))
          : null,
        domain,
        leadName: head.pillar.lead_name,
        counties: head.enrollments?.counties,
      };
    },
    async createEnrollment(
      code: PillarCode,
      input: { pillarId: number; participantId: number; entryCategory: string }
    ) {
      return client.request(
        {
          method: "POST",
          path: `/pillars/${presentation[code].dbCode.toLowerCase()}`,
          routeTemplate: "/pillars/:pillar",
          token,
          body: {
            pillar_id: input.pillarId,
            participant_id: input.participantId,
            entry_category: input.entryCategory,
          },
        },
        pillarMutationSchema
      );
    },
    async createDomainRecord(
      code: PillarCode,
      table:
        | "legal_case"
        | "grant_application"
        | "activity_session"
        | "training_enrollment"
        | "organisation"
        | "enrollment",
      body: Record<string, unknown>,
      pillarId?: number
    ) {
      return client.request(
        {
          method: "POST",
          path: `/pillars/${presentation[code].dbCode.toLowerCase()}`,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table, pillarId },
          body,
        },
        pillarDomainMutationSchema
      );
    },
    async updateEnrollment(code: PillarCode, id: number, entryCategory: string) {
      return client.request(
        {
          method: "PATCH",
          path: `/pillars/${presentation[code].dbCode.toLowerCase()}`,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { id },
          body: { entry_category: entryCategory },
        },
        pillarMutationSchema
      );
    },
  };
}

export const pillarsApi = {
  async get(code: string, options?: { period?: string }) {
    const token = await readSessionToken();
    if (!token) throw new PillarApiError("Sign in required", 403);
    return createPillarsApi(createPortalApiClient(), token).get(code, options);
  },
};
