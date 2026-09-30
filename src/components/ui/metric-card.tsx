import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A headline number with its icon tile and a trailing pill. Stacked (the
 * dashboard's KPI cards) by default; `inline` lays it out in a row, as on a
 * pillar page. With `href` the whole card opens the records behind the number.
 */
export function MetricCard({
  label,
  value,
  icon,
  detail,
  tint,
  ink,
  href,
  inline = false,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Usually a StatusBadge with the trend or context. */
  detail?: ReactNode;
  /** Icon tile background and icon colour, e.g. a pillar's tint and ink. */
  tint?: string;
  ink?: string;
  href?: string;
  inline?: boolean;
}) {
  const tile = icon && (
    <div
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary [&_svg]:size-6"
      style={tint || ink ? { backgroundColor: tint, color: ink } : undefined}
    >
      {icon}
    </div>
  );
  const body = inline ? (
    <>
      {tile}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="text-[13.5px] font-normal text-creaw-faint">{label}</h3>
        <p className="font-heading text-[28px] font-bold leading-none tabular-nums">{value}</p>
      </div>
      {detail}
    </>
  ) : (
    <>
      {tile}
      <div className="flex w-full items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-normal text-creaw-faint">{label}</h3>
          <p className="font-heading text-[34px] font-bold leading-none tabular-nums">{value}</p>
        </div>
        {detail}
      </div>
    </>
  );
  const className = cn(
    "flex rounded-2xl border border-creaw-line bg-white text-creaw-ink",
    inline ? "items-center gap-4 p-5" : "flex-col gap-[18px] p-[22px]",
    href && "hover:border-[#E2C7B6] focus-visible:outline-2 focus-visible:outline-primary"
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}
