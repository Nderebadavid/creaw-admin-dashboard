"use client";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronRight,
  Download,
  Eye,
  FolderOpen,
  Gavel,
  Paperclip,
  Pencil,
  Scale,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { DocumentRow, FieldGrid, SectionTitle, Timeline } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { pillarLook } from "@/components/portal/pillars";
import { formatDate } from "@/lib/format";
import { revealCaseObNumberAction } from "../actions";
import { VAWG_PILLAR_ID, type LegalCaseView } from "../model";
import { courtStatusLabel, courtStatusTone } from "./status";

const iconButton =
  "flex size-[34px] items-center justify-center rounded-lg text-creaw-body hover:bg-[#F4EEE8]";

/** A legal case as the design's record panel: overview, case files and history. */
export function CaseDrawer({
  legalCase,
  can,
  onClose,
  onEdit,
  onStatus,
  onAttach,
  onView,
}: {
  legalCase: LegalCaseView | null;
  can: { edit: boolean; attach: boolean; download: boolean; reveal: boolean };
  onClose: () => void;
  onEdit: () => void;
  onStatus: () => void;
  /** Opens the attach dialog, preset to a missing form when given. */
  onAttach: (documentType?: string) => void;
  onView: (documentId: number) => void;
}) {
  if (!legalCase) return null;
  const look = pillarLook(VAWG_PILLAR_ID);
  const fileCount = legalCase.documents.length + legalCase.missing.length;
  const fields: [string, React.ReactNode][] = [
    ["Case number", legalCase.number],
    ["Survivor", legalCase.survivor],
    ["Case type", legalCase.caseType],
    ["Court", legalCase.court ?? "—"],
    ["Court file number", legalCase.courtFileNumber ?? "—"],
    [
      "OB number",
      <MaskedField
        key="ob"
        label="OB number"
        maskedValue={legalCase.obNumber ?? "—"}
        revealAction={
          can.reveal && legalCase.obNumber
            ? () => revealCaseObNumberAction(legalCase.id)
            : undefined
        }
      />,
    ],
    ["Assigned officer", legalCase.assignedOfficer ?? "Not assigned"],
    ["Counsellor", legalCase.counsellor ?? "Not assigned"],
    ["Advocate", legalCase.advocate ?? "Not assigned"],
    ["Next court date", legalCase.nextCourtDate ? formatDate(legalCase.nextCourtDate) : "Pending"],
    ["Court status", courtStatusLabel(legalCase.courtStatus)],
  ];
  const timeline = [
    ...(legalCase.closed
      ? [
          {
            icon: <FolderOpen size={15} />,
            title: "Case closed",
            detail: formatDate(legalCase.closed),
          },
        ]
      : []),
    ...(legalCase.ruling
      ? [
          {
            icon: <Gavel size={15} />,
            title: "Ruling delivered",
            detail: formatDate(legalCase.ruling),
          },
        ]
      : []),
    ...[...legalCase.counselling].reverse().map((session) => ({
      icon: <Stethoscope size={15} />,
      title: session.counsellor
        ? `Counselling session ${session.number} · ${session.counsellor}`
        : `Counselling session ${session.number} logged`,
      detail: formatDate(session.date),
    })),
    {
      icon: <Scale size={15} />,
      title: `Case opened · ${legalCase.caseType}`,
      detail: formatDate(legalCase.opened),
    },
  ];
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials="VC"
      kind="Legal case · VAWG"
      title={`${legalCase.number} · ${legalCase.survivor}`}
      subtitle={`${legalCase.caseType} · ${legalCase.court ?? "Court not assigned"}`}
      accent={look?.color}
      tint={look?.tint}
      status={
        <StatusBadge tone={courtStatusTone(legalCase.courtStatus)}>
          {courtStatusLabel(legalCase.courtStatus)}
        </StatusBadge>
      }
      actions={
        <>
          <Button variant="outline" size="sm" disabled={!can.edit} onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button variant="outline" size="sm" disabled={!can.edit} onClick={onStatus}>
            <ArrowUpDown />
            Status
          </Button>
          <Button size="sm" disabled={!can.attach} onClick={() => onAttach()}>
            <Paperclip />
            Attach
          </Button>
        </>
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-[22px]">
              <FieldGrid fields={fields} />
              {legalCase.participantId && (
                <section className="flex flex-col gap-2.5">
                  <SectionTitle>Linked records</SectionTitle>
                  <Link
                    href="/participants"
                    className="flex items-center gap-3 rounded-xl border border-creaw-line bg-white px-3.5 py-3 hover:border-[#E2C7B6]"
                  >
                    <Gavel size={20} aria-hidden="true" style={{ color: look?.color }} />
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold">{legalCase.survivor}</span>
                      <span className="text-[12.5px] text-creaw-faint">
                        Participant · Participant registry
                      </span>
                    </span>
                    <ChevronRight size={20} aria-hidden="true" className="text-[#A39A92]" />
                  </Link>
                </section>
              )}
            </div>
          ),
        },
        {
          id: "documents",
          label: `Documents & photos (${fileCount})`,
          content: (
            <div className="flex flex-col gap-2.5">
              <SectionTitle note={`${legalCase.documents.length} of ${fileCount} attached`}>
                Documents
              </SectionTitle>
              {legalCase.documents.map((file) => (
                <DocumentRow
                  key={file.id}
                  name={file.name}
                  detail="Case file"
                  action={
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`View ${file.name}`}
                        disabled={!can.download}
                        onClick={() => onView(file.id)}
                        className={iconButton}
                      >
                        <Eye size={19} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Download ${file.name}`}
                        disabled={!can.download}
                        onClick={() => onView(file.id)}
                        className={iconButton}
                      >
                        <Download size={19} aria-hidden="true" />
                      </button>
                    </div>
                  }
                />
              ))}
              {legalCase.missing.map((name) => (
                <DocumentRow
                  key={name}
                  missing
                  name={name}
                  detail={`Missing — required for a ${legalCase.caseType.toLowerCase()} case`}
                  action={
                    <Button
                      size="sm"
                      disabled={!can.attach}
                      aria-label={`Attach ${name}`}
                      onClick={() => onAttach(name)}
                    >
                      <Paperclip />
                      Attach
                    </Button>
                  }
                />
              ))}
              {fileCount === 0 && (
                <p className="text-[13.5px] text-creaw-faint">No case files yet.</p>
              )}
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
