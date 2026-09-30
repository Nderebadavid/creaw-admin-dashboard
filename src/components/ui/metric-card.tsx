import type { ReactNode } from "react";
export function MetricCard({
  label,
  value,
  icon,
  detail,
  tint,
  ink,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  detail?: ReactNode;
  /** Icon tile background and icon colour, e.g. a pillar's tint and ink. */
  tint?: string;
  ink?: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-6">
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary"
          style={tint || ink ? { backgroundColor: tint, color: ink } : undefined}
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm text-creaw-muted">{label}</h3>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <p className="font-heading text-4xl font-bold tabular-nums">{value}</p>
        {detail}
      </div>
    </article>
  );
}
