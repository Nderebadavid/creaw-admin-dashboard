/** View models and constants shared by the WRO server code and its client components. */
/** The WRO pillar's fixed id. */
export const WRO_PILLAR_ID = 5;

export interface OrganisationStage {
  id: number;
  name: string;
  /** When the organisation reached this stage; null if it has not. */
  reachedAt: string | null;
}
export interface OrganisationView {
  id: number;
  name: string;
  legalForm: string;
  registrationNumber: string | null;
  ward: string;
  county: string;
  address: string | null;
  /** Masked unless revealed; "Yes"/"No" once known. */
  bankAccount: string;
  dueDiligence: string;
  registered: string;
  status: string;
  /** Why the record has its status, e.g. a deactivation reason. */
  statusDescription: string | null;
  updated: string | null;
  /** The organisation's WRO enrollment, which its pipeline stages hang off. */
  enrollmentId: number | null;
  entryCategory: string;
  /** Index into the pipeline of the furthest stage reached; -1 before the first or when unknown. */
  currentStage: number;
  /** Steps in the pipeline. */
  stageCount: number;
  /** Whether the organisation has reached the contract stage; null when progress is unknown. */
  contracted: boolean | null;
}

/** A pipeline stage the WRO pillar defines. */
export interface PipelineStageDef {
  id: number;
  name: string;
}

/** What an organisation's drawer loads when it opens: when it reached each stage. */
export interface OrganisationDetail {
  /** Stage id to the latest date the organisation reached it. */
  reachedAt: Record<number, string>;
}

/** The options the registration dialog offers, loaded when it opens. */
export interface OrganisationFormOptions {
  wards: { id: number; name: string }[];
}
