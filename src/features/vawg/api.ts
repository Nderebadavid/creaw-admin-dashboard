/**
 * Typed client for the VAWG legal case register: cases with their survivor,
 * case type, counselling sessions and case files, and the pillar's headline
 * counts. Reads go through /pillars/vawg; the API scopes and masks them.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { collectPages } from "@/lib/api/pagination";
import { withSessionApi } from "@/lib/api/session-api";
import { titleCase } from "@/lib/format";
import {
  counsellingTypes,
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
const caseSchema = z.object({
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
});
const enrollmentSchema = z.object({ id, participant_id: id.nullable(), pillar_id: id });
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
const caseTypeSchema = z.object({
  id,
  name: z.string(),
  requires_p3_prc_forms: z.boolean().optional(),
  default_route: z.string().optional(),
});
const participantSchema = z.object({ id, first_name: z.string(), last_name: z.string() });
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

type Envelope<T> = { success: boolean; message: string; data: T | null };

export function createVawgApi(client: ApiClient, token: string) {
  const all = <T>(
    path: string,
    routeTemplate: "/pillars/:pillar" | "/lookups/:table" | "/participants",
    query: Record<string, string>,
    schema: z.ZodType<
      Envelope<{
        items: T[];
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      }>
    >
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
  const table = <T>(name: string, schema: z.ZodType<T>) =>
    all<T>(PATH, "/pillars/:pillar", { table: name }, page(schema) as never);

  return {
    async workspace(options: VawgWorkspaceOptions = {}): Promise<VawgWorkspace> {
      const [cases, enrollments, sessions, documents, caseTypes, participants, counsellors] =
        await Promise.all([
          table("legal_case", caseSchema),
          table("enrollment", enrollmentSchema),
          options.canViewCounselling
            ? table("counselling_session", sessionSchema).catch(() => [])
            : Promise.resolve([] as z.infer<typeof sessionSchema>[]),
          table("document", documentSchema).catch(() => []),
          all("/lookups/case_type", "/lookups/:table", {}, page(caseTypeSchema) as never).catch(
            () => [] as z.infer<typeof caseTypeSchema>[]
          ),
          all("/participants", "/participants", {}, page(participantSchema) as never).catch(
            () => [] as z.infer<typeof participantSchema>[]
          ),
          options.canLogCounselling ? this.counsellors() : Promise.resolve([]),
        ]);
      const nameOf = (participantId: number | null) => {
        const person = (participants as z.infer<typeof participantSchema>[]).find(
          (row) => row.id === participantId
        );
        return person
          ? `${person.first_name} ${person.last_name}`
          : `Survivor #${participantId ?? "—"}`;
      };
      const vawgEnrollments = enrollments.filter((row) => row.pillar_id === 1);
      const sessionViews = sessions.map(sessionView).sort((a, b) => a.number - b.number);
      const views: LegalCaseView[] = cases.map((row) => {
        const enrollment = vawgEnrollments.find((item) => item.id === row.enrollment_id);
        const type = (caseTypes as z.infer<typeof caseTypeSchema>[]).find(
          (item) => item.id === row.case_type_id
        );
        const files = documents.filter(
          (doc) => doc.owner_type === "legal_case" && doc.owner_id === row.id
        );
        return {
          id: row.id,
          number: caseNumber(row.id),
          survivor: nameOf(enrollment?.participant_id ?? null),
          participantId: enrollment?.participant_id ?? null,
          enrollmentId: row.enrollment_id,
          caseType: type?.name ?? `Case type #${row.case_type_id}`,
          caseTypeId: row.case_type_id,
          route: type?.default_route === "court_direct" ? "Court, direct" : "Mediation/ADR first",
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
          counselling: sessionViews
            .filter((session) => session.enrollmentId === row.enrollment_id)
            .map((session) => ({
              number: session.number,
              date: session.date,
              counsellor: session.counsellor.kind ? session.counsellor.name : null,
            })),
          documents: files.map((doc) => ({ id: doc.id, name: titleCase(doc.document_type) })),
          missing: type?.requires_p3_prc_forms
            ? REQUIRED_FORMS.filter(
                ([code]) => !files.some((doc) => doc.document_type === code)
              ).map(([, label]) => label)
            : [],
        };
      });
      const quarterStart = (() => {
        const now = new Date();
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          .toISOString()
          .slice(0, 10);
      })();
      return {
        cases: views,
        summary: {
          survivors: vawgEnrollments.length,
          openCases: views.filter((row) => !row.closed).length,
          sessions: sessions.length,
          sessionsThisQuarter: sessions.filter((row) => row.session_date >= quarterStart).length,
          concluded: views.filter((row) => row.closed || row.courtStatus === "judgment_delivered")
            .length,
        },
        caseTypes: (caseTypes as z.infer<typeof caseTypeSchema>[]).map(({ id: typeId, name }) => ({
          id: typeId,
          name,
        })),
        survivors: vawgEnrollments.map((row) => ({
          enrollmentId: row.id,
          label: nameOf(row.participant_id),
        })),
        counselling: options.canViewCounselling
          ? vawgEnrollments.map<SurvivorCounselling>((row) => {
              const legalCase = views.find((item) => item.enrollmentId === row.id);
              return {
                enrollmentId: row.id,
                participantId: row.participant_id,
                name: nameOf(row.participant_id),
                sessions: sessionViews.filter((session) => session.enrollmentId === row.id),
                caseNumber: legalCase?.number ?? null,
              };
            })
          : null,
        counsellors,
        currentUserId: options.currentUserId ?? null,
      };
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
