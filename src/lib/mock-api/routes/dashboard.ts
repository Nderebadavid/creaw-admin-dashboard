import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { allowed, envelope, type Row } from "../core";
import { type ApiEnvelope } from "@/types/api";

/** `GET /dashboard`: pillar-scoped overview counts. */
export function handleDashboard(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, grants } = ctx;
  if (url.pathname === "/dashboard") {
    if (request.method !== "GET") return envelope(422);
    const pillars = store.pillar.filter(
      (pillar) =>
        !pillar.is_deleted && hasPermission(grants, "DASHBOARD_VIEW", { pillarId: pillar.id })
    );
    if (!pillars.length) return envelope(403);
    return envelope(200, {
      pillars,
      participantCount: store.participant.filter(
        (row) =>
          !row.is_deleted &&
          allowed(store, grants, "PARTICIPANT_VIEW", "participant", row as unknown as Row)
      ).length,
      enrollmentCount: store.enrollment.filter(
        (row) => !row.is_deleted && pillars.some((pillar) => pillar.id === row.pillar_id)
      ).length,
    });
  }
  return undefined;
}
