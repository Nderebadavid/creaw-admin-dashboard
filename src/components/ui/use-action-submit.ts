"use client";
import { useState } from "react";

type Result = { success: boolean; message: string };

/**
 * Busy/error state for a dialog whose submit calls one Server Action: shows
 * the action's message on failure and hands the success message to `onDone`.
 */
export function useActionSubmit(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: Promise<Result>, successMessage: string) {
    setBusy(true);
    setError("");
    const response = await action;
    setBusy(false);
    if (response.success) onDone(successMessage);
    else setError(response.message);
  }
  return { busy, error, run, clearError: () => setError("") };
}
