import { type ResourceContext } from "../context";
import { envelope, type Row } from "../core";
import type { ApiEnvelope } from "@/types/api";
import type { MockStore } from "@/types/db";

type Envelope = ApiEnvelope<unknown>;
const invalid = (message: string) => envelope(422, null, message);
const live = (row: { is_deleted: boolean; status: string }) =>
  !row.is_deleted && row.status === "ACTIVE";

/** Whether a user is active staff holding the Counsellor role. */
export function isStaffCounsellor(store: MockStore, userId: unknown) {
  const user = store.user.find((row) => row.id === userId);
  const role = store.role.find((row) => row.code === "COUNSELLOR" && !row.is_deleted);
  return (
    !!user &&
    !!role &&
    live(user) &&
    store.user_role.some(
      (link) => !link.is_deleted && link.user_id === user.id && link.role_id === role.id
    )
  );
}

/** Whether a provider is an active external counsellor. */
export function isProviderCounsellor(store: MockStore, providerId: unknown) {
  const provider = store.external_provider.find((row) => row.id === providerId);
  return !!provider && live(provider) && provider.provider_type === "counsellor";
}

/** The next session number for a survivor's enrollment, counting removed sessions too. */
export function nextSessionNo(store: MockStore, enrollmentId: unknown) {
  return (
    Math.max(
      0,
      ...store.counselling_session
        .filter((row) => row.enrollment_id === enrollmentId)
        .map((row) => row.session_no)
    ) + 1
  );
}

/**
 * Counselling counsellor rules: at most one counsellor is linked, and a newly linked one
 * must be an active staff counsellor or an active external counsellor (an unchanged one
 * may have left since). The body check already rejects client session numbers and moves
 * to another survivor.
 */
export function checkCounsellingWrite(
  ctx: ResourceContext,
  next: Row,
  existing: Row | undefined
): Envelope | undefined {
  if (ctx.table !== "counselling_session") return undefined;
  const { store } = ctx;
  if (next.counsellor_user_id && next.counsellor_provider_id)
    return invalid("Choose one counsellor");
  if (
    next.counsellor_user_id &&
    next.counsellor_user_id !== existing?.counsellor_user_id &&
    !isStaffCounsellor(store, next.counsellor_user_id)
  )
    return invalid("Choose a counsellor from the list");
  if (
    next.counsellor_provider_id &&
    next.counsellor_provider_id !== existing?.counsellor_provider_id &&
    !isProviderCounsellor(store, next.counsellor_provider_id)
  )
    return invalid("Choose a counsellor from the list");
  return undefined;
}
