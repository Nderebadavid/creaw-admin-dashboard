"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** How long a success toast stays on screen. */
const TOAST_MS = 4000;

/** The design's toast: dark, bottom-right, gone after a few seconds. */
function SuccessToast({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <p
      role="status"
      className="fixed bottom-6 right-6 z-[80] flex max-w-[min(420px,calc(100vw-3rem))] items-center gap-3 rounded-xl bg-creaw-ink px-[18px] py-3.5 text-[14.5px] text-white shadow-[0_16px_40px_-12px_rgba(34,28,24,.5)]"
    >
      <CircleCheck size={20} aria-hidden="true" className="shrink-0 text-[#8FD4AE]" />
      {children}
    </p>
  );
}

/**
 * The outcome of the last action on a screen: a toast for success, an inline
 * alert for errors. Renders nothing when there is no message.
 */
export function FormBanner({
  tone,
  children,
  className,
}: {
  tone: "success" | "error";
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  // Keyed by its text, so a new message shows (and times out) afresh.
  if (tone === "success") return <SuccessToast key={String(children)}>{children}</SuccessToast>;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-xl bg-creaw-danger-soft px-4 py-3 text-sm text-creaw-danger",
        className
      )}
    >
      {children}
    </p>
  );
}
