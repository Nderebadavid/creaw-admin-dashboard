import { StatusBadge } from "@/components/ui/status-badge";

export interface CurriculumCard {
  participants: number;
  buckets: { label: string; count: number }[];
  /** Null when the caller cannot see who has graduated. */
  behind: number | null;
}

/** How many SRHR participants sit in each band of curriculum completion. */
export function CurriculumProgressCard({
  card,
  color,
  tint,
}: {
  card: CurriculumCard;
  color: string;
  tint: string;
}) {
  return (
    <section
      aria-label="Curriculum progress"
      className="rounded-2xl border border-creaw-line bg-white p-[18px]"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="text-[15px] font-bold">Curriculum progress</h2>
        <span className="text-[13px] text-creaw-faint">
          {card.participants.toLocaleString()} enrolled
        </span>
        {card.behind !== null && card.behind > 0 && (
          <StatusBadge tone="warning">{card.behind.toLocaleString()} behind</StatusBadge>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-4">
        {card.buckets.map((bucket) => (
          <li
            key={bucket.label}
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: tint, color }}
          >
            <span className="block text-2xl font-bold">{bucket.count.toLocaleString()}</span>
            <span className="text-[13px] font-medium">{bucket.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
