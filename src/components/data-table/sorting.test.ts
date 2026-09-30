import { describe, expect, it } from "vitest";
import {
  dateSortValue,
  nextSort,
  parseSort,
  sortRows,
  textSortValue,
  withSortValues,
  type SortValues,
} from "./sorting";

interface Person {
  name: string | null;
  age: number;
}
const people: Person[] = [
  { name: "wanjiru", age: 9 },
  { name: null, age: 41 },
  { name: "Achieng", age: 100 },
  { name: "", age: 30 },
];
const values: SortValues<Person> = { name: (row) => row.name, age: (row) => row.age };
const names = (rows: readonly Person[]) => rows.map((row) => row.name);

describe("sortRows", () => {
  it("sorts text without regard to case and numbers by value", () => {
    expect(names(sortRows(people, { by: "name", order: "asc" }, values.name)).slice(0, 2)).toEqual([
      "Achieng",
      "wanjiru",
    ]);
    expect(
      sortRows(people, { by: "age", order: "desc" }, values.age).map((row) => row.age)
    ).toEqual([100, 41, 30, 9]);
  });

  it("orders digits inside text numerically", () => {
    const rows = ["Ward 10", "Ward 2", "Ward 1"].map((name) => ({ name, age: 0 }));
    expect(names(sortRows(rows, { by: "name", order: "asc" }, values.name))).toEqual([
      "Ward 1",
      "Ward 2",
      "Ward 10",
    ]);
  });

  it("keeps blank values last in both directions", () => {
    expect(names(sortRows(people, { by: "name", order: "asc" }, values.name)).slice(2)).toEqual([
      null,
      "",
    ]);
    expect(names(sortRows(people, { by: "name", order: "desc" }, values.name))).toEqual([
      "wanjiru",
      "Achieng",
      null,
      "",
    ]);
  });

  it("leaves the rows untouched without a sort and never mutates them", () => {
    expect(sortRows(people, undefined, values.name)).toBe(people);
    sortRows(people, { by: "age", order: "asc" }, values.age);
    expect(people[0].age).toBe(9);
  });
});

describe("nextSort", () => {
  it("cycles a column through ascending, descending and unsorted", () => {
    const asc = nextSort(undefined, "name");
    expect(asc).toEqual({ by: "name", order: "asc" });
    const desc = nextSort(asc, "name");
    expect(desc).toEqual({ by: "name", order: "desc" });
    expect(nextSort(desc, "name")).toBeUndefined();
  });

  it("starts ascending when another column is chosen", () => {
    expect(nextSort({ by: "name", order: "desc" }, "age")).toEqual({ by: "age", order: "asc" });
  });
});

describe("parseSort", () => {
  it("accepts only a known column and direction", () => {
    expect(parseSort({ by: "age", order: "desc" }, values)).toEqual({ by: "age", order: "desc" });
    for (const input of [
      undefined,
      null,
      "age",
      { by: "age" },
      { by: "age", order: "sideways" },
      { by: "salary", order: "asc" },
      { by: "toString", order: "asc" },
    ])
      expect(parseSort(input, values)).toBeUndefined();
  });
});

describe("withSortValues", () => {
  it("attaches each column's sort value by id", () => {
    const columns = withSortValues(values, [
      { id: "name", header: "Name", cell: (row: Person) => row.name },
      { id: "other", header: "Other", cell: () => null },
    ]);
    expect(columns[0].sortValue).toBe(values.name);
    expect(columns[1].sortValue).toBeUndefined();
  });
});

describe("sort values", () => {
  it("sorts formatted amounts by value, where text order would be wrong", () => {
    const amounts = ["KES 45,000", "KES 1,200,000", "KES 9,500", "Not recorded"];
    const rows = amounts.map((amount) => ({ amount }));
    const sorted = sortRows(rows, { by: "amount", order: "asc" }, (row) =>
      textSortValue(row.amount)
    );
    expect(sorted.map((row) => row.amount)).toEqual([
      "KES 9,500",
      "KES 45,000",
      "KES 1,200,000",
      "Not recorded",
    ]);
    expect(textSortValue("Case #12")).toBe("Case #12");
  });

  it("turns dates into times and treats a missing or invalid date as blank", () => {
    expect(dateSortValue("2026-09-27")).toBeLessThan(dateSortValue("2026-10-02")!);
    expect(dateSortValue(null)).toBeNull();
    expect(dateSortValue("not a date")).toBeNull();
  });
});
