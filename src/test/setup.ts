import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Barlow: () => ({ variable: "mock-barlow" }),
  Barlow_Condensed: () => ({ variable: "mock-barlow-condensed" }),
}));
