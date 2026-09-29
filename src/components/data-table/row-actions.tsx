"use client";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}
export function RowActions({ label, actions }: { label: string; actions: readonly RowAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent"
      >
        <Ellipsis aria-hidden="true" size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            variant={action.destructive ? "destructive" : "default"}
            onClick={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
