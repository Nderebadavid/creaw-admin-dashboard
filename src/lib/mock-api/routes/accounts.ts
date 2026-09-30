import { type MockStore } from "@/types/db";

/** The named fields of a request body, or `undefined` unless every one is a string. */
export function stringFields<K extends string>(
  body: unknown,
  ...keys: K[]
): Record<K, string> | undefined {
  const fields = (body ?? {}) as Record<string, unknown>;
  return keys.every((key) => typeof fields[key] === "string")
    ? (fields as Record<K, string>)
    : undefined;
}

/** The active account whose username or email matches, ignoring case. */
export function findAccount(store: MockStore, identifier: string) {
  const wanted = identifier.trim().toLowerCase();
  return store.user.find(
    (row) =>
      !row.is_deleted &&
      row.status === "ACTIVE" &&
      (row.username.toLowerCase() === wanted || row.email?.toLowerCase() === wanted)
  );
}
