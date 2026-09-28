import { fetchMembers } from "./actions";
import { MembersTable } from "@/components/features/member/members-table";
import type { Member } from "@/types/member";

export default async function MembersPage() {
  const result = await fetchMembers();
  const members = result.success ? ((result.data as Member[]) ?? []) : [];
  const error = result.success ? undefined : result.message;

  return (
    <div className="p-6">
      <MembersTable members={members} error={error} />
    </div>
  );
}
