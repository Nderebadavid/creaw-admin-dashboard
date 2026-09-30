import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/**
 * A pillar at a glance: icon and names, reach against its annual target,
 * two mini stats, and the lead beside the link that opens the pillar.
 */
export function PillarCard({
  name,
  description,
  value,
  target,
  unit = "target",
  color,
  tint,
  icon: Icon,
  stats = [],
  lead,
  href,
}: {
  name: string;
  /** The pillar's full name, under its short name. */
  description: string;
  value: number;
  /** Zero when the pillar has no annual target yet. */
  target: number;
  /** What the target counts, e.g. "survivors". */
  unit?: string;
  color: string;
  tint?: string;
  icon?: LucideIcon;
  stats?: readonly (readonly [label: string, value: string])[];
  lead?: string | null;
  href?: string;
}) {
  const percent = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <article
      className="flex flex-col gap-3.5 rounded-2xl border border-t-4 border-creaw-line bg-white p-5"
      style={{ borderTopColor: color }}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            aria-hidden="true"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px]"
            style={{ backgroundColor: tint, color }}
          >
            <Icon size={22} />
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <h3 className="font-heading text-xl font-bold leading-tight">{name}</h3>
          <p className="truncate text-[12.5px] text-creaw-faint">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="font-heading text-[28px] leading-tight">
            {value.toLocaleString()}
          </strong>
          <span className="text-[13px] text-creaw-faint">
            {target > 0 ? `of ${target.toLocaleString()} ${unit}` : "No target set"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`${name} target progress`}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={Math.max(value, target, 1)}
          aria-valuetext={target > 0 ? `${value} of ${target}` : "No target set"}
          className="h-2 overflow-hidden rounded-full bg-[#F4EEE8]"
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${percent}%`, background: color }}
          />
        </div>
      </div>
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-2.5">
          {stats.map(([label, stat]) => (
            <div
              key={label}
              className="rounded-[10px] border border-creaw-divider bg-creaw-surface p-2.5"
            >
              <dt className="text-xs text-creaw-faint">{label}</dt>
              <dd className="text-[15px] font-bold">{stat}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 text-[13px] text-creaw-faint">
        <span className="truncate">{lead ? `Lead: ${lead}` : ""}</span>
        {href && (
          <Link
            href={href}
            aria-label={`Open ${name}`}
            className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-primary"
          >
            Open
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
