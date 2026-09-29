import Link from "next/link";
import { Activity, Camera, CalendarClock, Users } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { MetricCard } from "@/components/ui/metric-card";
import { PillarCard } from "@/components/ui/pillar-card";
import type { DashboardOverview } from "./api";

export function DashboardContent({
  overview,
  year,
  canViewSubmissions = true,
}: {
  overview: DashboardOverview;
  year: string;
  canViewSubmissions?: boolean;
}) {
  const max = Math.max(1, ...overview.monthly.flatMap((row) => [row.newCount, row.completedCount]));
  const totalDistribution = Math.max(
    1,
    overview.participantDistribution.reduce((sum, row) => sum + row.count, 0)
  );
  return (
    <div className="space-y-6">
      {overview.reportingAlerts.length > 0 && (
        <AlertBanner tone="danger">
          <strong>{overview.reportingAlerts[0]}</strong>
          <span className="ml-2">Review the reporting calendar and follow up with the owner.</span>
        </AlertBanner>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active participants"
          value={overview.activeParticipants.toLocaleString()}
          icon={<Users />}
          detail={<span className="text-xs text-creaw-muted">Across your pillar scope</span>}
        />
        <MetricCard
          label="New this quarter"
          value={overview.newThisQuarter.toLocaleString()}
          icon={<Activity />}
          detail={<span className="text-xs text-creaw-muted">Jul–Sep {year}</span>}
        />
        <MetricCard
          label="Submissions to review"
          value={overview.pendingSubmissions.toLocaleString()}
          icon={<Camera />}
          detail={
            canViewSubmissions ? (
              <Link href="/field-submissions" className="text-xs font-semibold text-primary">
                From mobile →
              </Link>
            ) : (
              <span className="text-xs text-creaw-muted">From mobile</span>
            )
          }
        />
        <MetricCard
          label="Reports overdue"
          value={overview.overdueReports.toLocaleString()}
          icon={<CalendarClock />}
          detail={<span className="text-xs text-creaw-muted">Needs follow-up</span>}
        />
      </div>
      <section aria-labelledby="pillar-glance">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pillar-glance" className="font-heading text-2xl font-bold">
              Pillars at a glance
            </h2>
            <p className="text-sm text-creaw-muted">Programme reach in your permitted pillars</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.pillars.map((pillar) =>
            pillar.target === 0 ? (
              <article
                key={pillar.id}
                className="rounded-2xl border border-t-4 bg-white p-5"
                style={{ borderTopColor: pillar.color }}
              >
                <h3 className="font-heading text-xl font-bold">{pillar.name}</h3>
                <p className="mt-1 text-xs text-creaw-muted">Pipeline configuration pending</p>
                <p className="mt-6 text-sm font-semibold">No target set</p>
                <Link
                  href={pillar.href}
                  className="mt-4 inline-flex text-sm font-semibold text-primary"
                >
                  Open {pillar.name} →
                </Link>
              </article>
            ) : (
              <PillarCard
                key={pillar.id}
                name={pillar.name}
                description="Programme records"
                value={pillar.reached}
                target={pillar.target}
                color={pillar.color}
                href={pillar.href}
              />
            )
          )}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <section aria-labelledby="monthly-title" className="rounded-2xl border bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="monthly-title" className="font-heading text-xl font-bold">
                Participant activity
              </h2>
              <p className="text-xs text-creaw-muted">
                New registrations and verified field updates
              </p>
            </div>
            <form action="/dashboard" className="flex items-center gap-2">
              <label htmlFor="dashboard-year" className="text-xs font-medium">
                Year
              </label>
              <select
                id="dashboard-year"
                name="year"
                defaultValue={year}
                className="rounded-lg border px-2 py-1.5 text-sm"
              >
                <option>2026</option>
                <option>2025</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
              >
                Apply
              </button>
            </form>
          </div>
          <div className="mb-4 flex gap-4 text-xs">
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-creaw-orange" /> New
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-[#E6B069]" /> Verified
            </span>
          </div>
          <div
            className="flex h-44 items-end gap-1 sm:gap-2"
            role="img"
            aria-label={`Monthly activity for ${year}: ${overview.monthly.map((row) => `${row.month} ${row.newCount} new, ${row.completedCount} verified`).join("; ")}`}
          >
            {overview.monthly.map((row) => (
              <div
                key={row.month}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="flex h-[138px] w-full items-end justify-center gap-0.5">
                  <div
                    className="w-2.5 max-w-[44%] rounded-t bg-creaw-orange"
                    style={{ height: `${Math.max(2, (row.newCount / max) * 100)}%` }}
                  />
                  <div
                    className="w-2.5 max-w-[44%] rounded-t bg-[#E6B069]"
                    style={{ height: `${Math.max(2, (row.completedCount / max) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-creaw-muted">{row.month}</span>
              </div>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="distribution-title"
          className="rounded-2xl border bg-white p-5 sm:p-6"
        >
          <h2 id="distribution-title" className="font-heading text-xl font-bold">
            Participants by pillar
          </h2>
          <p className="mb-5 text-xs text-creaw-muted">Current programme enrollments</p>
          <div className="space-y-3">
            {overview.participantDistribution.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span>{item.name}</span>
                  <span className="font-semibold tabular-nums">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-creaw-divider">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.count / totalDistribution) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-bold">Latest from the field</h2>
              <p className="text-sm text-creaw-muted">
                Submissions synced from the MERL mobile app
              </p>
            </div>
            {canViewSubmissions && (
              <Link href="/field-submissions" className="text-sm font-semibold text-primary">
                View all →
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.recentSubmissions.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border">
                <div className="flex h-20 items-end bg-[repeating-linear-gradient(135deg,#EFE7DE_0_8px,#F7F2EC_8px_16px)] p-2">
                  <span className="rounded bg-white/80 px-2 py-0.5 text-[10px] text-creaw-muted">
                    mobile submission
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {item.pillar}
                  </p>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-creaw-muted">
                    {new Date(item.captured).toLocaleDateString("en-KE", {
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    · {item.status}
                  </p>
                </div>
              </article>
            ))}
            {overview.recentSubmissions.length === 0 && (
              <p className="text-sm text-creaw-muted">No submissions to review.</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="font-heading text-xl font-bold">Reporting calendar</h2>
          <p className="mb-4 text-sm text-creaw-muted">Reports needing attention</p>
          <div className="divide-y">
            {overview.upcomingReports.map((report) => (
              <div key={report.id} className="flex items-center gap-3 py-3">
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-creaw-canvas text-xs font-semibold">
                  <span className="uppercase text-creaw-muted">
                    {new Date(report.periodEnd).toLocaleDateString("en-KE", { month: "short" })}
                  </span>
                  {new Date(report.periodEnd).getDate()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{report.title}</p>
                  <p className="text-xs capitalize text-creaw-muted">
                    {report.status} · period end
                  </p>
                </div>
              </div>
            ))}
            {overview.upcomingReports.length === 0 && (
              <p className="text-sm text-creaw-muted">No reports need attention.</p>
            )}
          </div>
        </section>
      </div>
      {overview.recentActivity.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="font-heading text-xl font-bold">Recent activity</h2>
          <p className="mb-3 text-sm text-creaw-muted">From the audit log, portal and mobile</p>
          <div className="divide-y">
            {overview.recentActivity.map((item) => (
              <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  <strong className="capitalize">{item.action.toLowerCase()}</strong>{" "}
                  {item.entity.replaceAll("_", " ")}
                </span>
                <time className="text-xs text-creaw-muted" dateTime={item.when}>
                  {new Date(item.when).toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
