"use client";

import { useState } from "react";
import { CircleCheck, Mail, MessageSquareText, Smartphone, type LucideIcon } from "lucide-react";
import {
  resendOtpAction,
  verifyOtpAction,
  type OtpChannels,
  type VerifyOtpActionResult,
} from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import {
  AuthHeading,
  BackToSignIn,
  FieldError,
  ResendButton,
  SubmitButton,
  useCooldown,
} from "../auth-ui";

const CODE_LENGTH = 6;

interface OtpViewProps {
  channels: OtpChannels;
  onVerified: (user: NonNullable<VerifyOtpActionResult["user"]>) => void;
  /** The challenge is gone; the user has to start again from the password step. */
  onExpired: (message: string) => void;
  onBack: () => void;
}

/** Step two: the 6-digit code sent to the contacts on the staff record. */
export function OtpView({ channels, onVerified, onExpired, onBack }: OtpViewProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, restartCooldown] = useCooldown();
  const complete = code.length === CODE_LENGTH;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || loading) return;
    setLoading(true);
    try {
      const result = await verifyOtpAction(code);
      if (result.success && result.user) return onVerified(result.user);
      const message = result.error ?? "Verification failed. Please try again.";
      if (result.expired) return onExpired(message);
      setCode("");
      setError(message);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    restartCooldown();
    setError("");
    try {
      const result = await resendOtpAction();
      if (result.success) return;
      const message = result.error ?? "Could not resend the code. Please try again.";
      if (result.expired) return onExpired(message);
      setError(message);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <>
      <BackToSignIn onClick={onBack} />
      <AuthHeading title="Verify it's you" icon={Smartphone}>
        This portal holds survivor data, so we ask for a second step. Enter the 6-digit code we sent
        to the contact details on your staff record.
      </AuthHeading>
      <div className="flex flex-col gap-2">
        {channels.maskedPhone && (
          <Channel icon={MessageSquareText} via="SMS to" contact={channels.maskedPhone} />
        )}
        {channels.maskedEmail && (
          <Channel icon={Mail} via="Email to" contact={channels.maskedEmail} />
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        {/* One real input lies invisibly over six boxes that mirror what was typed. */}
        <label className="group relative grid cursor-text grid-cols-6 gap-2.5">
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <span
              key={index}
              aria-hidden
              className={cn(
                "grid h-[60px] place-items-center rounded-xl border-[1.5px] font-heading text-3xl font-bold",
                index === code.length
                  ? "border-creaw-orange bg-white group-focus-within:ring-2 group-focus-within:ring-[#F0CDBB]"
                  : code[index]
                    ? "border-[#D3C9BF] bg-creaw-surface"
                    : "border-creaw-line-strong bg-white"
              )}
            >
              {code[index] ?? ""}
            </span>
          ))}
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
              setError("");
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={loading}
            aria-label="Verification code"
            className="absolute inset-0 border-0 text-base opacity-0"
          />
        </label>
        {error && <FieldError>{error}</FieldError>}
        <SubmitButton loading={loading} disabled={!complete}>
          {loading ? "Verifying…" : "Verify and sign in"}
        </SubmitButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-creaw-faint">
        <span>Code valid for 10 minutes.</span>
        <ResendButton label="Resend code" cooldown={cooldown} onClick={handleResend} />
      </div>
    </>
  );
}

function Channel({ icon: Icon, via, contact }: { icon: LucideIcon; via: string; contact: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[#F0E3D2] bg-[#FDF6EC] px-3 py-2.5 text-sm text-creaw-ink-soft">
      <Icon size={19} className="shrink-0 text-creaw-orange" aria-hidden />
      <span className="flex-1">
        {via} <b className="text-creaw-ink">{contact}</b>
      </span>
      <CircleCheck size={18} className="shrink-0 text-creaw-success" aria-hidden />
    </div>
  );
}
