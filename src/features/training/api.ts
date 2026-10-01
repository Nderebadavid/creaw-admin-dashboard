/**
 * Typed client for Skilling trainees: placements, outcomes and the grant hand-off
 * to WEE. Reads go through /pillars/skilling; the API scopes them to the pillar,
 * masks the salary and adds the display names and hand-off stage.
 */
import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { collectPages } from "@/lib/api/pagination";
import { withSessionApi } from "@/lib/api/session-api";
import {
  buildTrainingSummary,
  handoffStages,
  pathways,
  trainingStatuses,
  workStatuses,
  type TraineeView,
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
const participantSchema = z.object({
  id,
  first_name: z.string(),
  middle_name: z.string().nullish(),
  last_name: z.string(),
});
const institutionSchema = z.object({
  id,
  name: z.string(),
  status: z.string(),
  is_deleted: z.boolean(),
});
const trainerSchema = z.object({ id, name: z.string(), detail: z.string() });
export const traineeMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);
const traineeReadSchema = createEnvelopeSchema(z.union([traineeSchema, z.null()]));

type Values = Record<string, string | number | boolean | null>;
type Page<T> = {
  success: boolean;
  message: string;
  data: {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
};

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
    created: row.created_at,
    updated: row.updated_at,
  };
}

export interface TrainingWorkspaceOptions {
  /** Whether to load the placement form's options (needs TRAINING_ENROLLMENT_EDIT). */
  canEdit?: boolean;
}

export function createTrainingApi(client: ApiClient, token: string) {
  const all = <T>(
    path: string,
    routeTemplate: "/pillars/:pillar" | "/lookups/:table" | "/participants",
    query: Record<string, string | number>,
    schema: z.ZodType<T>
  ) =>
    collectPages(async (pageNo, pageSize) => {
      const result = (await client.request(
        { method: "GET", path, routeTemplate, token, query: { ...query, page: pageNo, pageSize } },
        page(schema) as never
      )) as Page<T>;
      if (!result.success || !result.data) throw new Error(result.message);
      return result.data;
    });
  const table = <T>(name: string, schema: z.ZodType<T>) =>
    all<T>(PATH, "/pillars/:pillar", { table: name }, schema);
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
    async workspace(options: TrainingWorkspaceOptions = {}): Promise<TrainingWorkspace> {
      const [rows, enrollments, institutions, trainers] = await Promise.all([
        table("training_enrollment", traineeSchema),
        options.canEdit ? this.enrollmentOptions().catch(() => []) : Promise.resolve([]),
        all("/lookups/partner_institution", "/lookups/:table", {}, institutionSchema).catch(
          () => [] as z.infer<typeof institutionSchema>[]
        ),
        options.canEdit ? this.trainers() : Promise.resolve([]),
      ]);
      const trainees = rows
        .map(traineeView)
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "") || b.id - a.id);
      return {
        trainees,
        summary: buildTrainingSummary(trainees),
        enrollments,
        institutions: institutions
          .filter((row) => row.status === "ACTIVE" && !row.is_deleted)
          .map((row) => ({ id: row.id, label: row.name })),
        trainers,
      };
    },
    /** Skilling enrollments a placement can be made for, labelled "<name> · <entry category>". */
    async enrollmentOptions(): Promise<TrainingOption[]> {
      const [enrollments, people] = await Promise.all([
        table("enrollment", enrollmentSchema),
        all("/participants", "/participants", { pillarId: 6 }, participantSchema),
      ]);
      return enrollments.flatMap((row) => {
        const person = people.find((item) => item.id === row.participant_id);
        if (!person) return [];
        const name = [person.first_name, person.middle_name, person.last_name]
          .filter(Boolean)
          .join(" ");
        return [
          { id: row.id, label: row.entry_category ? `${name} · ${row.entry_category}` : name },
        ];
      });
    },
    /** Active trainer providers, labelled "<name> · <detail>"; [] when the read fails. */
    async trainers(): Promise<TrainingOption[]> {
      return table("trainer_option", trainerSchema)
        .then((rows) => rows.map((row) => ({ id: row.id, label: `${row.name} · ${row.detail}` })))
        .catch(() => []);
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
    /** The unmasked salary, read with an audited reveal. */
    async revealSalary(traineeId: number) {
      const result = await client.request(
        {
          method: "GET",
          path: PATH,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: "training_enrollment", id: traineeId, reveal: "monthly_salary" },
        },
        traineeReadSchema
      );
      return { ...result, value: result.data?.monthly_salary ?? null };
    },
  };
}

export const trainingApi = {
  async workspace(options?: TrainingWorkspaceOptions) {
    return (await withSessionApi(createTrainingApi)).workspace(options);
  },
};
