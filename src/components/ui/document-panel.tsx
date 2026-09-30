import type { ReactNode } from "react";
import { DocumentRow } from "./record-parts";

export interface DocumentItem {
  id: string | number;
  name: string;
  requirement?: string;
  description?: string;
  action?: ReactNode;
}

/** A record's documents, with each required one that is still missing flagged below. */
export function DocumentPanel({
  documents,
  requirements = [],
  title = "Documents",
}: {
  documents: readonly DocumentItem[];
  requirements?: readonly string[];
  title?: string;
}) {
  const missing = requirements.filter(
    (requirement) => !documents.some((document) => document.requirement === requirement)
  );
  const total = documents.length + missing.length;
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-2xl border border-creaw-line bg-white p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[22px] font-bold">{title}</h2>
        {total > 0 && (
          <span className="text-[13.5px] text-creaw-faint">
            {documents.length} of {total} attached
          </span>
        )}
      </div>
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          name={document.name}
          detail={document.description ?? "On file"}
          action={document.action}
        />
      ))}
      {missing.map((requirement) => (
        <DocumentRow
          key={requirement}
          missing
          name={requirement.charAt(0).toUpperCase() + requirement.slice(1)}
          detail={`Missing: ${requirement}`}
        />
      ))}
      {!documents.length && !missing.length && (
        <p className="text-sm text-creaw-faint">No documents added.</p>
      )}
    </section>
  );
}
