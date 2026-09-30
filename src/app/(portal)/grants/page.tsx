import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { grantsApi } from "@/features/grants/api";
import { GrantsContent } from "@/features/grants/components";
export default async function GrantsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW")) notFound();
  const [initial, pillars, programmes] = await Promise.all([
    grantsApi.list({ page: 1, pageSize: 25 }),
    grantsApi.pillars(),
    grantsApi.programmes(),
  ]);
  const weePillarId = pillars.find((pillar) => pillar.code === "WEE")?.id;
  return (
    <GrantsContent
      heading={{
        title: "Grants",
        section: "Records",
        description: "WEE business grants and WRO sub-grants",
      }}
      initial={initial}
      pillars={pillars}
      canExport={hasModulePermission(session.grants, "REPORT_EXPORT_CSV")}
      // As in the design, the queue files WEE business grants, whose applicants are
      // participants. Filing also prepares the application, so it needs that permission.
      programmes={programmes.filter(
        (programme) =>
          programme.pillarId === weePillarId &&
          hasPermission(session.grants, "GRANT_APPLICATION_PREPARE", {
            pillarId: programme.pillarId,
          })
      )}
    />
  );
}
