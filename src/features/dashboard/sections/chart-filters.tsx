"use client";
import { useRouter } from "next/navigation";

const select =
  "h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2.5 text-[13px] font-semibold text-creaw-ink-soft";

/** Pillar and year pickers for the monthly chart; a change reloads the dashboard with it applied. */
export function ChartFilters({
  year,
  years,
  pillar,
  pillars,
}: {
  year: string;
  years: readonly string[];
  /** The selected pillar slug, or "" for all pillars. */
  pillar: string;
  pillars: readonly { code: string; name: string }[];
}) {
  const router = useRouter();
  const go = (next: { year?: string; pillar?: string }) => {
    const query = new URLSearchParams({ year: next.year ?? year });
    const slug = next.pillar ?? pillar;
    if (slug) query.set("pillar", slug);
    router.push(`/dashboard?${query}`, { scroll: false });
  };
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
