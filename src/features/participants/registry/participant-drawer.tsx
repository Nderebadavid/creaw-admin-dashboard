"use client";
import { Button } from "@/components/ui/button";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/grants";
import { formatDate } from "@/lib/format";
import { revealParticipantAction } from "../actions";
import type { ParticipantView } from "../api";
import { initials } from "./columns";

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
  if (!participant) return null;
  const inAnyPillar = (code: string) =>
    participant.pillarIds.some((id) => hasPermission(grants, code, { pillarId: id }));
  // Reveals are server actions that write an audit entry for every disclosure.
  const reveal = (field: "id_number" | "phone_number") =>
    inAnyPillar("SENSITIVE_REVEAL")
      ? () => revealParticipantAction(participant.id, field)
      : undefined;
  const fields: [string, React.ReactNode][] = [
    ["County / ward", `${participant.county} · ${participant.ward}`],
    ["Registered", formatDate(participant.registered)],
    [
      "ID number",
      <MaskedField
        key="id"
        label="ID number"
        maskedValue={participant.idNumber ?? "—"}
        revealAction={reveal("id_number")}
      />,
    ],
    [
      "Phone number",
      <MaskedField
        key="phone"
        label="Phone number"
        maskedValue={participant.phoneNumber ?? "—"}
        revealAction={reveal("phone_number")}
      />,
    ],
    ["Consent", participant.consentGiven ? "Recorded" : "Not recorded"],
    ["Remarks", participant.remarks ?? "—"],
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(participant.name)}
      kind={`Participant · ${participant.pillarIds.map(pillarName).join(", ")}`}
      title={participant.name}
      subtitle={`${participant.county} · ${participant.ward}`}
      status={
        <StatusBadge tone={participant.status === "ACTIVE" ? "success" : "neutral"}>
          {participant.status}
        </StatusBadge>
      }
      actions={
        inAnyPillar("PARTICIPANT_EDIT") && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit participant
          </Button>
        )
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {fields.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-creaw-faint">{label}</dt>
                    <dd className="mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
              <section>
                <h3 className="font-heading text-lg font-bold">Pillar enrollments</h3>
                <ul className="mt-2 space-y-2">
                  {participant.enrollments.map((item) => (
                    <li key={item.id} className="rounded-xl border border-creaw-line p-3">
                      <span className="font-semibold">{pillarName(item.pillarId)}</span> ·{" "}
                      {item.category}
                      <span className="block text-xs text-creaw-faint">
                        Since {formatDate(item.date)} · {item.status}
                      </span>
                      <span className="mt-1 inline-block rounded-full bg-creaw-canvas px-2 py-0.5 text-xs font-semibold">
                        {item.currentStage ?? "Not started"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ),
        },
        {
          id: "activity",
          label: "Activity",
          content: (
            <p className="text-creaw-faint">
              Registered {formatDate(participant.registered)}; {participant.enrollments.length}{" "}
              enrollment
              {participant.enrollments.length === 1 ? "" : "s"} recorded.
            </p>
          ),
        },
      ]}
    />
  );
}
