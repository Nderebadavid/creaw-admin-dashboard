/**
 * Typed client for one pillar's group sessions: a page of sessions with the facilitator,
 * activity type and topic named by the API, each session's attendance and files on
 * demand, and the form options. Reads go through /pillars/<code>; the API scopes them to
 * that pillar, masks nothing sensitive here and computes the curriculum coverage.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import { titleCase } from "@/lib/format";
import type { PaginatedData } from "@/types/api";
import {
  type ActivityTopicOption,
  type ActivityTypeOption,
  type AttendeeView,
  type FacilitatorOption,
  type FacilitatorView,
  type SessionDetail,
  type SessionFormOptions,
  type SessionPeriod,
  type SessionPillar,
  type SessionView,
  type SessionWorkspace,
  type SessionSummary,
  type TypeCoverage,
} from "./model";

const id = z.number().int().positive();
const optionalId = id.nullish().transform((value) => value ?? null);
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));
export const sessionSchema = z.object({
  id,
  pillar_id: id,
  enrollment_id: id.nullable(),
  activity_type_id: id,
  activity_topic_id: optionalId,
  session_date: z.string(),
  venue: z.string().nullable(),
  topic: z.string().nullable(),
  facilitator_user_id: id.nullable(),
  facilitator_provider_id: id.nullable(),
  facilitator_name: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null),
  facilitator_kind: z
    .enum(["staff", "provider"])
    .nullish()
    .transform((value) => value ?? null),
  notes: z.string().nullable(),
  status: z
    .string()
    .nullish()
    .transform((value) => value ?? "ACTIVE"),
  status_description: optionalText,
  /** Named by the API, so a register row needs no other table. */
  activity_type_name: optionalText,
  activity_topic_name: optionalText,
  attendee_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  created_at: z.string(),
  updated_at: z.string(),
});
const attendanceSchema = z.object({
  id,
  session_id: id,
  participant_id: id,
  participant_name: optionalText,
  participant_ward_name: optionalText,
  created_at: z.string(),
  is_deleted: z.boolean(),
});
const sessionDocumentRow = z.object({
  id,
  owner_type: z.string(),
  owner_id: id,
  document_type: z.string(),
  created_at: z.string(),
});
const detailSchema = createEnvelopeSchema(
  z.union([
    sessionSchema.extend({
      attendees: z.array(attendanceSchema).default([]),
      documents: z.array(sessionDocumentRow).default([]),
    }),
    z.null(),
  ])
);
const facilitatorOptionSchema = z.object({
  kind: z.enum(["staff", "provider"]),
  id,
  name: z.string(),
  detail: z.string(),
});
const optionsSchema = createEnvelopeSchema(
  z.union([
    z.object({
      activity_types: z.array(z.object({ id, name: z.string(), active: z.boolean() })),
      topics: z.array(
        z.object({
          id,
          activity_type_id: id,
          name: z.string(),
          sequence_no: z.number(),
          active: z.boolean(),
        })
      ),
      facilitators: z.array(facilitatorOptionSchema),
    }),
    z.null(),
  ])
);
const documentSchema = z.object({
  id,
  owner_type: z.string(),
  owner_id: id,
  document_type: z.string(),
  created_at: z.string(),
});
export const sessionFileSchema = createEnvelopeSchema(
  z.union([documentSchema.extend({ file_url: z.string() }), z.null()])
);
export const sessionMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);

type Envelope<T> = { success: boolean; message: string; data: T | null };
type Values = Record<string, string | number | boolean | null>;

type FacilitatorRow = {
  facilitator_user_id: number | null;
  facilitator_provider_id: number | null;
  facilitator_name: string | null;
  facilitator_kind: "staff" | "provider" | null;
};
const facilitatorRefOf = (row: FacilitatorRow): SessionView["facilitatorRef"] =>
  row.facilitator_user_id
    ? { kind: "staff", id: row.facilitator_user_id }
    : row.facilitator_provider_id
      ? { kind: "provider", id: row.facilitator_provider_id }
      : null;
