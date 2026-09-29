import Link from "next/link";
import { AlertBanner } from "@/components/ui/alert-banner";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressChart } from "@/components/ui/progress-chart";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PillarRecord, PillarView } from "./api";
import type { PillarCode } from "./schemas";
import type { SubmissionRow } from "@/features/submissions/api";
import { PillarDomainTable } from "./domain-table";

const columns: DataColumn<PillarRecord>[] = [
  {
    id: "record",
    header: "Record",
    cell: (row) => <span className="font-semibold">{row.title}</span>,
  },
  { id: "category", header: "Programme / area", cell: (row) => row.category },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</StatusBadge>
    ),
  },
  {
    id: "updated",
    header: "Updated",
    cell: (row) =>
      new Date(row.updatedAt).toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
  },
];

export function PillarContent({
  pillar,
  canCreate,
  canViewSubmissions = true,
  actions,
  domainActions,
  availableCodes,
  rowActions,
  submissions = [],
}: {
  pillar: PillarView;
  canCreate: boolean;
  canViewSubmissions?: boolean;
  actions?: React.ReactNode;
  domainActions?: React.ReactNode;
  availableCodes?: readonly PillarCode[];
  rowActions?: (row: PillarRecord) => React.ReactNode;
  submissions?: readonly SubmissionRow[];
}) {
  const reached = pillar.records.length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" aria-label="Pillar navigation">
        {(
          availableCodes ?? (["vawg", "wee", "srhr", "leadership", "wros", "skilling"] as const)
        ).map((code) => (
          <Link
            key={code}
            href={`/pillars/${code}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${code === pillar.code ? "border-primary bg-[#FBEDE5] text-primary" : "bg-white text-[#6B625B]"}`}
          >
            {
              (
                {
                  vawg: "VAWG",
                  wee: "WEE",
                  srhr: "SRHR",
                  leadership: "Leadership",
                  wros: "WROs",
                  skilling: "Skilling",
                } as const
              )[code]
            }
          </Link>
        ))}
      </div>
      {!pillar.hasPipeline && (
        <AlertBanner tone="info">
          <strong>No pipeline configured.</strong> This pillar exists in the registry but has no
          stages yet. Configure its pipeline before enrolling participants.
        </AlertBanner>
      )}
      <section
        className="flex flex-wrap items-center gap-5 rounded-2xl border border-l-[5px] bg-white p-5 sm:p-6"
        style={{ borderLeftColor: pillar.color }}
      >
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-xl font-heading text-2xl font-bold"
          style={{ backgroundColor: pillar.tint, color: pillar.color }}
        >
          {pillar.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-2xl font-bold">{pillar.fullName}</h2>
          <p className="text-sm text-[#81766d]">
            {pillar.leadUserId ? "Pillar lead assigned" : "Pillar lead not assigned"} ·{" "}
            {pillar.hasPipeline ? `${pillar.stages.length} pipeline stages` : "Pipeline pending"}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <span className="text-[#81766d]">2026 target progress</span>
            <strong>{pillar.target > 0 ? `${reached} / ${pillar.target}` : "No target set"}</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F4EEE8]">
            <div
              className="h-full rounded-full"
              style={{
                width:
                  pillar.target > 0 ? `${Math.min(100, (reached / pillar.target) * 100)}%` : "0%",
                backgroundColor: pillar.color,
              }}
            />
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={pillar.code === "wros" ? "Partner organisations" : "Programme records"}
          value={reached.toLocaleString()}
          detail={<span className="text-xs text-[#81766d]">in this pillar</span>}
        />
        <MetricCard
          label="Target"
          value={pillar.target > 0 ? pillar.target.toLocaleString() : "—"}
          detail={
            <span className="text-xs text-[#81766d]">
              {pillar.target > 0 ? "programme target" : "No target set"}
            </span>
          }
        />
        <MetricCard
          label="Pipeline stages"
          value={pillar.stages.length}
          detail={<span className="text-xs text-[#81766d]">configured</span>}
        />
        <MetricCard
          label="Active records"
          value={pillar.records.filter((row) => row.status === "ACTIVE").length}
          detail={<span className="text-xs text-[#81766d]">current</span>}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        {pillar.stageCounts ? (
          <ProgressChart
            label={`${pillar.name} recorded stage updates`}
            series={pillar.stageCounts.map((stage) => ({
              label: stage.name,
              value: stage.count,
              target: Math.max(1, reached),
              color: pillar.color,
            }))}
          />
        ) : (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-heading text-xl font-bold">{pillar.name} pathway</h2>
            <p className="mt-2 text-sm text-[#81766d]">
              {pillar.stages.length
                ? "Stage counts unavailable for this role."
                : "No stages configured yet."}
            </p>
          </section>
        )}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-heading text-xl font-bold">Pillar progress</h2>
          <p className="mt-1 text-sm text-[#81766d]">{pillar.fullName}</p>
          <div className="mt-6 text-4xl font-bold tabular-nums" style={{ color: pillar.color }}>
            {reached}
            <span className="ml-2 text-lg font-normal text-[#81766d]">
              / {pillar.target > 0 ? pillar.target : "—"}
            </span>
          </div>
          {pillar.target > 0 ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1ece6]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (reached / pillar.target) * 100)}%`,
                  backgroundColor: pillar.color,
                }}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#81766d]">No target set</p>
          )}
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold">Field submissions</h2>
            <p className="text-sm text-[#81766d]">{pillar.name} data captured on mobile</p>
          </div>
          {canViewSubmissions && (
            <Link href="/field-submissions" className="text-sm font-semibold text-primary">
              View all →
            </Link>
          )}
        </div>
        <div className="divide-y">
          {submissions.slice(0, 3).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[repeating-linear-gradient(135deg,#EFE7DE_0_6px,#F7F2EC_6px_12px)] text-[#81766d]">
                ◉
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-[#81766d]">
                  {item.type} ·{" "}
                  {new Date(item.captured).toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short",
                  })}
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
            <p className="py-4 text-sm text-[#81766d]">No mobile submissions this week.</p>
          )}
        </div>
      </section>
      {pillar.domain && <PillarDomainTable domain={pillar.domain} actions={domainActions} />}
      <section aria-labelledby="records-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="records-title" className="font-heading text-2xl font-bold">
              Programme records
            </h2>
            <p className="text-sm text-[#81766d]">
              Records in this pillar; identity details stay masked in the list.
            </p>
          </div>
          {canCreate && actions}
        </div>
        <DataTable
          columns={columns}
          rows={pillar.records}
          getRowId={(row) => row.id}
          label={`${pillar.name} programme records`}
          rowActions={rowActions}
        />
      </section>
    </div>
  );
}
