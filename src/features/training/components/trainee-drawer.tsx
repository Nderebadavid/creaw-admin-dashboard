"use client";
import Link from "next/link";
import {
  Award,
  BadgeCheck,
  ClipboardCheck,
  FilePlus2,
  Flag,
  GraduationCap,
  Pencil,
  Send,
  Undo2,
  UserPlus,
} from "lucide-react";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { FieldGrid, SectionTitle, Timeline } from "@/components/ui/record-parts";
import { formatDate, initials } from "@/lib/format";
import {
  acceptedStages,
  pathwayLabels,
  TRAINING_PILLAR_ID,
  trainingStatusLabels,
  workStatusLabels,
  type TraineeView,
  type TrainingPermissions,
} from "../model";
import { HandoffBadge, TrainingStatusBadge } from "./status";

const dateOr = (value: string | null, fallback = "—") => (value ? formatDate(value) : fallback);

/** Why the recommend button is unavailable, or null when it can be used. */
export function recommendBlocker(trainee: TraineeView, can: TrainingPermissions) {
  if (!can.recommend) return "You cannot refer trainees to WEE";
  if (trainee.status !== "completed") return "Only completed trainees can be recommended";
  return null;
}

/** The recommend / withdraw control for a trainee, or nothing once WEE has accepted. */
function RecommendButton({
  trainee,
  can,
  onRecommend,
}: {
  trainee: TraineeView;
  can: TrainingPermissions;
  onRecommend: (recommend: boolean) => void;
}) {
  if (acceptedStages.includes(trainee.handoff.stage)) return null;
  if (trainee.handoff.stage === "referred")
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={!can.recommend}
        onClick={() => onRecommend(false)}
      >
        <Undo2 />
        Withdraw recommendation
      </Button>
    );
  const blocker = recommendBlocker(trainee, can);
  return (
    <Button
      size="sm"
      disabled={blocker !== null}
      title={blocker ?? undefined}
      onClick={() => onRecommend(true)}
    >
      <Send />
      Recommend for grant
    </Button>
  );
}

/** One step of the hand-off trail: done with its date, or still to come. */
function Step({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-creaw-line bg-white px-3.5 py-3">
      <BadgeCheck
        size={20}
        aria-hidden="true"
        className={done ? "text-[#1F7A4D]" : "text-[#C9BFB6]"}
      />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[12.5px] text-creaw-faint">{detail}</span>
      </span>
    </li>
  );
}

/** Recommended → WEE decision → application → award, with dates. */
function HandoffTrail({ trainee }: { trainee: TraineeView }) {
  const { handoff } = trainee;
  if (handoff.stage === "none")
    return (
      <p className="text-[13.5px] text-creaw-faint">
        Not recommended. Completed trainees can be recommended to WEE for a business grant; WEE then
        accepts or declines the referral.
      </p>
    );
  const declined = handoff.stage === "declined";
  return (
    <div className="flex flex-col gap-2.5">
      <SectionTitle note="WEE decides on the referral and files the application">
        Grant hand-off
      </SectionTitle>
      <ol className="flex flex-col gap-2" aria-label="Grant hand-off steps">
        <Step
          done
          title="Recommended for a grant"
          detail={dateOr(handoff.recommendedOn, "Date not recorded")}
        />
        <Step
          done={handoff.decidedOn !== null}
          title={declined ? "Declined by WEE" : "Accepted by WEE"}
          detail={dateOr(handoff.decidedOn, "Waiting for WEE")}
        />
        {!declined && (
          <>
            <Step
              done={handoff.applicationOn !== null}
              title="Grant application filed"
              detail={dateOr(handoff.applicationOn, "Not yet")}
            />
            <Step
              done={handoff.awardedOn !== null}
              title="Grant awarded"
              detail={dateOr(handoff.awardedOn, "Not yet")}
            />
          </>
        )}
      </ol>
      {declined && (
        <p className="text-[13.5px] text-creaw-faint">
          The trainee can be recommended again if their circumstances change.
        </p>
      )}
      {handoff.referralId !== null && (
        <Link href="/referrals" className="text-sm font-semibold underline">
          Open the referral queue
        </Link>
      )}
    </div>
  );
}

