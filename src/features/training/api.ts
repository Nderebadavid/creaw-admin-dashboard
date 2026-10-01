/**
 * Typed client for Skilling trainees: placements, outcomes and the grant hand-off
 * to WEE. Reads go through /pillars/skilling; the API scopes them to the pillar,
 * masks the salary and adds the display names and hand-off stage.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { listParams, type ListQuery } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  handoffStages,
  summaryFromCards,
  pathways,
  trainingStatuses,
  workStatuses,
  type TraineeView,
  type TrainingFormOptions,
  type TrainingOption,
  type TrainingWorkspace,
} from "./model";

const PATH = "/pillars/skilling";
const id = z.number().int().positive();
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));
/** A field an older backend may omit: a missing key reads as null. */
const optional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);
const optionalText = optional(z.string());

export const traineeSchema = z.object({
  id,
  enrollment_id: id,
  pathway: z.enum(pathways),
  partner_institution_id: id.nullable(),
  trainer_provider_id: id.nullable(),
  course_name: z.string().nullable(),
  start_date: z.string().nullable(),
  completion_date: z.string().nullable(),
  training_status: z.enum(trainingStatuses),
  current_work_status: optional(z.enum(workStatuses)),
  workstation: z.string().nullable(),
  monthly_salary: optional(z.union([z.string(), z.number()]).transform(String)),
  recommended_for_grant: z.boolean(),
  status: z
    .string()
    .nullish()
    .transform((value) => value ?? "ACTIVE"),
  status_description: optionalText,
  participant_name: optionalText,
  institution_name: optionalText,
  trainer_name: optionalText,
  life_skills_sessions: optional(z.number().int()),
  grant_handoff: optional(z.enum(handoffStages)),
  grant_referral_id: optional(id),
  grant_recommended_on: optionalText,
  grant_decided_on: optionalText,
  grant_application_on: optionalText,
  grant_awarded_on: optionalText,
  created_at: z.string(),
  updated_at: z.string(),
});
export type TraineeRow = z.infer<typeof traineeSchema>;
const enrollmentSchema = z.object({
  id,
  participant_id: id.nullable(),
  entry_category: z.string().nullable(),
});
const trainerSchema = z.object({ id, name: z.string(), detail: z.string() });
export const traineeMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);
const traineeReadSchema = createEnvelopeSchema(z.union([traineeSchema, z.null()]));

type Values = Record<string, string | number | boolean | null>;
type Envelope<T> = { success: boolean; message: string; data: T | null };

/** The view of one trainee row; names fall back to generic labels, never ids. */
export function traineeView(row: TraineeRow): TraineeView {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    name: row.participant_name ?? "Participant record",
    pathway: row.pathway,
    course: row.course_name,
    institutionId: row.partner_institution_id,
    institution:
      row.institution_name ?? (row.partner_institution_id ? "Institution on file" : null),
    trainerId: row.trainer_provider_id,
    trainer: row.trainer_name ?? (row.trainer_provider_id ? "External trainer" : null),
    startDate: row.start_date,
    completionDate: row.completion_date,
    status: row.training_status,
    workStatus: row.current_work_status,
    workstation: row.workstation,
    salary: row.monthly_salary,
    lifeSkillsSessions: row.life_skills_sessions ?? 0,
    recommended: row.recommended_for_grant,
    handoff: {
      stage: row.grant_handoff ?? (row.recommended_for_grant ? "referred" : "none"),
      referralId: row.grant_referral_id,
      recommendedOn: row.grant_recommended_on,
      decidedOn: row.grant_decided_on,
      applicationOn: row.grant_application_on,
      awardedOn: row.grant_awarded_on,
    },
    recordStatus: row.status,
    statusDescription: row.status_description,
    created: row.created_at,
    updated: row.updated_at,
  };
}

/** The register's column ids and the API fields they sort by. */
export const TRAINEE_SORT_KEYS: Record<string, string> = {
  trainee: "participant_name",
  pathway: "pathway",
  course: "course_name",
  institution: "institution_name",
  sessions: "life_skills_sessions",
  status: "training_status",
  outcome: "current_work_status",
  grant: "grant_handoff",
  record: "status",
  updated: "updated_at",
};

