"use client";
import { useRouter } from "next/navigation";
import { LocationFilter } from "@/components/data-table/location-filter";
import { locationParams, type LocationQuery } from "@/lib/api/location";

const select =
  "h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2.5 text-[13px] font-semibold text-creaw-ink-soft";

/** The dashboard's filters, all kept in the URL so each picker preserves the others. */
interface DashboardFilters {
  year: string;
  /** The monthly chart's pillar slug, or "" for all pillars. */
  pillar: string;
  /** The funnel's pillar slug, or "" to let the API choose. */
  funnel?: string;
  /** The area every people-based figure is narrowed to. */
  location?: LocationQuery;
}

function dashboardHref({ year, pillar, funnel, location = {} }: DashboardFilters) {
  const query = new URLSearchParams({ year });
  if (pillar) query.set("pillar", pillar);
  if (funnel) query.set("funnel", funnel);
  for (const [key, id] of Object.entries(locationParams(location))) query.set(key, String(id));
  return `/dashboard?${query}`;
}

/** Pillar and year pickers for the monthly chart; a change reloads the dashboard with it applied. */
export function ChartFilters({
  year,
  years,
  pillar,
  pillars,
  funnel,
  location,
}: {
  year: string;
  years: readonly string[];
  /** The selected pillar slug, or "" for all pillars. */
  pillar: string;
  pillars: readonly { code: string; name: string }[];
  /** The funnel's pillar slug, kept when the chart's filters change. */
  funnel?: string;
  /** The dashboard's location, kept when the chart's filters change. */
  location?: LocationQuery;
}) {
  const router = useRouter();
  const go = (next: Partial<DashboardFilters>) =>
    router.push(dashboardHref({ year, pillar, funnel, location, ...next }), { scroll: false });
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
  location,
}: {
  funnel: string;
  options: readonly { slug: string; name: string }[];
  year: string;
  /** The monthly chart's pillar slug, or "" for all pillars. */
  pillar: string;
  /** The dashboard's location, kept when the funnel's pillar changes. */
  location?: LocationQuery;
}) {
  const router = useRouter();
  if (options.length < 2) return null;
  return (
    <select
      aria-label="Pipeline pillar"
      value={funnel}
      onChange={(event) =>
        router.push(dashboardHref({ year, pillar, funnel: event.target.value, location }), {
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

/** County → sub-county → ward for the whole dashboard, kept in the URL with the other filters. */
export function DashboardLocationFilter(filters: DashboardFilters) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <LocationFilter
        value={filters.location ?? {}}
        onChange={(location) =>
          router.push(dashboardHref({ ...filters, location }), { scroll: false })
        }
      />
    </div>
  );
}
