import { notFound } from "next/navigation";
import { AlertBanner } from "@/components/ui/alert-banner";
import { PageHeading } from "@/components/portal/page-heading";
import { hasModulePermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { donorsApi } from "@/features/donors/api";
import { DonorsContent } from "@/features/donors/components";

export default async function DonorsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW")) notFound();
  const initial = await donorsApi.list({ page: 1, pageSize: 25 }).catch(() => null);
  const heading = {
    title: "Donors",
    section: "Records",
    description: "The funding partners behind CREAW's projects",
  };
  if (!initial)
    return (
      <>
        <PageHeading {...heading} />
        <AlertBanner tone="warning">
          Donors could not be loaded. Refresh the page to try again.
        </AlertBanner>
      </>
    );
  return <DonorsContent heading={heading} initial={initial} grants={session.grants} />;
}
