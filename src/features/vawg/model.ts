/** View models shared by the VAWG case server code and its client components. */
import type { PaginatedData } from "@/types/api";

/** The VAWG pillar's fixed id. */
export const VAWG_PILLAR_ID = 1;

/** Court statuses a legal case moves through, in court order. */
export const courtStatuses = [
  "police_investigation",
  "mediation",
  "plea_taken",
  "mention",
  "in_hearing",
  "judgment_delivered",
  "closed",
] as const;

export interface CaseDocument {
  id: number;
  /** e.g. "P3 form". */
  name: string;
}

export interface LegalCaseView {
  id: number;
  /** e.g. "CRW-VAWG-0001". */
  number: string;
  /** The survivor's full name. */
  survivor: string;
  participantId: number | null;
  enrollmentId: number;
  caseType: string;
  caseTypeId: number;
  /** "Mediation/ADR first" or "Court, direct", from the case type. */
  route: string;
  /** Raw court_status, e.g. "in_hearing"; null before the case reaches court. */
  courtStatus: string | null;
  court: string | null;
  assignedOfficer: string | null;
  nextCourtDate: string | null;
  courtFileNumber: string | null;
  obNumber: string | null;
  counsellor: string | null;
  advocate: string | null;
  mediationAttempted: boolean;
  mediationOutcome: string | null;
  opened: string;
  ruling: string | null;
  closed: string | null;
  /** Whether the case type needs P3 and PRC forms in the court file. */
  requiresForms: boolean;
  status: string;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  /** As the API sends it: masked. */
  outcomeNotes: string | null;
  created: string | null;
  updated: string | null;
  /** Counselling, files and missing forms load with the case's detail; empty in the register. */
  counselling: { number: number; date: string; counsellor: string | null }[];
  documents: CaseDocument[];
  /** Forms this case type requires that are not on file, e.g. "P3 form". */
  missing: string[];
}

/** What a case's drawer loads when it opens. */
export interface CaseDetail {
  counselling: LegalCaseView["counselling"];
  documents: CaseDocument[];
  missing: string[];
}

export const counsellingTypes = ["psychological_first_aid", "follow_up"] as const;
export type CounsellingType = (typeof counsellingTypes)[number];
export const counsellingTypeLabels: Record<CounsellingType, string> = {
  psychological_first_aid: "Psychological first aid",
  follow_up: "Follow-up",
};

export type CounsellorKind = "staff" | "provider";
/** Who gave a session: a name (never an id) and, when known, staff or external. */
export interface CounsellorView {
  name: string;
  kind: CounsellorKind | null;
}
export interface CounsellorOption {
  kind: CounsellorKind;
  id: number;
  name: string;
  detail: string;
}

export interface CounsellingSessionView {
  id: number;
  enrollmentId: number;
  /** The survivor's 1st, 2nd, 3rd… session. */
  number: number;
  date: string;
  /** Null for a type outside the list (older records). */
  type: CounsellingType | null;
  counsellor: CounsellorView;
  counsellorRef: { kind: CounsellorKind; id: number } | null;
  /** As the API sends it: masked. */
  notes: string | null;
}

/** One survivor's counselling; the sessions themselves load when their record opens. */
export interface SurvivorCounselling {
  enrollmentId: number;
  participantId: number | null;
  name: string;
  /** Sessions logged, and the latest one's date, type and counsellor. */
  sessionCount: number;
  lastDate: string | null;
  lastType: CounsellingType | null;
  lastCounsellor: CounsellorView | null;
  caseNumber: string | null;
}

/** Headline counts for the VAWG pillar page. */
export interface VawgSummary {
  survivors: number;
  openCases: number;
  sessions: number;
  sessionsThisQuarter: number;
  concluded: number;
}

/** The options VAWG's dialogs offer, loaded when a dialog opens. */
export interface CaseFormOptions {
  /** VAWG enrollments a new case can be opened for, labelled with the survivor. */
  survivors: { enrollmentId: number; label: string }[];
  caseTypes: { id: number; name: string }[];
}
export interface CounsellingFormOptions {
  /** Survivors, with the sessions already logged so the form can say which is next. */
  survivors: { enrollmentId: number; label: string; sessionCount: number }[];
  /** Active staff and external counsellors. */
  counsellors: CounsellorOption[];
}

/** What the VAWG page renders: page 1 of each register, ready for the server to hand over. */
export interface VawgWorkspace {
  cases: PaginatedData<LegalCaseView>;
  /** Every survivor's counselling; null when the user cannot view counselling. */
  counselling: PaginatedData<SurvivorCounselling> | null;
  /** The signed-in user, so a staff counsellor's own name can be the default. */
  currentUserId: number | null;
}

/** What the signed-in user may do with counselling. */
export interface CounsellingPermissions {
  log: boolean;
  reveal: boolean;
}
