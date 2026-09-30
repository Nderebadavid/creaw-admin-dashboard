import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DataTable } from "./data-table";
import { Pagination } from "./pagination";
import { RowActions } from "./row-actions";

// jsdom lacks PointerEvent, which Base UI dispatches for keyboard activation.
if (!window.PointerEvent) window.PointerEvent = MouseEvent as typeof PointerEvent;

afterEach(cleanup);
const columns = [
  { id: "name", header: "Name", cell: (row: { id: number; name: string }) => row.name },
];
it("distinguishes an empty collection from filtered no results", () => {
  const view = render(
    <DataTable columns={columns} rows={[]} getRowId={(row) => row.id} label="Participants" />
  );
  expect(screen.getByText("No records yet")).toBeInTheDocument();
  view.rerender(
    <DataTable
      columns={columns}
      rows={[]}
      getRowId={(row) => row.id}
      label="Participants"
      filtered
    />
  );
  expect(screen.getByText("No matching records")).toBeInTheDocument();
});
it("renders typed cells and loading/error recovery", () => {
  const retry = vi.fn();
  const view = render(
    <DataTable
      columns={columns}
      rows={[{ id: 1, name: "Sample" }]}
      getRowId={(row) => row.id}
      label="Participants"
    />
  );
  expect(screen.getByRole("table", { name: "Participants" })).toHaveTextContent("Sample");
  view.rerender(
    <DataTable
      columns={columns}
      rows={[]}
      getRowId={(row) => row.id}
      label="Participants"
      loading
    />
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  view.rerender(
    <DataTable
      columns={columns}
      rows={[]}
      getRowId={(row) => row.id}
      label="Participants"
      error="Could not load records"
      onRetry={retry}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
});
it("offers the required page sizes and reports page changes", () => {
  const onPageChange = vi.fn(),
    onPageSizeChange = vi.fn();
  render(
    <Pagination
      page={1}
      pageSize={10}
      totalItems={32}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "10",
    "25",
    "50",
    "100",
  ]);
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(onPageChange).toHaveBeenCalledWith(2);
  fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "25" } });
  expect(onPageSizeChange).toHaveBeenCalledWith(25);
});
it("opens row actions by keyboard with an accessible row-specific name", async () => {
  const onSelect = vi.fn();
  render(<RowActions label="Participant 12" actions={[{ label: "View record", onSelect }]} />);
  const trigger = screen.getByRole("button", { name: "Actions for Participant 12" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const item = await screen.findByRole("menuitem", { name: "View record" });
  await waitFor(() => expect(item).toHaveFocus());
  fireEvent.keyDown(item, { key: "Enter" });
  fireEvent.keyUp(item, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledOnce();
});

it("opens a record from anywhere on its row, and by keyboard", () => {
  const onOpen = vi.fn();
  render(
    <DataTable
      columns={columns}
      rows={[{ id: 1, name: "Faith" }]}
      getRowId={(row) => row.id}
      label="Participants"
      onRowOpen={onOpen}
      rowOpenLabel={(row) => `Open ${row.name}`}
    />
  );
  fireEvent.click(screen.getByText("Faith"));
  expect(onOpen).toHaveBeenCalledWith({ id: 1, name: "Faith" });
  fireEvent.click(screen.getByRole("button", { name: "Open Faith" }));
  expect(onOpen).toHaveBeenCalledTimes(2);
});

it("labels the visible range like the design", () => {
  render(
    <Pagination
      page={2}
      pageSize={10}
      totalItems={32}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      hint="Click a row to open the record"
    />
  );
  expect(screen.getByText("11–20 of 32")).toBeInTheDocument();
  expect(screen.getByText("Click a row to open the record")).toBeInTheDocument();
});

it("renders an expanded detail row beneath its record", () => {
  render(
    <DataTable
      columns={columns}
      rows={[
        { id: 1, name: "Faith" },
        { id: 2, name: "Grace" },
      ]}
      getRowId={(row) => row.id}
      label="Entries"
      renderExpanded={(row) => (row.id === 2 ? <p>Grace details</p> : null)}
    />
  );
  const detail = screen.getByText("Grace details");
  expect(detail.closest("td")).toHaveAttribute("colspan", "1");
  expect(screen.getAllByRole("row")).toHaveLength(4);
});
