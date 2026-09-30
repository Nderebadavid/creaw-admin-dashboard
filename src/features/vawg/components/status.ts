import type { StatusTone } from "@/components/ui/status-badge";

/** Court status labels as the design writes them. */
const labels: Record<string, string> = {
  police_investigation: "Police investigation",
  mediation: "Mediation",
  plea_taken: "Plea taken",
  mention: "Mention",
  in_hearing: "Hearing",
  judgment_delivered: "Judgment delivered",
  closed: "Closed",
};
export const courtStatusLabel = (status: string | null) =>
  status ? (labels[status] ?? status.replaceAll("_", " ")) : "Not in court";

export const courtStatusTone = (status: string | null): StatusTone =>
  status === "judgment_delivered" || status === "closed"
    ? "success"
    : status === "in_hearing" || status === "mediation"
      ? "warning"
      : status === "mention" || status === "plea_taken"
        ? "info"
        : "neutral";
