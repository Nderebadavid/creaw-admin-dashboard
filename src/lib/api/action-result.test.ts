import { describe, expect, it } from "vitest";
import { actionResult } from "./action-result";

describe("actionResult", () => {
  it("marks codes below 400 as successful and carries the created row ID", () => {
    expect(actionResult(201, "Created", 7)).toEqual({
      resultCode: 201,
      success: true,
      message: "Created",
      data: { id: 7 },
    });
  });

  it("marks error codes as unsuccessful with no data", () => {
    expect(actionResult(403, "Permission denied")).toEqual({
      resultCode: 403,
      success: false,
      message: "Permission denied",
      data: null,
    });
  });
});
