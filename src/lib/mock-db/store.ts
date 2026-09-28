// In-memory mock persistence for local development. State lives for the life
// of the server process (and resets on every dev-server file edit / restart)
// -- fine for building out the UI before a real backend exists. Swapping to a
// real API later means rewriting each actions.ts to call serverApiClient
// instead of a store like this one; the components that call the actions
// don't need to change, since they only ever see the ActionResult shape.
export function createMockStore<T extends { id: string }>(seed: T[]) {
  let rows = [...seed];

  return {
    list(): T[] {
      return rows;
    },
    find(id: string): T | undefined {
      return rows.find((r) => r.id === id);
    },
    insert(row: T): T {
      rows = [...rows, row];
      return row;
    },
    update(id: string, patch: Partial<T>): T | null {
      let updated: T | null = null;
      rows = rows.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, ...patch };
        return updated;
      });
      return updated;
    },
    remove(id: string): boolean {
      const before = rows.length;
      rows = rows.filter((r) => r.id !== id);
      return rows.length < before;
    },
  };
}