/** A Skilling trainee as the record panel: placement and outcome, grant hand-off, history. */
export function TraineeDrawer({
  trainee,
  can,
  onClose,
  onEdit,
  onOutcome,
  onRecommend,
}: {
  trainee: TraineeView | null;
  can: TrainingPermissions;
  onClose: () => void;
  onEdit: () => void;
  onOutcome: () => void;
  onRecommend: (recommend: boolean) => void;
}) {
  if (!trainee) return null;
  const look = pillarLook(TRAINING_PILLAR_ID);
  const finished = trainee.status !== "ongoing";
  const fields: [string, React.ReactNode][] = [
    ["Pathway", pathwayLabels[trainee.pathway]],
    ["Course", trainee.course ?? "Not recorded"],
    ["Institution", trainee.institution ?? "Not recorded"],
    ["Trainer", trainee.trainer ?? "Not assigned"],
    ["Start date", dateOr(trainee.startDate, "Not recorded")],
    [
      trainee.status === "dropped_out" ? "Drop-out date" : "Completion date",
      dateOr(trainee.completionDate),
    ],
    ["Training status", trainingStatusLabels[trainee.status]],
    ["Life-skills sessions", String(trainee.lifeSkillsSessions)],
    [
      "Work status",
      trainee.workStatus ? workStatusLabels[trainee.workStatus] : finished ? "Not recorded" : "—",
    ],
    ["Workplace", trainee.workstation ?? "—"],
    [
      "Monthly salary",
      <MaskedField key="salary" label="Monthly salary" maskedValue={trainee.salary ?? "—"} />,
    ],
  ];
  const { handoff } = trainee;
  const events = [
    { at: trainee.created, icon: <UserPlus size={15} />, title: "Placement recorded" },
    ...(trainee.startDate
      ? [{ at: trainee.startDate, icon: <Flag size={15} />, title: "Training started" }]
      : []),
    ...(trainee.completionDate
      ? [
          {
            at: trainee.completionDate,
            icon: <GraduationCap size={15} />,
            title: trainee.status === "dropped_out" ? "Dropped out" : "Training completed",
          },
        ]
      : []),
    ...(handoff.recommendedOn
      ? [{ at: handoff.recommendedOn, icon: <Send size={15} />, title: "Recommended for a grant" }]
      : []),
    ...(handoff.decidedOn
      ? [
          {
            at: handoff.decidedOn,
            icon: <ClipboardCheck size={15} />,
            title: handoff.stage === "declined" ? "Declined by WEE" : "Accepted by WEE",
          },
        ]
      : []),
    ...(handoff.applicationOn
      ? [
          {
            at: handoff.applicationOn,
            icon: <FilePlus2 size={15} />,
            title: "Grant application filed",
          },
        ]
      : []),
    ...(handoff.awardedOn
      ? [{ at: handoff.awardedOn, icon: <Award size={15} />, title: "Grant awarded" }]
      : []),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => ({ icon: event.icon, title: event.title, detail: formatDate(event.at) }));
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(trainee.name)}
      kind="Trainee · Skilling"
      title={trainee.name}
      subtitle={`${trainee.course ?? "Course not recorded"} · ${trainee.institution ?? "Institution not recorded"}`}
      accent={look?.color}
      tint={look?.tint}
      status={
        <span className="flex flex-wrap gap-1.5">
          <TrainingStatusBadge status={trainee.status} />
          {handoff.stage !== "none" && <HandoffBadge stage={handoff.stage} />}
        </span>
      }
      actions={
        <>
          <Button variant="outline" size="sm" disabled={!can.edit} onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button variant="outline" size="sm" disabled={!can.edit} onClick={onOutcome}>
            <GraduationCap />
            Record outcome
          </Button>
          <RecommendButton trainee={trainee} can={can} onRecommend={onRecommend} />
        </>
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-[22px]">
              <FieldGrid fields={fields} />
              <RecordSection
                status={trainee.recordStatus}
                statusDescription={trainee.statusDescription}
                created={trainee.created}
                updated={trainee.updated}
              />
            </div>
          ),
        },
        { id: "handoff", label: "Grant hand-off", content: <HandoffTrail trainee={trainee} /> },
        { id: "activity", label: "Activity", content: <Timeline events={events} /> },
      ]}
    />
  );
}
