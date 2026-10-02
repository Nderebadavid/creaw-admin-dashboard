"use client";
import Link from "next/link";
import {
  CalendarPlus,
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { DocumentRow, FieldGrid, SectionTitle, Timeline } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { pillarLook } from "@/components/portal/pillars";
import { formatDate } from "@/lib/format";
import {
  SESSION_PILLAR_IDS,
  type AttendeeView,
  type SessionPermissions,
  type SessionPillar,
  type FacilitatorView,
  type SessionDetail,
  type SessionView,
} from "../model";

const kindTag = { staff: "Staff", provider: "Provider" } as const;

/** A facilitator's name with a small Staff or Provider tag (none when the kind is unknown). */
export function FacilitatorName({
  facilitator,
  className,
}: {
  facilitator: FacilitatorView;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      {facilitator.name}
      {facilitator.kind && <StatusBadge tone="neutral">{kindTag[facilitator.kind]}</StatusBadge>}
    </span>
  );
}

const iconButton =
  "flex size-[34px] items-center justify-center rounded-lg text-creaw-body hover:bg-[#F4EEE8] disabled:opacity-50";

/** A group session as the record panel: overview, attendance, files and history. */
export function SessionDrawer({
  session,
  detail,
  detailLoading,
  pillar,
  can,
  onClose,
  onEdit,
  onAttach,
  onAddAttendee,
  onRemoveAttendee,
  onView,
  openingId = null,
}: {
  session: SessionView | null;
  /** Attendance and files, once loaded. */
  detail: SessionDetail | null;
  detailLoading: boolean;
  pillar: SessionPillar;
  can: SessionPermissions;
  onClose: () => void;
  onEdit: () => void;
  onAttach: () => void;
  onAddAttendee: () => void;
  onRemoveAttendee: (attendee: AttendeeView) => void;
  onView: (documentId: number) => void;
  /** The file being opened; every file button waits while one opens. */
  openingId?: number | null;
}) {
  if (!session) return null;
  const look = pillarLook(SESSION_PILLAR_IDS[pillar]);
  const reach = session.communityWide ? "Community-wide" : "Linked participant";
  const attendees = detail?.attendees ?? [];
  const documents = detail?.documents ?? [];
  const fields: [string, React.ReactNode][] = [
    ["Activity type", session.activityType],
    ["Topic", session.topicId === null ? `${session.topic} (Other)` : session.topic],
    ["Date", formatDate(session.date)],
    ["Venue", session.venue ?? "—"],
    ["Facilitator", <FacilitatorName key="facilitator" facilitator={session.facilitator} />],
    ["Reach", reach],
  ];
  const events = [
    ...(session.updated !== session.logged
      ? [{ at: session.updated, icon: <Pencil size={15} />, title: "Session edited" }]
      : []),
    ...attendees.map((attendee) => ({
      at: attendee.added,
      icon: <Users size={15} />,
      title: `${attendee.name} added to attendance`,
    })),
    ...documents.map((file) => ({
      at: file.added,
      icon: <FileText size={15} />,
      title: `${file.name} attached`,
    })),
    { at: session.logged, icon: <CalendarPlus size={15} />, title: "Session logged" },
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((event) => ({ icon: event.icon, title: event.title, detail: formatDate(event.at) }));
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={session.activityType.slice(0, 2).toUpperCase()}
      kind={`Group session · ${pillar === "srhr" ? "SRHR" : "Skilling"}`}
      title={`${session.topic} · ${formatDate(session.date)}`}
      subtitle={`${session.venue ?? "Venue not recorded"} · ${session.facilitator.name}`}
      accent={look?.color}
      tint={look?.tint}
      status={<StatusBadge tone="neutral">{reach}</StatusBadge>}
      actions={
        <>
          <Button variant="outline" size="sm" disabled={!can.log} onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button size="sm" disabled={!can.attach} onClick={onAttach}>
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
              <RecordSection
                status={session.status}
                statusDescription={session.statusDescription}
                created={session.logged}
                updated={session.updated}
                notes={[["Notes", session.notes ?? "—"]]}
              />
            </div>
          ),
        },
        {
          id: "attendance",
          label: `Attendance (${session.attendeeCount})`,
          content: (
            <div className="flex flex-col gap-2.5">
              <SectionTitle note="Attendance normally arrives from the mobile app. Use this list to correct it.">
                Attendees
              </SectionTitle>
              <div>
                <Button variant="outline" size="sm" disabled={!can.log} onClick={onAddAttendee}>
                  <UserPlus />
                  Add attendee
                </Button>
              </div>
              {detailLoading && (
                <p role="status" className="text-[13.5px] text-creaw-faint">
                  Loading attendance…
                </p>
              )}
              {attendees.map((attendee) => (
                <div
                  key={attendee.attendanceId}
                  className="flex items-center gap-3 rounded-xl border border-creaw-line bg-white px-3.5 py-3"
                >
                  <Link href="/participants" className="flex flex-1 flex-col hover:underline">
                    <span className="text-sm font-semibold">{attendee.name}</span>
                    <span className="text-[12.5px] text-creaw-faint">
                      {attendee.ward ?? "Ward not recorded"}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${attendee.name}`}
                    disabled={!can.log}
                    onClick={() => onRemoveAttendee(attendee)}
                    className={iconButton}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {!detailLoading && attendees.length === 0 && (
                <p className="text-[13.5px] text-creaw-faint">No attendees recorded yet.</p>
              )}
            </div>
          ),
        },
        {
          id: "documents",
          label: detailLoading ? "Documents & photos" : `Documents & photos (${documents.length})`,
          content: (
            <div className="flex flex-col gap-2.5">
              {documents.map((file) => (
                <DocumentRow
                  key={file.id}
                  name={file.name}
                  detail="Session file"
                  action={
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`View ${file.name}`}
                        aria-busy={openingId === file.id}
                        disabled={!can.download || openingId != null}
                        onClick={() => onView(file.id)}
                        className={iconButton}
                      >
                        {openingId === file.id ? (
                          <Loader2 size={19} aria-hidden="true" className="animate-spin" />
                        ) : (
                          <Eye size={19} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Download ${file.name}`}
                        aria-busy={openingId === file.id}
                        disabled={!can.download || openingId != null}
                        onClick={() => onView(file.id)}
                        className={iconButton}
                      >
                        {openingId === file.id ? (
                          <Loader2 size={19} aria-hidden="true" className="animate-spin" />
                        ) : (
                          <Download size={19} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  }
                />
              ))}
              {!detailLoading && documents.length === 0 && (
                <p className="text-[13.5px] text-creaw-faint">No files attached yet.</p>
              )}
            </div>
          ),
        },
        { id: "activity", label: "Activity", content: <Timeline events={events} /> },
      ]}
    />
  );
}
