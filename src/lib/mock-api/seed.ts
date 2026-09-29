import type { DbTables, MockStore, TableName } from "@/types/db";
import { tableDefinitions } from "./schema";
import { makeRow } from "./rows";
import { story } from "./story";

export const MOCK_PASSWORD = "creaw-demo";
const SEED_DATE = "2026-09-27T09:00:00.000Z";
const pillarIds: Record<string, number> = { vawg: 1, wee: 2, srhr: 3, leadership: 4, wro: 5, skill: 6 };

export function createSeed(): MockStore {
  const store = Object.fromEntries(Object.keys(tableDefinitions).map((table) => [table, []])) as unknown as MockStore;
  store.sessions = new Map();
  function add<K extends TableName>(table: K, input: Partial<DbTables[K]>) {
    const row = makeRow(table, input, store[table].length + 1, SEED_DATE);
    (store[table] as DbTables[K][]).push(row);
    return row;
  }

  for (const user of story.users) add("user", {
    first_name: user[1].split(" ")[0], last_name: user[1].split(" ").slice(1).join(" "), username: user[2],
    password_hash: "mock-only:no-real-password-hash", email: user[7], phone_number: user[8].replaceAll(" ", ""),
    status: user[6] === "Active" ? "ACTIVE" : user[6].toUpperCase(),
  });
  const leaders = [5, 3, 9, null, 8, 10];
  story.lookups.Pillars.forEach((pillar, i) => add("pillar", { code: pillar[0], name: pillar[1], lead_user_id: leaders[i] }));
  const roleNames = ["System Administrator", "Head of MERL", "Pillar Lead", "Case Officer", "Counsellor", "M&E Officer", "Grants & Finance Officer", "Data Entry", "External Assessor", "Community Volunteer", "Portal Viewer"];
  roleNames.forEach((name, i) => add("role", { name, code: ["SYSTEM_ADMIN", "HEAD_MERL", "PILLAR_LEAD", "CASE_OFFICER", "COUNSELLOR", "ME_OFFICER", "GRANTS_OFFICER", "DATA_ENTRY", "EXTERNAL_ASSESSOR", "COMMUNITY_VOLUNTEER", "PORTAL_VIEWER"][i], is_system_role: i < 2 }));
  story.permissions.forEach((permission) => add("permission", permission));
  // Extra catalogue entries represent explicit prototype actions absent from SQL's
  // illustrative INSERT list. They add data, never columns or role-name checks.
  ["SENSITIVE_REVEAL", "FIELD_SUBMISSION_VIEW", "FIELD_SUBMISSION_REVIEW", "LOOKUP_MANAGE"].forEach((code) => add("permission", { code, name: code.replaceAll("_", " "), module: code.split("_")[0] }));
  const roleCodes: Record<number, string[]> = {
    3: ["DASHBOARD_VIEW", "PARTICIPANT_VIEW", "PARTICIPANT_EDIT", "SENSITIVE_REVEAL", "REFERRAL_VIEW", "REFERRAL_CREATE", "REFERRAL_ACCEPT", "FIELD_SUBMISSION_VIEW", "FIELD_SUBMISSION_REVIEW", "NARRATIVE_REPORT_MANAGE", "CASE_VIEW", "CASE_EDIT", "TRAINING_ENROLLMENT_VIEW", "TRAINING_ENROLLMENT_EDIT", "ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG", "GRANT_APPLICATION_VIEW", "GRANT_APPLICATION_REVIEW", "ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT", "DUE_DILIGENCE_MANAGE", "DOCUMENT_VIEW", "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "REPORT_EXPORT_CSV"],
    4: ["DASHBOARD_VIEW", "PARTICIPANT_VIEW", "PARTICIPANT_EDIT", "CASE_VIEW", "CASE_EDIT", "CASE_CLOSE", "REFERRAL_VIEW", "REFERRAL_CREATE", "DOCUMENT_VIEW", "DOCUMENT_UPLOAD"],
    5: ["PARTICIPANT_VIEW", "COUNSELLING_VIEW", "COUNSELLING_LOG", "SENSITIVE_REVEAL"],
    6: ["DASHBOARD_VIEW", "PARTICIPANT_VIEW", "FIELD_SUBMISSION_VIEW", "FIELD_SUBMISSION_REVIEW", "REPORT_EXPORT_CSV"],
    7: ["DASHBOARD_VIEW", "PARTICIPANT_VIEW", "GRANT_APPLICATION_VIEW", "GRANT_APPLICATION_EDIT", "GRANT_APPLICATION_PREPARE", "GRANT_APPLICATION_REVIEW", "GRANT_AWARD_VIEW", "GRANT_AWARD_MANAGE", "GRANT_DISBURSEMENT_RECORD", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE", "DOCUMENT_VIEW", "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD"],
    8: ["PARTICIPANT_VIEW", "PARTICIPANT_EDIT", "ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"],
    9: ["ORGANISATION_VIEW", "ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT", "DUE_DILIGENCE_MANAGE", "DOCUMENT_VIEW", "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD"],
    10: ["PARTICIPANT_VIEW", "ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"],
    11: ["DASHBOARD_VIEW", "PARTICIPANT_VIEW", "REFERRAL_VIEW"],
  };
  for (const role of store.role) for (const permission of store.permission) {
    const granted = role.id === 1 || (role.id === 2 && permission.module !== "ADMIN" && permission.code !== "LOOKUP_MANAGE") || roleCodes[role.id]?.includes(permission.code);
    if (granted) add("role_permission", { role_id: role.id, permission_id: permission.id });
  }
  const assignments: [number, number, number | null][] = [[1,1,null],[2,2,null],[3,3,2],[3,7,2],[4,4,2],[4,7,2],[5,3,1],[6,4,1],[6,5,1],[7,4,1],[8,3,5],[8,7,5],[9,3,3],[10,3,6],[10,8,6],[11,8,1],[12,10,3],[13,11,null],[14,9,5]];
  assignments.forEach(([user_id, role_id, pillar_id]) => add("user_role", { user_id, role_id, pillar_id }));

  for (const [name, county] of Object.entries(story.geo)) {
    const countyRow = add("county", { name });
    for (const [subName, wards] of Object.entries(county.subs)) {
      const sub = add("sub_county", { county_id: countyRow.id, name: subName });
      (wards as readonly string[]).forEach((wardName) => add("ward", { sub_county_id: sub.id, name: wardName }));
    }
  }
  story.lookups.Donors.forEach(([name, notes]) => add("donor", { name, notes }));
  story.lookups["Business sectors"].forEach(([name]) => add("business_sector", { name }));
  story.lookups["Case types"].forEach(([name, forms, route]) => add("case_type", { name, pillar_id: 1, requires_p3_prc_forms: forms === "Yes", default_route: route === "Court, direct" ? "court_direct" : "mediation_adr_first" }));
  story.lookups["Partner institutions"].forEach(([name, type, county]) => add("partner_institution", { name, institution_type: type.toLowerCase().replaceAll(" ", "_"), county_id: store.county.find((row) => row.name === county)!.id }));
  add("partner_institution", { name: "Mathare Skills Centre", institution_type: "community_center", county_id: store.county[0].id });
  story.lookups["Activity types"].forEach(([pillar, name, description]) => add("activity_type_definition", { pillar_id: pillar === "SRHR" ? 3 : 6, name, description }));

  const enrollmentSpecs: [number, number, string][] = [[1,1,"Legal aid & counselling"],[2,2,"Grant applicant"],[3,2,"Grant recipient"],[4,6,"Tailoring & design"],[4,2,"Grant applicant"],[5,3,"Youth champion"],[6,1,"Counselling"],[7,6,"ICT basics"],[8,1,"Legal aid"],[8,3,"Peer educator"],[9,2,"Business training"],[10,1,"Legal aid (minor)"]];
  for (const participant of story.participants) {
    const fields = Object.fromEntries(participant.fields.map((field) => [field[0], field[1]]));
    const aliases: Record<string, string> = { Kibera: "Laini Saba", Mathare: "Mabatini", Thika: "Township", Nyalenda: "Nyalenda A", Bondeni: "Kivumbini", Mlolongo: "Syokimau/Mulolongo" };
    const ward = store.ward.find((row) => row.name === (aliases[fields["Ward / location"]] ?? fields["Ward / location"]));
    add("participant", { first_name: participant.title.split(" ")[0], last_name: participant.title.split(" ").slice(1).join(" "), gender: fields.Gender.toLowerCase(), phone_number: fields.Phone.replaceAll(" ", ""), id_number: fields["National ID number"] ?? null, id_number_type: fields["National ID number"] ? "national_id" : "none", ward_id: ward?.id ?? null, is_consent_given: true, created_at: new Date(fields.Registered).toISOString() });
  }
  enrollmentSpecs.forEach(([participant_id, pillar_id, entry_category]) => add("enrollment", { participant_id, pillar_id, entry_category }));
  for (const organisation of story.organisations) {
    const org = add("organisation", { name: organisation.title, legal_form: "ngo", has_bank_account: true, due_diligence_status: organisation.title === "Sauti ya Mama" ? "in_progress" : "passed" });
    add("enrollment", { organisation_id: org.id, pillar_id: 5, entry_category: "Sub-grant applicant" });
  }
  for (const [key, stages] of Object.entries(story.pipes)) {
    const pipeline = add("pipeline_definition", { pillar_id: pillarIds[key], name: `${store.pillar.find((p) => p.id === pillarIds[key])!.code} pathway` });
    stages.forEach((name, i) => add("stage_definition", { pipeline_id: pipeline.id, step_no: i + 1, name, leads_to_pillar_id: name === "Grant recommendation" ? 2 : null }));
  }
  [[2,"Jasiri business grants",1],[5,"WROs sub-grant facility",3],[3,"Adolescent SRHR",2],[1,"VAWG response",4],[6,"Skilling cohorts",5]].forEach(([pillarId, name, donorId]) => add("project", { pillar_id: Number(pillarId), name: String(name), donor_id: Number(donorId), start_date: "2026-01-01", end_date: "2026-12-31" }));
  for (const ref of story.refs) {
    const enrollment = store.enrollment.find((row) => row.participant_id === Number(ref.pk.slice(1)) && row.pillar_id === pillarIds[ref.from])!;
    add("referral", { enrollment_id: enrollment.id, from_pillar_id: pillarIds[ref.from], to_pillar_id: pillarIds[ref.to], trigger_reason: ref.reason, status: ref.status.toUpperCase(), to_partner_institution_id: "ext" in ref ? store.partner_institution.find((row) => row.name === ref.ext)?.id ?? null : null, to_project_id: "ext" in ref ? null : store.project.find((row) => row.pillar_id === pillarIds[ref.to])?.id ?? null });
  }
  for (const submission of story.submissions) {
    const pillarId = pillarIds[submission.pillar];
    const participantByRecord: Record<string, number> = { s1: 5, p10: 10, g1: 3, s5: 5, k1: 7, g2: 2, c1: 1 };
    const enrollment = store.enrollment.find((row) => row.pillar_id === pillarId && (submission.rec === "o3" ? row.organisation_id === 3 : row.participant_id === participantByRecord[submission.rec]))!;
    const pipeline = store.pipeline_definition.find((row) => row.pillar_id === pillarId)!;
    add("participant_stage_event", { enrollment_id: enrollment.id, stage_definition_id: store.stage_definition.find((row) => row.pipeline_id === pipeline.id)!.id, notes: submission.title + (submission.flag ? ` — ${submission.flag}` : ""), stage_event_status: submission.status === "Approved" ? "verified" : submission.status === "Flagged" ? "disputed" : "recorded", source_channel: "mobile", local_ref: submission.id });
  }
  add("legal_case", { enrollment_id: 1, case_type_id: 2, opened_date: "2026-02-14", court_status: "in_hearing", mediation_attempted: true, mediation_outcome: "unresolved", outcome_notes: "Safety plan and shelter referral discussed." });
  add("counselling_session", { enrollment_id: 1, session_no: 1, session_date: "2026-02-14", session_type: "psychological_first_aid", notes: "Initial confidential counselling session." });
  add("training_enrollment", { enrollment_id: 4, pathway: "apprenticeship", partner_institution_id: 7, course_name: "Tailoring & design", training_status: "completed", start_date: "2025-11-09", completion_date: "2026-04-02", recommended_for_grant: true });
  add("training_enrollment", { enrollment_id: 8, pathway: "community_center", course_name: "ICT basics", start_date: "2026-07-15" });
  add("activity_session", { pillar_id: 3, activity_type_id: 4, session_date: "2026-09-24", venue: "Kilifi County Hospital", topic: "Facility referral day", facilitator_user_id: 9 });
  add("activity_attendance", { session_id: 1, participant_id: 5 });
  [[3,60000,"Retail shop, Kondele Market"],[2,45000,"Poultry farming"],[4,38000,"Tailoring workshop"],[9,42000,"Business training"]].forEach(([participantId, amount, notes], i) => add("grant_application", { project_id: 1, participant_id: Number(participantId), requested_amount: Number(amount), grant_type: "staggered_by_milestone", notes: String(notes), status: ["APPROVED","REVIEWED","PREPARED","PREPARED"][i] }));
  add("grant_award", { application_id: 1, amount_awarded: 55000, sector_id: 3, contract_start: "2026-05-15", contract_end: "2027-05-14" });
  add("grant_disbursement", { grant_id: 1, amount: 27500, percentage_of_total: 50, disbursement_date: "2026-05-20", notes: "First tranche" });
  add("grant_report", { grant_award_id: 1, reporting_period_start: "2026-04-01", reporting_period_end: "2026-06-30", due_date: "2026-08-30", notes: "Peter Otieno grant report — Q2" });
  for (const report of story.reports.filter((row) => row.id !== "r2")) add("narrative_report", { project_id: store.project.find((row) => row.pillar_id === pillarIds[report.pillar])!.id, reporting_period_start: "2026-07-01", reporting_period_end: "2026-09-30", report_status: report.status === "Overdue" ? "overdue" : report.status === "Submitted" ? "submitted" : "pending", submitted_date: report.status === "Submitted" ? "2026-08-28" : null, notes: report.title });
  add("assessment_instrument", { code: "ORG_CAPACITY", name: "Organisation capacity", scoring_scale: "1-5", notes: "" });
  add("assessment_instrument", { code: "DUE_DILIGENCE", name: "Due diligence", notes: "" });
  ["Governance","Financial management","Programme delivery","M&E capacity","Safeguarding"].forEach((label, i) => add("assessment_criterion", { instrument_id: 1, section: label, label, max_score: 5, sort_order: i + 1 }));
  store.organisation.forEach((org) => {
    const assessment = add("organisation_assessment", { organisation_id: org.id, instrument_id: 1, recorded_by: 8, overall_recommendation: org.due_diligence_status === "passed" ? "award" : null });
    store.assessment_criterion.forEach((criterion) => add("organisation_assessment_score", { assessment_id: assessment.id, criterion_id: criterion.id, score: Math.round(story.organisations[org.id - 1].scores[criterion.id - 1][1]) }));
    ["Registration certificate","Constitution","Audited accounts 2025","Board member list","Safeguarding policy","Bank reference letter"].forEach((name, i) => add("assessment_document_check", { assessment_id: assessment.id, document_name: name, document_check_status: org.id === 3 && i > 2 || org.id === 1 && i === 5 ? "not_obtained" : "obtained" }));
  });
  for (const participant of store.participant) add("document", { owner_type: "participant", owner_id: participant.id, document_type: "consent_form", file_url: `mock://documents/participant/${participant.id}/consent.pdf` });
  add("document", { owner_type: "grant_application", owner_id: 1, document_type: "business_plan", file_url: "mock://documents/grants/1/business-plan.pdf" });
  add("audit_logs", { entity_type: "referral", entity_id: 2, action: "CREATE", source: "KAFKA", performed_at: "2026-04-02T10:00:00.000Z", event_name: "skilling.grant_recommended" });
  return store;
}
