import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useActionSubmit } from "./use-action-submit";

afterEach(cleanup);

it("reports success to onDone and failure as an error", async () => {
  const onDone = vi.fn();
  const { result } = renderHook(() => useActionSubmit(onDone));
  await act(() => result.current.run(Promise.resolve({ success: true, message: "" }), "Saved."));
  expect(onDone).toHaveBeenCalledWith("Saved.");
  await act(() =>
    result.current.run(Promise.resolve({ success: false, message: "Name taken" }), "Saved.")
  );
  expect(result.current.error).toBe("Name taken");
});

it("turns a rejected action into an error and clears busy", async () => {
  const { result } = renderHook(() => useActionSubmit(vi.fn()));
  await act(() => result.current.run(Promise.reject(new Error("offline")), "Saved."));
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toBe("Could not save this change. Please try again.");
});
