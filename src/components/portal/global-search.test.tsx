import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlobalSearch } from "./global-search";
afterEach(cleanup);
it("searches permitted destinations and dismisses results with Escape", () => {
  render(<GlobalSearch destinations={[{label:"Dashboard",href:"/dashboard"}]} />);
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"dash"}});
  expect(screen.getByRole("link",{name:"Dashboard"})).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("searchbox"), {key:"Escape"});
  expect(screen.queryByRole("link",{name:"Dashboard"})).not.toBeInTheDocument();
});
it("shows no results for unmatched search", () => {
  render(<GlobalSearch destinations={[]} />);
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"unknown"}});
  expect(screen.getByRole("status")).toHaveTextContent("No matching pages");
});
