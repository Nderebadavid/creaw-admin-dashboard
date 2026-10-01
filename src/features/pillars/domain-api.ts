import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { collectPages } from "@/lib/api/pagination";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import type { PillarCode } from "./schemas";
import { titleCase } from "@/lib/format";

export interface PillarDomainRecord {
  id: number;
  title: string;
  values: string[];
  status: string;
}
export interface PillarDomainView {
  title: string;
  subtitle: string;
  columns: string[];
  rows: PillarDomainRecord[];
}

const core = { id: z.number().int(), status: z.string(), updated_at: z.string() };
const schemas = {
  vawg: z.object({
    ...core,
    enrollment_id: z.number().int(),
    case_type_id: z.number().int(),
    court_status: z.string().nullable(),
    ruling_date: z.string().nullable(),
  }),
  wee: z.object({
    ...core,
    participant_id: z.number().int().nullable(),
    organisation_id: z.number().int().nullable(),
    notes: z.string().nullable(),
    requested_amount: z.number(),
  }),
  srhr: z.object({
    ...core,
    topic: z.string().nullable(),
    venue: z.string().nullable(),
    facilitator_user_id: z.number().int().nullable(),
    facilitator_provider_id: z.number().int().nullable(),
    session_date: z.string(),
  }),
  skilling: z.object({
    ...core,
    enrollment_id: z.number().int(),
    course_name: z.string().nullable(),
    partner_institution_id: z.number().int().nullable(),
    training_status: z.string(),
    start_date: z.string().nullable(),
  }),
  wros: z.object({
    ...core,
    name: z.string(),
    ward_id: z.number().int().nullable(),
    due_diligence_status: z.string(),
  }),
};
const attendanceSchema = z.object({ id: z.number().int(), session_id: z.number().int() });
const domainTables = {
  vawg: "legal_case",
  wee: "grant_application",
  srhr: "activity_session",
  skilling: "training_enrollment",
  wros: "organisation",
} as const;

export async function loadPillarDomain(
  client: ApiClient,
  token: string,
  code: PillarCode,
  enrollments: readonly {
    id: number;
    participant_id: number | null;
    organisation_id: number | null;
  }[]
): Promise<PillarDomainView | null> {
  if (code === "leadership") return null;
  const path = `/pillars/${code}`;
  const table = domainTables[code];
  async function read<T>(name: string, schema: z.ZodType<T>): Promise<T[]> {
    const responseSchema = createEnvelopeSchema(z.union([createPaginatedSchema(schema), z.null()]));
    return collectPages(async (page, pageSize) => {
      const response = await client.request(
        {
          method: "GET",
          path,
          routeTemplate: "/pillars/:pillar",
          token,
          query: { table: name, page, pageSize },
        },
        responseSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data;
    });
  }
  const enrollmentById = new Map(enrollments.map((row) => [row.id, row]));
  if (code === "vawg") {
    const rows = await read(table, schemas.vawg);
    return {
      title: "Legal case register",
      subtitle: "Open a case for the full record",
      columns: ["Case", "Case type", "Court", "Officer", "Ruling date"],
      rows: rows.map((row) => ({
        id: row.id,
        title: `Case #${row.id}`,
        values: [
          `Case #${row.id}`,
          `Case type #${row.case_type_id}`,
          row.court_status ? titleCase(row.court_status) : "Not set",
          "Not assigned",
          row.ruling_date ?? "Not scheduled",
        ],
        status: row.court_status ?? row.status,
      })),
    };
  }
  if (code === "wee") {
    const rows = await read(table, schemas.wee);
    return {
      title: "Grant applications",
      subtitle: "Prepared → Reviewed → Approved sign-off chain",
      columns: ["Applicant", "Business", "County", "Requested", "Stage"],
      rows: rows.map((row) => ({
        id: row.id,
        title: `Application #${row.id}`,
        values: [
          row.participant_id
            ? `Participant #${row.participant_id}`
            : `Organisation #${row.organisation_id}`,
          row.notes ?? "Not recorded",
          "Not recorded",
          `KES ${row.requested_amount.toLocaleString("en-KE")}`,
          row.status,
        ],
        status: row.status,
      })),
    };
  }
  if (code === "srhr") {
    const [rows, attendance] = await Promise.all([
      read(table, schemas.srhr),
      read("activity_attendance", attendanceSchema),
    ]);
    return {
      title: "Outreach sessions",
      subtitle: "Sessions logged with attendance records",
      columns: ["Session", "Location", "Facilitator", "Date", "Attendees"],
      rows: rows.map((row) => ({
        id: row.id,
        title: row.topic ?? `Session #${row.id}`,
        values: [
          row.topic ?? `Session #${row.id}`,
          row.venue ?? "Not recorded",
          row.facilitator_user_id
            ? `Staff #${row.facilitator_user_id}`
            : row.facilitator_provider_id
              ? `Provider #${row.facilitator_provider_id}`
              : "Not assigned",
          row.session_date,
          String(attendance.filter((item) => item.session_id === row.id).length),
        ],
        status: row.status,
      })),
    };
  }
  if (code === "skilling") {
    const rows = await read(table, schemas.skilling);
    return {
      title: "Trainee enrollments",
      subtitle: "Training status from centre records",
      columns: ["Trainee", "Course", "Centre", "Attendance", "Cohort"],
      rows: rows.map((row) => ({
        id: row.id,
        title: `Training #${row.id}`,
        values: [
          `Participant #${enrollmentById.get(row.enrollment_id)?.participant_id ?? "—"}`,
          row.course_name ?? "Not recorded",
          row.partner_institution_id ? `Centre #${row.partner_institution_id}` : "Not recorded",
          "Not tracked",
          row.start_date ?? "Not recorded",
        ],
        status: row.training_status,
      })),
    };
  }
  const rows = await read(table, schemas.wros);
  return {
    title: "Partner organisations",
    subtitle: "Due-diligence status and capacity register",
    columns: ["Organisation", "County", "Focus", "Capacity score", "Due diligence"],
    rows: rows.map((row) => ({
      id: row.id,
      title: row.name,
      values: [
        row.name,
        row.ward_id ? `Ward #${row.ward_id}` : "Not recorded",
        "Not recorded",
        "Not scored",
        titleCase(row.due_diligence_status),
      ],
      status: row.due_diligence_status,
    })),
  };
}
