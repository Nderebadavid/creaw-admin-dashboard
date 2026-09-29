import type { DbTables, TableName } from "@/types/db";
import { tableDefinitions } from "./schema";

export function makeRow<K extends TableName>(
  table: K,
  input: Partial<DbTables[K]>,
  id: number,
  now: string
): DbTables[K] {
  const values: Record<string, unknown> = { ...input, id };
  for (const [name, column] of Object.entries(tableDefinitions[table])) {
    if (values[name] !== undefined) continue;
    if (column.default !== undefined)
      values[name] = column.default === "$now" ? now : column.default;
    else if (column.nullable) values[name] = null;
    else throw new Error(`Missing required ${table}.${name}`);
  }
  return values as unknown as DbTables[K];
}
