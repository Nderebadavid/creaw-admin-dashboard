import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { chooseOption, searchSelect } from "@/test/searchable-select";
import { SearchableSelect } from "./searchable-select";

afterEach(cleanup);

const wards = [
  { value: 1, label: "Kibra" },
  { value: 2, label: "Kilimani" },
  { value: 3, label: "Parklands" },
];

describe("searchable select", () => {
  it("narrows the options to what the user types", async () => {
    render(<SearchableSelect label="Ward" options={wards} emptyLabel="Not recorded" />);
    await searchSelect("Ward", "kil");
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Kilimani"]);
  });

  it("submits the chosen value with the form, like a native select", async () => {
    let submitted: FormData | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget);
        }}
      >
        <SearchableSelect name="wardId" label="Ward" options={wards} emptyLabel="Not recorded" />
        <button type="submit">Save</button>
      </form>
    );
    await chooseOption("Ward", "park", "Parklands");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted!.get("wardId")).toBe("3");
  });

  it("starts from a default value and reports changes when controlled", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchableSelect
        label="Ward"
        options={wards}
        emptyLabel="All wards"
        value={2}
        onChange={onChange}
      />
    );
    const input = screen.getByRole("combobox", { name: "Ward" }) as HTMLInputElement;
    expect(input.value).toBe("Kilimani");
    await chooseOption("Ward", "kib", "Kibra");
    expect(onChange).toHaveBeenLastCalledWith("1");
    rerender(
      <SearchableSelect
        label="Ward"
        options={wards}
        emptyLabel="All wards"
        value={null}
        onChange={onChange}
      />
    );
    expect(input.value).toBe("");
  });

  it("says when nothing matches", async () => {
    render(<SearchableSelect label="Ward" options={wards} emptyLabel="Not recorded" />);
    await searchSelect("Ward", "zzz");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("lists grouped options under their headings and still filters them", async () => {
    render(
      <SearchableSelect
        label="Facilitator"
        emptyLabel="Choose a facilitator"
        options={[
          { value: "staff:1", label: "Judy Mwangi", group: "CREAW staff" },
          { value: "provider:4", label: "Grace Akinyi", group: "External providers" },
          { value: "provider:5", label: "Judith Were", group: "External providers" },
        ]}
      />
    );
    await searchSelect("Facilitator", "jud");
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Judy Mwangi",
      "Judith Were",
    ]);
    expect(screen.getByText("CREAW staff")).toBeInTheDocument();
    expect(screen.getByText("External providers")).toBeInTheDocument();
  });
});
