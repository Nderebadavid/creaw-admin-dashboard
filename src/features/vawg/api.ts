/**
 * Typed client for the VAWG legal case register: cases with their survivor,
 * case type, counselling sessions and case files, and the pillar's headline
 * counts. Reads go through /pillars/vawg; the API scopes and masks them.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { collectPages } from "@/lib/api/pagination";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import { titleCase } from "@/lib/format";
import type { PaginatedData } from "@/types/api";
import {
  counsellingTypes,
  type CaseDetail,
  type CaseFormOptions,
  type CounsellingFormOptions,
  type CounsellingSessionView,
  type CounsellorOption,
  type LegalCaseView,
  type SurvivorCounselling,
  type VawgWorkspace,
} from "./model";

const id = z.number().int().positive();
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));
/** A column an older backend may omit: a missing key reads as null. */
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const optionalNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);
export const caseSchema = z.object({
  id,
  enrollment_id: id,
  case_type_id: id,
  court_status: z.string().nullable(),
  court_name: optionalText,
  assigned_officer: optionalText,
  next_court_date: optionalText,
  court_file_number: optionalText,
  ob_number: optionalText,
  counsellor: optionalText,
  advocate_name: optionalText,
  mediation_attempted: z.boolean(),
  mediation_outcome: z.string().nullable(),
  ruling_date: z.string().nullable(),
  opened_date: z.string(),
  closed_date: z.string().nullable(),
  status: z
    .string()
    .nullish()
    .transform((value) => value ?? "ACTIVE"),
  status_description: optionalText,
  outcome_notes: optionalText,
  created_at: optionalText,
  updated_at: optionalText,
  /** Named by the API, so a register row needs no other table. */
  participant_id: optionalNumber,
  participant_name: optionalText,
  case_type_name: optionalText,
  case_type_route: optionalText,
  case_type_requires_forms: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  case_number: optionalText,
});
const survivorSchema = z.object({
  id,
  participant_id: optionalNumber,
  record_name: optionalText,
  counselling_count: optionalNumber,
  counselling_last_date: optionalText,
  counselling_last_type: optionalText,
  counselling_last_counsellor: optionalText,
  counselling_last_counsellor_kind: z
    .enum(["staff", "provider"])
    .nullish()
    .transform((value) => value ?? null),
  legal_case_number: optionalText,
});
const optionalId = id.nullish().transform((value) => value ?? null);
const sessionSchema = z.object({
  id,
  enrollment_id: id,
  session_no: z.number(),
  session_date: z.string(),
  session_type: z.string(),
  counsellor_user_id: optionalId,
  counsellor_provider_id: optionalId,
  counsellor_name: optionalText,
  counsellor_kind: z
    .enum(["staff", "provider"])
    .nullish()
    .transform((value) => value ?? null),
  notes: optionalText,
});
const counsellorOptionSchema = z.object({
  kind: z.enum(["staff", "provider"]),
  id,
  name: z.string(),
  detail: z.string(),
});
export const counsellingReadSchema = createEnvelopeSchema(z.union([sessionSchema, z.null()]));

/** A session as the register shows it; the counsellor falls back to a label, never an id. */
function sessionView(row: z.infer<typeof sessionSchema>): CounsellingSessionView {
  const counsellorRef = row.counsellor_user_id
    ? { kind: "staff" as const, id: row.counsellor_user_id }
    : row.counsellor_provider_id
      ? { kind: "provider" as const, id: row.counsellor_provider_id }
      : null;
  const kind = row.counsellor_kind ?? counsellorRef?.kind ?? null;
  const fallback =
    kind === "staff"
      ? "CREAW counsellor"
      : kind === "provider"
        ? "External counsellor"
        : "Not recorded";
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    number: row.session_no,
    date: row.session_date,
    type: counsellingTypes.find((type) => type === row.session_type) ?? null,
    counsellor: { name: row.counsellor_name ?? fallback, kind },
    counsellorRef,
    notes: row.notes,
  };
}

