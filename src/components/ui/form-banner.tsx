import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  success: "bg-creaw-success-soft text-creaw-success",
  error: "bg-creaw-danger-soft text-creaw-danger",
};

/**
 * The outcome of the last action on a screen: a polite status for success, an
 * alert for errors. Renders nothing when there is no message.
 */
export function FormBanner({
  tone,
  children,
  className,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role={tone === "success" ? "status" : "alert"}
      className={cn("rounded-xl px-4 py-3 text-sm", tones[tone], className)}
    >
      {children}
    </p>
  );
}
