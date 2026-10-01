/** View models shared by the provider directory's server code and client components. */
export const providerTypes = [
  "counsellor",
  "nurse",
  "trainer",
  "advocate",
  "facilitator",
  "other",
] as const;
export type ProviderType = (typeof providerTypes)[number];
export const providerTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);
export interface WorkloadItem {
  id: number;
  date: string;
  label: string;
  pillar?: string;
}
export interface WorkloadGroup {
  count: number;
  recent: WorkloadItem[];
}
export interface ProviderWorkload {
  sessions: WorkloadGroup;
  counselling: WorkloadGroup;
  trainees: WorkloadGroup;
  cases: WorkloadGroup;
}
export interface ProviderView {
  id: number;
  name: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  type: ProviderType;
  service: string | null;
  institutionId: number | null;
  /** The institution's name, or "Independent". */
  institution: string;
  /** Masked as the API sends them. */
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  created: string | null;
  updated: string | null;
  /** Sum of the four workload counts. */
  linkedWork: number;
  workload: ProviderWorkload;
}
export interface ProviderDirectory {
  providers: ProviderView[];
  institutions: { id: number; name: string }[];
}
