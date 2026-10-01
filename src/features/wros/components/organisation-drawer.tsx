"use client";
import Link from "next/link";
import { Check, Circle, ClipboardCheck } from "lucide-react";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { FieldGrid, SectionTitle } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, initials, titleCase } from "@/lib/format";
import { WRO_PILLAR_ID, type OrganisationStage, type OrganisationView } from "../model";
import { dueDiligenceTone } from "./organisation-register";

/** An organisation's profile: details, its sub-grant pipeline, and where its assessments live. */
export function OrganisationDrawer({
  organisation,
  stages,
  canMove,
  canAssess,
  onClose,
  onMove,
  onAssess,
}: {
  organisation: OrganisationView | null;
  /** The pipeline's stages, with when this organisation reached each (once loaded). */
  stages: readonly OrganisationStage[];
  canMove: boolean;
  canAssess: boolean;
  onClose: () => void;
  onMove: (stage: OrganisationStage) => void;
  onAssess: () => void;
}) {
  if (!organisation) return null;
  const look = pillarLook(WRO_PILLAR_ID);
  const next = stages[organisation.currentStage + 1];
  const current = stages[organisation.currentStage];
  const fields: [string, React.ReactNode][] = [
    ["Organisation", organisation.name],
    ["Legal form", organisation.legalForm],
    ["Registration no.", organisation.registrationNumber ?? "Not recorded"],
    ["Ward / county", `${organisation.ward} · ${organisation.county}`],
    ["Office address", organisation.address ?? "Not recorded"],
    ["Bank account", organisation.bankAccount],
    ["Programme category", organisation.entryCategory],
    ["Registered", formatDate(organisation.registered)],
  ];
  const moveButton = next && (
    <Button
      size="sm"
      disabled={!canMove || !organisation.enrollmentId}
      title={!canMove ? "Pipeline permission required" : undefined}
      onClick={() => onMove(next)}
    >
      Move to {next.name}
    </Button>
  );
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(organisation.name)}
      kind="Organisation · WROs"
      title={organisation.name}
      subtitle={`${organisation.legalForm} · ${organisation.county} · Registered ${formatDate(organisation.registered)}`}
      accent={look?.color}
      tint={look?.tint}
      status={
        <StatusBadge tone={dueDiligenceTone(organisation.dueDiligence)}>
          Due diligence {titleCase(organisation.dueDiligence).toLowerCase()}
        </StatusBadge>
      }
      actions={
        <>
          {canAssess && (
            <Button variant="outline" size="sm" onClick={onAssess}>
              <ClipboardCheck />
              Record assessment
            </Button>
          )}
          {moveButton}
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
                status={organisation.status}
                statusDescription={organisation.statusDescription}
                created={organisation.registered}
                updated={organisation.updated}
              />
            </div>
          ),
        },
        {
          id: "pipeline",
          label: "Sub-grant pipeline",
          content: (
            <div className="flex flex-col gap-3.5">
              <SectionTitle
                note={
                  current
                    ? `Step ${organisation.currentStage + 1} of ${stages.length}`
                    : "Not started"
                }
              >
                {current ? current.name : "Awaiting onboarding"}
              </SectionTitle>
              <ol className="flex flex-col rounded-[14px] border border-creaw-line bg-white p-[18px]">
                {stages.map((stage, index) => {
                  const done = index <= organisation.currentStage;
                  const upNext = index === organisation.currentStage + 1;
                  return (
                    <li key={stage.id} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex size-[30px] items-center justify-center rounded-full border-2 ${done ? "border-[#1F7A4D] bg-[#1F7A4D] text-white" : upNext ? "border-[#F2B25C] bg-[#FDEFD9] text-[#9A5A0E]" : "border-creaw-line-strong bg-white text-[#C9C0B7]"}`}
                        >
                          {done ? <Check size={16} /> : <Circle size={10} fill="currentColor" />}
                        </span>
                        {index < stages.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={`min-h-4 w-0.5 flex-1 ${index < organisation.currentStage ? "bg-[#1F7A4D]" : "bg-creaw-line"}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4">
                        <span className="text-sm font-semibold">{stage.name}</span>
                        <span className="text-[12.5px] text-creaw-faint">
                          {stage.reachedAt
                            ? `Reached ${formatDate(stage.reachedAt)}`
                            : upNext
                              ? "Next stage"
                              : "Not reached"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {!stages.length && (
                <p className="text-[13.5px] text-creaw-faint">
                  The WRO pillar has no pipeline configured.
                </p>
              )}
            </div>
          ),
        },
        {
          id: "assessments",
          label: "Assessments",
          content: (
            <div className="flex flex-col gap-3 text-[13.5px] text-creaw-body">
              <p>
                Capacity scores, the due-diligence checklist and recommendations for this
                organisation are kept with its assessments.
              </p>
              <Link href="/assessments" className="font-semibold text-primary">
                Open organisation assessments →
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