export interface VawgWorkspaceOptions {
  /** Whether to read counselling (needs COUNSELLING_VIEW in VAWG). */
  canViewCounselling?: boolean;
  /** Whether to load the counsellor picker (needs COUNSELLING_LOG in VAWG). */
  canLogCounselling?: boolean;
  currentUserId?: number;
}
const documentSchema = z.object({
  id,
  owner_type: z.string(),
  owner_id: id,
  document_type: z.string(),
});
const enrollmentSchema = z.object({ id, participant_id: id.nullable(), pillar_id: id });
export const caseFileSchema = createEnvelopeSchema(
  z.union([documentSchema.extend({ file_url: z.string() }), z.null()])
);
export const vawgMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);

const PATH = "/pillars/vawg";
/** Forms a sexual-violence case type needs in its court file. */
const REQUIRED_FORMS = [
  ["p3_form", "P3 form"],
  ["prc_form", "PRC form"],
] as const;

export const caseNumber = (caseId: number) => `CRW-VAWG-${String(caseId).padStart(4, "0")}`;

/** The case register's column ids and the API fields they sort by. */
export const CASE_SORT_KEYS: Record<string, string> = {
  case: "id",
  type: "case_type_name",
  court: "court_name",
  officer: "assigned_officer",
  nextDate: "next_court_date",
  status: "court_status",
};
/** The counselling register's column ids and the API fields they sort by. */
export const SURVIVOR_SORT_KEYS: Record<string, string> = {
  survivor: "record_name",
  sessions: "counselling_count",
  last: "counselling_last_date",
  counsellor: "counselling_last_counsellor",
  case: "legal_case_number",
};

type Envelope<T> = { success: boolean; message: string; data: T | null };

function caseView(row: z.infer<typeof caseSchema>): LegalCaseView {
  return {
    id: row.id,
    number: row.case_number ?? caseNumber(row.id),
    survivor: row.participant_name ?? "Survivor record",
    participantId: row.participant_id,
    enrollmentId: row.enrollment_id,
    caseType: row.case_type_name ?? "Case type",
    caseTypeId: row.case_type_id,
    route: row.case_type_route === "court_direct" ? "Court, direct" : "Mediation/ADR first",
    courtStatus: row.court_status,
    court: row.court_name,
    assignedOfficer: row.assigned_officer,
    nextCourtDate: row.next_court_date,
    courtFileNumber: row.court_file_number,
    obNumber: row.ob_number,
    counsellor: row.counsellor,
    advocate: row.advocate_name,
    mediationAttempted: row.mediation_attempted,
    mediationOutcome: row.mediation_outcome,
    opened: row.opened_date,
    ruling: row.ruling_date,
    closed: row.closed_date,
    requiresForms: row.case_type_requires_forms,
    status: row.status,
    statusDescription: row.status_description,
    outcomeNotes: row.outcome_notes,
    created: row.created_at,
    updated: row.updated_at,
    counselling: [],
    documents: [],
    missing: [],
  };
}

function survivorView(row: z.infer<typeof survivorSchema>): SurvivorCounselling {
  return {
    enrollmentId: row.id,
    participantId: row.participant_id,
    name: row.record_name ?? "Survivor record",
    sessionCount: row.counselling_count ?? 0,
    lastDate: row.counselling_last_date,
    lastType: counsellingTypes.find((type) => type === row.counselling_last_type) ?? null,
    lastCounsellor: row.counselling_last_counsellor
      ? { name: row.counselling_last_counsellor, kind: row.counselling_last_counsellor_kind }
      : null,
    caseNumber: row.legal_case_number,
  };
}

const caseDetailSchema = createEnvelopeSchema(
  z.union([
    caseSchema.extend({
      documents: z.array(documentSchema.pick({ id: true, document_type: true })).default([]),
      counselling: z.array(sessionSchema).default([]),
    }),
    z.null(),
  ])
);
const survivorDetailSchema = createEnvelopeSchema(
  z.union([survivorSchema.extend({ counselling: z.array(sessionSchema).default([]) }), z.null()])
);
const caseOptionsSchema = createEnvelopeSchema(
  z.union([
    z.object({
      survivors: z.array(z.object({ id, label: z.string() })),
      case_types: z.array(z.object({ id, name: z.string() })),
    }),
    z.null(),
  ])
);
const counsellingOptionsSchema = createEnvelopeSchema(
  z.union([
    z.object({
      survivors: z.array(
        z.object({ id, label: z.string(), sessions: z.number().int().default(0) })
      ),
      counsellors: z.array(counsellorOptionSchema),
    }),
    z.null(),
  ])
);

