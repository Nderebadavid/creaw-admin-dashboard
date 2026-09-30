import { cn } from "@/lib/utils";
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
const tones: Record<StatusTone, string> = {
  neutral: "bg-[#F4EEE8] text-creaw-body",
  success: "bg-[#E3F3EA] text-[#1F7A4D]",
  warning: "bg-[#FDEFD9] text-[#9A5A0E]",
  danger: "bg-creaw-danger-soft text-creaw-danger",
  info: "bg-[#E7EEF8] text-[#2F5E9A]",
};
export function StatusBadge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  /** A leading dot in the badge colour, as on account statuses. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        tones[tone]
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
