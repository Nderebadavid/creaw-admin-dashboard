import type { PaginatedData } from "@/types/api";

/** Read every authorized page; callers still rely on the API's scope filter. */
export async function collectPages<T>(
  load: (page: number, pageSize: number) => Promise<PaginatedData<T>>,
  pageSize = 100
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await load(page, pageSize);
    items.push(...result.items);
    if (page >= result.totalPages) return items;
    if (result.page !== page || result.items.length === 0)
      throw new Error("Invalid pagination response");
    page += 1;
  }
}
