/**
 * Typed client for the external provider directory: providers with their
 * institution, masked contacts and linked work, plus the writes and the audited
 * contact reveal. Reads go through /admin/providers; the API masks the contacts.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { collectPages } from "@/lib/api/pagination";
import { withSessionApi } from "@/lib/api/session-api";
import {
  providerTypes,
  type ProviderDirectory,
  type ProviderView,
  type ProviderWorkload,
} from "./model";

const id = z.number().int().positive();
const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const providerSchema = z.object({
  id,
  status: z.string(),
  first_name: z.string(),
  middle_name: nullableText,
  last_name: z.string(),
  provider_type: z.string(),
  service_description: nullableText,
  affiliated_institution_id: id.nullish().transform((value) => value ?? null),
  phone_number: nullableText,
  email: nullableText,
  notes: nullableText,
  status_description: nullableText,
  created_at: nullableText,
  updated_at: nullableText,
  /** Linked-work counts the API sums for the register (PROVIDER_MANAGE holders). */
  sessions_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  counselling_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  trainees_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  cases_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
});
const itemSchema = z.object({
  id: z.number(),
  date: z.string(),
  label: z.string(),
  pillar: z.string().optional(),
});
const groupSchema = z.object({ count: z.number(), recent: z.array(itemSchema) });
const workloadSchema = z.object({
  sessions: groupSchema,
  counselling: groupSchema,
  trainees: groupSchema,
  cases: groupSchema,
});
const providerWithWorkloadSchema = providerSchema.extend({ workload: workloadSchema.optional() });
const institutionSchema = z.object({ id, name: z.string(), status: z.string().optional() });
/** A reveal-only caller gets just the id and the revealed field back. */
const revealSchema = z.object({ id, phone_number: nullableText, email: nullableText });
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));
export const providerMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);

const PATH = "/admin/providers";
const ITEM_TEMPLATE = "/admin/providers/:id";
type Values = Record<string, string | number | boolean | null>;
type Envelope<T> = { success: boolean; message: string; data: T | null };

const linkedWork = (workload: ProviderWorkload) =>
  workload.sessions.count +
  workload.counselling.count +
  workload.trainees.count +
  workload.cases.count;
const typeOf = (value: string) =>
  (providerTypes as readonly string[]).includes(value) ? (value as ProviderView["type"]) : "other";

export function createProvidersApi(client: ApiClient, token: string) {
  const all = <T>(
    path: string,
    routeTemplate: "/admin/providers" | "/lookups/:table",
    query: Record<string, string>,
    schema: z.ZodType
  ) =>
    collectPages(async (pageNo, pageSize) => {
      const result = (await client.request(
        { method: "GET", path, routeTemplate, token, query: { ...query, page: pageNo, pageSize } },
        schema as never
      )) as Envelope<{
        items: T[];
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      }>;
      if (!result.success || !result.data) throw new Error(result.message);
      return result.data;
    });
  const write = (method: "POST" | "PATCH", body: Values, providerId?: number) =>
    client.request(
      providerId === undefined
        ? { method, path: PATH, routeTemplate: PATH, token, body }
        : { method, path: `${PATH}/${providerId}`, routeTemplate: ITEM_TEMPLATE, token, body },
      providerMutationSchema
    );

  return {
    async directory(): Promise<ProviderDirectory> {
      const [rows, institutions] = await Promise.all([
        all<z.infer<typeof providerSchema>>(PATH, PATH, {}, page(providerSchema)),
        all<z.infer<typeof institutionSchema>>(
          "/lookups/partner_institution",
          "/lookups/:table",
          {},
          page(institutionSchema)
        ).catch(() => [] as z.infer<typeof institutionSchema>[]),
      ]);
      const providers = rows.map<ProviderView>((row) => {
        // The register holds the counts; each group's recent items load with the drawer.
        const workload: ProviderWorkload = {
          sessions: { count: row.sessions_count, recent: [] },
          counselling: { count: row.counselling_count, recent: [] },
          trainees: { count: row.trainees_count, recent: [] },
          cases: { count: row.cases_count, recent: [] },
        };
        return {
          id: row.id,
          name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
          firstName: row.first_name,
          middleName: row.middle_name,
          lastName: row.last_name,
          type: typeOf(row.provider_type),
          service: row.service_description,
          institutionId: row.affiliated_institution_id,
          institution:
            row.affiliated_institution_id === null
              ? "Independent"
              : (institutions.find((item) => item.id === row.affiliated_institution_id)?.name ??
                "Unknown institution"),
          phone: row.phone_number,
          email: row.email,
          notes: row.notes,
          active: row.status === "ACTIVE",
          statusDescription: row.status_description,
          created: row.created_at,
          updated: row.updated_at,
          linkedWork: linkedWork(workload),
          workload,
        };
      });
      return {
        providers,
        institutions: institutions
          .filter((item) => item.status === undefined || item.status === "ACTIVE")
          .map(({ id: value, name }) => ({ id: value, name })),
      };
    },
    /** A provider's recent linked work, loaded when its drawer opens. */
    async workload(providerId: number): Promise<ProviderWorkload | null> {
      const result = await client.request(
        {
          method: "GET",
          path: `${PATH}/${providerId}`,
          routeTemplate: ITEM_TEMPLATE,
          token,
          query: { include: "workload" },
        },
        createEnvelopeSchema(z.union([providerWithWorkloadSchema, z.null()]))
      );
      return result.success ? (result.data?.workload ?? null) : null;
    },
    create: (values: Values) => write("POST", values),
    update: (providerId: number, values: Values) => write("PATCH", values, providerId),
    setActive: (providerId: number, active: boolean) =>
      write("PATCH", { status: active ? "ACTIVE" : "INACTIVE" }, providerId),
    /** The full contact value; the API audits every reveal. */
    async reveal(providerId: number, field: "phone_number" | "email") {
      const result = await client.request(
        {
          method: "GET",
          path: `${PATH}/${providerId}`,
          routeTemplate: ITEM_TEMPLATE,
          token,
          query: { reveal: field },
        },
        createEnvelopeSchema(z.union([revealSchema, z.null()]))
      );
      return {
        ...result,
        data: result.data?.[field] == null ? null : { value: result.data[field] },
      };
    },
  };
}

export const providersApi = {
  async directory() {
    return (await withSessionApi(createProvidersApi)).directory();
  },
};
