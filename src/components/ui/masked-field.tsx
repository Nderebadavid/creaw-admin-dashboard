"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export type RevealResult = { success: true; value: string } | { success: false; error: string };
export function MaskedField({
  label,
  maskedValue,
  revealAction,
}: {
  label: string;
  maskedValue: string;
  revealAction?: () => Promise<RevealResult>;
}) {
  const [revealed, setRevealed] = useState<{
    value: string;
    maskedValue: string;
    action: typeof revealAction;
  } | null>(null);
  const value =
    revealed?.maskedValue === maskedValue && revealed.action === revealAction
      ? revealed.value
      : null;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function reveal() {
    if (value !== null) {
      setRevealed(null);
      return;
    }
    if (!revealAction) return;
    setPending(true);
    setError("");
    try {
      const result = await revealAction();
      if (result.success) setRevealed({ value: result.value, maskedValue, action: revealAction });
      else setError(result.error);
    } catch {
      setError("Could not reveal this field. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <span
        aria-label={label}
        className={
          value === null ? "break-all font-mono" : "min-w-0 whitespace-pre-wrap break-words"
        }
      >
        {value ?? maskedValue}
      </span>
      {revealAction && (
        <button
          type="button"
          disabled={pending}
          onClick={reveal}
          aria-label={`${value === null ? "Reveal" : "Hide"} ${label}`}
          className="flex items-center gap-[3px] rounded-md bg-[#FDEFD9] px-2 py-0.5 text-xs font-semibold text-[#9A5A0E] hover:bg-[#FBE3BD] disabled:opacity-50"
        >
          {value === null ? (
            <Eye aria-hidden="true" size={14} />
          ) : (
            <EyeOff aria-hidden="true" size={14} />
          )}
          {value === null ? "Reveal" : "Hide"}
        </button>
      )}
      {pending && (
        <span role="status" className="sr-only">
          Revealing field
        </span>
      )}
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
