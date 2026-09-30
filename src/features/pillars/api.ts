/**
 * Typed client for per-pillar overviews, programme records and each pillar's domain register.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { readSessionToken } from "@/lib/api/session-api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { collectPages } from "@/lib/api/pagination";
import {
  pillarCodeSchema,
  pillarDashboardSchema,
  pillarDomainMutationSchema,
  pillarEnrollmentListSchema,
  pillarMutationSchema,
  pillarPipelineSchema,
  pillarStageSchema,
  pillarStageEventSchema,
  type PillarCode,
} from "./schemas";
import { loadPillarDomain, type PillarDomainView } from "./domain-api";

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
  records: PillarRecord[];
  stages: string[];
  stageCounts?: { name: string; count: number }[] | null;
  /** The pillar lead's name, when the user may read it. */
  leadName?: string | null;
  /** Counties the pillar's participants live in, most common first. */
  counties?: string[];
  hasPipeline: boolean;
  domain?: PillarDomainView | null;
}
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

/** Pages of a lookup-style list; none when the user may not read it. */
async function readAll<T>(
  client: ApiClient,
  token: string,
  path: string,
  routeTemplate: "/lookups/:table" | "/participants",
  schema: z.ZodType<T>
): Promise<T[]> {
  const envelope = createEnvelopeSchema(z.union([createPaginatedSchema(schema), z.null()]));
  return collectPages(async (page, pageSize) => {
    const result = await client.request(
      { method: "GET", path, routeTemplate, token, query: { page, pageSize } },
      envelope
    );
    if (!result.success || !result.data) throw new Error(result.message);
    return result.data;
  }).catch(() => []);
}

/** The lead's name from the reporting catalogue, which lists pillar leads as report owners. */
async function leadNameOf(client: ApiClient, token: string, leadId: number | null) {
  if (!leadId) return null;
  const result = await client
    .request(
      {
        method: "GET",
        path: "/reports",
        routeTemplate: "/reports",
        token,
        query: { catalog: true },
      },
      createEnvelopeSchema(
        z.union([
          z.object({ owners: z.array(z.object({ id: z.number(), name: z.string() })) }),
          z.null(),
        ])
      )
    )
    .catch(() => null);
  return result?.data?.owners.find((owner) => owner.id === leadId)?.name ?? null;
}

