import Link from "next/link";
import type { DashboardOverview } from "../api";
import type { LocationQuery } from "@/lib/api/location";
import { ChartFilters } from "./chart-filters";

const card = "flex flex-col gap-[18px] rounded-2xl border border-creaw-line bg-white p-6";

/** The years the chart can show: this one and the six before it. */
const chartYears = (latest: number) =>
  Array.from({ length: 7 }, (_, back) => String(latest - back));

/** Paired monthly bars: new enrollments against completions. */
export function MonthlyChart({
  monthly,
  year,
  pillar,
  pillars = [],
  funnel,
  location,
}: {
  monthly: DashboardOverview["monthly"];
  year: string;
  /** The pillar slug the chart is narrowed to; every pillar when omitted. */
  pillar?: string;
  pillars?: DashboardOverview["pillars"];
  /** The funnel's pillar slug, kept when the chart's filters change. */
  funnel?: string;
  /** The dashboard's location, kept when the chart's filters change. */
  location?: LocationQuery;
}) {
  const max = Math.max(1, ...monthly.flatMap((row) => [row.newCount, row.completedCount]));
  const yMax = Math.ceil((max * 1.15) / 10) * 10 || 10;
  const selected = pillars.find((item) => item.code === pillar);
  return (
    <section aria-labelledby="monthly-title" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="monthly-title" className="font-heading text-[22px] font-bold">
            Monthly enrollments
          </h2>
          <p className="mt-0.5 text-[13.5px] text-creaw-faint">
            New vs. completed, all pillars · {selected?.name ?? "all pillars"}
          </p>
        </div>
        <ChartFilters
          year={year}
          years={chartYears(new Date().getFullYear())}
          pillar={selected?.code ?? ""}
          pillars={pillars}
          funnel={funnel}
          location={location}
        />
      </div>
      <div className="flex gap-[18px] text-[13px] text-creaw-body">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-creaw-orange" /> New enrollments
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-[#F2B25C]" /> Completed
        </span>
      </div>
      <div className="flex h-[230px] gap-3">
        <div
          aria-hidden="true"
          className="flex w-7 flex-col justify-between pb-[22px] text-right text-xs text-[#A39A92]"
        >
          <span>{yMax}</span>
          <span>{yMax / 2}</span>
          <span>0</span>
        </div>
        <div
          className="grid flex-1 grid-cols-12 items-end gap-1.5"
          role="img"
          aria-label={`Monthly enrollments for ${year}: ${monthly.map((row) => `${row.month} ${row.newCount} new, ${row.completedCount} completed`).join("; ")}`}
        >
          {monthly.map((row) => (
            <div
              key={row.month}
              title={`${row.month} ${year}: ${row.newCount} new, ${row.completedCount} completed`}
              className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
            >
              <div className="flex h-full w-full items-end justify-center gap-[3px]">
                <div
                  className="w-[38%] max-w-3.5 rounded-t bg-creaw-orange"
                  style={{ height: `${(row.newCount / yMax) * 100}%` }}
                />
                <div
                  className="w-[38%] max-w-3.5 rounded-t bg-[#F2B25C]"
                  style={{ height: `${(row.completedCount / yMax) * 100}%` }}
                />
              </div>
              <span className="h-4 text-xs text-creaw-faint">{row.month}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Ring chart of current enrollments per pillar, with a legend of counts and shares. */
export function ParticipantsDonut({
  distribution,
}: {
  distribution: DashboardOverview["participantDistribution"];
}) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // Each segment starts where the previous ones end around the ring.
  const segments = distribution.map((item, index) => ({
    ...item,
    length: total ? (item.count / total) * circumference : 0,
    start: distribution
      .slice(0, index)
      .reduce((sum, prior) => sum + (total ? (prior.count / total) * circumference : 0), 0),
  }));
  const label = `Participants by pillar: ${distribution.map((item) => `${item.name} ${item.count} (${share(item.count)}%)`).join(", ")}`;

  return (
    <section aria-labelledby="distribution-title" className={card}>
      <div>
        <h2 id="distribution-title" className="font-heading text-[22px] font-bold">
          Participants by pillar
        </h2>
        <p className="mt-0.5 text-[13.5px] text-creaw-faint">
          {total.toLocaleString()} current enrollments · some participants hold two
        </p>
      </div>
      <div className="relative mx-auto size-[180px] shrink-0">
        <svg viewBox="0 0 100 100" role="img" aria-label={label} className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#F4EEE8" strokeWidth="16" />
          {segments.map((item) => (
            <circle
              key={item.name}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={`${item.length} ${circumference - item.length}`}
              strokeDashoffset={-item.start}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-bold leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-[12.5px] text-creaw-faint">enrollments</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {distribution.map((item) => {
          const row = (
            <>
              <i
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 text-creaw-ink-soft">{item.name}</span>
              <span className="font-semibold tabular-nums">{item.count}</span>
              <span className="w-10 text-right text-creaw-faint tabular-nums">
                {share(item.count)}%
              </span>
            </>
          );
          const className = "flex items-center gap-2.5 rounded-lg px-2 py-1.5";
          return (
            <li key={item.name}>
              {item.href ? (
                <Link href={item.href} className={`${className} hover:bg-accent`}>
                  {row}
                </Link>
              ) : (
                <div className={className}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
