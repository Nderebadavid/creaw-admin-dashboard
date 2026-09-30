// Mirrors CREATE TABLE declarations in merl-database-schema-mysql.sql. Dates use ISO strings.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface StandardColumns {
  id: number;
  created_at: string;
  updated_at: string;
  status: string;
  status_description: string | null;
  is_deleted: boolean;
}

export interface User extends StandardColumns {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  username: string;
  password_hash: string;
  phone_number: string | null;
  email: string | null;
}

export interface Pillar extends StandardColumns {
  code: string;
  name: string;
  focus_description: string | null;
  lead_user_id: number | null;
}

export interface County extends StandardColumns {
  name: string;
}

export interface SubCounty extends StandardColumns {
  county_id: number;
  name: string;
}

export interface Ward extends StandardColumns {
  sub_county_id: number;
  name: string;
}

export interface Donor extends StandardColumns {
  name: string;
  notes: string | null;
}

export interface BusinessSector extends StandardColumns {
  name: string;
}

export interface CaseType extends StandardColumns {
  pillar_id: number | null;
  name: string;
  requires_p3_prc_forms: boolean;
  default_route: string;
}

export interface PartnerInstitution extends StandardColumns {
  name: string;
  institution_type: string;
  county_id: number | null;
  contact_details: string | null;
}

export interface ActivityTypeDefinition extends StandardColumns {
  pillar_id: number;
  name: string;
  description: string | null;
}

export interface ActivityTopic extends StandardColumns {
  activity_type_id: number;
  name: string;
  description: string | null;
  sequence_no: number;
}

