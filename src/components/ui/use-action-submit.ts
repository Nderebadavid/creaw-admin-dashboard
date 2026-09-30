"use client";
import { useState } from "react";

type Result = { success: boolean; message: string };

/**
 * Busy/error state for a dialog whose submit calls one Server Action: shows
 * the action's message on failure and hands the success message to `onDone`.
 * A rejected action (network drop, server error) becomes a generic error, so
 * `busy` always resets.
 */
export function useActionSubmit(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: Promise<Result>, successMessage: string) {
    setBusy(true);
    setError("");
    try {
      const response = await action;
      if (response.success) onDone(successMessage);
      else setError(response.message);
    } catch {
      setError("Could not save this change. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
