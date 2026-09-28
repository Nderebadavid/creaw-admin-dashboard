import { redirect } from "next/navigation";
import SidebarWrapper from "@/components/layout/sidebar/sidebar";
import { Header } from "@/components/layout/header/header";
import { CurrentRoleProvider } from "@/lib/auth/current-role";
import { getSessionUser } from "@/lib/auth/session-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already gated this route on a valid session; this only comes
  // back null in the rare case the token expired in the last few hundred ms
  // or the identity service is unreachable right now.
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  // TODO: once a change-password page exists, redirect here when
  // user.passwordChangeRequired is true instead of letting them through.
  // vsla-identity-service has no authenticated "change my password" endpoint
  // yet -- only the public OTP-based /password-reset/* flow can actually set
  // a new password, so this needs either a backend addition or reusing that
  // flow for the forced-change case.

  return (
    <CurrentRoleProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-background">
        <SidebarWrapper />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </CurrentRoleProvider>
  );
}
