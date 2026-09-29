"use client";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}
export function FilterBar({
  search,
  onSearchChange,
  chips = [],
  onClear,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  chips?: readonly FilterChip[];
  onClear?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 py-4">
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search records"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search records…"
          className="min-w-48 flex-1 rounded-lg border bg-white px-3 py-2"
        />
        {children}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}`}
              className="flex items-center gap-2 rounded-full border bg-accent px-3 py-1 text-sm"
            >
              {chip.label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
