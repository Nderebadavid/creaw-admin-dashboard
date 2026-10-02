import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { loadGeographyAction } from "@/components/portal/geography-actions";
import { LocationFilter } from "./location-filter";

vi.mocked(loadGeographyAction).mockResolvedValue({
  success: true,
  message: "OK",
  data: {
    counties: [
      { id: 1, name: "Kisumu" },
      { id: 2, name: "Nairobi" },
    ],
    subCounties: [
      { id: 10, name: "Westlands", countyId: 2 },
      { id: 11, name: "Kisumu East", countyId: 1 },
    ],
    wards: [{ id: 100, name: "Parklands", subCountyId: 10 }],
  },
});

afterEach(cleanup);

describe("location filter", () => {
  it("offers lower levels only once the parent is chosen", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<LocationFilter value={{}} onChange={onChange} />);
    fireEvent.change(await screen.findByRole("combobox", { name: "County" }), {
      target: { value: "2" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      countyId: 2,
      subCountyId: undefined,
      wardId: undefined,
    });
    expect(screen.queryByRole("combobox", { name: "Sub-county" })).toBeNull();

    rerender(<LocationFilter value={{ countyId: 2 }} onChange={onChange} />);
    const subCounty = screen.getByRole("combobox", { name: "Sub-county" });
    // Only the county's own sub-counties are offered.
    expect(subCounty.textContent).toContain("Westlands");
    expect(subCounty.textContent).not.toContain("Kisumu East");
    fireEvent.change(subCounty, { target: { value: "10" } });
    expect(onChange).toHaveBeenLastCalledWith({ countyId: 2, subCountyId: 10, wardId: undefined });

    rerender(<LocationFilter value={{ countyId: 2, subCountyId: 10 }} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ward" }), { target: { value: "100" } });
    expect(onChange).toHaveBeenLastCalledWith({ countyId: 2, subCountyId: 10, wardId: 100 });
  });

  it("clears the lower levels when the county changes", async () => {
    const onChange = vi.fn();
    render(
      <LocationFilter value={{ countyId: 2, subCountyId: 10, wardId: 100 }} onChange={onChange} />
    );
    fireEvent.change(await screen.findByRole("combobox", { name: "County" }), {
      target: { value: "1" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      countyId: 1,
      subCountyId: undefined,
      wardId: undefined,
    });
  });
});
