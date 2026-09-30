"use client";
import { MONTHS_SHORT } from "@/lib/format";
import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePopover } from "./use-popover";

/** Inclusive range of `YYYY-MM-DD` calendar days. */
export interface DateRange {
  from: string;
  to: string;
}

/** Local calendar day as `YYYY-MM-DD` (toISOString would shift to UTC). */
function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** e.g. "07 Sep 2026", with fixed month names so every runtime renders the same text. */
export function formatRangeDate(day: string) {
  const [year, month, date] = day.split("-");
  return `${date} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

/** The current quarter so far, e.g. 1 Jul → today. */
export function defaultRange(today: Date): DateRange {
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  return { from: isoDay(quarterStart), to: isoDay(today) };
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

/** Header control for the portal-wide created-date range; edits apply on "Apply". */
export function DateRangePicker({
  value,
  onChange,
  today = new Date(),
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today?: Date;
}) {
  const { ref, open, toggle, close } = usePopover();
  const [draft, setDraft] = useState(value);
  const days = spanDays(draft);
  let spanLabel = `${days} day${days === 1 ? "" : "s"}`;
  if (!draft.from || !draft.to) spanLabel = "Choose both dates";
  else if (days < 1) spanLabel = "End date is before start date";

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
        onClick={openPanel}
        className="flex h-11 max-w-full items-center gap-2 rounded-[10px] border border-creaw-line bg-white px-3 text-sm font-semibold text-creaw-ink-soft hover:border-[#E2C7B6]"
      >
        <CalendarRange size={18} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="truncate">
          {formatRangeDate(value.from)} – {formatRangeDate(value.to)}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-creaw-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-[54px] z-30 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-3.5 rounded-[14px] border border-creaw-line bg-white p-4 shadow-[0_16px_40px_-12px_rgba(34,28,24,.25)]">
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
            {spanLabel} · filters records by their created date
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={days < 1}
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
