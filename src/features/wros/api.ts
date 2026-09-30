/**
 * Typed client for WRO partner organisations: the register, registration, and
 * each organisation's progress through the WRO sub-grant pipeline.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { collectPages } from "@/lib/api/pagination";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  enrollmentListSchema,
  legalForms,
  lookupListSchema,
  mutationSchema,
  organisationListSchema,
  pipelineListSchema,
  stageEventListSchema,
  stageListSchema,
  type OrganisationRegistration,
  type StageMove,
} from "./schemas";
import { WRO_PILLAR_ID, type OrganisationView } from "./model";

export { WRO_PILLAR_ID, type OrganisationStage, type OrganisationView } from "./model";

const PATH = "/pillars/wros";

type Envelope<T> = { success: boolean; message: string; data: T | null };
const required = <T>(result: Envelope<T>): T => {
  if (!result.success || !result.data) throw new Error(result.message);
  return result.data;
};
const bankAccountLabel = (value: boolean | string | null) =>
  value === null ? "Not recorded" : typeof value === "string" ? value : value ? "Yes" : "No";

export function createWrosApi(client: ApiClient, token: string) {
  const request = <T>(input: Parameters<ApiClient["request"]>[0], schema: z.ZodType<T>) =>
    client.request(input, schema as never) as Promise<T>;
  const all = <T>(
    path: string,
    routeTemplate: "/pillars/:pillar" | "/lookups/:table",
    table: string | undefined,
    schema: z.ZodType<Envelope<PaginatedData<T>>>
  ) =>
    collectPages(async (pageNo, pageSize) =>
      required(
        await request(
          {
            method: "GET",
            path,
            routeTemplate,
            token,
            query: { ...(table ? { table } : {}), page: pageNo, pageSize },
          },
          schema
        )
      )
    );
  const post = (table: string, body: Record<string, unknown>, pillarId?: number) =>
    request(
      {
        method: "POST",
        path: PATH,
        routeTemplate: "/pillars/:pillar",
        token,
        query: { table, pillarId },
        body,
      },
      mutationSchema
    );

  return {
    /** Every organisation in the WRO pillar, with its pipeline progress. */
    async list(): Promise<OrganisationView[]> {
      const [organisations, enrollments, pipelines, stages, events, wards, subCounties, counties] =
        await Promise.all([
          all(PATH, "/pillars/:pillar", "organisation", organisationListSchema),
          all(PATH, "/pillars/:pillar", "enrollment", enrollmentListSchema),
          all(PATH, "/pillars/:pillar", "pipeline_definition", pipelineListSchema),
          all(PATH, "/pillars/:pillar", "stage_definition", stageListSchema),
          // Stage events need the submissions grant; without it progress is unknown.
          all(PATH, "/pillars/:pillar", "participant_stage_event", stageEventListSchema).catch(
            () => []
          ),
          all("/lookups/ward", "/lookups/:table", undefined, lookupListSchema).catch(() => []),
          all("/lookups/sub_county", "/lookups/:table", undefined, lookupListSchema).catch(
            () => []
          ),
          all("/lookups/county", "/lookups/:table", undefined, lookupListSchema).catch(() => []),
        ]);
      const pipeline = pipelines.find((row) => row.pillar_id === WRO_PILLAR_ID);
      const pipelineStages = stages
        .filter((row) => row.pipeline_id === pipeline?.id)
        .sort((a, b) => a.step_no - b.step_no);
      return organisations.map((organisation) => {
        const enrollment = enrollments.find((row) => row.organisation_id === organisation.id);
        const reached = events.filter(
          (row) => row.enrollment_id === enrollment?.id && row.stage_event_status !== "disputed"
        );
        const orgStages = pipelineStages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          reachedAt:
            reached
              .filter((row) => row.stage_definition_id === stage.id)
              .map((row) => row.event_date)
              .sort()
              .at(-1) ?? null,
        }));
        const ward = wards.find((row) => row.id === organisation.ward_id);
        const subCounty = subCounties.find((row) => row.id === ward?.sub_county_id);
        const county = counties.find((row) => row.id === subCounty?.county_id);
        return {
          id: organisation.id,
          name: organisation.name,
          legalForm:
            legalForms[organisation.legal_form as keyof typeof legalForms] ??
            organisation.legal_form,
          registrationNumber: organisation.registration_number,
          ward: ward?.name ?? "Not recorded",
          county: county?.name ?? "Not recorded",
          address: organisation.address,
          bankAccount: bankAccountLabel(organisation.has_bank_account),
          dueDiligence: organisation.due_diligence_status,
          registered: organisation.created_at,
          status: organisation.status,
          enrollmentId: enrollment?.id ?? null,
          entryCategory: enrollment?.entry_category ?? "Not enrolled",
          stages: orgStages,
          currentStage: orgStages.reduce(
            (furthest, stage, index) => (stage.reachedAt ? index : furthest),
            -1
          ),
        };
      });
    },
    /** Wards to register an organisation in, labelled with their county. */
    async wardOptions(): Promise<{ id: number; name: string }[]> {
      const [wards, subCounties, counties] = await Promise.all([
        all("/lookups/ward", "/lookups/:table", undefined, lookupListSchema),
        all("/lookups/sub_county", "/lookups/:table", undefined, lookupListSchema),
        all("/lookups/county", "/lookups/:table", undefined, lookupListSchema),
      ]);
      return wards.map((ward) => {
        const subCounty = subCounties.find((row) => row.id === ward.sub_county_id);
        const county = counties.find((row) => row.id === subCounty?.county_id);
        return { id: ward.id, name: county ? `${ward.name} · ${county.name}` : ward.name };
      });
    },
    /** Creates the organisation and its WRO enrollment, like "Register organisation" on mobile. */
    async register(input: OrganisationRegistration) {
      const organisation = await post(
        "organisation",
        {
          name: input.name,
          legal_form: input.legalForm,
          registration_number: input.registrationNumber || null,
          ward_id: input.wardId ?? null,
          address: input.address || null,
          has_bank_account: input.hasBankAccount,
        },
        WRO_PILLAR_ID
      );
      if (!organisation.success || !organisation.data) return organisation;
      return post("enrollment", {
        pillar_id: WRO_PILLAR_ID,
        organisation_id: organisation.data.id,
        entry_category: input.entryCategory,
      });
    },
    /** Records that the organisation reached a pipeline stage, as a verified stage event. */
    moveToStage(input: StageMove) {
      return post("participant_stage_event", {
        enrollment_id: input.enrollmentId,
        stage_definition_id: input.stageId,
        stage_event_status: "verified",
        source_channel: "portal",
        event_date: new Date().toISOString(),
        notes: input.notes || null,
      });
    },
  };
}

export const wrosApi = {
  async list() {
    return (await withSessionApi(createWrosApi)).list();
  },
  async wardOptions() {
    return (await withSessionApi(createWrosApi)).wardOptions();
  },
};