/** The facilitator's name, or a generic label (never an id) when the API did not send one. */
const facilitatorOf = (row: FacilitatorRow): FacilitatorView => {
  const kind = row.facilitator_kind ?? facilitatorRefOf(row)?.kind ?? null;
  const fallback =
    kind === "staff" ? "CREAW staff" : kind === "provider" ? "External provider" : "Not assigned";
  return { name: row.facilitator_name ?? fallback, kind };
};

/** The register's column ids and the API fields they sort by. */
export const SESSION_SORT_KEYS: Record<string, string> = {
  type: "activity_type_name",
  topic: "activity_topic_name,topic",
  date: "session_date",
  venue: "venue",
  facilitator: "facilitator_name",
  attendees: "attendee_count",
  record: "status",
  updated: "updated_at",
};

/** A session as the register shows it; names arrive with the row. */
function sessionView(row: z.infer<typeof sessionSchema>): SessionView {
  const freeTopic = row.topic?.trim() ? row.topic : null;
  return {
    id: row.id,
    activityTypeId: row.activity_type_id,
    activityType: row.activity_type_name ?? "Unknown activity type",
    topicId: row.activity_topic_id,
    topic: row.activity_topic_name ?? freeTopic ?? `Session #${row.id}`,
    freeTopic,
    date: row.session_date,
    venue: row.venue,
    notes: row.notes,
    facilitator: facilitatorOf(row),
    facilitatorRef: facilitatorRefOf(row),
    communityWide: row.enrollment_id === null,
    attendeeCount: row.attendee_count,
    status: row.status,
    statusDescription: row.status_description,
    logged: row.created_at,
    updated: row.updated_at,
  };
}

