import type { StatusTone } from "@/components/ui/status-badge";

/** A pending report this close to its due date is called out as "Due in N days". */
const DUE_SOON_DAYS = 14;

/** Whole days from `today` to a `YYYY-MM-DD` date; negative once it has passed. */
export function daysUntil(date: string, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(`${date}T00:00:00`).getTime() - start) / 86_400_000);
}

/** The design's status pill for a report: label and tone from its status and due date. */
export function reportStatus(
  report: { status: string; dueDate: string },
  today = new Date()
): { label: string; tone: StatusTone } {
  if (report.status === "submitted") return { label: "Submitted", tone: "success" };
  if (report.status === "overdue") return { label: "Overdue", tone: "danger" };
  const days = daysUntil(report.dueDate, today);
  if (days === 0) return { label: "Due today", tone: "warning" };
  if (days > 0 && days <= DUE_SOON_DAYS)
    return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "warning" };
  return { label: "Upcoming", tone: "neutral" };
}
