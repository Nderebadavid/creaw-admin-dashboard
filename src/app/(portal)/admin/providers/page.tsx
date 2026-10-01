import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { AlertBanner } from "@/components/ui/alert-banner";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { providersApi } from "@/features/providers/api";
import { ProviderRegister } from "@/features/providers/components/provider-register";

export default async function ProvidersPage() {
  const session = await requireSession();
  if (!hasPermission(session.grants, "PROVIDER_MANAGE")) notFound();
  const directory = await providersApi.directory().catch(() => null);
  return (
    <>
      <PageHeading
        title="External providers"
        section="Admin"
        description="Counsellors, nurses, trainers, advocates and facilitators who work with CREAW"
      />
      {directory ? (
        <ProviderRegister
          directory={directory}
          can={{
            manage: true,
            export: hasPermission(session.grants, "REPORT_EXPORT_CSV"),
          }}
        />
      ) : (
        <AlertBanner tone="warning">
          The provider directory could not be loaded. Refresh the page to try again.
        </AlertBanner>
      )}
    </>
  );
}
