/**
 * Typed client for referrals between pillars and to partner institutions.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { SortState } from "@/components/data-table/sorting";
import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import { listParams } from "@/lib/api/list";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { z } from "zod";
import { enrollmentDetailSchema, lookupListSchema } from "@/features/participants/schemas";
import {
  referralDestinationCatalogSchema,
  referralDetailSchema,
  referralListSchema,
  referralMutationSchema,
  referralOriginListSchema,
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
/** The queue's column ids and the API fields they sort by. */
export const REFERRAL_SORT_KEYS: Record<string, string> = {
  participant: "participant_name",
  route: "from_pillar_name,destination_label",
  reason: "trigger_reason",
  referredBy: "referred_by_name",
  date: "created_at",
  status: "status",
  updated: "updated_at",
};

/** An enrollment a referral can be made from. */
export interface ReferralOriginOption {
  enrollmentId: number;
  pillarId: number;
  participant: string;
  category: string;
}

export interface ReferralQuery {
  /** A displayed column to sort by, mapped to an API field by the list. */
  sort?: SortState;
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
  /** Who made the referral; null when no creation record exists. */
  referredBy: string | null;
  destinationName: string;
  date: string;
  ageDays: number;
  status: string;
  canRespond: boolean;
  respondDisabledReason: string | null;
  canEdit: boolean;
  canWithdraw: boolean;
  enrollmentId: number;
  updated: string;
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
  /**
   * Rows as the queue shows them. The API names each pillar, destination and participant;
   * `known` supplies the caller's grants when the caller already has them, saving a read.
   */
  async function enrich(rows: ReferralDto[], known?: EffectiveGrant[]): Promise<ReferralView[]> {
    const allGrants = known ?? (await grants());
    return Promise.all(
      rows.map(async (row) => {
        const participantId = row.participant_summary?.id ?? null;
        const name = row.participant_summary?.name ?? "Participant record";
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
          fromPillar: row.from_pillar_name ?? "Pillar",
          toPillar: row.to_pillar_name ?? "Pillar",
          external: row.to_partner_institution_id !== null,
          destinationName:
            row.destination_name ?? row.destination_label ?? row.to_pillar_name ?? "Pillar",
          reason: row.trigger_reason ?? "No reason recorded",
          referredBy: row.referred_by_name,
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
          updated: row.updated_at,
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
    /**
     * One page of referrals; the API filters, searches and sorts. Pass the caller's `known`
     * grants (from the session) to avoid reading them again.
     */
    async list(query: ReferralQuery = {}, known?: EffectiveGrant[]): Promise<ReferralPage> {
      const response = await client.request(
        {
          method: "GET",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          query: {
            ...listParams(
              {
                page: query.page ?? 1,
                pageSize: query.pageSize ?? 25,
                search: query.search,
                sort: query.sort,
                filters: { status: query.status },
              },
              REFERRAL_SORT_KEYS
            ),
            ...(query.pillarId ? { pillarId: query.pillarId } : {}),
          },
        },
        referralListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: await enrich(response.data.items, known) };
    },
    /** Enrollments the caller may refer from, for the New referral dialog; searchable. */
    async origins(search?: string): Promise<ReferralOriginOption[]> {
      const response = await client.request(
        {
          method: "GET",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          query: { catalog: "origins", ...(search?.trim() ? { search: search.trim() } : {}) },
        },
        referralOriginListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data.items.map((row) => ({
        enrollmentId: row.enrollment_id,
        pillarId: row.pillar_id,
        participant: row.participant,
        category: row.category,
      }));
    },
    /** Referrals in the caller's scope with this status; skips the per-row permission work. */
    async countByStatus(status: string): Promise<number> {
      const response = await client.request(
        {
          method: "GET",
          path: "/referrals",
          routeTemplate: "/referrals",
          token,
          query: { page: 1, pageSize: 1, status },
        },
        referralListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data.totalItems;
    },
    async get(id: number, known?: EffectiveGrant[]): Promise<ReferralView | null> {
      const row = await this.getRaw(id);
      return row ? (await enrich([row], known))[0] : null;
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
  async list(query: ReferralQuery = {}, known?: EffectiveGrant[]) {
    return (await withSessionApi(createReferralsApi)).list(query, known);
  },
  async countByStatus(status: string) {
    return (await withSessionApi(createReferralsApi)).countByStatus(status);
  },
  async pillars() {
    return (await withSessionApi(createReferralsApi)).pillars();
  },
  async destinations() {
    return (await withSessionApi(createReferralsApi)).destinations();
  },
};
