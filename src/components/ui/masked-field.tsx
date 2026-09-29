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
    <span className="inline-flex flex-wrap items-center gap-2">
      <span aria-label={label}>{value ?? maskedValue}</span>
      {revealAction && (
        <button
          type="button"
          disabled={pending}
          onClick={reveal}
          aria-label={`${value === null ? "Reveal" : "Hide"} ${label}`}
          className="rounded p-1 text-primary hover:bg-accent disabled:opacity-50"
        >
          {value === null ? (
            <Eye aria-hidden="true" size={16} />
          ) : (
            <EyeOff aria-hidden="true" size={16} />
          )}
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