const optionsSchema = createEnvelopeSchema(
  z.union([
    z.object({
      enrollments: z.array(z.object({ id, label: z.string() })),
      institutions: z.array(z.object({ id, label: z.string() })),
      trainers: z.array(z.object({ id, label: z.string() })),
    }),
    z.null(),
  ])
);

export function createTrainingApi(client: ApiClient, token: string) {
  const read = <T>(query: Record<string, string | number>, schema: z.ZodType<Envelope<T>>) =>
    client.request(
      { method: "GET", path: PATH, routeTemplate: "/pillars/:pillar", token, query },
      schema as never
    ) as Promise<Envelope<T>>;
  const required = <T>(result: Envelope<T>): T => {
    if (!result.success || !result.data) throw new Error(result.message);
    return result.data;
  };
  const write = (method: "POST" | "PATCH", body: Values, traineeId?: number) =>
    client.request(
      {
        method,
        path: PATH,
        routeTemplate: "/pillars/:pillar",
        token,
        query:
          traineeId === undefined
            ? { table: "training_enrollment" }
            : { table: "training_enrollment", id: traineeId },
        body,
      },
      traineeMutationSchema
    );

  return {
    /** One page of trainees; names, life-skills counts and the grant hand-off arrive with each row. */
    async listTrainees(query: ListQuery = {}): Promise<PaginatedData<TraineeView>> {
      const data = required(
        await read(
          {
            table: "training_enrollment",
            ...listParams(query, TRAINEE_SORT_KEYS, { sort: "start_date:desc" }),
          },
          page(traineeSchema) as never
        )
      ) as PaginatedData<TraineeRow>;
      return { ...data, items: data.items.map(traineeView) };
    },
    /** Page 1 of the register with the headline counts the pillar summary already holds. */
    async workspace(cards: Parameters<typeof summaryFromCards>[0]): Promise<TrainingWorkspace> {
      return {
        trainees: await this.listTrainees({ page: 1, pageSize: 25 }),
        summary: summaryFromCards(cards),
      };
    },
    /** What the enrol and edit forms offer: enrollments, institutions and trainers. */
    async formOptions(): Promise<TrainingFormOptions> {
      const result = await client.request(
        {
          method: "GET",
          path: `${PATH}/form-options`,
          routeTemplate: "/pillars/:pillar/form-options",
          token,
          query: { form: "trainee" },
        },
        optionsSchema
      );
      return required(result);
    },
    /** Whether an enrollment belongs to Skilling. */
    async isSkillingEnrollment(enrollmentId: number) {
      const result = await read(
        { table: "enrollment", ids: String(enrollmentId), page: 1, pageSize: 1 },
        page(enrollmentSchema) as never
      );
      return !!result.data && (result.data as PaginatedData<unknown>).items.length > 0;
    },
    /** Active trainer providers, labelled "<name> · <detail>". */
    async trainers(): Promise<TrainingOption[]> {
      const data = required(
        await read(
          { table: "trainer_option", page: 1, pageSize: 100 },
          page(trainerSchema) as never
        )
      ) as PaginatedData<z.infer<typeof trainerSchema>>;
      return data.items.map((row) => ({ id: row.id, label: `${row.name} · ${row.detail}` }));
    },
    /** One trainee as the API returns it, or null when it is not there. */
    async trainee(traineeId: number) {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "training_enrollment", id: traineeId },
        },
        traineeReadSchema
      );
      return result.success ? result.data : null;
    },
    create(values: Values) {
      return write("POST", values);
    },
    update(traineeId: number, values: Values) {
      return write("PATCH", values, traineeId);
    },
  };
}

export const trainingApi = {
  async workspace(cards: Parameters<typeof summaryFromCards>[0]) {
    return (await withSessionApi(createTrainingApi)).workspace(cards);
  },
};
