"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { loginAction } from "@/lib/auth/actions";
import { AuthShell } from "./auth-shell";

export function safeRedirectTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value)) return value;
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!username.trim()) { setError("Enter your email or username."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    try {
      const result = await loginAction(username, password, remember);
      if (!result.success) { setError(result.error ?? "Sign in failed. Please try again."); return; }
      router.push(safeRedirectTarget(searchParams.get("redirect")));
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your CREAW staff account.">
      {error && <div role="alert" className="rounded-[10px] border border-[#F3CCC6] bg-[#FBE9E6] px-3.5 py-3 text-sm text-[#6E2019]">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-[18px]" noValidate>
        <label htmlFor="username" className="block space-y-[7px] text-sm font-semibold text-[#4A413A]">
          <span>Email or username</span>
          <span className="flex h-12 items-center gap-2.5 rounded-[10px] border border-[#E2DBD3] px-3.5 focus-within:border-[#B4552E] focus-within:ring-2 focus-within:ring-[#F0CDBB]">
            <Mail size={20} className="shrink-0 text-[#A39A92]" aria-hidden />
            <input id="username" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" placeholder="name@creaw.org" value={username} onChange={(event) => setUsername(event.target.value)} disabled={loading} className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-[#221C18] outline-none placeholder:text-[#A39A92]" />
          </span>
        </label>
        <label htmlFor="password" className="block space-y-[7px] text-sm font-semibold text-[#4A413A]">
          <span>Password</span>
          <span className="flex h-12 items-center gap-2.5 rounded-[10px] border border-[#E2DBD3] pr-1.5 pl-3.5 focus-within:border-[#B4552E] focus-within:ring-2 focus-within:ring-[#F0CDBB]">
            <LockKeyhole size={20} className="shrink-0 text-[#A39A92]" aria-hidden />
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-[#221C18] outline-none placeholder:text-[#A39A92]" />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="grid h-9 w-9 place-items-center rounded-lg text-[#6B625B] hover:bg-[#F7F4F0]">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
        </label>
        <label className="flex items-center gap-2.5 text-sm text-[#4A413A]">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-[18px] w-[18px] accent-[#B4552E]" />
          Keep me signed in on this device for 12 hours
        </label>
        <button type="submit" disabled={loading} className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#B4552E] text-base font-semibold text-white hover:bg-[#8C3F20] disabled:cursor-wait disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"} {!loading && <ArrowRight size={19} aria-hidden />}
        </button>
      </form>
      <div className="rounded-xl bg-[#F7F4F0] p-3.5 text-[13px] leading-relaxed text-[#6B625B]">
        <p className="flex gap-2"><ShieldCheck size={20} className="shrink-0 text-[#B4552E]" aria-hidden /><span>This portal holds survivor and participant data. Need an account? Ask your System Administrator.</span></p>
        <p className="mt-2 pl-7">Demo: <strong>judy.mwangi</strong> / <strong>creaw-demo</strong></p>
      </div>
    </AuthShell>
  );
}
