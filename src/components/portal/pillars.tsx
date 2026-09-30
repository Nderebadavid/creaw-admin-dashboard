import {
  Gavel,
  GraduationCap,
  Megaphone,
  ShieldPlus,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

/** How a pillar is drawn everywhere: short name, colours, icon and what its target counts. */
export interface PillarLook {
  id: number;
  slug: string;
  /** Short name used in chips and tabs, e.g. "VAWG". */
  name: string;
  fullName: string;
  /** What the annual target counts, e.g. "survivors". */
  unit: string;
  color: string;
  tint: string;
  icon: LucideIcon;
}

/** Keyed by `pillar.id`, which is fixed by the seed script in the schema. */
const looks: PillarLook[] = [
  {
    id: 1,
    slug: "vawg",
    name: "VAWG",
    fullName: "Violence Against Women & Girls",
    unit: "survivors",
    color: "#B4552E",
    tint: "#FBEDE5",
    icon: Gavel,
  },
  {
    id: 2,
    slug: "wee",
    name: "WEE",
    fullName: "Women's Economic Empowerment",
    unit: "women",
    color: "#D9772B",
    tint: "#FDF0E3",
    icon: Store,
  },
  {
    id: 3,
    slug: "srhr",
    name: "SRHR",
    fullName: "Sexual & Reproductive Health Rights",
    unit: "registered",
    color: "#C9921F",
    tint: "#FCF3DF",
    icon: ShieldPlus,
  },
  {
    id: 4,
    slug: "leadership",
    name: "Leadership",
    fullName: "Leadership",
    unit: "participants",
    color: "#6E6459",
    tint: "#EFEAE4",
    icon: Megaphone,
  },
  {
    id: 5,
    slug: "wros",
    name: "WROs",
    fullName: "Women's Rights Organisations",
    unit: "organisations",
    color: "#9C6B4E",
    tint: "#F4ECE6",
    icon: Users,
  },
  {
    id: 6,
    slug: "skilling",
    name: "Skilling",
    fullName: "Vocational Skilling",
    unit: "trainees",
    color: "#7A3A1F",
    tint: "#F3E7E0",
    icon: GraduationCap,
  },
];

export function pillarLook(id: number | null | undefined): PillarLook | undefined {
  return looks.find((look) => look.id === id);
}

export function pillarLookBySlug(slug: string): PillarLook | undefined {
  return looks.find((look) => look.slug === slug.toLowerCase());
}

/** A pillar's short name on its tint, as in the design's table chips. */
export function PillarChip({ id, fallback }: { id: number; fallback?: string }) {
  const look = pillarLook(id);
  return (
    <span
      className="whitespace-nowrap rounded-[7px] bg-creaw-orange-soft px-[9px] py-[3px] text-xs font-semibold text-primary"
      style={look && { backgroundColor: look.tint, color: look.color }}
    >
      {look?.name ?? fallback ?? `Pillar #${id}`}
    </span>
  );
}
