import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next config", () => {
  // Dev Server Function traces print raw arguments, including login passwords.
  it("keeps Server Function arguments out of development logs", () => {
    expect(nextConfig.logging && nextConfig.logging.serverFunctions).toBe(false);
  });

  // docker/Dockerfile copies .next/standalone into the runtime image.
  it("emits a standalone server bundle", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
