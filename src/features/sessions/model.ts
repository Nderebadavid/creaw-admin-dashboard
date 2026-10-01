/** View models shared by the sessions server code and its client components. */
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
  /** As the API sends it: masked. */
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
  attendees: AttendeeView[];
  documents: SessionDocument[];
  logged: string;
  updated: string;
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
export interface SessionWorkspace {
  pillar: SessionPillar;
  period: SessionPeriod;
  /** Every session of the pillar, newest first (the register is not period-filtered). */
  sessions: SessionView[];
  coverage: TypeCoverage[];
  summary: SessionSummary;
  activityTypes: ActivityTypeOption[];
  topics: ActivityTopicOption[];
  /** People an attendee can be picked from, labelled "<name> · <ward>" (plus "#<id>" only to tell identical labels apart). */
  participants: { id: number; label: string }[];
  /** Active staff and providers a session can be assigned to; [] when the user can't log or the read fails. */
  facilitators: FacilitatorOption[];
  currentUser: { id: number; name: string } | null;
}

/** What the signed-in user may do on the sessions page. */
export interface SessionPermissions {
  log: boolean;
  attach: boolean;
  download: boolean;
  export: boolean;
}
