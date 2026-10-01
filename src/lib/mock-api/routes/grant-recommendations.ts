import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope } from "../core";
import { pendingRecommendations, pillarIdOf } from "../training";

/**
 * `GET /grants?view=recommended`: Skilling graduates WEE has accepted for a grant
 * and not yet filed an application for, with suggested notes. Never carries salary.
 */
export function handleGrantRecommendations(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  if (request.method !== "GET" || parts.length !== 1 || parts[0] !== "grants") return undefined;
  if (query.get("view") !== "recommended") return undefined;
  if ([...query.keys()].some((key) => key !== "view")) return envelope(422);
  if (!hasPermission(grants, "GRANT_APPLICATION_PREPARE", { pillarId: pillarIdOf(store, "wee") }))
    return envelope(403);
  return envelope(200, { items: pendingRecommendations(store) });
}