export interface Role extends StandardColumns {
  code: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

export interface UserRole extends StandardColumns {
  user_id: number;
  role_id: number;
  pillar_id: number | null;
}

export interface Permission extends StandardColumns {
  code: string;
  module: string;
  name: string;
  description: string | null;
}

export interface RolePermission extends StandardColumns {
  role_id: number;
  permission_id: number;
}

export interface Participant extends StandardColumns {
  sync_ref: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  id_number: string | null;
  id_number_type: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone_number: string | null;
  ward_id: number | null;
  is_person_with_disability: boolean;
  is_refugee: boolean;
  is_consent_given: boolean;
  remarks: string | null;
}

export interface Organisation extends StandardColumns {
  name: string;
  legal_form: string;
  registration_number: string | null;
  ward_id: number | null;
  address: string | null;
  board_size: number | null;
  board_women_count: number | null;
  board_youth_count: number | null;
  has_bank_account: boolean | null;
  financial_mgmt_notes: string | null;
  safeguarding_policies: JsonValue | null;
  due_diligence_status: string;
  due_diligence_date: string | null;
}

export interface ExternalProvider extends StandardColumns {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  provider_type: string;
  service_description: string | null;
  affiliated_institution_id: number | null;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
}

export interface Enrollment extends StandardColumns {
  participant_id: number | null;
  organisation_id: number | null;
  pillar_id: number;
  entry_category: string;
}

export interface Document extends StandardColumns {
  owner_type: string;
  owner_id: number;
  document_type: string;
  file_url: string;
}

export interface AssessmentInstrument extends StandardColumns {
  code: string;
  name: string;
  notes: string;
  scoring_scale: string | null;
}

export interface AssessmentCriterion extends StandardColumns {
  instrument_id: number;
  section: string;
  label: string;
  max_score: number | null;
  sort_order: number;
}

export interface OrganisationAssessment extends StandardColumns {
  organisation_id: number;
  instrument_id: number;
  donor_id: number | null;
  respondent_names: JsonValue | null;
  section_comments: JsonValue | null;
  overall_recommendation: string | null;
  recorded_by: number | null;
}

export interface OrganisationAssessmentScore extends StandardColumns {
  assessment_id: number;
  criterion_id: number;
  score: number | null;
  notes: string | null;
}

export interface AssessmentDocumentCheck extends StandardColumns {
  assessment_id: number;
  document_name: string;
  document_check_status: string;
  document_id: number | null;
  notes: string | null;
}

export interface PipelineDefinition extends StandardColumns {
  pillar_id: number;
  name: string;
  version: number;
}

export interface StageDefinition extends StandardColumns {
  pipeline_id: number;
  step_no: number;
  name: string;
  description: string | null;
  trigger_description: string | null;
  key_activities: string | null;
  documents_needed: string | null;
  system_tool: string | null;
  typical_duration: string | null;
  completion_criteria: string | null;
  leads_to_pillar_id: number | null;
}

export interface ParticipantStageEvent extends StandardColumns {
  enrollment_id: number;
  stage_definition_id: number;
  local_ref: string | null;
  event_date: string;
  stage_event_status: string;
  source_channel: string;
  notes: string | null;
}

export interface Project extends StandardColumns {
  pillar_id: number;
  name: string;
  notes: string | null;
  donor_id: number | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Referral extends StandardColumns {
  enrollment_id: number;
  from_pillar_id: number;
  to_pillar_id: number;
  from_stage_id: number | null;
  to_project_id: number | null;
  to_partner_institution_id: number | null;
  trigger_reason: string | null;
  notes: string | null;
}

export interface LegalCase extends StandardColumns {
  enrollment_id: number;
  case_type_id: number;
  court_name: string | null;
  assigned_officer: string | null;
  next_court_date: string | null;
  court_file_number: string | null;
  ob_number: string | null;
  counsellor: string | null;
  mediation_attempted: boolean;
  mediation_outcome: string | null;
  court_status: string | null;
  ruling_date: string | null;
  outcome_notes: string | null;
  advocate_provider_id: number | null;
  opened_date: string;
  closed_date: string | null;
}

export interface CounsellingSession extends StandardColumns {
  enrollment_id: number;
  session_no: number;
  session_date: string;
  session_type: string;
  counsellor_provider_id: number | null;
  notes: string | null;
}

export interface TrainingEnrollment extends StandardColumns {
  enrollment_id: number;
  pathway: string;
  partner_institution_id: number | null;
  trainer_provider_id: number | null;
  course_name: string | null;
  start_date: string | null;
  completion_date: string | null;
  training_status: string;
  current_work_status: string | null;
  workstation: string | null;
  monthly_salary: number | null;
  recommended_for_grant: boolean;
}

export interface ActivitySession extends StandardColumns {
  pillar_id: number;
  enrollment_id: number | null;
  activity_type_id: number;
  activity_topic_id: number | null;
  session_date: string;
  venue: string | null;
  topic: string | null;
  facilitator_user_id: number | null;
  facilitator_provider_id: number | null;
  notes: string | null;
}

export interface ActivityAttendance extends StandardColumns {
  session_id: number;
  participant_id: number;
}

export interface GrantApplication extends StandardColumns {
  project_id: number;
  participant_id: number | null;
  organisation_id: number | null;
  requested_amount: number;
  grant_type: string;
  application_document_id: number | null;
  notes: string | null;
}

export interface GrantAward extends StandardColumns {
  application_id: number;
  amount_awarded: number;
  currency: string;
  sector_id: number | null;
  contract_start: string | null;
  contract_end: string | null;
  grant_lifecycle_status: string;
  contract_document_id: number | null;
}

export interface GrantDisbursement extends StandardColumns {
  grant_id: number;
  amount: number;
  percentage_of_total: number | null;
  disbursement_date: string | null;
  notes: string | null;
}

export interface NarrativeReport extends StandardColumns {
  project_id: number;
  reporting_period_start: string;
  reporting_period_end: string;
  submitted_date: string | null;
  report_status: string;
  notes: string | null;
}

export interface GrantReport extends StandardColumns {
  grant_award_id: number;
  reporting_period_start: string;
  reporting_period_end: string;
  due_date: string;
  submitted_date: string | null;
  document_id: number | null;
  notes: string | null;
}

export interface AuditLogs {
  id: number;
  entity_type: string | null;
  entity_id: number | null;
  action: string;
  source: "HTTP" | "KAFKA" | null;
  performed_by: number | null;
  performed_at: string;
  endpoint: string | null;
  event_name: string | null;
  input_payload: string | null;
  previous_state: string | null;
  new_state: string | null;
}

export interface DbTables {
  user: User;
  pillar: Pillar;
  county: County;
  sub_county: SubCounty;
  ward: Ward;
  donor: Donor;
  business_sector: BusinessSector;
  case_type: CaseType;
  partner_institution: PartnerInstitution;
  activity_type_definition: ActivityTypeDefinition;
  activity_topic: ActivityTopic;
  role: Role;
  user_role: UserRole;
  permission: Permission;
  role_permission: RolePermission;
  participant: Participant;
  organisation: Organisation;
  external_provider: ExternalProvider;
  enrollment: Enrollment;
  document: Document;
  assessment_instrument: AssessmentInstrument;
  assessment_criterion: AssessmentCriterion;
  organisation_assessment: OrganisationAssessment;
  organisation_assessment_score: OrganisationAssessmentScore;
  assessment_document_check: AssessmentDocumentCheck;
  pipeline_definition: PipelineDefinition;
  stage_definition: StageDefinition;
  participant_stage_event: ParticipantStageEvent;
  project: Project;
  referral: Referral;
  legal_case: LegalCase;
  counselling_session: CounsellingSession;
  training_enrollment: TrainingEnrollment;
  activity_session: ActivitySession;
  activity_attendance: ActivityAttendance;
  grant_application: GrantApplication;
  grant_award: GrantAward;
  grant_disbursement: GrantDisbursement;
  narrative_report: NarrativeReport;
  grant_report: GrantReport;
  audit_logs: AuditLogs;
}
export type TableName = keyof DbTables;
/** A password that passed and is waiting for its one-time code. */
export interface MockLoginChallenge {
  userId: number;
  expiresAt: number;
  wrongCodes: number;
}
export type MockStore = { [K in TableName]: DbTables[K][] } & {
  sessions: Map<string, number>;
  loginChallenges: Map<string, MockLoginChallenge>;
  /** Failed password attempts per account; `lockedUntil` is 0 while unlocked. */
  failedLogins: Map<string, { count: number; lockedUntil: number }>;
  resetTokens: Map<string, { userId: number; expiresAt: number }>;
  /** Passwords changed through a reset; everyone else keeps the shared mock password. */
  passwords: Map<number, string>;
};
