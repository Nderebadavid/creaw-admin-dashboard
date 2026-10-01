import Link from "next/link";
import { PillarChip } from "@/components/portal/pillars";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { ProjectCard } from "./schemas";

const kes = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

/**
 * A pillar's (or every visible pillar's) active projects: donor, end date and the grant
 * figures the caller may see. Used on the dashboard and on each pillar page.
 */
export function ProjectsPanel({
  projects,
  title = "Projects",
  subtitle = "Active funded initiatives",
  showPillar = false,
}: {
  projects: readonly ProjectCard[];
  title?: string;
  subtitle?: string;
  /** Show each project's pillar chip (when the list spans several pillars). */
  showPillar?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2.5 rounded-2xl border border-creaw-line bg-white p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[22px] font-bold">{title}</h2>
          <p className="mt-0.5 text-[13.5px] text-creaw-faint">{subtitle}</p>
        </div>
        <Link href="/projects" className="text-sm font-semibold text-primary">
          All projects
        </Link>
      </div>
      <ul>
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-creaw-divider py-2.5 last:border-b-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{project.name}</span>
              <span className="truncate text-[12.5px] text-creaw-faint">
                {project.donor_name ?? "No donor"}
                {project.end_date ? ` · ends ${formatDate(project.end_date)}` : ""}
              </span>
            </span>
            {showPillar && <PillarChip id={project.pillar_id} fallback="Pillar" />}
            {project.applications_count !== null && (
              <span className="text-[13px] text-creaw-ink-soft">
                {project.applications_count} application
                {project.applications_count === 1 ? "" : "s"}
              </span>
            )}
            {project.awarded_total !== null && (
              <span className="text-[13px] text-creaw-ink-soft">
                {kes(project.awarded_total)} awarded
              </span>
            )}
            {project.reports_overdue ? (
              <StatusBadge tone="danger">{project.reports_overdue} overdue</StatusBadge>
            ) : null}
          </li>
        ))}
        {projects.length === 0 && (
          <li className="py-3 text-sm text-creaw-faint">No active projects.</li>
        )}
      </ul>
    </section>
  );
}
