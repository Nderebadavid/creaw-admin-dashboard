import SidebarWrapper from "@/components/layout/sidebar/sidebar";
import { Header } from "@/components/layout/header/header";
import { CurrentRoleProvider } from "@/lib/auth/current-role";
import { requireSession } from "@/lib/auth/session-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

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
