import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
export function AlertBanner({
  children,
  action,
  tone = "warning",
}: {
  children: ReactNode;
  action?: ReactNode;
  tone?: "warning" | "danger" | "info";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-5 py-4 text-sm",
        tone === "danger"
          ? "border-[#f4cec8] bg-[#fce9e6] text-[#a23227]"
          : tone === "warning"
            ? "border-[#f0dfc8] bg-[#fdf3e3] text-[#83541e]"
            : "border-border bg-accent text-foreground"
      )}
    >
      <CircleAlert size={20} aria-hidden="true" className="shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
