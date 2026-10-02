import { formatDayMonth } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardReferrals } from "../api";
import { SectionHeader } from "./panels";

const card = "flex flex-col gap-4 rounded-2xl border border-creaw-line bg-white p-6";
const days = (count: number) => `${count} day${count === 1 ? "" : "s"}`;

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-[#FBF7F3] px-3.5 py-3">
      <p className="text-[12.5px] font-semibold text-creaw-faint">{label}</p>
      <p className="font-heading text-[26px] font-bold leading-tight tabular-nums">{value}</p>
      <p className="text-[12.5px] text-creaw-faint">{detail}</p>
    </div>
  );
}

/**
 * Cross-pillar referrals waiting on a response: how many, how many are overdue, how
 * this quarter's decisions went, where the open ones are waiting, and the oldest five.
 */
export function ReferralOversight({ referrals }: { referrals: DashboardReferrals }) {
  const { overdueAfterDays } = referrals;
  return (
    <section className={card} aria-label="Referral oversight">
      <SectionHeader
        title="Referral oversight"
        subtitle="Referrals between pillars waiting on a response"
        href="/referrals"
        linkLabel="Open referral queue →"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open" value={referrals.open.toLocaleString()} detail="awaiting a decision" />
        <Stat
          label={`Waiting over ${days(overdueAfterDays)}`}
          value={referrals.overdue.toLocaleString()}
          detail={referrals.overdue ? "need follow-up" : "none overdue"}
        />
        <Stat
          label="Accepted this quarter"
          value={referrals.acceptedRate === null ? "—" : `${referrals.acceptedRate}%`}
          detail={
            referrals.decidedThisQuarter
              ? `of ${referrals.decidedThisQuarter} decided`
              : "none decided yet"
          }
        />
      </div>
      {referrals.open === 0 ? (
        <p className="text-sm text-creaw-faint">No referrals are waiting on a response.</p>
      ) : (
        <>
          <div>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[.06em] text-creaw-faint">
              Waiting longest
            </h3>
            <ul className="flex flex-col divide-y divide-creaw-line">
              {referrals.oldest.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.participant}</p>
                    <p className="text-[12.5px] text-creaw-faint">
                      {row.from} → {row.to} · raised {formatDayMonth(row.raisedOn)}
                    </p>
                  </div>
                  <StatusBadge tone={row.ageDays > overdueAfterDays ? "danger" : "neutral"}>
                    {days(row.ageDays)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[.06em] text-creaw-faint">
              Open by destination
            </h3>
            <ul className="flex flex-wrap gap-2">
              {referrals.byDestination.map((row) => (
                <li
                  key={row.pillarId}
                  className="flex items-center gap-2 rounded-full border border-creaw-line px-3 py-1 text-[13px]"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-semibold">{row.pillar}</span>
                  <span className="tabular-nums text-creaw-faint">
                    {row.open} open · oldest {days(row.oldestDays)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
