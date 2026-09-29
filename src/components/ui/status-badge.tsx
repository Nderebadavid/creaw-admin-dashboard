import { cn } from "@/lib/utils";
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
const tones: Record<StatusTone,string> = {neutral:"bg-[#f1ece6] text-[#665b52]",success:"bg-[#e2f3e9] text-[#24734b]",warning:"bg-[#fff1d8] text-[#94570d]",danger:"bg-[#fce7e4] text-[#b52e26]",info:"bg-[#e9eef9] text-[#36548e]"};
export function StatusBadge({children,tone="neutral"}:{children:React.ReactNode;tone?:StatusTone}) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",tones[tone])}>{children}</span>;
}
