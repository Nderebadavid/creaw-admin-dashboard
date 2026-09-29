import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { collectPages } from "@/lib/api/pagination";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import {
  enrollmentListSchema, lookupListSchema, participantDetailSchema, participantListSchema, participantMutationSchema,
  type EnrollmentDto, type ParticipantDto, type ParticipantRegistration, type ParticipantUpdate,
} from "./schemas";

export interface ParticipantQuery { page?: number; pageSize?: number; pillarId?: number; countyId?: number; search?: string }
export interface ParticipantView {
  id: number; name: string; idNumber: string | null; phoneNumber: string | null; gender: string | null;
  county: string; countyId: number | null; ward: string; pillarIds: number[];
  enrollments: { id: number; pillarId: number; category: string; status: string; date: string }[];
  consentGiven: boolean; registered: string; status: string; remarks: string | null;
}
export interface ParticipantPage { items: ParticipantView[]; page: number; pageSize: number; totalItems: number; totalPages: number }
export interface ParticipantCatalog { pillars: { id: number; name: string }[]; counties: { id: number; name: string }[]; wards: { id: number; name: string; countyId: number }[] }

export function createParticipantsApi(client: ApiClient, token: string) {
  const listEnrollments = () => collectPages(async (page, pageSize) => {
    const response = await client.request({ method: "GET", path: "/participants", routeTemplate: "/participants", token, query: { table: "enrollment", page, pageSize } }, enrollmentListSchema);
    if (!response.success || !response.data) throw new Error(response.message);
    return response.data;
  });
  const listLookup = (table: "county" | "sub_county" | "ward" | "pillar") => collectPages(async (page, pageSize) => {
    const response = await client.request({ method: "GET", path: `/lookups/${table}`, routeTemplate: "/lookups/:table", token, query: { page, pageSize } }, lookupListSchema);
    if (!response.success || !response.data) throw new Error(response.message);
    return response.data;
  });
  async function catalog(): Promise<ParticipantCatalog> {
    const [pillars, counties, subCounties, wards] = await Promise.all([listLookup("pillar"), listLookup("county"), listLookup("sub_county"), listLookup("ward")]);
    const subToCounty = new Map(subCounties.map(row => [row.id, "county_id" in row ? Number(row.county_id) : 0]));
    return { pillars: pillars.map(row => ({ id: row.id, name: row.name })), counties: counties.map(row => ({ id: row.id, name: row.name })),
      wards: wards.map(row => ({ id: row.id, name: row.name, countyId: subToCounty.get("sub_county_id" in row ? Number(row.sub_county_id) : 0) ?? 0 })) };
  }
  async function toView(row: ParticipantDto, enrollments: EnrollmentDto[], locations: ParticipantCatalog): Promise<ParticipantView> {
    const ward = locations.wards.find(item => item.id === row.ward_id);
    const county = locations.counties.find(item => item.id === ward?.countyId);
    const linked = enrollments.filter(item => item.participant_id === row.id);
    return { id: row.id, name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "), idNumber: row.id_number,
      phoneNumber: row.phone_number, gender: row.gender, county: county?.name ?? "Not recorded", countyId: county?.id ?? null,
      ward: ward?.name ?? "Not recorded", pillarIds: linked.map(item => item.pillar_id),
      enrollments: linked.map(item => ({ id: item.id, pillarId: item.pillar_id, category: item.entry_category, status: item.status, date: item.created_at })),
      consentGiven: row.is_consent_given, registered: row.created_at, status: row.status, remarks: row.remarks };
  }
  return {
    catalog,
    async list(query: ParticipantQuery = {}): Promise<ParticipantPage> {
      const response = await client.request({ method: "GET", path: "/participants", routeTemplate: "/participants", token,
        query: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, pillarId: query.pillarId, countyId: query.countyId, search: query.search } }, participantListSchema);
      if (!response.success || !response.data) throw new Error(response.message);
      const [enrollments, locations] = await Promise.all([listEnrollments(), catalog()]);
      return { ...response.data, items: await Promise.all(response.data.items.map(row => toView(row, enrollments, locations))) };
    },
    async get(id: number): Promise<ParticipantView | null> {
      const response = await client.request({ method: "GET", path: `/participants/${id}`, routeTemplate: "/participants/:id", token }, participantDetailSchema);
      if (!response.success || !response.data) return null;
      const [enrollments, locations] = await Promise.all([listEnrollments(), catalog()]);
      return toView(response.data, enrollments, locations);
    },
    register(input: ParticipantRegistration) {
      return client.request({ method: "POST", path: "/participants", routeTemplate: "/participants", token, query: { pillarId: input.pillarId, enroll: true },
        body: { first_name: input.firstName, middle_name: input.middleName || null, last_name: input.lastName,
          id_number: input.idNumber || null, id_number_type: input.idNumber ? "national_id" : "none", phone_number: input.phoneNumber || null,
          date_of_birth: input.dateOfBirth || null, gender: input.gender || null, ward_id: input.wardId ?? null,
          is_consent_given: input.consentGiven, remarks: input.remarks || null } }, participantMutationSchema);
    },
    update(input: ParticipantUpdate) {
      return client.request({ method: "PATCH", path: `/participants/${input.id}`, routeTemplate: "/participants/:id", token,
        body: { ...(input.firstName !== undefined ? { first_name: input.firstName } : {}), ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
          ...(input.phoneNumber !== undefined ? { phone_number: input.phoneNumber } : {}), ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
          ...(input.consentGiven !== undefined ? { is_consent_given: input.consentGiven } : {}) } }, participantMutationSchema);
    },
    reveal(id: number, field: "id_number" | "phone_number" | "first_name" | "last_name") {
      return client.request({ method: "GET", path: `/participants/${id}`, routeTemplate: "/participants/:id", token, query: { reveal: field } }, participantDetailSchema);
    },
  };
}

export const participantsApi = {
  async list(query: ParticipantQuery = {}) {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) throw new Error("Sign in required");
    return createParticipantsApi(createPortalApiClient(), token).list(query);
  },
  async catalog() {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) throw new Error("Sign in required");
    return createParticipantsApi(createPortalApiClient(), token).catalog();
  },
};
