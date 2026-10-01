/** View models shared by the Skilling trainee server code and its client components. */
export const TRAINING_PILLAR_ID = 6;

export const pathways = ["tvet", "apprenticeship", "community_center", "life_skills"] as const;
export type Pathway = (typeof pathways)[number];
export const pathwayLabels: Record<Pathway, string> = {
  tvet: "TVET",
  apprenticeship: "Apprenticeship",
  community_center: "Community centre",
  life_skills: "Life skills",
};

export const trainingStatuses = ["ongoing", "completed", "dropped_out"] as const;
export type TrainingStatus = (typeof trainingStatuses)[number];
export const trainingStatusLabels: Record<TrainingStatus, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  dropped_out: "Dropped out",
};

export const workStatuses = [
  "employed",
  "self_employed",
  "further_training",
  "seeking_work",
  "not_seeking_work",
] as const;
export type WorkStatus = (typeof workStatuses)[number];
export const workStatusLabels: Record<WorkStatus, string> = {
  employed: "Employed",
  self_employed: "Self-employed",
  further_training: "In further training",
  seeking_work: "Seeking work",
  not_seeking_work: "Not seeking work",
};
/** Work statuses that earn an income: these count as "in work" and may carry a salary. */
export const earningStatuses: readonly WorkStatus[] = ["employed", "self_employed"];
/** Work statuses with a place to name (employer, business or institution). */
export const placedStatuses: readonly WorkStatus[] = [
  "employed",
  "self_employed",
  "further_training",
];

export const handoffStages = [
  "none",
  "referred",
  "declined",
  "accepted",
  "application_filed",
  "awarded",
] as const;
export type HandoffStage = (typeof handoffStages)[number];
export const handoffLabels: Record<HandoffStage, string> = {
  none: "Not recommended",
  referred: "Recommended",
  declined: "Declined by WEE",
  accepted: "With WEE",
  application_filed: "Application filed",
  awarded: "Awarded",
};
/** Stages where WEE has accepted the trainee. */
export const acceptedStages: readonly HandoffStage[] = ["accepted", "application_filed", "awarded"];

export interface GrantHandoff {
  stage: HandoffStage;
  referralId: number | null;
  recommendedOn: string | null;
  decidedOn: string | null;
  applicationOn: string | null;
  awardedOn: string | null;
}

export interface TraineeView {
  id: number;
  enrollmentId: number;
  /** The participant's full name, or a generic label when the API sent none. */
  name: string;
  pathway: Pathway;
  course: string | null;
  institutionId: number | null;
  institution: string | null;
  trainerId: number | null;
  trainer: string | null;
  startDate: string | null;
  completionDate: string | null;
  status: TrainingStatus;
  workStatus: WorkStatus | null;
  workstation: string | null;
  /** As the API sends it: masked. */
  salary: string | null;
  lifeSkillsSessions: number;
  recommended: boolean;
  handoff: GrantHandoff;
  created: string;
  updated: string;
}

export interface TrainingSummary {
  enrolled: number;
  completed: number;
  droppedOut: number;
  /** Completed ÷ (completed + dropped out), as a whole percentage; null before anyone finishes. */
  completionRate: number | null;
  /** Completers who are employed or self-employed. */
  inWork: number;
  /** In work ÷ completed, as a whole percentage; null before anyone completes. */
  inWorkRate: number | null;
  recommended: number;
  acceptedByWee: number;
}

export interface TrainingOption {
  id: number;
  label: string;
}

export interface TrainingWorkspace {
  trainees: TraineeView[];
  summary: TrainingSummary;
  /** Skilling enrollments a placement can be made for; [] when the user can't edit. */
  enrollments: TrainingOption[];
  /** Active training institutions. */
  institutions: TrainingOption[];
  /** Active trainer providers; [] when the user can't edit or the read fails. */
  trainers: TrainingOption[];
}

/** What the signed-in user may do with trainees. */
export interface TrainingPermissions {
  edit: boolean;
  recommend: boolean;
  reveal: boolean;
  export: boolean;
}

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 100);

/** The headline counts over every trainee. */
export function buildTrainingSummary(trainees: readonly TraineeView[]): TrainingSummary {
  const completed = trainees.filter((row) => row.status === "completed");
  const droppedOut = trainees.filter((row) => row.status === "dropped_out").length;
  const inWork = completed.filter(
    (row) => row.workStatus !== null && earningStatuses.includes(row.workStatus)
  ).length;
  return {
    enrolled: trainees.length,
    completed: completed.length,
    droppedOut,
    completionRate: percent(completed.length, completed.length + droppedOut),
    inWork,
    inWorkRate: percent(inWork, completed.length),
    recommended: trainees.filter((row) => !["none", "declined"].includes(row.handoff.stage)).length,
    acceptedByWee: trainees.filter((row) => acceptedStages.includes(row.handoff.stage)).length,
  };
}
