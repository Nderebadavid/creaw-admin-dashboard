"use client";

import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import type { VerifyOtpActionResult } from "@/lib/auth/actions";

const REDIRECT_MS = 1500;

interface WelcomeViewProps {
  user: NonNullable<VerifyOtpActionResult["user"]>;
  onOpen: () => void;
}

/** Shown once signed in; opens the portal after a short pause, or at once on click. */
export function WelcomeView({ user, onOpen }: WelcomeViewProps) {
  useEffect(() => {
    const timer = setTimeout(onOpen, REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [onOpen]);

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <span className="mb-1.5 grid h-14 w-14 place-items-center rounded-full bg-creaw-orange text-[19px] font-bold text-white">
          {user.initials}
        </span>
        <h2 className="font-heading text-4xl font-bold">Welcome back, {user.firstName}</h2>
        <p className="text-[15.5px] text-creaw-faint">
          {user.role ? `Signed in as ${user.role}. ` : ""}Taking you to your dashboard…
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F4EEE8]">
        <div className="h-full animate-[auth-progress_1.5s_linear_forwards] rounded-full bg-creaw-orange motion-reduce:w-full motion-reduce:animate-none" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-creaw-orange text-base font-semibold text-white hover:bg-[#8C3F20]"
      >
        Open dashboard now
        <ArrowRight size={20} aria-hidden />
      </button>
    </>
  );
}
