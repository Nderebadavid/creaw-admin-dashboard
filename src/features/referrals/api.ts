import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { z } from "zod";
import { enrollmentDetailSchema, lookupListSchema } from "@/features/participants/schemas";
import {
  referralDestinationCatalogSchema,
  referralDetailSchema,
  referralListSchema,
  referralMutationSchema,
  type ReferralCreate,
  type ReferralDto,
  type ReferralDestinationCatalog,
} from "./schemas";

const meSchema = z.object({
  resultCode: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z.union([
    z.object({
      grants: z.array(z.object({ permissionCode: z.string(), pillarId: z.number().nullable() })),
    }),
    z.null(),
  ]),
});
export interface ReferralQuery {
  page?: number;
  pageSize?: number;
  pillarId?: number;
  status?: string;
  search?: string;
}
export interface ReferralView {
  id: number;
  participantId: number | null;
  participant: string;
  fromPillarId: number;
  toPillarId: number;
  fromPillar: string;
  toPillar: string;
  external: boolean;
  reason: string;
  source: string;
  destinationName: string;
  date: string;
  ageDays: number;
  status: string;
  canRespond: boolean;
  respondDisabledReason: string | null;
  canEdit: boolean;
  canWithdraw: boolean;
  enrollmentId: number;
}
export interface ReferralPage {
  items: ReferralView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function createReferralsApi(client: ApiClient, token: string) {
  async function grants(): Promise<EffectiveGrant[]> {
    const response = await client.request(
      { method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token },
      meSchema
    );
    return response.success ? (response.data?.grants ?? []) : [];
  }
  async function pillars() {
    const rows = await collectPages(async (page, pageSize) => {
      const response = await client.request(
        {
          method: "GET",
          path: "/lookups/pillar",
          routeTemplate: "/lookups/:table",
          token,
          query: { page, pageSize },
        },
        lookupListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data;
    });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
  async function enrich(rows: ReferralDto[]): Promise<ReferralView[]> {
    const [allGrants, allPillars] = await Promise.all([grants(), pillars()]);
    const pillarNames = new Map(allPillars.map((row) => [row.id, row.name]));
    return Promise.all(
      rows.map(async (row) => {
        const participantId = row.participant_summary?.id ?? null;
        const name = row.participant_summary?.name ?? `Participant #${participantId ?? "unknown"}`;
        const canRespond =
          row.status === "NEW" &&
          hasPermission(allGrants, "REFERRAL_ACCEPT", { pillarId: row.to_pillar_id });
        const canChange =
          row.status === "NEW" &&
          hasPermission(allGrants, "REFERRAL_CREATE", { pillarId: row.from_pillar_id });
        return {
          id: row.id,
          participantId,
          participant: name,
          fromPillarId: row.from_pillar_id,
          toPillarId: row.to_pillar_id,
          fromPillar: pillarNames.get(row.from_pillar_id) ?? `Pillar #${row.from_pillar_id}`,
          toPillar: pillarNames.get(row.to_pillar_id) ?? `Pillar #${row.to_pillar_id}`,
          external: row.to_partner_institution_id !== null,
          destinationName:
            row.destination_name ??
            pillarNames.get(row.to_pillar_id) ??
            `Pillar #${row.to_pillar_id}`,
          reason: row.trigger_reason ?? "No reason recorded",
          source: "Not recorded",
          date: row.created_at,
          ageDays: Math.max(0, Math.floor((Date.now() - Date.parse(row.created_at)) / 86_400_000)),
          status: row.status,
          canRespond,
          respondDisabledReason:
            row.status !== "NEW"
              ? "Already decided"
              : canRespond
                ? null
                : "Only the receiving pillar can decide this referral",
          canEdit: canChange,
          canWithdraw: canChange,
          enrollmentId: row.enrollment_id,
        };
      })
    );
  }
  return {
    pillars,
    async destinations(): Promise<ReferralDestinationCatalog> {
      const response = await client.request(
        {
          method: "GET",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          query: { catalog: "destinations" },
        },
        referralDestinationCatalogSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data;
    },
    async getRaw(id: number) {
      const response = await client.request(
        { method: "GET", path: `/referrals/${id}`, routeTemplate: "/referrals/:id", token },
        referralDetailSchema
      );
      return response.success ? response.data : null;
    },
    async getOrigin(enrollmentId: number) {
      const response = await client.request(
        {
          method: "GET",
          path: `/participants/${enrollmentId}`,
          routeTemplate: "/participants/:id",
          token,
          query: { table: "enrollment" },
        },
        enrollmentDetailSchema
      );
      return response.success ? response.data : null;
    },
    async list(query: ReferralQuery = {}): Promise<ReferralPage> {
      const response = await client.request(
        {
          method: "GET",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          query: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 25,
            pillarId: query.pillarId,
            status: query.status,
            search: query.search,
          },
        },
        referralListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: await enrich(response.data.items) };
    },
    async get(id: number): Promise<ReferralView | null> {
      const row = await this.getRaw(id);
      return row ? (await enrich([row]))[0] : null;
    },
    create(input: ReferralCreate) {
      return client.request(
        {
          method: "POST",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          body: {
            enrollment_id: input.enrollmentId,
            from_pillar_id: input.fromPillarId,
            to_pillar_id: input.toPillarId,
            to_partner_institution_id: input.partnerInstitutionId ?? null,
            trigger_reason: input.reason,
            notes: input.notes ?? null,
          },
        },
        referralMutationSchema
      );
    },
    respond(id: number, decision: "ACCEPTED" | "DECLINED", note?: string) {
      return client.request(
        {
          method: "PATCH",
          path: `/referrals/${id}`,
          routeTemplate: "/referrals/:id",
          token,
          body: { status: decision, ...(note ? { notes: note } : {}) },
        },
        referralMutationSchema
      );
    },
    edit(id: number, reason: string) {
      return client.request(
        {
          method: "PATCH",
          path: `/referrals/${id}`,
          routeTemplate: "/referrals/:id",
          token,
          body: { trigger_reason: reason },
        },
        referralMutationSchema
      );
    },
    withdraw(id: number) {
      return client.request(
        {
          method: "PATCH",
          path: `/referrals/${id}`,
          routeTemplate: "/referrals/:id",
          token,
          body: { status: "WITHDRAWN" },
        },
        referralMutationSchema
      );
    },
  };
}

export const referralsApi = {
  async list(query: ReferralQuery = {}) {
    return (await withSessionApi(createReferralsApi)).list(query);
  },
  async pillars() {
    return (await withSessionApi(createReferralsApi)).pillars();
  },
  async destinations() {
    return (await withSessionApi(createReferralsApi)).destinations();
  },
};
