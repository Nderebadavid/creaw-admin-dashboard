import type { AuditRow } from "../api";
import { displayDate, sourceLabel } from "./columns";

/** Pretty-prints stored JSON; values were redacted server-side before storage. */
function formattedJson(text: string | null) {
  if (!text) return "—";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** The expanded view of one audit entry: where it came from, then input/before/after. */
export function AuditEntryDetail({ row }: { row: AuditRow }) {
  const origin = row.endpoint ?? row.event_name ?? "—";
  return (
    <div>
      <p className="mb-2.5 font-mono text-[12.5px] text-creaw-body">
        #{row.id} · {sourceLabel(row.source)} · {origin} · {displayDate(row.performed_at)}
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(
          [
            ["Input", row.input_payload],
            ["Before", row.previous_state],
            ["After", row.new_state],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-creaw-faint">
              {label}
            </span>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-creaw-line bg-white p-3 text-xs">
              {formattedJson(value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
