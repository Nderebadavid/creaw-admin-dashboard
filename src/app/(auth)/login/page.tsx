import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { LoginForm, type DemoCredentials } from "@/components/features/auth/login-form";
import { MOCK_OTP_CODE, MOCK_PASSWORD } from "@/lib/mock-api/seed";

export const metadata: Metadata = {
  title: "Sign in | CREAW MERL Portal",
};

export default async function LoginPage() {
  // Read the API mode per request, so a build made in mock mode never bakes
  // the demo credentials into a live deployment's page.
  await connection();
  const demo: DemoCredentials | undefined =
    (process.env.PORTAL_API_MODE ?? "mock") === "mock"
      ? { username: "judy.mwangi", password: MOCK_PASSWORD, code: MOCK_OTP_CODE }
      : undefined;
  // LoginForm reads the ?redirect= and ?reset= query params via
  // useSearchParams(), which requires a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LoginForm demo={demo} />
    </Suspense>
  );
}
