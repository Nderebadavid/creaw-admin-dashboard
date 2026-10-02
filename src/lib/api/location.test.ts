import { describe, expect, it } from "vitest";
import { cleanLocation, hasLocation, locationParams } from "./location";

describe("location query", () => {
  it("keeps only positive integer ids from untrusted input", () => {
    expect(cleanLocation({ countyId: 47, subCountyId: "3", wardId: -1 })).toEqual({ countyId: 47 });
    expect(cleanLocation({ countyId: 1.5, wardId: Number.NaN })).toEqual({});
    expect(cleanLocation(null)).toEqual({});
  });

  it("turns a location into query parameters and reports whether one is set", () => {
    expect(locationParams({ countyId: 47, subCountyId: undefined, wardId: 9 })).toEqual({
      countyId: 47,
      wardId: 9,
    });
    expect(hasLocation({})).toBe(false);
    expect(hasLocation({ wardId: 9 })).toBe(true);
  });
});
