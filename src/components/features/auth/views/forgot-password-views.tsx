"use client";

import { useState } from "react";
import { Inbox, KeyRound, Mail, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/auth/password-actions";
import {
  AuthField,
  AuthHeading,
  BackToSignIn,
  FieldError,
  ResendButton,
  SubmitButton,
  useCooldown,
} from "../auth-ui";

interface ForgotViewProps {
  email: string;
  onEmailChange: (value: string) => void;
  /** `previewToken` is only present in mock mode, where no email is really sent. */
  onSent: (previewToken?: string) => void;
  onBack: () => void;
}

/** Asks for the work email a reset link should go to. */
export function ForgotView({ email, onEmailChange, onSent, onBack }: ForgotViewProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const result = await requestPasswordResetAction(email);
      if (result.success) return onSent(result.previewToken);
      setError(result.error ?? "Could not send the reset link. Please try again.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BackToSignIn onClick={onBack} />
      <AuthHeading title="Reset your password" icon={KeyRound}>
        Enter your work email and we&apos;ll send a reset link. The link expires in 30 minutes.
      </AuthHeading>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        <AuthField
          label="Work email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="name@creaw.org"
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
            setError("");
          }}
          invalid={!!error}
          disabled={loading}
        >
          {error && <FieldError>{error}</FieldError>}
        </AuthField>
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
    </>
  );
}

interface SentViewProps {
  email: string;
  previewToken?: string;
  /** A resend issues a new link, so the preview has to follow it. */
  onResent: (previewToken?: string) => void;
  onOpenReset: () => void;
  onBack: () => void;
}

/** Confirms the request. In mock mode it also previews the email, since none is sent. */
export function SentView({ email, previewToken, onResent, onOpenReset, onBack }: SentViewProps) {
  const [cooldown, restartCooldown] = useCooldown();
  const [error, setError] = useState("");

  async function handleResend() {
    restartCooldown();
    setError("");
    try {
      const result = await requestPasswordResetAction(email);
      if (result.success) return onResent(result.previewToken);
      setError(result.error ?? "Could not resend the link. Please try again.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <>
      <AuthHeading title="Check your inbox" icon={MailCheck} tone="success">
        If <b className="text-creaw-ink">{email}</b> matches a CREAW account, a reset link is on its
        way. It expires in 30 minutes. Check spam if it hasn&apos;t arrived.
      </AuthHeading>
      {previewToken && (
        <div className="overflow-hidden rounded-[14px] border border-creaw-line">
          <div className="flex items-center gap-2.5 border-b border-creaw-line bg-creaw-surface px-3.5 py-3 text-[13px] text-creaw-body">
            <Inbox size={18} className="shrink-0 text-creaw-faint" aria-hidden />
            <b className="text-creaw-ink">CREAW MERL Portal</b>
            <span className="ml-auto">just now</span>
          </div>
          <div className="flex flex-col gap-2.5 p-3.5 text-sm text-creaw-ink-soft">
            <b className="text-creaw-ink">Reset your MERL Portal password</b>
            <span className="leading-normal">
              We received a request to reset the password for {email}. This link works once and
              expires in 30 minutes.
            </span>
            <button
              type="button"
              onClick={onOpenReset}
              className="h-10 self-start rounded-[9px] bg-creaw-orange px-4 text-sm font-semibold text-white hover:bg-[#8C3F20]"
            >
              Reset password
            </button>
            <span className="text-xs text-[#A39A92]">
              Demo preview of the email · no message is sent in mock mode
            </span>
          </div>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-sm text-creaw-faint">
        <span>Didn&apos;t get it?</span>
        <ResendButton label="Resend link" cooldown={cooldown} onClick={handleResend} />
      </div>
      <button
        type="button"
        onClick={onBack}
        className="h-[50px] rounded-[10px] border border-creaw-line-strong bg-white text-[15px] font-semibold text-creaw-ink-soft hover:bg-[#FBF3EE]"
      >
        Back to sign in
      </button>
    </>
  );
}
