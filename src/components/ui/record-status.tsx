import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { titleCase } from "@/lib/format";

const tones: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  DISABLED: "warning",
};

/** A record's own status (the standard `status` column): Active, Inactive, Disabled… */
export function RecordStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={tones[status] ?? "neutral"}>{titleCase(status)}</StatusBadge>;
}
