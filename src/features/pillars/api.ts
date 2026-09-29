import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
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
      const domain = await loadPillarDomain(client, token, selected, enrollments).catch(() => null);
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
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) throw new PillarApiError("Sign in required", 403);
    return createPillarsApi(createPortalApiClient(), token).get(code);
  },
};
