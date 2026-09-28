"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";

import { FormInput } from "@/components/ui/form-input";
import { login } from "@/lib/auth/auth-client";
import { AuthShell } from "./auth-shell";

// proxy.ts sets ?redirect=<pathname> when it bounces an unauthenticated
// visitor here. It's attacker-controllable via the URL (not just proxy.ts),
// so only ever treat it as a same-origin relative path -- never pass it to
// router.push unsanitized, or a crafted //evil.com value becomes an open
// redirect right after a real login.
function safeRedirectTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.error ?? "Login failed. Please check your credentials.");
        return;
      }
      // TODO: once a change-password page exists, route
      // result.requirePasswordChange there instead of the redirect target.
      router.push(safeRedirectTarget(searchParams.get("redirect")));
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your account">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormInput
          label="Username"
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username or email"
          autoComplete="username"
          autoCorrect="off"
          autoCapitalize="none"
          disabled={loading}
          icon={<User className="h-4 w-4 text-slate-500" />}
          showLabel={false}
          containerClassName="space-y-1.5"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 pr-3 pl-10 text-sm text-white transition-all placeholder:text-slate-600 focus-visible:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50"
        />

        <FormInput
          label="Password"
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          autoComplete="current-password"
          disabled={loading}
          icon={<Lock className="h-4 w-4 text-slate-500" />}
          showLabel={false}
          containerClassName="space-y-1.5"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 pr-10 pl-10 text-sm text-white transition-all placeholder:text-slate-600 focus-visible:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50"
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex items-center text-slate-500 transition-colors hover:text-slate-400"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <div className="flex items-center justify-end text-xs">
          {/* Placeholder route -- build the reset-password flow when auth lands. */}
          <Link
            href="/forgot-password"
            className="text-primary/80 transition-colors hover:text-primary"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
