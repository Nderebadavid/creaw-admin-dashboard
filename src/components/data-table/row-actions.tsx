"use client";
import { EllipsisVertical, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown in red below a divider, like the design's closing "Deactivate" or "Withdraw". */
  destructive?: boolean;
}
export function RowActions({ label, actions }: { label: string; actions: readonly RowAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="inline-flex size-[34px] items-center justify-center rounded-lg border border-transparent text-creaw-body hover:border-creaw-line hover:bg-[#F4EEE8] aria-expanded:border-creaw-line aria-expanded:bg-[#F4EEE8]"
      >
        <EllipsisVertical aria-hidden="true" size={20} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[214px] rounded-xl p-1.5 shadow-[0_16px_40px_-12px_rgba(34,28,24,.3)] ring-creaw-line"
      >
        {actions.map((action, index) => (
          <div key={action.label}>
            {action.destructive && index > 0 && (
              <DropdownMenuSeparator className="bg-creaw-divider" />
            )}
            <DropdownMenuItem
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onClick={action.onSelect}
              className="gap-2.5 rounded-lg px-2.5 py-[9px] text-sm"
            >
              {action.icon && (
                <action.icon
                  aria-hidden="true"
                  className={action.destructive ? "size-[18px]" : "size-[18px] text-creaw-faint"}
                />
              )}
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
