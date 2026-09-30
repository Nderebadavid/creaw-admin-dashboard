import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { push, loginAction, redirectState } = vi.hoisted(() => ({
  push: vi.fn(),
  loginAction: vi.fn(),
  redirectState: { value: null as string | null },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: () => redirectState.value }),
}));
vi.mock("@/lib/auth/actions", () => ({ loginAction }));
import { LoginForm, safeRedirectTarget } from "./login-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  redirectState.value = null;
});

describe("CREAW login form", () => {
  it("uses the design's hero copy", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Every woman counted. Every outcome measured.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Five pillars, one evidence base")).toBeInTheDocument();
  });

  it("warns when Caps Lock is on while typing the password", () => {
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(screen.queryByText("Caps Lock is on")).not.toBeInTheDocument();
    fireEvent.keyUp(password, { key: "A", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();
    fireEvent.keyUp(password, { key: "a", modifierCapsLock: false });
    expect(screen.queryByText("Caps Lock is on")).not.toBeInTheDocument();
  });

  it("shows designer labels and reveals the password", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email or username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.queryByText("Forgot password?")).not.toBeInTheDocument();
  });

  it("uses the server action and a safe same-origin redirect", async () => {
    redirectState.value = "//evil.example";
    loginAction.mockResolvedValue({ success: true });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email or username"), {
      target: { value: "judy.mwangi" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "creaw-demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(loginAction).toHaveBeenCalledWith("judy.mwangi", "creaw-demo", expect.any(Boolean))
    );
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("displays the action error", async () => {
    loginAction.mockResolvedValue({ success: false, error: "Permission denied" });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email or username"), {
      target: { value: "judy.mwangi" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
  });
});

describe("safeRedirectTarget", () => {
  it.each([
    ["/participants?page=2#top", "/participants?page=2#top"],
    ["/\t/evil.com", "/dashboard"],
    ["/\n/evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    [null, "/dashboard"],
  ])("sends %j to %j", (input, expected) => {
    expect(safeRedirectTarget(input)).toBe(expected);
  });
});
