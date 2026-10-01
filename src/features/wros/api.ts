/**
 * Typed client for WRO partner organisations: the register, registration, and
 * each organisation's progress through the WRO sub-grant pipeline.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering, masks sensitive fields and names
 * the ward, county and pipeline progress of each organisation.
 */
import type { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  legalForms,
  mutationSchema,
  organisationDetailSchema,
  organisationListSchema,
  organisationOptionsSchema,
  type OrganisationDto,
  type OrganisationRegistration,
  type StageMove,
} from "./schemas";
import {
  WRO_PILLAR_ID,
  type OrganisationDetail,
  type OrganisationFormOptions,
  type OrganisationView,
} from "./model";

export {
  WRO_PILLAR_ID,
  type OrganisationDetail,
  type OrganisationFormOptions,
  type OrganisationStage,
  type OrganisationView,
  type PipelineStageDef,
} from "./model";

const PATH = "/pillars/wros";

type Envelope<T> = { success: boolean; message: string; data: T | null };
const required = <T>(result: Envelope<T>): T => {
  if (!result.success || !result.data) throw new Error(result.message);
  return result.data;
};
const bankAccountLabel = (value: boolean | string | null) =>
  value === null ? "Not recorded" : typeof value === "string" ? value : value ? "Yes" : "No";

/** The register's column ids and the API fields they sort by. */
export const ORGANISATION_SORT_KEYS: Record<string, string> = {
  organisation: "name",
  legalForm: "legal_form",
  location: "county_name,ward_name",
  stage: "current_stage_index",
  registered: "created_at",
  dueDiligence: "due_diligence_status",
};

/** An organisation as the register shows it; its place and pipeline progress arrive with the row. */
export function organisationView(row: OrganisationDto): OrganisationView {
  return {
    id: row.id,
    name: row.name,
    legalForm: legalForms[row.legal_form as keyof typeof legalForms] ?? row.legal_form,
    registrationNumber: row.registration_number,
    ward: row.ward_name ?? "Not recorded",
    county: row.county_name ?? "Not recorded",
    address: row.address,
    bankAccount: bankAccountLabel(row.has_bank_account),
    dueDiligence: row.due_diligence_status,
    registered: row.created_at,
    status: row.status,
    statusDescription: row.status_description,
    updated: row.updated_at,
    enrollmentId: row.enrollment_id,
    entryCategory: row.entry_category ?? "Not enrolled",
    currentStage: row.current_stage_index ?? -1,
    stageCount: row.stage_count ?? 0,
    contracted: row.is_contracted,
  };
}

export function createWrosApi(client: ApiClient, token: string) {
  const request = <T>(input: Parameters<ApiClient["request"]>[0], schema: z.ZodType<T>) =>
    client.request(input, schema as never) as Promise<T>;
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
    /** One page of organisations; the API filters, searches and sorts. */
    async list(query: ListQuery = {}): Promise<PaginatedData<OrganisationView>> {
      const data = required(
        await request(
          {
            method: "GET",
            path: PATH,
            routeTemplate: "/pillars/:pillar",
            token,
            query: { table: "organisation", ...listParams(query, ORGANISATION_SORT_KEYS) },
          },
          organisationListSchema
        )
      );
      return { ...data, items: data.items.map(organisationView) };
    },
    /** When an organisation reached each pipeline stage, loaded when its drawer opens. */
    async detail(organisationId: number): Promise<OrganisationDetail | null> {
      const result = await request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "organisation", id: organisationId, include: "stage_events" },
        },
        organisationDetailSchema
      );
      if (!result.success || !result.data) return null;
      const reachedAt: Record<number, string> = {};
      for (const event of result.data.stage_events) {
        if (event.stage_event_status === "disputed") continue;
        const previous = reachedAt[event.stage_definition_id];
        if (!previous || event.event_date > previous)
          reachedAt[event.stage_definition_id] = event.event_date;
      }
      return { reachedAt };
    },
    /** Wards to register an organisation in, labelled with their county. */
    async formOptions(): Promise<OrganisationFormOptions> {
      return required(
        await request(
          {
            method: "GET",
            path: `${PATH}/form-options`,
            routeTemplate: "/pillars/:pillar/form-options",
            token,
            query: { form: "organisation" },
          },
          organisationOptionsSchema
        )
      );
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
  async list(query?: ListQuery) {
    return (await withSessionApi(createWrosApi)).list(query);
  },
};
