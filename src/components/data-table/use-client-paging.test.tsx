import { afterEach, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useClientPaging } from "./use-client-paging";

afterEach(cleanup);
const rows = Array.from({ length: 23 }, (_, index) => index + 1);

it("slices the current page and exposes Pagination props", () => {
  const { result } = renderHook(() => useClientPaging(rows));
  expect(result.current.pageRows).toEqual(rows.slice(0, 10));
  act(() => result.current.pager.onPageChange(3));
  expect(result.current.pageRows).toEqual([21, 22, 23]);
  expect(result.current.pager).toMatchObject({ page: 3, pageSize: 10, totalItems: 23 });
});

it("returns to page one when the page size or filter changes", () => {
  const { result, rerender } = renderHook(({ list }) => useClientPaging(list), {
    initialProps: { list: rows },
  });
  act(() => result.current.pager.onPageChange(2));
  act(() => result.current.pager.onPageSizeChange(25));
  expect(result.current.pager.page).toBe(1);
  act(() => result.current.pager.onPageChange(1));
  act(() => result.current.resetPage());
  expect(result.current.pager.page).toBe(1);
  rerender({ list: rows.slice(0, 5) });
  expect(result.current.pageRows).toHaveLength(5);
});
