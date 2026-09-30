import type { DashboardOverview } from "../api";

const card = "rounded-2xl border border-creaw-line bg-white p-5 sm:p-6";

/** Paired monthly bars: new enrollments against completions. */
export function MonthlyChart({
  monthly,
  year,
}: {
  monthly: DashboardOverview["monthly"];
  year: string;
}) {
  const max = Math.max(1, ...monthly.flatMap((row) => [row.newCount, row.completedCount]));
  const yMax = Math.ceil((max * 1.15) / 10) * 10 || 10;
  return (
    <section aria-labelledby="monthly-title" className={card}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="monthly-title" className="font-heading text-[22px] font-bold">
            Monthly enrollments
          </h2>
          <p className="text-[13.5px] text-creaw-faint">New vs. completed, all pillars</p>
        </div>
        <form action="/dashboard" className="flex items-center gap-2">
          <label htmlFor="dashboard-year" className="sr-only">
            Year
          </label>
          <select
            id="dashboard-year"
            name="year"
            defaultValue={year}
            className="h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2.5 text-[13px] font-semibold"
          >
            <option>2026</option>
            <option>2025</option>
          </select>
          <button
            type="submit"
            className="h-[34px] rounded-lg bg-primary px-3 text-xs font-semibold text-white"
          >
            Apply
          </button>
        </form>
      </div>
      <div className="mb-4 flex gap-4 text-[13px] text-creaw-body">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm bg-creaw-orange" /> New enrollments
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm bg-[#E6B069]" /> Completed
        </span>
      </div>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="flex h-44 flex-col justify-between pb-6 text-right text-[11px] text-creaw-faint"
        >
          <span>{yMax}</span>
          <span>{yMax / 2}</span>
          <span>0</span>
        </div>
        <div
          className="flex h-44 flex-1 items-end gap-1 sm:gap-2"
          role="img"
          aria-label={`Monthly enrollments for ${year}: ${monthly.map((row) => `${row.month} ${row.newCount} new, ${row.completedCount} completed`).join("; ")}`}
        >
          {monthly.map((row) => (
            <div
              key={row.month}
              title={`${row.month} ${year}: ${row.newCount} new, ${row.completedCount} completed`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <div className="flex h-[138px] w-full items-end justify-center gap-0.5">
                <div
                  className="w-2.5 max-w-[44%] rounded-t bg-creaw-orange"
                  style={{ height: `${(row.newCount / yMax) * 100}%` }}
                />
                <div
                  className="w-2.5 max-w-[44%] rounded-t bg-[#E6B069]"
                  style={{ height: `${(row.completedCount / yMax) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-creaw-faint">{row.month}</span>
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
      <h2 id="distribution-title" className="font-heading text-[22px] font-bold">
        Participants by pillar
      </h2>
      <p className="mb-5 text-[13.5px] text-creaw-faint">
        {total.toLocaleString()} current enrollments · some participants hold two
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative size-40 shrink-0">
          <svg viewBox="0 0 100 100" role="img" aria-label={label} className="-rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#F4EEE8" strokeWidth="14" />
            {segments.map((item) => (
              <circle
                key={item.name}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="14"
                strokeDasharray={`${item.length} ${circumference - item.length}`}
                strokeDashoffset={-item.start}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-3xl font-bold">{total.toLocaleString()}</span>
            <span className="text-xs text-creaw-faint">enrollments</span>
          </div>
        </div>
        <ul className="min-w-40 flex-1 space-y-2 text-sm">
          {distribution.map((item) => (
            <li key={item.name} className="flex items-center gap-2">
              <i className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="flex-1">{item.name}</span>
              <span className="font-semibold tabular-nums">{item.count}</span>
              <span className="w-10 text-right text-creaw-faint tabular-nums">
                {share(item.count)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
