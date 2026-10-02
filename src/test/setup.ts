import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Barlow: () => ({ variable: "mock-barlow" }),
  Barlow_Condensed: () => ({ variable: "mock-barlow-condensed" }),
}));

// Every register's location filter loads geography through a Server Action; component
// tests get an empty geography (the filter then renders nothing) unless they override it.
vi.mock("@/components/portal/geography-actions", () => ({
  loadGeographyAction: vi.fn(async () => ({ success: true, message: "OK", data: null })),
}));
