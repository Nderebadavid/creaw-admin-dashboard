"use client";
import { useRouter } from "next/navigation";

const select =
  "h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2.5 text-[13px] font-semibold text-creaw-ink-soft";

/** The dashboard's filters, all kept in the URL so each picker preserves the others. */
interface DashboardFilters {
  year: string;
  /** The monthly chart's pillar slug, or "" for all pillars. */
  pillar: string;
  /** The funnel's pillar slug, or "" to let the API choose. */
  funnel?: string;
}

function dashboardHref({ year, pillar, funnel }: DashboardFilters) {
  const query = new URLSearchParams({ year });
  if (pillar) query.set("pillar", pillar);
  if (funnel) query.set("funnel", funnel);
  return `/dashboard?${query}`;
}

/** Pillar and year pickers for the monthly chart; a change reloads the dashboard with it applied. */
export function ChartFilters({
  year,
  years,
  pillar,
  pillars,
  funnel,
}: {
  year: string;
  years: readonly string[];
  /** The selected pillar slug, or "" for all pillars. */
  pillar: string;
  pillars: readonly { code: string; name: string }[];
  /** The funnel's pillar slug, kept when the chart's filters change. */
  funnel?: string;
}) {
  const router = useRouter();
  const go = (next: Partial<DashboardFilters>) =>
    router.push(dashboardHref({ year, pillar, funnel, ...next }), { scroll: false });
  return (
    <div className="flex flex-wrap gap-2">
      {pillars.length > 1 && (
        <select
          aria-label="Pillar"
          value={pillar}
          onChange={(event) => go({ pillar: event.target.value })}
          className={select}
        >
          <option value="">All pillars</option>
          {pillars.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Year"
        value={year}
        onChange={(event) => go({ year: event.target.value })}
        className={select}
      >
        {years.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}

/** Switches the pipeline funnel to another pillar, keeping the chart's filters. */
export function FunnelPicker({
  funnel,
  options,
  year,
  pillar,
}: {
  funnel: string;
  options: readonly { slug: string; name: string }[];
  year: string;
  /** The monthly chart's pillar slug, or "" for all pillars. */
  pillar: string;
}) {
  const router = useRouter();
  if (options.length < 2) return null;
  return (
    <select
      aria-label="Pipeline pillar"
      value={funnel}
      onChange={(event) =>
        router.push(dashboardHref({ year, pillar, funnel: event.target.value }), {
          scroll: false,
        })
      }
      className={select}
    >
      {options.map((item) => (
        <option key={item.slug} value={item.slug}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
