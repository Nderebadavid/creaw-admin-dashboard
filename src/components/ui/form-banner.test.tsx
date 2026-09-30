import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormBanner } from "./form-banner";

afterEach(cleanup);

it("announces success politely and errors assertively", () => {
  render(
    <>
      <FormBanner tone="success">Saved.</FormBanner>
      <FormBanner tone="error">Could not save.</FormBanner>
    </>
  );
  expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");
});

it("renders nothing without a message", () => {
  const { container } = render(<FormBanner tone="error">{""}</FormBanner>);
  expect(container).toBeEmptyDOMElement();
});
