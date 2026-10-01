"use client";
import { Flag, Pencil, UserPlus } from "lucide-react";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { FieldGrid, SectionTitle, Timeline } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/grants";
import { formatDate, initials, titleCase } from "@/lib/format";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import { loadParticipantCurriculumAction, revealParticipantAction } from "../actions";
import type { ParticipantView } from "../api";
import { CurriculumSection } from "./curriculum-section";

/** One participant across every pillar they are enrolled in, with audited reveals. */
export function ParticipantDrawer({
  participant,
  grants,
  pillarName,
  onClose,
  onEdit,
}: {
  participant: ParticipantView | null;
  grants: readonly EffectiveGrant[];
  pillarName: (id: number) => string;
  onClose: () => void;
  onEdit: () => void;
}) {
  // The topic list loads when the drawer opens, and only for those who have progress to show.
  const curriculum = useRecordDetail(
    participant?.curriculum ? participant.id : null,
    loadParticipantCurriculumAction
  );
  if (!participant) return null;
  const inAnyPillar = (code: string) =>
    participant.pillarIds.some((id) => hasPermission(grants, code, { pillarId: id }));
  // Reveals are server actions that write an audit entry for every disclosure.
  const reveal = (field: "id_number" | "phone_number") =>
    inAnyPillar("SENSITIVE_REVEAL")
      ? () => revealParticipantAction(participant.id, field)
      : undefined;
  const fields: [string, React.ReactNode][] = [
    ["Full name", participant.name],
    ["Gender", participant.gender ? titleCase(participant.gender) : "Not recorded"],
    ["County", participant.county],
    ["Ward / location", participant.ward],
    [
      "National ID number",
      <MaskedField
        key="id"
        label="ID number"
        maskedValue={participant.idNumber ?? "—"}
        revealAction={reveal("id_number")}
      />,
    ],
    [
      "Phone",
      <MaskedField
        key="phone"
        label="Phone number"
        maskedValue={participant.phoneNumber ?? "—"}
        revealAction={reveal("phone_number")}
      />,
    ],
    ["Registered", formatDate(participant.registered)],
    ["Consent", participant.consentGiven ? "Recorded" : "Not recorded"],
  ];
  const firstPillar = pillarLook(participant.pillarIds[0]);
  // Newest first: each enrollment, then the registration they all hang off.
  const timeline = [
    ...[...participant.enrollments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        icon: <Flag size={15} aria-hidden="true" />,
        title: `Enrolled in ${pillarName(item.pillarId)} · ${item.category}`,
        detail: formatDate(item.date),
      })),
    {
      icon: <UserPlus size={15} aria-hidden="true" />,
      title: "Registered",
      detail: formatDate(participant.registered),
    },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(participant.name)}
      kind={`Participant · ${participant.pillarIds.map(pillarName).join(", ")}`}
      title={participant.name}
      subtitle={`${participant.county} · ${participant.ward} · Registered ${formatDate(participant.registered)}`}
      accent={firstPillar?.color}
      tint={firstPillar?.tint}
      status={
        <StatusBadge tone={participant.status === "ACTIVE" ? "success" : "neutral"}>
          {titleCase(participant.status)}
        </StatusBadge>
      }
      actions={
        inAnyPillar("PARTICIPANT_EDIT") && (
          <Button variant="outline" size="sm" aria-label="Edit participant" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-[22px]">
              <FieldGrid fields={fields} />
              <RecordSection
                status={participant.status}
                statusDescription={participant.statusDescription}
                created={participant.registered}
                updated={participant.updated}
                notes={[["Remarks", participant.remarks ?? "—"]]}
              />
              {participant.curriculum && (
                <CurriculumSection
                  summary={participant.curriculum}
                  detail={curriculum.data}
                  loading={curriculum.loading}
                  error={curriculum.error}
                />
              )}
              <section className="flex flex-col gap-2.5">
                <SectionTitle>Pillar enrollments</SectionTitle>
                {participant.enrollments.map((item) => {
                  const look = pillarLook(item.pillarId);
                  const Icon = look?.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3.5 rounded-xl border border-l-4 border-creaw-line bg-white px-4 py-3.5"
                      style={{ borderLeftColor: look?.color }}
                    >
                      {Icon && (
                        <Icon
                          size={22}
                          aria-hidden="true"
                          className="shrink-0"
                          style={{ color: look.color }}
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">
                          {pillarName(item.pillarId)} · {item.category}
                        </span>
                        <span className="text-[13px] text-creaw-faint">
                          Since {formatDate(item.date)}
                          {item.status === "ACTIVE" ? "" : ` · ${titleCase(item.status)}`}
                        </span>
                      </div>
                      <StatusBadge tone={item.currentStage ? "info" : "neutral"}>
                        {item.currentStage ?? "Not started"}
                      </StatusBadge>
                    </div>
                  );
                })}
                {participant.enrollments.length === 0 && (
                  <p className="text-[13.5px] text-creaw-faint">No pillar enrollments yet.</p>
                )}
              </section>
            </div>
          ),
        },
        {
          id: "activity",
          label: "Activity",
          content: <Timeline events={timeline} />,
        },
      ]}
    />
  );
}
