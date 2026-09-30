"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ArrowLeft, CircleAlert, ClockAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Building blocks shared by the sign-in, verification and password-reset views.

/** A view's title block, with an optional icon tile above it. */
export function AuthHeading({
  title,
  icon: Icon,
  tone = "brand",
  children,
}: {
  title: string;
  icon?: LucideIcon;
  tone?: "brand" | "success";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {Icon && (
        <span
          className={cn(
            "mb-2 grid h-[54px] w-[54px] place-items-center rounded-[14px]",
            tone === "success"
              ? "bg-creaw-success-soft text-creaw-success"
              : "bg-creaw-orange-soft text-creaw-orange"
          )}
        >
          <Icon size={27} aria-hidden />
        </span>
      )}
      <h2 className="font-heading text-4xl font-bold">{title}</h2>
      <p className="text-[15.5px] leading-normal text-creaw-faint">{children}</p>
    </div>
  );
}

export function BackToSignIn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start text-sm font-semibold text-creaw-body hover:text-creaw-ink"
    >
      <ArrowLeft size={18} aria-hidden />
      Back to sign in
    </button>
  );
}

/** The banner above a form. `warn` is for a locked account; everything else is `crit`. */
export function AuthAlert({
  tone = "crit",
  children,
}: {
  tone?: "crit" | "warn";
  children: ReactNode;
}) {
  const Icon = tone === "warn" ? ClockAlert : CircleAlert;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-sm leading-[1.45]",
        tone === "warn"
          ? "border-[#F2D3A4] bg-[#FDEFD9] text-[#7A4A0E]"
          : "border-[#F3CCC6] bg-creaw-danger-soft text-[#6E2019]"
      )}
    >
      <Icon size={20} className="shrink-0" aria-hidden />
      <span className="flex-1">{children}</span>
    </div>
  );
}

interface AuthFieldProps extends Omit<ComponentProps<"input">, "className" | "id"> {
  label: string;
  icon: LucideIcon;
  invalid?: boolean;
  /** Sits beside the label, e.g. the "Forgot password?" link. */
  labelAside?: ReactNode;
  /** Sits inside the box after the input, e.g. the show-password toggle. */
  trailing?: ReactNode;
  /** Hints and errors shown under the box. */
  children?: ReactNode;
}

/** A labelled text input in the design's bordered box with a leading icon. */
export function AuthField({
  label,
  icon: Icon,
  invalid,
  labelAside,
  trailing,
  children,
  ...input
}: AuthFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-creaw-ink-soft">
          {label}
        </label>
        {labelAside}
      </div>
      <div
        className={cn(
          "flex h-[50px] items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white pl-3.5 focus-within:border-creaw-orange focus-within:ring-2 focus-within:ring-[#F0CDBB]",
          trailing ? "pr-1.5" : "pr-3.5",
          invalid ? "border-[#E8A59C]" : "border-creaw-line-strong"
        )}
      >
        <Icon size={20} className="shrink-0 text-[#A39A92]" aria-hidden />
        <input
          id={id}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent text-[15.5px] text-creaw-ink outline-none placeholder:text-[#A39A92]"
          {...input}
        />
        {trailing}
      </div>
      {children}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <span role="alert" className="text-[13px] text-creaw-danger">
      {children}
    </span>
  );
}

/** The full-width primary button; shows a spinner while `loading` and greys out when disabled. */
export function SubmitButton({
  loading = false,
  disabled = false,
  children,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] text-base font-semibold text-white",
        loading
          ? "cursor-wait bg-creaw-orange"
          : disabled
            ? "cursor-not-allowed bg-[#D9CFC6]"
            : "bg-creaw-orange hover:bg-[#8C3F20]"
      )}
    >
      {loading && (
        <span
          className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-white/35 border-t-white"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

/** The "Resend code" / "Resend link" text button, held back while a cooldown runs. */
export function ResendButton({
  label,
  cooldown,
  onClick,
}: {
  label: string;
  cooldown: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={cooldown ? undefined : onClick}
      aria-disabled={cooldown > 0}
      className={cn("text-sm font-semibold", cooldown ? "text-[#A39A92]" : "text-creaw-orange")}
    >
      {cooldown ? `Resend in ${cooldown}s` : label}
    </button>
  );
}

/** Counts down once a second from `seconds`, starting immediately. Returns the time left and a restart. */
export function useCooldown(seconds = 30): [number, () => void] {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const restart = useCallback(() => setRemaining(seconds), [seconds]);
  return [remaining, restart];
}
