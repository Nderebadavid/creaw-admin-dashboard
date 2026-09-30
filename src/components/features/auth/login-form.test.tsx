import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  loginAction: vi.fn(),
  verifyOtpAction: vi.fn(),
  resendOtpAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
  resetPasswordAction: vi.fn(),
  params: {} as Record<string, string>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => ({ get: (key: string) => mocks.params[key] ?? null }),
}));
vi.mock("@/lib/auth/actions", () => ({
  loginAction: mocks.loginAction,
  verifyOtpAction: mocks.verifyOtpAction,
  resendOtpAction: mocks.resendOtpAction,
}));
vi.mock("@/lib/auth/password-actions", () => ({
  requestPasswordResetAction: mocks.requestPasswordResetAction,
  resetPasswordAction: mocks.resetPasswordAction,
}));
import { LoginForm, safeRedirectTarget } from "./login-form";

const CHALLENGE = { maskedPhone: "07•• ••• 344", maskedEmail: "ju•••••@creaw.org" };
const JUDY = { firstName: "Judy", initials: "JM", role: "System Administrator" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.params = {};
});

function submitCredentials(username = "judy.mwangi", password = "creaw-demo") {
  fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

async function reachCodeStep() {
  mocks.loginAction.mockResolvedValue({ success: true, challenge: CHALLENGE });
  render(<LoginForm />);
  submitCredentials();
  await screen.findByRole("heading", { name: "Verify it's you" });
}

function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
}

describe("sign-in screen", () => {
  it("uses the design's hero copy, pillars and footer", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Every woman counted. Every outcome measured.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Five pillars, one evidence base")).toBeInTheDocument();
    for (const pillar of ["VAWG", "WEE", "SRHR", "Skilling", "WROs"])
      expect(screen.getByText(pillar)).toBeInTheDocument();
    expect(
      screen.getByText("Protected under the Kenya Data Protection Act, 2019")
    ).toBeInTheDocument();
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
  });

  it("asks for both fields before calling the action", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email or username.");
    expect(mocks.loginAction).not.toHaveBeenCalled();
  });

  it("displays the action error and the lockout warning", async () => {
    mocks.loginAction.mockResolvedValue({ success: false, error: "Incorrect email or password." });
    render(<LoginForm />);
    submitCredentials("judy.mwangi", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    mocks.loginAction.mockResolvedValue({ success: false, locked: true, error: "Account locked" });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Account locked"));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows the demo credentials only when they are supplied", () => {
    render(<LoginForm />);
    expect(screen.queryByText(/Verification code:/)).not.toBeInTheDocument();
    cleanup();
    render(
      <LoginForm demo={{ username: "judy.mwangi", password: "creaw-demo", code: "246810" }} />
    );
    expect(screen.getByText("246810")).toBeInTheDocument();
    expect(screen.getByText("creaw-demo")).toBeInTheDocument();
  });
});

describe("verification step", () => {
  it("follows a correct password with the code step instead of signing in", async () => {
    await reachCodeStep();
    expect(mocks.loginAction).toHaveBeenCalledWith("judy.mwangi", "creaw-demo", true);
    expect(screen.getByText("07•• ••• 344")).toBeInTheDocument();
    expect(screen.getByText("ju•••••@creaw.org")).toBeInTheDocument();
    expect(screen.getByText("Code valid for 10 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps only digits, then welcomes the user and opens a safe same-origin target", async () => {
    mocks.params = { redirect: "//evil.example" };
    mocks.verifyOtpAction.mockResolvedValue({ success: true, user: JUDY });
    await reachCodeStep();
    enterCode("24a68 10");
    expect(screen.getByLabelText("Verification code")).toHaveValue("246810");
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByRole("heading", { name: "Welcome back, Judy" })).toBeInTheDocument();
    expect(screen.getByText(/Signed in as System Administrator/)).toBeInTheDocument();
    expect(mocks.verifyOtpAction).toHaveBeenCalledWith("246810");
    fireEvent.click(screen.getByRole("button", { name: "Open dashboard now" }));
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });

  it("opens the requested page once verified", async () => {
    mocks.params = { redirect: "/participants?page=2" };
    mocks.verifyOtpAction.mockResolvedValue({ success: true, user: JUDY });
    await reachCodeStep();
    enterCode("246810");
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open dashboard now" }));
    expect(mocks.push).toHaveBeenCalledWith("/participants?page=2");
  });

  it("clears a wrong code and explains", async () => {
    mocks.verifyOtpAction.mockResolvedValue({ success: false, error: "That code isn’t right." });
    await reachCodeStep();
    enterCode("000000");
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code isn’t right.");
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("returns to the password step when the challenge has expired", async () => {
    mocks.verifyOtpAction.mockResolvedValue({
      success: false,
      expired: true,
      error: "This code has expired. Sign in again to get a new one.",
    });
    await reachCodeStep();
    enterCode("246810");
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This code has expired.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("holds the resend button for 30 seconds and goes back on request", async () => {
    await reachCodeStep();
    const resend = screen.getByRole("button", { name: "Resend in 30s" });
    fireEvent.click(resend);
    expect(mocks.resendOtpAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("password reset", () => {
  async function reachInbox(previewToken?: string) {
    mocks.requestPasswordResetAction.mockResolvedValue({ success: true, previewToken });
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "judy.mwangi@creaw.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await screen.findByRole("heading", { name: "Check your inbox" });
  }

  it("confirms the request without an email preview outside mock mode", async () => {
    await reachInbox();
    expect(mocks.requestPasswordResetAction).toHaveBeenCalledWith("judy.mwangi@creaw.org");
    expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  });

  it("walks from the mock email preview to a new password and back to sign in", async () => {
    mocks.resetPasswordAction.mockResolvedValue({ success: true });
    await reachInbox("preview-token");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    const update = screen.getByRole("button", { name: "Update password" });
    expect(update).toBeDisabled();
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "Str0ng!Passw0rd" },
    });
    expect(screen.getByText("Strong")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Str0ng!Passw0r" },
    });
    expect(screen.getByText("Passwords don't match yet.")).toBeInTheDocument();
    expect(update).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Str0ng!Passw0rd" },
    });
    fireEvent.click(update);
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(mocks.resetPasswordAction).toHaveBeenCalledWith("preview-token", "Str0ng!Passw0rd");
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("opens the new-password screen from an emailed link and reports a dead link", async () => {
    mocks.params = { reset: "emailed-token" };
    mocks.resetPasswordAction.mockResolvedValue({
      success: false,
      error: "This link has expired.",
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "Str0ng!Passw0rd" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Str0ng!Passw0rd" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired.");
    expect(mocks.resetPasswordAction).toHaveBeenCalledWith("emailed-token", "Str0ng!Passw0rd");
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
