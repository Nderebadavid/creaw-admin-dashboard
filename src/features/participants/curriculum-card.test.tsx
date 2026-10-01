import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CurriculumProgressCard } from "./curriculum-card";

afterEach(cleanup);
const card = {
  participants: 9,
  buckets: [
    { label: "Not started", count: 2 },
    { label: "1–49%", count: 3 },
    { label: "50–99%", count: 3 },
    { label: "Completed", count: 1 },
  ],
  behind: 4,
};

it("shows each completion band, the enrolled total and how many are behind", () => {
  render(<CurriculumProgressCard card={card} color="#C9921F" tint="#FCF3DF" />);
  const section = screen.getByRole("region", { name: "Curriculum progress" });
  expect(section).toHaveTextContent("9 enrolled");
  expect(within(section).getByText("4 behind")).toBeInTheDocument();
  const items = within(section).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "2Not started",
    "31–49%",
    "350–99%",
    "1Completed",
  ]);
});

it("leaves out the behind count when the caller cannot see graduation", () => {
  render(<CurriculumProgressCard card={{ ...card, behind: null }} color="#000" tint="#fff" />);
  expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
});
