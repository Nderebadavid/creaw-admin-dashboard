"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowBigUp, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { loginAction } from "@/lib/auth/actions";
import { AuthShell } from "./auth-shell";

export function safeRedirectTarget(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  // Resolve the way the browser will: URL parsing drops tabs and newlines, so
  // "/\t/evil.com" becomes "//evil.com". Only a same-origin result is safe.
  const base = "http://portal.invalid";
  const url = new URL(value, base);
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Enter your email or username.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      const result = await loginAction(username, password, remember);
      if (!result.success) {
        setError(result.error ?? "Sign in failed. Please try again.");
        return;
      }
      router.push(safeRedirectTarget(searchParams.get("redirect")));
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your CREAW staff account.">
      {error && (
        <div
          role="alert"
          className="rounded-[10px] border border-[#F3CCC6] bg-creaw-danger-soft px-3.5 py-3 text-sm text-[#6E2019]"
        >
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-[18px]" noValidate>
        <label
          htmlFor="username"
          className="block space-y-[7px] text-sm font-semibold text-creaw-ink-soft"
        >
          <span>Email or username</span>
          <span className="flex h-12 items-center gap-2.5 rounded-[10px] border border-creaw-line-strong px-3.5 focus-within:border-creaw-orange focus-within:ring-2 focus-within:ring-[#F0CDBB]">
            <Mail size={20} className="shrink-0 text-[#A39A92]" aria-hidden />
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="name@creaw.org"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={loading}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-creaw-ink outline-none placeholder:text-[#A39A92]"
            />
          </span>
        </label>
        <label
          htmlFor="password"
          className="block space-y-[7px] text-sm font-semibold text-creaw-ink-soft"
        >
          <span>Password</span>
          <span className="flex h-12 items-center gap-2.5 rounded-[10px] border border-creaw-line-strong pr-1.5 pl-3.5 focus-within:border-creaw-orange focus-within:ring-2 focus-within:ring-[#F0CDBB]">
            <LockKeyhole size={20} className="shrink-0 text-[#A39A92]" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
              onBlur={() => setCapsLock(false)}
              disabled={loading}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-creaw-ink outline-none placeholder:text-[#A39A92]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="grid h-9 w-9 place-items-center rounded-lg text-creaw-body hover:bg-creaw-canvas"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
          {capsLock && (
            <span role="status" className="flex items-center gap-1.5 text-xs text-[#94570d]">
              <ArrowBigUp size={14} aria-hidden="true" />
              Caps Lock is on
            </span>
          )}
        </label>
        <label className="flex items-center gap-2.5 text-sm text-creaw-ink-soft">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-[18px] w-[18px] accent-creaw-orange"
          />
          Keep me signed in on this device for 12 hours
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-creaw-orange text-base font-semibold text-white hover:bg-[#8C3F20] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"} {!loading && <ArrowRight size={19} aria-hidden />}
        </button>
      </form>
      <div className="rounded-xl bg-creaw-canvas p-3.5 text-[13px] leading-relaxed text-creaw-body">
        <p className="flex gap-2">
          <ShieldCheck size={20} className="shrink-0 text-creaw-orange" aria-hidden />
          <span>
            This portal holds survivor and participant data. Need an account? Ask your System
            Administrator.
          </span>
        </p>
        <p className="mt-2 pl-7">
          Demo: <strong>judy.mwangi</strong> / <strong>creaw-demo</strong>
        </p>
      </div>
    </AuthShell>
  );
}
