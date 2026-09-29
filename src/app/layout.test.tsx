import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("root metadata", () => {
  it("identifies the CREAW MERL portal", () => {
    expect(metadata.title).toBe("CREAW MERL Portal");
    expect(metadata.description).toContain("Monitoring, Evaluation");
  });
});

describe("root layout", () => {
  it("keeps the CREAW light theme fixed", () => {
    const html = RootLayout({ children: null, params: Promise.resolve({}) });
    const themeProvider = html.props.children.props.children;

    expect(themeProvider.props.defaultTheme).toBe("light");
    expect(themeProvider.props.enableSystem).toBe(false);
  });
});
