/** View models shared by the sessions server code and its client components. */
import type { PaginatedData } from "@/types/api";
export const SESSION_PILLAR_IDS = { srhr: 3, skilling: 6 } as const;
export type SessionPillar = keyof typeof SESSION_PILLAR_IDS;
export const isSessionPillar = (code: string): code is SessionPillar => code in SESSION_PILLAR_IDS;
export const sessionPeriods = ["quarter", "year", "all"] as const;
export type SessionPeriod = (typeof sessionPeriods)[number];
export const periodLabels: Record<SessionPeriod, string> = {
  quarter: "This quarter",
  year: "This year",
  all: "All time",
};
export const parsePeriod = (value: unknown): SessionPeriod =>
  sessionPeriods.includes(value as SessionPeriod) ? (value as SessionPeriod) : "quarter";

export type FacilitatorKind = "staff" | "provider";
/** Who led a session: a name (never an id) and, when known, whether they are staff or a provider. */
export interface FacilitatorView {
  name: string;
  kind: FacilitatorKind | null;
}
export interface FacilitatorOption {
  kind: FacilitatorKind;
  id: number;
  name: string;
  detail: string;
}
export interface ActivityTypeOption {
  id: number;
  name: string;
  active: boolean;
}
export interface ActivityTopicOption {
  id: number;
  activityTypeId: number;
  name: string;
  sequenceNo: number;
  active: boolean;
}
export interface AttendeeView {
  attendanceId: number;
  participantId: number;
  name: string;
  ward: string | null;
  added: string;
}
export interface SessionDocument {
  id: number;
  name: string;
  added: string;
}
export interface SessionView {
  id: number;
  activityTypeId: number;
  activityType: string;
  topicId: number | null;
  /** The planned topic's name, else the free-text topic, else "Session #<id>". */
  topic: string;
  /** The free-text topic as stored; null when blank. */
  freeTopic: string | null;
  date: string;
  venue: string | null;
  notes: string | null;
  facilitator: FacilitatorView;
  facilitatorRef: { kind: FacilitatorKind; id: number } | null;
  communityWide: boolean;
  /** Who attended, counted by the API; the names load with the session's detail. */
  attendeeCount: number;
  status: string;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  logged: string;
  updated: string;
}
/** What a session's drawer loads when it opens. */
export interface SessionDetail {
  attendees: AttendeeView[];
  documents: SessionDocument[];
}
export interface TopicCoverage {
  topicId: number;
  name: string;
  sequenceNo: number;
  sessions: number;
  lastDelivered: string | null;
}
export interface TypeCoverage {
  activityTypeId: number;
  name: string;
  topics: TopicCoverage[];
  otherTopics: { name: string; sessions: number; lastDelivered: string }[];
}
export interface SessionSummary {
  sessionsHeld: number;
  peopleReached: number;
  topicsCovered: number;
  topicsPlanned: number;
  activeTypes: number;
}
/** The options the session form offers, loaded when the form opens. */
export interface SessionFormOptions {
  activityTypes: ActivityTypeOption[];
  topics: ActivityTopicOption[];
  /** Active staff and providers a session can be assigned to. */
  facilitators: FacilitatorOption[];
}

/** What the sessions page renders: page 1 of the register and the server-computed coverage. */
export interface SessionWorkspace {
  pillar: SessionPillar;
  period: SessionPeriod;
  /** The first page of the pillar's sessions, newest first. */
  sessions: PaginatedData<SessionView>;
  coverage: TypeCoverage[];
  summary: SessionSummary;
  currentUser: { id: number; name: string } | null;
}

/** What the signed-in user may do on the sessions page. */
export interface SessionPermissions {
  log: boolean;
  attach: boolean;
  download: boolean;
  export: boolean;
}
