import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission } from "@/lib/auth/permissions";
import { participantsApi } from "@/features/participants/api";
import { ParticipantsContent } from "@/features/participants/components";

export default async function ParticipantsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "PARTICIPANT_VIEW")) notFound();
  const [initial, catalog] = await Promise.all([
    participantsApi.list({ page: 1, pageSize: 25 }),
    participantsApi.catalog(),
  ]);
  return (
    <ParticipantsContent
      heading={{
        title: "Participants",
        section: "Records",
        description: "One registry across all pillars — a participant can hold several enrollments",
      }}
      initial={initial}
      catalog={catalog}
      grants={session.grants}
    />
  );
}
