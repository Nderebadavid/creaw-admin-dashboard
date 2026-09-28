import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in - VSLA App",
};

export default function LoginPage() {
  // LoginForm reads the ?redirect= query param via useSearchParams(), which
  // requires a Suspense boundary to keep this route prerenderable.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
