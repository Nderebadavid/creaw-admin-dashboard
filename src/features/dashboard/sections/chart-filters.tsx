"use client";
import { useSearchParams } from "next/navigation";
import { LocationFilter } from "@/components/data-table/location-filter";
import { usePortalNavigation } from "@/components/portal/portal-navigation";
import { cleanLocation } from "@/lib/api/location";

const select =
  "h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2.5 text-[13px] font-semibold text-creaw-ink-soft disabled:opacity-60";

/**
 * The dashboard's filters all live in the URL (period, location, chart pillar, funnel
 * pillar). Each control changes its own keys and keeps the rest, and the page reloads
 * through the portal's navigation, which marks the page busy until the new figures arrive.
 */
function useDashboardFilters() {
  const params = useSearchParams();
  const { navigate, pending } = usePortalNavigation();
  const change = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch))
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    navigate(`/dashboard?${next}`);
  };
  return { params, change, pending };
}

/** The monthly chart's pillar picker. */
export function ChartFilters({
  pillar,
  pillars,
}: {
  /** The selected pillar slug, or "" for all pillars. */
  pillar: string;
  pillars: readonly { code: string; name: string }[];
}) {
  const { change, pending } = useDashboardFilters();
  if (pillars.length < 2) return null;
  return (
    <select
      aria-label="Pillar"
      value={pillar}
      disabled={pending}
      onChange={(event) => change({ pillar: event.target.value })}
      className={select}
    >
      <option value="">All pillars</option>
      {pillars.map((item) => (
        <option key={item.code} value={item.code}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

/** Switches the pipeline funnel to another pillar. */
export function FunnelPicker({
  funnel,
  options,
}: {
  funnel: string;
  options: readonly { slug: string; name: string }[];
}) {
  const { change, pending } = useDashboardFilters();
  if (options.length < 2) return null;
  return (
    <select
      aria-label="Pipeline pillar"
      value={funnel}
      disabled={pending}
      onChange={(event) => change({ funnel: event.target.value })}
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

/** County → sub-county → ward for the whole dashboard. */
export function DashboardLocationFilter() {
  const { params, change, pending } = useDashboardFilters();
  const location = cleanLocation({
    countyId: Number(params.get("countyId")),
    subCountyId: Number(params.get("subCountyId")),
    wardId: Number(params.get("wardId")),
  });
  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      <LocationFilter value={location} onChange={change} disabled={pending} />
    </div>
  );
}
