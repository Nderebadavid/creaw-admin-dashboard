import { vi, afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PillarDomainTable } from "./domain-table";
// Grant rows navigate to their sign-off page with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

describe("pillar domain register", () => {
  it("filters by status and opens a read-only record detail", () => {
    render(
      <PillarDomainTable
        domain={{
          title: "Legal case register",
          subtitle: "Masked names",
          columns: ["Case", "Court"],
          rows: [
            { id: 1, title: "Case #1", values: ["Case #1", "in hearing"], status: "in hearing" },
            { id: 2, title: "Case #2", values: ["Case #2", "concluded"], status: "concluded" },
          ],
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluded" }));
    expect(screen.queryByText("Case #1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Case #2" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Case #2");
    expect(screen.getByRole("dialog")).toHaveTextContent("concluded");
  });

  it("sorts every column across pages and returns to the first page", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Case #${index + 1}`,
      values: [`Case #${index + 1}`, index % 2 ? "Milimani" : "Kibera"],
      status: index < 6 ? "in hearing" : "concluded",
    }));
    render(
      <PillarDomainTable
        domain={{ title: "Legal case register", subtitle: "", columns: ["Case", "Court"], rows }}
      />
    );
    const firstCell = () => screen.getAllByRole("row")[1].querySelector("td")!.textContent;
    for (const name of ["Case", "Court", "Status"])
      expect(screen.getByRole("columnheader", { name })).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(firstCell()).toBe("Case #11");
    fireEvent.click(screen.getByRole("button", { name: "Case" }));
    fireEvent.click(screen.getByRole("button", { name: "Case" }));
    // Descending puts the last case first, numerically (#12, not #9), on page one.
    expect(firstCell()).toBe("Case #12");
    expect(screen.getByRole("columnheader", { name: "Case" })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(firstCell()).toBe("Case #7");
  });
});
