import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TableCard } from "./table-card";

afterEach(cleanup);

it("frames a table with its title, chips, search and actions", () => {
  const onChip = vi.fn();
  const onSearch = vi.fn();
  render(
    <TableCard
      title="Participant registry"
      subtitle="One registry across every pillar"
      chips={[
        { label: "All", active: true, onSelect: () => onChip("All") },
        { label: "VAWG", active: false, onSelect: () => onChip("VAWG") },
      ]}
      search={{ value: "", onChange: onSearch, label: "Search participants" }}
      actions={<button type="button">CSV</button>}
    >
      <p>table body</p>
    </TableCard>
  );
  expect(screen.getByRole("heading", { name: "Participant registry" })).toBeInTheDocument();
  expect(screen.getByText("One registry across every pillar")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "VAWG" }));
  expect(onChip).toHaveBeenCalledWith("VAWG");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search participants" }), {
    target: { value: "Faith" },
  });
  expect(onSearch).toHaveBeenCalledWith("Faith");
  expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Filter this list");
  expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
  expect(screen.getByText("table body")).toBeInTheDocument();
});
