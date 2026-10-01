/** View models shared by the VAWG case server code and its client components. */

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
  /** The survivor's name as the API sends it (masked unless revealed). */
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
  counselling: { number: number; date: string; counsellor: string | null }[];
  documents: CaseDocument[];
  /** Forms this case type requires that are not on file, e.g. "P3 form". */
  missing: string[];
}

/** Headline counts for the VAWG pillar page. */
export interface VawgSummary {
  survivors: number;
  openCases: number;
  sessions: number;
  sessionsThisQuarter: number;
  concluded: number;
}

/** Everything the VAWG register and its dialogs need. */
export interface VawgWorkspace {
  cases: LegalCaseView[];
  summary: VawgSummary;
  caseTypes: { id: number; name: string }[];
  /** VAWG enrollments a new case can be opened for, labelled with the survivor. */
  survivors: { enrollmentId: number; label: string }[];
}