export function createVawgApi(client: ApiClient, token: string) {
  const read = async <T>(
    query: Record<string, string | number>,
    schema: z.ZodType<Envelope<T>>
  ) => {
    const result = await client.request(
      { method: "GET", path: PATH, routeTemplate: "/pillars/:pillar", token, query },
      schema as never
    );
    return result as Envelope<T>;
  };
  const required = <T>(result: Envelope<T>): T => {
    if (!result.success || !result.data) throw new Error(result.message);
    return result.data;
  };
  /** Every page of a small table, e.g. the counsellor options. */
  const table = <T>(name: string, schema: z.ZodType<T>) =>
    collectPages(async (pageNo, pageSize) =>
      required(
        (await read({ table: name, page: pageNo, pageSize }, page(schema) as never)) as Envelope<
          PaginatedData<T>
        >
      )
    );
  const formOptions = <T>(form: string, schema: z.ZodType<Envelope<T>>) =>
    client
      .request(
        {
          method: "GET",
          path: `${PATH}/form-options`,
          routeTemplate: "/pillars/:pillar/form-options",
          token,
          query: { form },
        },
        schema as never
      )
      .then((result) => required(result as Envelope<T>));

  return {
    /** One page of legal cases; names and the case type's rules arrive with each row. */
    async listCases(query: ListQuery = {}): Promise<PaginatedData<LegalCaseView>> {
      const data = required(
        await read(
          { table: "legal_case", ...listParams(query, CASE_SORT_KEYS) },
          page(caseSchema) as never
        )
      ) as PaginatedData<z.infer<typeof caseSchema>>;
      return { ...data, items: data.items.map(caseView) };
    },
    /** One page of VAWG survivors with their counselling summary, for users who may view it. */
    async listSurvivors(query: ListQuery = {}): Promise<PaginatedData<SurvivorCounselling>> {
      const data = required(
        await read(
          { table: "enrollment", ...listParams(query, SURVIVOR_SORT_KEYS) },
          page(survivorSchema) as never
        )
      ) as PaginatedData<z.infer<typeof survivorSchema>>;
      return { ...data, items: data.items.map(survivorView) };
    },
    /** A case's counselling, files and missing forms, loaded when its drawer opens. */
    async caseDetail(caseId: number): Promise<CaseDetail | null> {
      const result = await read(
        { table: "legal_case", id: caseId, include: "documents,counselling" },
        caseDetailSchema
      );
      if (!result.success || !result.data) return null;
      const row = result.data;
      return {
        counselling: row.counselling
          .map((session) => sessionView(session))
          .sort((a, b) => a.number - b.number)
          .map((session) => ({
            number: session.number,
            date: session.date,
            counsellor: session.counsellor.kind ? session.counsellor.name : null,
          })),
        documents: row.documents.map((doc) => ({ id: doc.id, name: titleCase(doc.document_type) })),
        missing: row.case_type_requires_forms
          ? REQUIRED_FORMS.filter(
              ([code]) => !row.documents.some((doc) => doc.document_type === code)
            ).map(([, label]) => label)
          : [],
      };
    },
    /** A survivor's counselling sessions in order, loaded when their record opens. */
    async survivorSessions(enrollmentId: number): Promise<CounsellingSessionView[]> {
      const result = await read(
        { table: "enrollment", id: enrollmentId, include: "counselling" },
        survivorDetailSchema
      );
      if (!result.success || !result.data) return [];
      return result.data.counselling.map(sessionView).sort((a, b) => a.number - b.number);
    },
    /** What the Open legal case and Edit case dialogs offer. */
    async caseOptions(): Promise<CaseFormOptions> {
      const data = await formOptions("case", caseOptionsSchema);
      return {
        survivors: data.survivors.map((row) => ({ enrollmentId: row.id, label: row.label })),
        caseTypes: data.case_types,
      };
    },
    /** What the Log counselling dialog offers. */
    async counsellingOptions(): Promise<CounsellingFormOptions> {
      const data = await formOptions("counselling", counsellingOptionsSchema);
      return {
        survivors: data.survivors.map((row) => ({
          enrollmentId: row.id,
          label: row.label,
          sessionCount: row.sessions,
        })),
        counsellors: data.counsellors,
      };
    },
    /** Page 1 of each register for the VAWG page. */
    async workspace(options: VawgWorkspaceOptions = {}): Promise<VawgWorkspace> {
      const [cases, counselling] = await Promise.all([
        this.listCases({ page: 1, pageSize: 25 }),
        options.canViewCounselling
          ? this.listSurvivors({ page: 1, pageSize: 25 })
          : Promise.resolve(null),
      ]);
      return { cases, counselling, currentUserId: options.currentUserId ?? null };
    },
    /** Active staff and external counsellors this user may pick; [] when the read fails. */
    async counsellors(): Promise<CounsellorOption[]> {
      return table("counsellor_option", counsellorOptionSchema).catch(() => []);
    },
    /** Whether an enrollment is a VAWG survivor's. */
    async isSurvivor(enrollmentId: number) {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "enrollment", id: enrollmentId },
        },
        createEnvelopeSchema(z.union([enrollmentSchema, z.null()]))
      );
      return result.success && result.data?.pillar_id === 1;
    },
    /** One counselling session as the API returns it, or null when it is not there. */
    async counsellingSession(sessionId: number) {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "counselling_session", id: sessionId },
        },
        counsellingReadSchema
      );
      return result.success ? result.data : null;
    },
    logCounselling(values: Record<string, string | number | null>) {
      return client.request(
        {
          method: "POST",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "counselling_session" },
          body: values,
        },
        vawgMutationSchema
      );
    },
    updateCounselling(sessionId: number, values: Record<string, string | number | null>) {
      return client.request(
        {
          method: "PATCH",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "counselling_session", id: sessionId },
          body: values,
        },
        vawgMutationSchema
      );
    },
    /** A session's notes, read with an audited reveal. */
    async revealCounsellingNotes(sessionId: number) {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "counselling_session", id: sessionId, reveal: "notes" },
        },
        counsellingReadSchema
      );
      return { ...result, value: result.data?.notes ?? null };
    },
    setCourtStatus(caseId: number, courtStatus: string) {
      return client.request(
        {
          method: "PATCH",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "legal_case", id: caseId },
          body: { court_status: courtStatus },
        },
        vawgMutationSchema
      );
    },
    updateCase(caseId: number, values: Record<string, string | number | null>) {
      return client.request(
        {
          method: "PATCH",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "legal_case", id: caseId },
          body: values,
        },
        vawgMutationSchema
      );
    },
    async revealCaseField(caseId: number, field: "ob_number") {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "legal_case", id: caseId, reveal: field },
        },
        createEnvelopeSchema(z.union([caseSchema, z.null()]))
      );
      return {
        ...result,
        data: result.data?.[field] == null ? null : { value: result.data[field] },
      };
    },
    attach(caseId: number, documentType: string, fileUrl: string) {
      return client.request(
        {
          method: "POST",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "document" },
          body: {
            owner_type: "legal_case",
            owner_id: caseId,
            document_type: documentType,
            file_url: fileUrl,
          },
        },
        vawgMutationSchema
      );
    },
    /** A case file, read with an audited download. */
    viewDocument(documentId: number) {
      return client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "document", id: documentId, download: true },
        },
        caseFileSchema
      );
    },
  };
}

export const vawgApi = {
  async workspace(options?: VawgWorkspaceOptions) {
    return (await withSessionApi(createVawgApi)).workspace(options);
  },
};
