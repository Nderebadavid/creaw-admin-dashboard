"use client";

import { useState } from "react";
import {
  Circle,
  CircleCheck,
  CircleCheckBig,
  Eye,
  EyeOff,
  LockKeyhole,
  RotateCcwKey,
} from "lucide-react";
import { resetPasswordAction } from "@/lib/auth/password-actions";
import { PASSWORD_RULES, passwordScore } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";
import { AuthAlert, AuthField, AuthHeading, FieldError, SubmitButton } from "../auth-ui";

// Indexed by how many of the four rules the password meets.
const STRENGTH = [
  { label: "Too weak", bar: "bg-creaw-line", text: "text-creaw-faint" },
  { label: "Weak", bar: "bg-creaw-danger", text: "text-creaw-danger" },
  { label: "Fair", bar: "bg-[#E0822F]", text: "text-[#E0822F]" },
  { label: "Good", bar: "bg-[#C9921F]", text: "text-[#C9921F]" },
  { label: "Strong", bar: "bg-creaw-success", text: "text-creaw-success" },
];

interface ResetViewProps {
  /** The one-time token carried by the reset link. */
  token: string;
  /** Known when the user arrived from the forgot-password step on this device. */
  email?: string;
  onDone: () => void;
  onRequestNewLink: () => void;
}

/** Sets a new password from a reset link, with the design's strength meter and rule checklist. */
export function ResetView({ token, email, onDone, onRequestNewLink }: ResetViewProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const score = passwordScore(password);
  const strength = STRENGTH[score];
  const mismatch = !!confirmation && confirmation !== password;
  const ready = score === PASSWORD_RULES.length && confirmation === password;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await resetPasswordAction(token, password);
      if (result.success) return onDone();
      setError(result.error ?? "Could not update the password. Please try again.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthHeading title="Choose a new password">
        For {email || "your CREAW staff account"}
      </AuthHeading>
      {error && (
        <AuthAlert>
          {error}{" "}
          <button type="button" onClick={onRequestNewLink} className="font-semibold underline">
            Request a new link
          </button>
        </AuthAlert>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        <AuthField
          label="New password"
          icon={LockKeyhole}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 10 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
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
          <div className="mt-1 grid grid-cols-4 gap-1.5" aria-hidden>
            {PASSWORD_RULES.map((rule, index) => (
              <span
                key={rule.label}
                className={cn(
                  "h-[5px] rounded-[3px]",
                  index < score ? strength.bar : "bg-creaw-line"
                )}
              />
            ))}
          </div>
          <span
            role="status"
            className={cn(
              "text-[13px] font-semibold",
              password ? strength.text : "text-creaw-faint"
            )}
          >
            {password ? strength.label : "Password strength"}
          </span>
        </AuthField>
        <ul className="grid grid-cols-2 gap-x-3.5 gap-y-2">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password);
            const Icon = met ? CircleCheck : Circle;
            return (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-1.5 text-[13.5px]",
                  met ? "text-creaw-success" : "text-creaw-faint"
                )}
              >
                <Icon size={17} className="shrink-0" aria-hidden />
                {rule.label}
              </li>
            );
          })}
        </ul>
        <AuthField
          label="Confirm new password"
          icon={RotateCcwKey}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          invalid={mismatch}
          disabled={loading}
        >
          {mismatch && <FieldError>Passwords don&apos;t match yet.</FieldError>}
        </AuthField>
        <SubmitButton loading={loading} disabled={!ready}>
          Update password
        </SubmitButton>
      </form>
    </>
  );
}

/** Confirms the change and sends the user back to sign in with the new password. */
export function ResetDoneView({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <AuthHeading title="Password updated" icon={CircleCheckBig} tone="success">
        You&apos;ve been signed out of all other devices. Sign in with your new password to
        continue.
      </AuthHeading>
      <button
        type="button"
        onClick={onContinue}
        className="h-[52px] rounded-[10px] bg-creaw-orange text-base font-semibold text-white hover:bg-[#8C3F20]"
      >
        Continue to sign in
      </button>
    </>
  );
}
