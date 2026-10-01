import { notFound } from "next/navigation";
import { AlertBanner } from "@/components/ui/alert-banner";
import { PageHeading } from "@/components/portal/page-heading";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { ProjectsContent } from "@/features/projects/components";
import { projectsApi } from "@/features/projects/api";

export default async function ProjectsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW")) notFound();
  const [initial, pillars] = await Promise.all([
    projectsApi.list({ page: 1, pageSize: 25 }).catch(() => null),
    projectsApi.options().catch(() => null),
  ]);
  const heading = {
    title: "Projects",
    section: "Records",
    description: "Funded initiatives and the grants attached to them",
  };
  if (!initial)
    return (
      <>
        <PageHeading {...heading} />
        <AlertBanner tone="warning">
          Projects could not be loaded. Refresh the page to try again.
        </AlertBanner>
      </>
    );
  return (
    <ProjectsContent
      heading={heading}
      initial={initial}
      pillars={(pillars?.pillars ?? []).filter((item) =>
        hasPermission(session.grants, "DASHBOARD_VIEW", { pillarId: item.id })
      )}
      grants={session.grants}
    />
  );
}
