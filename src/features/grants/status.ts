import type { StatusTone } from "@/components/ui/status-badge";
import { titleCase } from "@/lib/format";

/** Badge tone for a grant application's sign-off status. */
export const grantTone = (status: string): StatusTone =>
  status === "APPROVED"
    ? "success"
    : status === "DECLINED"
      ? "danger"
      : status === "REVIEWED"
        ? "warning"
        : "neutral";

/** Sign-off stage label; ACTIVE is a new application not yet prepared. */
export const stageLabel = (status: string) => (status === "ACTIVE" ? "New" : titleCase(status));
