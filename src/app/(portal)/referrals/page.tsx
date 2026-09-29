import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission } from "@/lib/auth/permissions";
import { collectPages } from "@/lib/api/pagination";
import { participantsApi } from "@/features/participants/api";
import { referralsApi } from "@/features/referrals/api";
import { ReferralsContent, type ReferralOriginOption } from "@/features/referrals/components";

export default async function ReferralsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "REFERRAL_VIEW")) notFound();
  const [initial, pillars, destinations, participants] = await Promise.all([
    referralsApi.list({ page: 1, pageSize: 25 }),
    referralsApi.pillars(),
    hasModulePermission(session.grants, "REFERRAL_CREATE")
      ? referralsApi.destinations()
      : Promise.resolve({ internalPillarIds: [], partnerInstitutions: [] }),
    hasModulePermission(session.grants, "REFERRAL_CREATE") &&
    hasModulePermission(session.grants, "PARTICIPANT_VIEW")
      ? collectPages((page, pageSize) => participantsApi.list({ page, pageSize })).catch(() => [])
      : Promise.resolve([]),
  ]);
  const origins: ReferralOriginOption[] = participants.flatMap((participant) =>
    participant.enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      pillarId: enrollment.pillarId,
      participant: participant.name,
      category: enrollment.category,
    }))
  );
  return (
    <>
      <PageHeading
        title="Referral queue"
        section="Records"
        description="Participants moving between pillars — accepting adds an enrollment to the same record"
      />
      <ReferralsContent
        initial={initial}
        pillars={pillars}
        origins={origins}
        catalog={destinations}
        grants={session.grants}
      />
    </>
  );
}
