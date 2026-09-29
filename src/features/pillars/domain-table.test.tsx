import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PillarDomainTable } from "./domain-table";

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
    fireEvent.click(screen.getByRole("button", { name: "concluded" }));
    expect(screen.queryByText("Case #1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Case #2" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Case #2");
    expect(screen.getByRole("dialog")).toHaveTextContent("concluded");
  });
});