/** Counties the given participants live in, most common first. */
async function countiesOf(client: ApiClient, token: string, participantIds: number[]) {
  if (!participantIds.length) return [];
  const place = z.object({
    id: z.number(),
    name: z.string(),
    sub_county_id: z.number().optional(),
    county_id: z.number().optional(),
  });
  const [participants, wards, subCounties, counties] = await Promise.all([
    readAll(
      client,
      token,
      "/participants",
      "/participants",
      z.object({ id: z.number(), ward_id: z.number().nullable() })
    ),
    readAll(client, token, "/lookups/ward", "/lookups/:table", place),
    readAll(client, token, "/lookups/sub_county", "/lookups/:table", place),
    readAll(client, token, "/lookups/county", "/lookups/:table", place),
  ]);
  const tally = new Map<string, number>();
  for (const participant of participants.filter((row) => participantIds.includes(row.id))) {
    const ward = wards.find((row) => row.id === participant.ward_id);
    const subCounty = subCounties.find((row) => row.id === ward?.sub_county_id);
    const county = counties.find((row) => row.id === subCounty?.county_id);
    if (county) tally.set(county.name, (tally.get(county.name) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

export function createPillarsApi(client: ApiClient, token: string) {
  return {
    async get(code: string): Promise<PillarView> {
      const parsed = pillarCodeSchema.safeParse(code);
      if (!parsed.success) throw new PillarApiError("Pillar not found", 404);
      const selected = parsed.data;
      const config = presentation[selected];
      const dashboard = await client.request(
        { method: "GET", path: "/dashboard", routeTemplate: "/dashboard", token },
        pillarDashboardSchema
      );
      if (!dashboard.success || !dashboard.data)
        throw new PillarApiError(dashboard.message, dashboard.resultCode);
      const pillar = dashboard.data.pillars.find((row) => row.code.toUpperCase() === config.dbCode);
      if (!pillar) throw new PillarApiError("Pillar outside your scope", 403);
      const path = `/pillars/${config.dbCode.toLowerCase()}`;
      const [enrollments, pipelines] = await Promise.all([
        collectPages(async (page, pageSize) => {
          const result = await client.request(
            {
              method: "GET",
              path,
              routeTemplate: "/pillars/:pillar",
              token,
              query: { table: "enrollment", page, pageSize },
            },
            pillarEnrollmentListSchema
          );
          if (!result.success || !result.data)
            throw new PillarApiError(result.message, result.resultCode);
          return result.data;
        }),
        collectPages(async (page, pageSize) => {
          const result = await client.request(
            {
              method: "GET",
              path,
              routeTemplate: "/pillars/:pillar",
              token,
              query: { table: "pipeline_definition", page, pageSize },
            },
            pillarPipelineSchema
          );
          if (!result.success || !result.data)
            throw new PillarApiError(result.message, result.resultCode);
          return result.data;
        }).catch(() => null),
      ]);
      const pipeline = pipelines?.[0];
      const [stages, events] = pipeline
        ? await Promise.all([
            collectPages(async (page, pageSize) => {
              const result = await client.request(
                {
                  method: "GET",
                  path,
                  routeTemplate: "/pillars/:pillar",
                  token,
                  query: { table: "stage_definition", page, pageSize },
                },
                pillarStageSchema
              );
              if (!result.success || !result.data) throw new Error(result.message);
              return result.data;
            }).catch(() => []),
            collectPages(async (page, pageSize) => {
              const result = await client.request(
                {
                  method: "GET",
                  path,
                  routeTemplate: "/pillars/:pillar",
                  token,
                  query: { table: "participant_stage_event", page, pageSize },
                },
                pillarStageEventSchema
              );
              if (!result.success || !result.data) throw new Error(result.message);
              return result.data;
            }).catch(() => null),
          ])
        : [[], null];
      const configuredStages = stages
        .filter((row) => row.pipeline_id === pipeline?.id)
        .sort((a, b) => a.step_no - b.step_no);
      const records = enrollments.map((row) => ({
        id: row.id,
        pillarId: row.pillar_id,
        title: row.organisation_id
          ? `Organisation #${row.organisation_id}`
          : `Participant #${row.participant_id}`,
        category: row.entry_category,
        status: row.status,
        updatedAt: row.updated_at,
      }));
      const [domain, leadName, counties] = await Promise.all([
        loadPillarDomain(client, token, selected, enrollments).catch(() => null),
        leadNameOf(client, token, pillar.lead_user_id),
        countiesOf(
          client,
          token,
          enrollments.map((row) => row.participant_id).filter((id): id is number => id !== null)
        ),
      ]);
      return {
        id: pillar.id,
        code: selected,
        name: selected === "wros" ? "WROs" : selected === "skilling" ? "Skilling" : pillar.code,
        fullName: config.fullName,
        leadUserId: pillar.lead_user_id,
        color: config.color,
        tint: config.tint,
        target: config.target,
        records,
        hasPipeline: Boolean(pipeline),
        stages: configuredStages.map((row) => row.name),
        stageCounts: events
          ? configuredStages.map((stage) => ({
              name: stage.name,
              count: new Set(
                events
                  .filter((event) => event.stage_definition_id === stage.id)
                  .map((event) => event.enrollment_id)
              ).size,
            }))
          : null,
        domain,
        leadName,
        counties,
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
  async get(code: string) {
    const token = await readSessionToken();
    if (!token) throw new PillarApiError("Sign in required", 403);
    return createPillarsApi(createPortalApiClient(), token).get(code);
  },
};
