import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePagedList } from "./use-paged-list";

afterEach(cleanup);

const page = { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };

it("ends loading with a message when the Server Action rejects", async () => {
  const load = vi.fn().mockRejectedValue(new Error("network down"));
  const { result } = renderHook(() => usePagedList(page, { page: 1, pageSize: 10 }, load));
  act(() => result.current.filter({ pageSize: 25 }));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("Could not load this list. Please try again.");
});
