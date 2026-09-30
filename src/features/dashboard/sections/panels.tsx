import { MONTHS_SHORT, formatDayMonth, initials, titleCase } from "@/lib/format";
import Link from "next/link";
import { Camera, CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { reportStatus } from "@/features/reporting/status";
import type { DashboardOverview } from "../api";

const card = "flex flex-col rounded-2xl border border-creaw-line bg-white p-6";

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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-[22px] font-bold">{title}</h2>
        <p className="mt-0.5 text-[13.5px] text-creaw-faint">{subtitle}</p>
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
  // "Report (Donor) is 12 days overdue": the report is bold, the lateness is not.
  const [, report, lateness] = /^(.*?)( is \d+ days? overdue)$/.exec(alerts[0]) ?? [];
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3.5 rounded-xl border border-[#F3CCC6] bg-creaw-danger-soft px-[18px] py-3.5 text-[14.5px] text-[#6E2019]"
    >
      <CircleAlert size={22} aria-hidden="true" className="shrink-0 text-creaw-danger" />
      <p className="min-w-60 flex-1">
        <strong>{report ?? alerts[0]}</strong>
        {lateness ?? ""}.
        {more > 0 && (
          <span>
            {" "}
            {more} more report{more === 1 ? " is" : "s are"} overdue.
          </span>
        )}
      </p>
      <Link href="/reporting" className="text-sm font-semibold text-creaw-danger">
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
    <section className={`${card} gap-4`}>
      <SectionHeader
        title="Latest from the field"
        subtitle="Submissions synced from the MERL mobile app"
        href={canView ? "/field-submissions" : undefined}
        linkLabel="View all"
      />
      <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-4">
        {submissions.map((item) => {
          const body = (
            <>
              <div className="flex h-[110px] items-end justify-between bg-[repeating-linear-gradient(135deg,#EFE7DE_0_8px,#F7F2EC_8px_16px)] p-2">
                <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10.5px] text-creaw-faint">
                  photo · {(item.type ?? "field update").toLowerCase()}
                </span>
                <span className="flex items-center rounded-full bg-creaw-ink/60 p-1 text-white">
                  <Camera size={13} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p
                  className="text-[11.5px] font-bold uppercase tracking-[.06em] text-primary"
                  style={{ color: item.pillarColor }}
                >
                  {item.pillar}
                  {item.type ? ` · ${item.type}` : ""}
                </p>
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                <p className="text-[12.5px] text-creaw-faint">{formatDayMonth(item.captured)}</p>
                <span className="mt-1 self-start">
                  <StatusBadge tone={item.status === "Flagged" ? "danger" : "warning"}>
                    {item.status}
                  </StatusBadge>
                </span>
              </div>
            </>
          );
          const className =
            "flex flex-col overflow-hidden rounded-xl border border-creaw-line bg-white text-left";
          return canView ? (
            <Link
              key={item.id}
              href="/field-submissions"
              aria-label={`Review ${item.title}`}
              className={`${className} hover:border-[#E2C7B6]`}
            >
              {body}
            </Link>
          ) : (
            <article key={item.id} className={className}>
              {body}
            </article>
          );
        })}
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
    <section className={`${card} gap-2.5`}>
      <SectionHeader
        title="Reporting calendar"
        subtitle="Next 30 days"
        href="/reporting"
        linkLabel="See all"
      />
      <ul>
        {reports.map((report) => {
          const dueDate = report.dueDate ?? report.periodEnd;
          const due = new Date(`${dueDate}T00:00:00`);
          const status = reportStatus({ status: report.status, dueDate });
          return (
            <li key={report.key ?? report.id}>
              <Link
                href="/reporting"
                className="flex items-center gap-3 border-b border-creaw-divider py-2.5 hover:bg-creaw-surface"
              >
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-[10px] bg-creaw-canvas leading-[1.1]">
                  <span className="text-[10.5px] font-semibold uppercase text-creaw-faint">
                    {MONTHS_SHORT[due.getMonth()]}
                  </span>
                  <span className="font-heading text-[19px] font-bold">{due.getDate()}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{report.title}</span>
                  {report.project && (
                    <span className="truncate text-[12.5px] text-creaw-faint">
                      {report.project}
                    </span>
                  )}
                </span>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </Link>
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

/** Past-tense verbs for audit action codes; other codes are shown lower-cased. */
const verbs: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "removed",
  DOWNLOAD: "downloaded",
  VIEW: "viewed",
  REVEAL: "revealed a sensitive field on",
  EXPORT: "exported",
  LOGIN: "signed in to",
  LOGOUT: "signed out of",
};

/** Latest audit entries: who did what to which record, and through which channel. */
export function ActivityFeed({
  activity,
  canViewAudit = false,
}: {
  activity: DashboardOverview["recentActivity"];
  canViewAudit?: boolean;
}) {
  if (!activity.length) return null;
  return (
    <section className={`${card} gap-1.5`}>
      <div className="mb-1.5">
        <SectionHeader
          title="Recent activity"
          subtitle="From the audit log, portal and mobile"
          href={canViewAudit ? "/audit" : undefined}
          linkLabel="Audit log"
        />
      </div>
      <ul>
        {activity.map((item) => {
          const entity = item.entity.replaceAll("_", " ");
          return (
            <li
              key={item.id}
              className="flex items-start gap-3.5 border-b border-[#F7F2EC] py-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#F7E6DC] text-xs font-bold text-[#8C3F20]"
              >
                {initials(item.who)}
              </span>
              <div className="min-w-0 flex-1 leading-[1.45]">
                <p>
                  <strong>{item.who}</strong> {verbs[item.action] ?? item.action.toLowerCase()}{" "}
                  <span className="font-semibold text-primary">
                    {entity}
                    {item.entityId ? ` #${item.entityId}` : ""}
                  </span>
                </p>
                <p className="text-[12.5px] text-creaw-faint">
                  {titleCase(item.entity)} · via {item.source === "KAFKA" ? "system job" : "portal"}
                </p>
              </div>
              <time
                className="whitespace-nowrap text-[12.5px] text-creaw-faint"
                dateTime={item.when}
              >
                {formatDayMonth(item.when)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
