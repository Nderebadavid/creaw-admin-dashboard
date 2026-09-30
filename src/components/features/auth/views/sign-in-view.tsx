"use client";

import { useState } from "react";
import { ArrowBigUp, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { loginAction, type OtpChannels } from "@/lib/auth/actions";
import { AuthAlert, AuthField, AuthHeading, SubmitButton } from "../auth-ui";

interface SignInError {
  message: string;
  tone?: "crit" | "warn";
  field?: "email" | "password";
}

interface SignInViewProps {
  email: string;
  onEmailChange: (value: string) => void;
  /** Carried in from another step, e.g. an expired verification code. */
  notice?: string;
  onChallenge: (channels: OtpChannels) => void;
  onForgot: () => void;
}

/** Step one: email or username and password. Success hands over to the verification step. */
export function SignInView({
  email,
  onEmailChange,
  notice,
  onChallenge,
  onForgot,
}: SignInViewProps) {
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<SignInError | null>(notice ? { message: notice } : null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!email.trim())
      return setError({ message: "Enter your email or username.", field: "email" });
    if (!password) return setError({ message: "Enter your password.", field: "password" });
    setError(null);
    setLoading(true);
    try {
      const result = await loginAction(email, password, remember);
      if (result.success && result.challenge) return onChallenge(result.challenge);
      setError({
        message: result.error ?? "Sign in failed. Please try again.",
        tone: result.locked ? "warn" : "crit",
      });
    } catch {
      setError({ message: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthHeading title="Sign in">Use your CREAW staff account.</AuthHeading>
      {error && <AuthAlert tone={error.tone}>{error.message}</AuthAlert>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        <AuthField
          label="Email or username"
          icon={Mail}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="name@creaw.org"
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
            setError(null);
          }}
          invalid={error?.field === "email"}
          disabled={loading}
        />
        <AuthField
          label="Password"
          icon={LockKeyhole}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
          invalid={error?.field === "password"}
          disabled={loading}
          labelAside={
            <button
              type="button"
              onClick={onForgot}
              className="text-[13.5px] font-semibold text-creaw-orange hover:text-[#8C3F20]"
            >
              Forgot password?
            </button>
          }
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="grid h-[38px] w-[38px] place-items-center rounded-lg text-creaw-body hover:bg-creaw-canvas"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          }
        >
          {capsLock && (
            <span role="status" className="flex items-center gap-1.5 text-[13px] text-[#9A5A0E]">
              <ArrowBigUp size={16} aria-hidden />
              Caps Lock is on
            </span>
          )}
        </AuthField>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-creaw-ink-soft">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-[18px] w-[18px] accent-creaw-orange"
          />
          Keep me signed in on this device for 12 hours
        </label>
        <SubmitButton loading={loading}>{loading ? "Signing in…" : "Sign in"}</SubmitButton>
      </form>
    </>
  );
}
