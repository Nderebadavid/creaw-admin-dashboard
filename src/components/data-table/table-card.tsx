"use client";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableChip {
  label: string;
  active: boolean;
  onSelect: () => void;
}

/**
 * The design's list card: title and subtitle, filter chips, a "Filter this list"
 * search box and actions (e.g. CSV) in the header; the table and pager below.
 */
export function TableCard({
  title,
  subtitle,
  chips,
  chipsLabel = "Filter",
  search,
  filters,
  actions,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  chips?: TableChip[];
  /** Accessible name for the chip group, e.g. "Pillar filter". */
  chipsLabel?: string;
  search?: { value: string; onChange: (value: string) => void; label: string };
  /** Extra filter controls, such as a county select. */
  filters?: ReactNode;
  actions?: ReactNode;
  /** Usually a Pagination. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-creaw-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-creaw-divider px-5 py-4">
        <div>
          <h2 className="font-heading text-[22px] font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-creaw-faint">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {chips && (
            <div role="group" aria-label={chipsLabel} className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={chip.active}
                  onClick={chip.onSelect}
                  className={cn(
                    "rounded-[9px] border px-3 py-[7px] text-[13px] font-semibold",
                    chip.active
                      ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary"
                      : "border-creaw-line-strong bg-white text-creaw-body"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
          {filters}
          {search && (
            <label className="flex h-10 w-60 max-w-full items-center gap-2 rounded-[10px] border border-creaw-line bg-creaw-canvas px-3">
              <Search size={18} aria-hidden="true" className="shrink-0 text-creaw-faint" />
              <span className="sr-only">{search.label}</span>
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder="Filter this list"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          )}
          {actions}
        </div>
      </div>
      {children}
      {footer && <div className="border-t border-creaw-divider px-5">{footer}</div>}
    </section>
  );
}
