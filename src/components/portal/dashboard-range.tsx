"use client";
import { useSearchParams } from "next/navigation";
import { MAX_PERIOD_DAYS, periodFromParams } from "@/lib/dashboard-period";
import { DateRangePicker } from "./date-range-picker";
import { usePortalNavigation } from "./portal-navigation";

/**
 * The header's period picker on the dashboard. The period lives in the URL with the
 * dashboard's other filters, so a reload or shared link shows the same figures.
 */
export function DashboardRange() {
  const params = useSearchParams();
  const { navigate, pending } = usePortalNavigation();
  return (
    <DateRangePicker
      value={periodFromParams(params.get("from"), params.get("to"))}
      hint="filters what happened in the period"
      maxDays={MAX_PERIOD_DAYS}
      busy={pending}
      onChange={(range) => {
        const next = new URLSearchParams(params);
        next.set("from", range.from);
        next.set("to", range.to);
        navigate(`/dashboard?${next}`);
      }}
    />
  );
}
