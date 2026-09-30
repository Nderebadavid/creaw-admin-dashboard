import Link from "next/link";
import { Camera, CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardOverview } from "../api";

const card = "rounded-2xl border border-creaw-line bg-white p-5 sm:p-6";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-[22px] font-bold">{title}</h2>
        <p className="text-[13.5px] text-creaw-faint">{subtitle}</p>
      </div>
      {href && (
        <Link href={href} className="text-sm font-semibold text-primary">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/** The most urgent overdue report, plus how many more are late. */
export function OverdueAlert({ alerts }: { alerts: string[] }) {
  if (!alerts.length) return null;
  const more = alerts.length - 1;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F4CEC8] bg-[#FCE9E6] px-5 py-4 text-sm text-[#A23227]"
    >
      <CircleAlert size={20} aria-hidden="true" className="shrink-0" />
      <p className="min-w-0 flex-1">
        <strong>{alerts[0]}.</strong>
        {more > 0 && (
          <span>
            {" "}
            {more} more report{more === 1 ? " is" : "s are"} overdue.
          </span>
        )}
      </p>
      <Link href="/reporting" className="font-semibold text-creaw-danger">
        Open reporting calendar →
      </Link>
    </div>
  );
}

/** Up to four unapproved mobile submissions, as cards. */
export function FieldPreview({
  submissions,
  canView,
}: {
  submissions: DashboardOverview["recentSubmissions"];
  canView: boolean;
}) {
  return (
    <section className={card}>
      <SectionHeader
        title="Latest from the field"
        subtitle="Submissions synced from the MERL mobile app"
        href={canView ? "/field-submissions" : undefined}
        linkLabel="View all"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {submissions.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-xl border border-creaw-line">
            <div className="flex h-20 items-end justify-between bg-[repeating-linear-gradient(135deg,#EFE7DE_0_8px,#F7F2EC_8px_16px)] p-2">
              <span className="rounded bg-white/80 px-2 py-0.5 text-[10px] text-creaw-faint">
                mobile submission
              </span>
              <Camera size={16} aria-hidden="true" className="text-creaw-faint" />
            </div>
            <div className="space-y-1 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {item.pillar}
              </p>
              <p className="text-sm font-semibold">{item.title}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-creaw-faint">
                  {new Date(item.captured).getDate()} {MONTHS[new Date(item.captured).getMonth()]}
                </p>
                <StatusBadge tone={item.status === "Flagged" ? "danger" : "warning"}>
                  {item.status}
                </StatusBadge>
              </div>
            </div>
          </article>
        ))}
        {submissions.length === 0 && (
          <p className="text-sm text-creaw-faint">No submissions to review.</p>
        )}
      </div>
    </section>
  );
}

/** Reports not yet submitted, with a month/day badge like a calendar leaf. */
export function CalendarPreview({ reports }: { reports: DashboardOverview["upcomingReports"] }) {
  return (
    <section className={card}>
      <SectionHeader
        title="Reporting calendar"
        subtitle="Next 30 days"
        href="/reporting"
        linkLabel="See all"
      />
      <ul className="divide-y divide-creaw-divider">
        {reports.map((report) => {
          const due = new Date(`${report.periodEnd}T00:00:00`);
          return (
            <li key={report.id} className="flex items-center gap-3 py-3">
              <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-creaw-canvas leading-tight">
                <span className="text-[11px] font-semibold uppercase text-creaw-faint">
                  {MONTHS[due.getMonth()]}
                </span>
                <span className="font-heading text-lg font-bold">{due.getDate()}</span>
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{report.title}</p>
              <StatusBadge tone={report.status === "overdue" ? "danger" : "warning"}>
                {report.status}
              </StatusBadge>
            </li>
          );
        })}
        {reports.length === 0 && (
          <li className="py-3 text-sm text-creaw-faint">No reports need attention.</li>
        )}
      </ul>
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Latest audit entries: who did what to which kind of record. */
export function ActivityFeed({ activity }: { activity: DashboardOverview["recentActivity"] }) {
  if (!activity.length) return null;
  return (
    <section className={card}>
      <SectionHeader title="Recent activity" subtitle="From the audit log, portal and mobile" />
      <ul className="divide-y divide-creaw-divider">
        {activity.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3 text-sm">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-creaw-canvas text-xs font-bold text-creaw-body"
            >
              {initials(item.who)}
            </span>
            <p className="min-w-0 flex-1">
              <strong>{item.who}</strong> <span className="lowercase">{item.action}</span>{" "}
              {item.entity.replaceAll("_", " ")}
            </p>
            <time className="text-xs text-creaw-faint" dateTime={item.when}>
              {new Date(item.when).getDate()} {MONTHS[new Date(item.when).getMonth()]}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
