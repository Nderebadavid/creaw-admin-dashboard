/**
 * Typed client for one pillar's group sessions: activity types, planned topics,
 * sessions with their attendance and files, and the curriculum coverage.
 * Reads go through /pillars/<code>; the API scopes them to that pillar and masks names.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { collectPages } from "@/lib/api/pagination";
import { withSessionApi } from "@/lib/api/session-api";
import { titleCase } from "@/lib/format";
import { buildCoverage } from "./coverage";
import {
  SESSION_PILLAR_IDS,
  type ActivityTopicOption,
  type ActivityTypeOption,
  type FacilitatorLabel,
  type SessionPeriod,
  type SessionPillar,
  type SessionView,
  type SessionWorkspace,
} from "./model";

const id = z.number().int().positive();
const optionalId = id.nullish().transform((value) => value ?? null);
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));
const sessionSchema = z.object({
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
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const attendanceSchema = z.object({
  id,
  session_id: id,
  participant_id: id,
  created_at: z.string(),
  is_deleted: z.boolean(),
});
const typeSchema = z.object({
  id,
  pillar_id: id,
  name: z.string(),
  status: z.string(),
  is_deleted: z.boolean(),
});
const topicSchema = z.object({
  id,
  activity_type_id: id,
  name: z.string(),
  sequence_no: z.number(),
  status: z.string(),
  is_deleted: z.boolean(),
});
const participantSchema = z.object({
  id,
  first_name: z.string(),
  last_name: z.string(),
  ward_id: id.nullable().optional(),
});
const wardSchema = z.object({ id, name: z.string() });
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

const isActive = (row: { status: string; is_deleted: boolean }) =>
  row.status === "ACTIVE" && !row.is_deleted;
const facilitatorOf = (row: {
  facilitator_user_id: number | null;
  facilitator_provider_id: number | null;
}): FacilitatorLabel =>
  row.facilitator_user_id
    ? "CREAW staff"
    : row.facilitator_provider_id
      ? "External provider"
      : "Not assigned";

export function createSessionsApi(client: ApiClient, token: string) {
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
  const pathOf = (pillar: SessionPillar) => `/pillars/${pillar}`;
  const table = <T>(pillar: SessionPillar, name: string, schema: z.ZodType<T>, extra = {}) =>
    all<T>(pathOf(pillar), "/pillars/:pillar", { table: name, ...extra }, page(schema) as never);
  /** Retired rows too when the caller manages lookups; otherwise the active ones. */
  const lookup = <T>(name: string, schema: z.ZodType<T>) =>
    all<T>("/lookups/" + name, "/lookups/:table", { includeDeleted: "true" }, page(schema) as never)
      .catch(() => all<T>("/lookups/" + name, "/lookups/:table", {}, page(schema) as never))
      .catch(() => [] as T[]);
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
  const curriculumOf = (
    pillar: SessionPillar,
    rawTypes: z.infer<typeof typeSchema>[],
    rawTopics: z.infer<typeof topicSchema>[]
  ) => {
    const types = rawTypes.filter((row) => row.pillar_id === SESSION_PILLAR_IDS[pillar]);
    const typeIds = new Set(types.map((row) => row.id));
    return {
      types: types.map<ActivityTypeOption>((row) => ({
        id: row.id,
        name: row.name,
        active: isActive(row),
      })),
      topics: rawTopics
        .filter((row) => typeIds.has(row.activity_type_id))
        .map<ActivityTopicOption>((row) => ({
          id: row.id,
          activityTypeId: row.activity_type_id,
          name: row.name,
          sequenceNo: row.sequence_no,
          active: isActive(row),
        })),
    };
  };

  return {
    async workspace(
      pillar: SessionPillar,
      period: SessionPeriod,
      today: Date = new Date()
    ): Promise<SessionWorkspace> {
      const [sessions, attendance, documents, rawTypes, rawTopics, participants, wards] =
        await Promise.all([
          table(pillar, "activity_session", sessionSchema),
          table(pillar, "activity_attendance", attendanceSchema).catch(() => []),
          table(pillar, "document", documentSchema).catch(() => []),
          lookup("activity_type_definition", typeSchema),
          lookup("activity_topic", topicSchema),
          all("/participants", "/participants", {}, page(participantSchema) as never).catch(
            () => [] as z.infer<typeof participantSchema>[]
          ),
          lookup("ward", wardSchema),
        ]);
      const { types, topics } = curriculumOf(pillar, rawTypes, rawTopics);
      const people = participants as z.infer<typeof participantSchema>[];
      const liveAttendance = attendance.filter((row) => !row.is_deleted);
      const views: SessionView[] = sessions
        .filter((row) => row.pillar_id === SESSION_PILLAR_IDS[pillar])
        .map((row) => {
          const topic = topics.find((item) => item.id === row.activity_topic_id);
          const freeTopic = row.topic?.trim() ? row.topic : null;
          return {
            id: row.id,
            activityTypeId: row.activity_type_id,
            activityType:
              types.find((item) => item.id === row.activity_type_id)?.name ??
              `Activity type #${row.activity_type_id}`,
            topicId: row.activity_topic_id,
            topic: topic?.name ?? freeTopic ?? `Session #${row.id}`,
            freeTopic,
            date: row.session_date,
            venue: row.venue,
            notes: row.notes,
            facilitator: facilitatorOf(row),
            communityWide: row.enrollment_id === null,
            attendees: liveAttendance
              .filter((item) => item.session_id === row.id)
              .map((item) => {
                const person = people.find((entry) => entry.id === item.participant_id);
                const ward = wards.find((entry) => entry.id === person?.ward_id);
                return {
                  attendanceId: item.id,
                  participantId: item.participant_id,
                  name: person
                    ? `${person.first_name} ${person.last_name}`
                    : `Participant #${item.participant_id}`,
                  ward: ward?.name ?? null,
                  added: item.created_at,
                };
              }),
            documents: documents
              .filter((doc) => doc.owner_type === "activity_session" && doc.owner_id === row.id)
              .map((doc) => ({
                id: doc.id,
                name: titleCase(doc.document_type),
                added: doc.created_at,
              })),
            logged: row.created_at,
            updated: row.updated_at,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
      const { coverage, summary } = buildCoverage({
        types,
        topics,
        sessions: views,
        attendance: liveAttendance.map((row) => ({
          sessionId: row.session_id,
          participantId: row.participant_id,
        })),
        period,
        today,
      });
      return {
        pillar,
        period,
        sessions: views,
        coverage,
        summary,
        activityTypes: types,
        topics,
        participants: participantOptions(people, wards),
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
      const rows = await all(
        pathOf(pillar),
        "/pillars/:pillar",
        { table: "activity_attendance", includeDeleted: "true" },
        page(attendanceSchema) as never
      );
      return (rows as z.infer<typeof attendanceSchema>[])
        .filter((row) => row.session_id === sessionId)
        .map((row) => ({
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
    async curriculum(pillar: SessionPillar) {
      const [rawTypes, rawTopics] = await Promise.all([
        lookup("activity_type_definition", typeSchema),
        lookup("activity_topic", topicSchema),
      ]);
      return curriculumOf(pillar, rawTypes, rawTopics);
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
  async workspace(pillar: SessionPillar, period: SessionPeriod) {
    return (await withSessionApi(createSessionsApi)).workspace(pillar, period);
  },
};

/** "<masked name> · <ward>"; only exact duplicates get " · #<id>" so they stay distinguishable. */
function participantOptions(
  people: { id: number; first_name: string; last_name: string; ward_id?: number | null }[],
  wards: { id: number; name: string }[]
) {
  const labels = people.map((row) => ({
    id: row.id,
    label: `${row.first_name} ${row.last_name} · ${wards.find((ward) => ward.id === row.ward_id)?.name ?? "Ward not recorded"}`,
  }));
  const counts = new Map<string, number>();
  for (const { label } of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return labels.map(({ id, label }) => ({
    id,
    label: counts.get(label)! > 1 ? `${label} · #${id}` : label,
  }));
}
