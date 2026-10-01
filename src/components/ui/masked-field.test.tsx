import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MaskedField } from "./masked-field";

afterEach(cleanup);

it("renders the masked text under its label and offers no reveal control", () => {
  render(<MaskedField label="ID number" maskedValue="••••1172" />);
  expect(screen.getByLabelText("ID number")).toHaveTextContent("••••1172");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
