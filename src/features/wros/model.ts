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
  /** The organisation's WRO enrollment, which its pipeline stages hang off. */
  enrollmentId: number | null;
  entryCategory: string;
  stages: OrganisationStage[];
  /** Index into `stages` of the furthest stage reached; -1 before the first. */
  currentStage: number;
}
