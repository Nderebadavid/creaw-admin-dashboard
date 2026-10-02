"use client";
import { MONTHS_SHORT } from "@/lib/format";
import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePopover } from "./use-popover";

import { defaultRange, isoDay, type DateRange } from "@/lib/dashboard-period";

export { defaultRange, type DateRange };

/** e.g. "07 Sep 2026", with fixed month names so every runtime renders the same text. */
export function formatRangeDate(day: string) {
  const [year, month, date] = day.split("-");
  return `${date} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

function presets(today: Date): [string, DateRange][] {
  const daysBack = (n: number) => {
    const start = new Date(today);
    start.setDate(start.getDate() - n + 1);
    return { from: isoDay(start), to: isoDay(today) };
  };
  const year = today.getFullYear();
  return [
    ["Last 7 days", daysBack(7)],
    ["Last 30 days", daysBack(30)],
    ["Last 90 days", daysBack(90)],
    ["This month", { from: isoDay(new Date(year, today.getMonth(), 1)), to: isoDay(today) }],
    ["Year to date", { from: `${year}-01-01`, to: isoDay(today) }],
    ["Last year", { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }],
  ];
}

/** Whole days in an inclusive range; zero or less when the end precedes the start or a date is cleared. */
function spanDays({ from, to }: DateRange) {
  const days =
    Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 864e5) + 1;
  return Number.isNaN(days) ? 0 : days;
}

/** A date range picker with presets; edits apply on "Apply". */
export function DateRangePicker({
  value,
  onChange,
  today = new Date(),
  hint = "filters records by their created date",
  maxDays,
  busy = false,
  compact = false,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today?: Date;
  /** What the range filters, shown under the dates. */
  hint?: string;
  /** The longest range allowed, in days. */
  maxDays?: number;
  /** A change is loading; the picker waits for it. */
  busy?: boolean;
  /** Toolbar-filter size, matching the filter dropdowns beside it. */
  compact?: boolean;
}) {
  const { ref, open, toggle, close } = usePopover();
  const [draft, setDraft] = useState(value);
  const days = spanDays(draft);
  let spanLabel = `${days} day${days === 1 ? "" : "s"}`;
  if (!draft.from || !draft.to) spanLabel = "Choose both dates";
  else if (days < 1) spanLabel = "End date is before start date";
  else if (maxDays && days > maxDays)
    spanLabel = `Choose at most ${Math.floor(maxDays / 365)} years`;
  const valid = days >= 1 && (!maxDays || days <= maxDays);

  const openPanel = () => {
    setDraft(value);
    toggle();
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-label={`Date range ${formatRangeDate(value.from)} – ${formatRangeDate(value.to)}`}
        aria-expanded={open}
        aria-busy={busy}
        disabled={busy}
        onClick={openPanel}
        className={`flex max-w-full items-center gap-2 rounded-[10px] border bg-white px-3 font-semibold text-creaw-ink-soft hover:border-[#E2C7B6] disabled:opacity-60 ${compact ? "h-10 border-creaw-line-strong text-[13.5px]" : "h-11 border-creaw-line text-sm"}`}
      >
        <CalendarRange size={18} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="truncate">
          {formatRangeDate(value.from)} – {formatRangeDate(value.to)}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-creaw-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-3.5 rounded-[14px] border border-creaw-line bg-white p-4 shadow-[0_16px_40px_-12px_rgba(34,28,24,.25)]">
          <div className="flex flex-wrap gap-1.5">
            {presets(today).map(([label, range]) => {
              const on = draft.from === range.from && draft.to === range.to;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft(range)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary" : "border-creaw-line-strong bg-white text-creaw-ink-soft"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(["from", "to"] as const).map((edge) => (
              <label key={edge} className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-creaw-body">
                  {edge === "from" ? "From" : "To"}
                </span>
                <input
                  type="date"
                  value={draft[edge]}
                  onChange={(event) => setDraft({ ...draft, [edge]: event.target.value })}
                  className="h-10 rounded-[9px] border border-creaw-line-strong px-2.5 text-sm"
                />
              </label>
            ))}
          </div>
          <p className="text-[12.5px] text-creaw-faint">
            {spanLabel} · {hint}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!valid}
              onClick={() => {
                onChange(draft);
                close();
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
