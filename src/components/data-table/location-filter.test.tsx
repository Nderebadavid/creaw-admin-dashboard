import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { loadGeographyAction } from "@/components/portal/geography-actions";
import { chooseOption, searchSelect } from "@/test/searchable-select";
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
    await screen.findByRole("combobox", { name: "County" });
    await chooseOption("County", "nai", "Nairobi");
    expect(onChange).toHaveBeenLastCalledWith({
      countyId: 2,
      subCountyId: undefined,
      wardId: undefined,
    });
    expect(screen.queryByRole("combobox", { name: "Sub-county" })).toBeNull();

    rerender(<LocationFilter value={{ countyId: 2 }} onChange={onChange} />);
    // Only the county's own sub-counties are offered.
    await searchSelect("Sub-county", "");
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Westlands",
    ]);
    await chooseOption("Sub-county", "west", "Westlands");
    expect(onChange).toHaveBeenLastCalledWith({ countyId: 2, subCountyId: 10, wardId: undefined });

    rerender(<LocationFilter value={{ countyId: 2, subCountyId: 10 }} onChange={onChange} />);
    await chooseOption("Ward", "park", "Parklands");
    expect(onChange).toHaveBeenLastCalledWith({ countyId: 2, subCountyId: 10, wardId: 100 });
  });

  it("clears the lower levels when the county changes", async () => {
    const onChange = vi.fn();
    render(
      <LocationFilter value={{ countyId: 2, subCountyId: 10, wardId: 100 }} onChange={onChange} />
    );
    await screen.findByRole("combobox", { name: "County" });
    await chooseOption("County", "kis", "Kisumu");
    expect(onChange).toHaveBeenLastCalledWith({
      countyId: 1,
      subCountyId: undefined,
      wardId: undefined,
    });
  });
});
