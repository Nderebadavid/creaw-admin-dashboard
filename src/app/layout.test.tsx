import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("root metadata", () => {
  it("identifies the CREAW MERL portal", () => {
    expect(metadata.title).toBe("CREAW MERL Portal");
    expect(metadata.description).toContain("Monitoring, Evaluation");
  });
});
