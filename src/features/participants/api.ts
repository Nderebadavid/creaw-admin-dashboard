/**
 * Typed client for the cross-pillar participant registry and enrollments.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { SortState } from "@/components/data-table/sorting";
import type { ApiClient } from "@/lib/api/client";
import { listParams } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import {
  catalogSchema,
  participantDetailSchema,
  participantListSchema,
  participantMutationSchema,
  participantPickerSchema,
  type ParticipantDto,
  type ParticipantRegistration,
  type ParticipantUpdate,
} from "./schemas";

/** The registry's column ids and the API fields they sort by. */
export const PARTICIPANT_SORT_KEYS: Record<string, string> = {
  participant: "first_name,last_name",
  county: "county_name,ward_name",
  pillars: "pillar_codes",
  stage: "current_stage_name",
  registered: "created_at",
  status: "status",
};

export interface ParticipantQuery {
  /** A displayed column to sort by, mapped to an API field by the list. */
  sort?: SortState;
  page?: number;
  pageSize?: number;
  pillarId?: number;
  countyId?: number;
  search?: string;
}
export interface ParticipantView {
  id: number;
  name: string;
  idNumber: string | null;
  phoneNumber: string | null;
  gender: string | null;
  county: string;
  countyId: number | null;
  ward: string;
  pillarIds: number[];
  enrollments: {
    id: number;
    pillarId: number;
    category: string;
    currentStage: string | null;
    status: string;
    date: string;
  }[];
  currentStage: string;
  consentGiven: boolean;
  registered: string;
  status: string;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  updated: string | null;
  remarks: string | null;
}
export interface ParticipantPage {
  items: ParticipantView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export interface ParticipantCatalog {
  pillars: { id: number; name: string }[];
  counties: { id: number; name: string }[];
  wards: { id: number; name: string; countyId: number }[];
}

export function createParticipantsApi(client: ApiClient, token: string) {
  /**
   * People matching a name search, labelled "<name> · <ward>" (plus "#<id>" only to tell
   * identical labels apart). One small page, for pickers that search as you type.
   */
  async function search(text: string, limit = 20): Promise<{ id: number; label: string }[]> {
    const response = await client.request(
      {
        method: "GET",
        path: "/participants",
        routeTemplate: "/participants",
        token,
        query: { page: 1, pageSize: limit, search: text, sort: "first_name:asc,last_name:asc" },
      },
      participantPickerSchema
    );
    if (!response.success || !response.data) throw new Error(response.message);
    const labels = response.data.items.map((row) => ({
      id: row.id,
      label: `${row.first_name} ${row.last_name} · ${row.ward_name ?? "Ward not recorded"}`,
    }));
    const counts = new Map<string, number>();
    for (const { label } of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    return labels.map(({ id, label }) => ({
      id,
      label: counts.get(label)! > 1 ? `${label} · #${id}` : label,
    }));
  }
  /** Pillars, counties and wards in one batched call, for the filters and the register form. */
  async function catalog(): Promise<ParticipantCatalog> {
    const response = await client.request(
      {
        method: "GET",
        path: "/lookups",
        routeTemplate: "/lookups",
        token,
        query: { tables: "pillar,county,ward" },
      },
      catalogSchema
    );
    if (!response.success || !response.data) throw new Error(response.message);
    const { tables } = response.data;
    return {
      pillars: tables.pillar.map((row) => ({ id: row.id, name: row.name })),
      counties: tables.county.map((row) => ({ id: row.id, name: row.name })),
      wards: tables.ward.map((row) => ({
        id: row.id,
        name: row.name,
        countyId: row.county_id ?? 0,
      })),
    };
  }
  /** A participant as the registry shows it: place, enrollments and stage arrive with the row. */
  function toView(row: ParticipantDto): ParticipantView {
    const linked = row.enrollments;
    return {
      id: row.id,
      name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
      idNumber: row.id_number,
      phoneNumber: row.phone_number,
      gender: row.gender,
      county: row.county_name ?? "Not recorded",
      countyId: row.county_id,
      ward: row.ward_name ?? "Not recorded",
      pillarIds: linked.map((item) => item.pillar_id),
      enrollments: linked.map((item) => ({
        id: item.id,
        pillarId: item.pillar_id,
        category: item.entry_category,
        currentStage: item.current_stage,
        status: item.status,
        date: item.created_at,
      })),
      currentStage: row.current_stage_name ?? "Not started",
      consentGiven: row.is_consent_given,
      registered: row.created_at,
      status: row.status,
      statusDescription: row.status_description,
      updated: row.updated_at,
      remarks: row.remarks,
    };
  }
  return {
    search,
    catalog,
    /** One page of participants; the API filters, searches and sorts, and embeds enrollments. */
    async list(query: ParticipantQuery = {}): Promise<ParticipantPage> {
      const response = await client.request(
        {
          method: "GET",
          path: "/participants",
          routeTemplate: "/participants",
          token,
          query: {
            ...listParams(
              {
                page: query.page ?? 1,
                pageSize: query.pageSize ?? 25,
                search: query.search,
                sort: query.sort,
                include: "enrollments",
              },
              PARTICIPANT_SORT_KEYS
            ),
            ...(query.pillarId ? { pillarId: query.pillarId } : {}),
            ...(query.countyId ? { countyId: query.countyId } : {}),
          },
        },
        participantListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: response.data.items.map(toView) };
    },
    async get(id: number): Promise<ParticipantView | null> {
      const response = await client.request(
        {
          method: "GET",
          path: `/participants/${id}`,
          routeTemplate: "/participants/:id",
          token,
          query: { include: "enrollments" },
        },
        participantDetailSchema
      );
      if (!response.success || !response.data) return null;
      return toView(response.data);
    },
    register(input: ParticipantRegistration) {
      return client.request(
        {
          method: "POST",
          path: "/participants",
          routeTemplate: "/participants",
          token,
          query: { pillarId: input.pillarId, enroll: true },
          body: {
            first_name: input.firstName,
            middle_name: input.middleName || null,
            last_name: input.lastName,
            id_number: input.idNumber || null,
            id_number_type: input.idNumber ? "national_id" : "none",
            phone_number: input.phoneNumber || null,
            date_of_birth: input.dateOfBirth || null,
            gender: input.gender || null,
            ward_id: input.wardId ?? null,
            is_consent_given: input.consentGiven,
            remarks: input.remarks || null,
          },
        },
        participantMutationSchema
      );
    },
    update(input: ParticipantUpdate) {
      return client.request(
        {
          method: "PATCH",
          path: `/participants/${input.id}`,
          routeTemplate: "/participants/:id",
          token,
          body: {
            ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
            ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
            ...(input.phoneNumber !== undefined ? { phone_number: input.phoneNumber } : {}),
            ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
            ...(input.consentGiven !== undefined ? { is_consent_given: input.consentGiven } : {}),
          },
        },
        participantMutationSchema
      );
    },
    reveal(id: number, field: "id_number" | "phone_number") {
      return client.request(
        {
          method: "GET",
          path: `/participants/${id}`,
          routeTemplate: "/participants/:id",
          token,
          query: { reveal: field },
        },
        participantDetailSchema
      );
    },
  };
}

export const participantsApi = {
  async list(query: ParticipantQuery = {}) {
    return (await withSessionApi(createParticipantsApi)).list(query);
  },
  async catalog() {
    return (await withSessionApi(createParticipantsApi)).catalog();
  },
};
