import type { ReactNode } from "react";
import { CircleAlert, FileText } from "lucide-react";

/** A record's facts as the design's white card: two columns of small label over bold value. */
export function FieldGrid({ fields }: { fields: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid gap-x-5 gap-y-4 rounded-[14px] border border-creaw-line bg-white p-[18px] sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-[3px]">
          <dt className="text-[12.5px] text-creaw-faint">{label}</dt>
          <dd className="text-[14.5px] font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Heading for a group of cards inside a record drawer, with an optional note on the right. */
export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-heading text-lg font-bold">{children}</h3>
      {note && <span className="text-[13px] text-creaw-faint">{note}</span>}
    </div>
  );
}

/**
 * One line of a document checklist. A document on file is a plain row; a
 * missing one is dashed amber and carries the control that attaches it.
 */
export function DocumentRow({
  name,
  detail,
  missing = false,
  action,
}: {
  name: string;
  /** Second line: what the file is, or why it is needed when missing. */
  detail: ReactNode;
  missing?: boolean;
  /** View/download controls, or the Attach button for a missing document. */
  action?: ReactNode;
}) {
  const Icon = missing ? CircleAlert : FileText;
  return (
    <div
      className={`flex flex-wrap items-center gap-3.5 rounded-xl px-3.5 py-3 ${missing ? "border-[1.5px] border-dashed border-[#F2C98A] bg-[#FFFBF4]" : "border border-creaw-divider bg-white"}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${missing ? "bg-[#FDEFD9] text-[#9A5A0E]" : "bg-creaw-canvas text-primary"}`}
      >
        <Icon size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-semibold">{name}</span>
        <span className={`text-[13px] ${missing ? "text-[#9A5A0E]" : "text-creaw-faint"}`}>
          {detail}
        </span>
      </div>
      {action}
    </div>
  );
}

/** A vertical timeline of what happened to a record, newest first. */
export function Timeline({
  events,
}: {
  events: readonly { icon: ReactNode; title: ReactNode; detail: ReactNode }[];
}) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => (
        <li key={index} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className="flex size-[30px] items-center justify-center rounded-full border border-creaw-line bg-white text-primary">
              {event.icon}
            </span>
            <span aria-hidden="true" className="min-h-[18px] w-0.5 flex-1 bg-creaw-line" />
          </div>
          <div className="flex flex-col gap-0.5 pb-[18px]">
            <span className="text-sm font-semibold">{event.title}</span>
            <span className="text-[12.5px] text-creaw-faint">{event.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
