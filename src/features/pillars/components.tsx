import Link from "next/link";
import { Camera, CircleCheck, Target, Users, Workflow } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { pillarLookBySlug } from "@/components/portal/pillars";
import { formatDayMonth } from "@/lib/format";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PillarRecord, PillarView } from "./api";
import type { PillarCode } from "./schemas";
import type { SubmissionRow } from "@/features/submissions/api";
import { PillarDomainTable } from "./domain-table";
import { PillarRecordsTable } from "./records-table";
import { PipelineFunnel } from "./overview/pipeline-funnel";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";

/** What one row of each pillar's register is. */
const recordKinds: Record<PillarCode, string> = {
  vawg: "Legal case",
  wee: "Grant application",
  srhr: "Outreach session",
  leadership: "Record",
  wros: "Organisation",
  skilling: "Trainee enrollment",
};

/**
 * One pillar's overview: target progress, headline counts, pipeline funnel,
 * recent field submissions, the pillar's domain register and its records.
 */
export function PillarContent({
  heading,
  pillar,
  canCreate,
  canViewSubmissions = true,
  actions,
  domainActions,
  availableCodes,
  rowActions,
  submissions = [],
  register,
}: {
  /** Page heading; the create action renders beside it. */
  heading?: PageHeadingText;
  pillar: PillarView;
  canCreate: boolean;
  canViewSubmissions?: boolean;
  actions?: React.ReactNode;
  domainActions?: React.ReactNode;
  availableCodes?: readonly PillarCode[];
  rowActions?: (row: PillarRecord) => React.ReactNode;
  submissions?: readonly SubmissionRow[];
  /** A dedicated register shown in place of the generic domain table, e.g. WRO organisations. */
  register?: React.ReactNode;
}) {
  const reached = pillar.records.length;
  const look = pillarLookBySlug(pillar.code);
  const Icon = look?.icon;
  const percent = pillar.target > 0 ? Math.round((reached / pillar.target) * 100) : 0;
  const active = pillar.records.filter((row) => row.status === "ACTIVE").length;
  // The register's own create action leads; enrolling a participant sits beside it.
  const headingActions = (
    <>
      {canCreate && actions}
      {domainActions}
    </>
  );
  return (
    <div className="flex flex-col gap-[22px]">
      {heading && <PageHeading {...heading} actions={headingActions} />}
      <div className="flex flex-wrap items-center gap-2" aria-label="Pillar navigation">
        {(
          availableCodes ?? (["vawg", "wee", "srhr", "leadership", "wros", "skilling"] as const)
        ).map((code) => {
          const tab = pillarLookBySlug(code);
          const on = code === pillar.code;
          return (
            <Link
              key={code}
              href={`/pillars/${code}`}
              aria-current={on ? "page" : undefined}
              className="flex items-center gap-2 rounded-[10px] border border-creaw-line-strong bg-white px-4 py-[9px] text-sm font-semibold text-creaw-body"
              style={
                on
                  ? { backgroundColor: pillar.tint, color: pillar.color, borderColor: pillar.color }
                  : undefined
              }
            >
              <span
                aria-hidden="true"
                className="size-[9px] rounded-full"
                style={{ backgroundColor: tab?.color }}
              />
              {tab?.name ?? code}
            </Link>
          );
        })}
      </div>
      {!pillar.hasPipeline && (
        <AlertBanner tone="info">
          <strong>No pipeline configured.</strong> This pillar exists in the registry but has no
          stages yet. Configure its pipeline before enrolling participants.
        </AlertBanner>
      )}
      <section
        className="flex flex-wrap items-center gap-6 rounded-2xl border border-l-[5px] border-creaw-line bg-white p-6"
        style={{ borderLeftColor: pillar.color }}
      >
        <div
          aria-hidden="true"
          className="flex size-[60px] shrink-0 items-center justify-center rounded-[14px] font-heading text-2xl font-bold"
          style={{ backgroundColor: pillar.tint, color: pillar.color }}
        >
          {Icon ? <Icon size={30} /> : pillar.name.slice(0, 2)}
        </div>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
          <h2 className="font-heading text-[26px] font-bold leading-tight">{pillar.fullName}</h2>
          <p className="text-sm text-creaw-faint">
            {pillar.leadUserId ? "Pillar lead assigned" : "Pillar lead not assigned"} ·{" "}
            {pillar.hasPipeline ? `${pillar.stages.length} pipeline stages` : "Pipeline pending"}
          </p>
        </div>
        <div className="flex flex-[1_1_280px] flex-col gap-2">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-creaw-body">2026 target progress</span>
            <strong>
              {pillar.target > 0
                ? `${reached.toLocaleString()} / ${pillar.target.toLocaleString()} ${look?.unit ?? ""}`
                : "No target set"}
            </strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F4EEE8]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, percent)}%`, backgroundColor: pillar.color }}
            />
          </div>
        </div>
      </section>
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          inline
          label={pillar.code === "wros" ? "Partner organisations" : "Programme records"}
          value={reached.toLocaleString()}
          icon={<Users />}
          tint={pillar.tint}
          ink={pillar.color}
          detail={<StatusBadge tone="neutral">in this pillar</StatusBadge>}
        />
        <MetricCard
          inline
          label="Active records"
          value={active.toLocaleString()}
          icon={<CircleCheck />}
          tint={pillar.tint}
          ink={pillar.color}
          detail={
            <StatusBadge tone={active === reached ? "success" : "neutral"}>
              of {reached.toLocaleString()}
            </StatusBadge>
          }
        />
        <MetricCard
          inline
          label="Annual target"
          value={pillar.target > 0 ? pillar.target.toLocaleString() : "—"}
          icon={<Target />}
          tint={pillar.tint}
          ink={pillar.color}
          detail={
            <StatusBadge tone={pillar.target > 0 ? "info" : "neutral"}>
              {pillar.target > 0 ? `${percent}% reached` : "No target set"}
            </StatusBadge>
          }
        />
        <MetricCard
          inline
          label="Pipeline stages"
          value={pillar.stages.length}
          icon={<Workflow />}
          tint={pillar.tint}
          ink={pillar.color}
          detail={<StatusBadge tone="neutral">configured</StatusBadge>}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <PipelineFunnel pillar={pillar} />
        <section className="flex flex-col gap-1.5 rounded-2xl border border-creaw-line bg-white p-6">
          <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-[22px] font-bold">Field submissions</h2>
              <p className="mt-0.5 text-[13.5px] text-creaw-faint">
                {pillar.name} data captured on mobile
              </p>
            </div>
            {canViewSubmissions && (
              <Link href="/field-submissions" className="text-sm font-semibold text-primary">
                View all
              </Link>
            )}
          </div>
          {submissions.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 border-b border-[#F7F2EC] py-2.5"
            >
              <span className="flex size-[54px] shrink-0 items-center justify-center rounded-[10px] bg-[repeating-linear-gradient(135deg,#EFE7DE_0_6px,#F7F2EC_6px_12px)] text-[#A39A92]">
                <Camera size={20} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-[12.5px] text-creaw-faint">
                  {item.type} · {formatDayMonth(item.captured)}
                </p>
              </div>
              <StatusBadge
                tone={
                  item.status === "Approved"
                    ? "success"
                    : item.status === "Flagged"
                      ? "danger"
                      : "warning"
                }
              >
                {item.status}
              </StatusBadge>
            </div>
          ))}
          {submissions.length === 0 && (
            <p className="py-6 text-center text-sm text-creaw-faint">
              No mobile submissions this week.
            </p>
          )}
        </section>
      </div>
      {register}
      {!register && pillar.domain && (
        <PillarDomainTable
          domain={pillar.domain}
          actions={heading ? undefined : domainActions}
          recordKind={recordKinds[pillar.code]}
          pillarName={pillar.name}
          accent={pillar.color}
          tint={pillar.tint}
          // A grant application is worked on its own sign-off page.
          recordPath={pillar.code === "wee" ? "/grants/" : undefined}
        />
      )}
      <PillarRecordsTable
        records={pillar.records}
        label={`${pillar.name} programme records`}
        headerActions={!heading && canCreate ? actions : undefined}
        // Sorting needs browser state, so each row's controls are rendered here and handed over.
        actions={
          rowActions && Object.fromEntries(pillar.records.map((row) => [row.id, rowActions(row)]))
        }
      />
    </div>
  );
}