export function createSessionsApi(client: ApiClient, token: string) {
  const pathOf = (pillar: SessionPillar) => `/pillars/${pillar}`;
  const required = <T>(result: Envelope<T>): T => {
    if (!result.success || !result.data) throw new Error(result.message);
    return result.data;
  };
  const read = <T>(
    pillar: SessionPillar,
    query: Record<string, string | number | boolean>,
    schema: z.ZodType<Envelope<T>>
  ) =>
    client.request(
      {
        method: "GET",
        path: pathOf(pillar),
        routeTemplate: "/pillars/:pillar",
        token,
        query,
      },
      schema as never
    ) as Promise<Envelope<T>>;
  const write = (
    method: "POST" | "PATCH",
    pillar: SessionPillar,
    name: string,
    body: Values,
    recordId?: number
  ) =>
    client.request(
      {
        method,
        path: pathOf(pillar),
        routeTemplate: "/pillars/:pillar",
        token,
        query: recordId === undefined ? { table: name } : { table: name, id: recordId },
        body,
      },
      sessionMutationSchema
    );

  return {
    /** One page of the pillar's sessions; the API filters, searches and sorts. */
    async listSessions(
      pillar: SessionPillar,
      query: ListQuery = {}
    ): Promise<PaginatedData<SessionView>> {
      const data = required(
        await read(
          pillar,
          {
            table: "activity_session",
            ...listParams(query, SESSION_SORT_KEYS, { sort: "session_date:desc" }),
          },
          page(sessionSchema) as never
        )
      ) as PaginatedData<z.infer<typeof sessionSchema>>;
      return { ...data, items: data.items.map(sessionView) };
    },
    /** A session's attendance and files, loaded when its drawer opens. */
    async sessionDetail(pillar: SessionPillar, sessionId: number): Promise<SessionDetail | null> {
      const result = await read(
        pillar,
        { table: "activity_session", id: sessionId, include: "attendees,documents" },
        detailSchema
      );
      if (!result.success || !result.data) return null;
      return {
        attendees: result.data.attendees.map<AttendeeView>((item) => ({
          attendanceId: item.id,
          participantId: item.participant_id,
          name: item.participant_name ?? "Participant record",
          ward: item.participant_ward_name,
          added: item.created_at,
        })),
        documents: result.data.documents.map((doc) => ({
          id: doc.id,
          name: titleCase(doc.document_type),
          added: doc.created_at,
        })),
      };
    },
    /** What the log and edit forms offer; people are names only. */
    async formOptions(pillar: SessionPillar): Promise<SessionFormOptions> {
      const result = await client.request(
        {
          method: "GET",
          path: `${pathOf(pillar)}/form-options`,
          routeTemplate: "/pillars/:pillar/form-options",
          token,
          query: { form: "session" },
        },
        optionsSchema
      );
      const data = required(result);
      return {
        activityTypes: data.activity_types.map<ActivityTypeOption>((row) => row),
        topics: data.topics.map<ActivityTopicOption>((row) => ({
          id: row.id,
          activityTypeId: row.activity_type_id,
          name: row.name,
          sequenceNo: row.sequence_no,
          active: row.active,
        })),
        facilitators: data.facilitators as FacilitatorOption[],
      };
    },
    /**
     * Page 1 of the register with the pillar's coverage cards. The cards come from the
     * pillar summary, which the page has already read.
     */
    async workspace(
      pillar: SessionPillar,
      period: SessionPeriod,
      cards: { summary: SessionSummary; coverage: TypeCoverage[] },
      currentUser?: { id: number; name: string }
    ): Promise<SessionWorkspace> {
      return {
        pillar,
        period,
        sessions: await this.listSessions(pillar, { page: 1, pageSize: 25 }),
        coverage: cards.coverage,
        summary: cards.summary,
        currentUser: currentUser ?? null,
      };
    },
    logSession(pillar: SessionPillar, values: Values) {
      return write("POST", pillar, "activity_session", values);
    },
    updateSession(pillar: SessionPillar, sessionId: number, values: Values) {
      return write("PATCH", pillar, "activity_session", values, sessionId);
    },
    /** Every attendance row of a session, including removed ones. */
    async attendance(pillar: SessionPillar, sessionId: number) {
      const data = required(
        await read(
          pillar,
          {
            table: "activity_attendance",
            includeDeleted: "true",
            session_id: String(sessionId),
            page: 1,
            pageSize: 100,
          },
          page(attendanceSchema) as never
        )
      ) as PaginatedData<z.infer<typeof attendanceSchema>>;
      return data.items.map((row) => ({
        id: row.id,
        participant_id: row.participant_id,
        is_deleted: row.is_deleted,
      }));
    },
    addAttendance(pillar: SessionPillar, sessionId: number, participantId: number) {
      return write("POST", pillar, "activity_attendance", {
        session_id: sessionId,
        participant_id: participantId,
      });
    },
    setAttendanceDeleted(pillar: SessionPillar, attendanceId: number, deleted: boolean) {
      return write(
        "PATCH",
        pillar,
        "activity_attendance",
        { is_deleted: deleted, status: deleted ? "INACTIVE" : "ACTIVE" },
        attendanceId
      );
    },
    /** One session of a pillar as stored, or undefined when it is not there. */
    async session(pillar: SessionPillar, sessionId: number) {
      const result = await read(
        pillar,
        { table: "activity_session", id: sessionId },
        createEnvelopeSchema(z.union([sessionSchema, z.null()]))
      );
      return result.success ? (result.data ?? undefined) : undefined;
    },
    attach(pillar: SessionPillar, sessionId: number, documentType: string, fileUrl: string) {
      return write("POST", pillar, "document", {
        owner_type: "activity_session",
        owner_id: sessionId,
        document_type: documentType,
        file_url: fileUrl,
      });
    },
    /** A session file, read with an audited download. */
    viewDocument(pillar: SessionPillar, documentId: number) {
      return client.request(
        {
          method: "GET",
          path: pathOf(pillar),
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "document", id: documentId, download: true },
        },
        sessionFileSchema
      );
    },
  };
}

export const sessionsApi = {
  async workspace(
    pillar: SessionPillar,
    period: SessionPeriod,
    cards: { summary: SessionSummary; coverage: TypeCoverage[] },
    currentUser?: { id: number; name: string }
  ) {
    return (await withSessionApi(createSessionsApi)).workspace(pillar, period, cards, currentUser);
  },
};
