import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams("countyId=4&pillar=srhr"),
}));
import { PortalNavigationProvider } from "@/components/portal/portal-navigation";
import { DashboardFilters } from "./chart-filters";

afterEach(() => {
  cleanup();
  navigation.push.mockClear();
});

it("puts the period beside the location and keeps the dashboard's other filters", () => {
  render(<PortalNavigationProvider>{() => <DashboardFilters />}</PortalNavigationProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Date range/ }));
  fireEvent.click(screen.getByRole("button", { name: "Last year" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  const lastYear = new Date().getFullYear() - 1;
  expect(navigation.push).toHaveBeenCalledWith(
    `/dashboard?countyId=4&pillar=srhr&from=${lastYear}-01-01&to=${lastYear}-12-31`,
    { scroll: false }
  );
});
