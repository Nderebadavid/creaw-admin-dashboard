"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import type { OtpChannels, VerifyOtpActionResult } from "@/lib/auth/actions";
import { AuthShell } from "./auth-shell";
import { ForgotView, SentView } from "./views/forgot-password-views";
import { ResetDoneView, ResetView } from "./views/new-password-views";
import { OtpView } from "./views/otp-view";
import { SignInView } from "./views/sign-in-view";
import { WelcomeView } from "./views/welcome-view";

export function safeRedirectTarget(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  // Resolve the way the browser will: URL parsing drops tabs and newlines, so
  // "/\t/evil.com" becomes "//evil.com". Only a same-origin result is safe.
  const base = "http://portal.invalid";
  const url = new URL(value, base);
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/dashboard";
}

/** Mock-mode credentials shown under the form so the prototype can be walked through. */
export interface DemoCredentials {
  username: string;
  password: string;
  code: string;
}

type View = "login" | "otp" | "forgot" | "sent" | "reset" | "done" | "welcome";
type SignedInUser = NonNullable<VerifyOtpActionResult["user"]>;

/**
 * The whole sign-in experience on one route: password, one-time code and
 * welcome, plus the forgot-password path. An emailed reset link opens the
 * new-password view through `/login?reset=<token>`.
 */
export function LoginForm({ demo }: { demo?: DemoCredentials }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get("reset");
  const redirectTarget = safeRedirectTarget(searchParams.get("redirect"));

  const [view, setView] = useState<View>(linkToken ? "reset" : "login");
  // Shared by the sign-in and forgot-password fields, as in the design.
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [channels, setChannels] = useState<OtpChannels | null>(null);
  const [previewToken, setPreviewToken] = useState<string>();
  const [user, setUser] = useState<SignedInUser | null>(null);

  function showSignIn(message = "") {
    setNotice(message);
    setView("login");
    // Drop a used reset token from the address bar.
    if (linkToken) router.replace("/login");
  }

  // The welcome view opens the portal on a timer or a click, whichever is first.
  const opened = useRef(false);
  const openPortal = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    router.push(redirectTarget);
  }, [router, redirectTarget]);

  return (
    <AuthShell>
      {view === "login" && (
        <SignInView
          email={email}
          onEmailChange={setEmail}
          notice={notice}
          onChallenge={(sentTo) => {
            setChannels(sentTo);
            setView("otp");
          }}
          onForgot={() => setView("forgot")}
        />
      )}
      {view === "otp" && channels && (
        <OtpView
          channels={channels}
          onVerified={(signedIn) => {
            setUser(signedIn);
            setView("welcome");
          }}
          onExpired={showSignIn}
          onBack={() => showSignIn()}
        />
      )}
      {view === "welcome" && user && <WelcomeView user={user} onOpen={openPortal} />}
      {view === "forgot" && (
        <ForgotView
          email={email}
          onEmailChange={setEmail}
          onSent={(token) => {
            setPreviewToken(token);
            setView("sent");
          }}
          onBack={() => showSignIn()}
        />
      )}
      {view === "sent" && (
        <SentView
          email={email}
          previewToken={previewToken}
          onResent={setPreviewToken}
          onOpenReset={() => setView("reset")}
          onBack={() => showSignIn()}
        />
      )}
      {view === "reset" && (
        <ResetView
          token={linkToken ?? previewToken ?? ""}
          email={linkToken ? undefined : email}
          onDone={() => setView("done")}
          onRequestNewLink={() => setView("forgot")}
        />
      )}
      {view === "done" && <ResetDoneView onContinue={() => showSignIn()} />}
      {demo && (view === "login" || view === "otp") && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-dashed border-[#E2C7B6] bg-[#FFFBF7] px-3.5 py-3 text-[13px] leading-normal text-[#6B5A4C]">
          <FlaskConical size={18} className="shrink-0 text-creaw-orange" aria-hidden />
          <span>
            Demo: sign in as <b className="text-creaw-ink">{demo.username}</b> with password{" "}
            <b className="text-creaw-ink">{demo.password}</b>. Verification code:{" "}
            <b className="font-mono text-creaw-ink">{demo.code}</b>
          </span>
        </div>
      )}
    </AuthShell>
  );
}
