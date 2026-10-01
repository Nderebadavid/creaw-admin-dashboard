import { hasPermission, hasModulePermission } from "../../auth/permissions";
import { type MockContext, type ResourceTarget } from "../context";
import { envelope, permissionCodes, type Row, readableAsReference } from "../core";
import { signoffActors } from "../reporting";
import { type ApiEnvelope } from "@/types/api";

/** Grant sign-off statuses in order. DECLINED sits outside the chain and is final. */
const GRANT_CHAIN = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];

/** Chooses the permission a resource request needs and enforces workflow rules (grant sign-off order, referral responses, award changes). Returns the permission code or an error envelope. */
export function resolvePermission(
  ctx: MockContext & ResourceTarget
): ApiEnvelope<unknown> | string {
  const { request, store, userId, grants, family, pillar, table, existing } = ctx;
  let permission =
    permissionCodes[table]?.[request.method === "GET" ? 0 : 1] ??
    (request.method === "GET" ? "DASHBOARD_VIEW" : "LOOKUP_MANAGE");
  if (family === "admin/pipelines") permission = "PILLAR_CONFIG_MANAGE";
  if (family === "lookups" && request.method !== "GET") permission = "LOOKUP_MANAGE";
  if (family === "lookups" && request.method === "GET" && hasPermission(grants, "LOOKUP_MANAGE"))
    permission = "LOOKUP_MANAGE";
  if (table === "role" && request.method === "GET" && hasPermission(grants, "PERMISSION_MANAGE"))
    permission = "PERMISSION_MANAGE";
  if (family === "assessments" && table === "organisation" && request.method === "GET")
    permission = "ORG_ASSESSMENT_VIEW";
  if (table === "referral" && request.method === "POST") permission = "REFERRAL_CREATE";
  if (
    table === "grant_application" &&
    request.method !== "GET" &&
    request.body &&
    typeof request.body === "object" &&
    "status" in request.body
  ) {
    const status = request.body.status;
    const stepPermission: Record<string, string> = {
      PREPARED: "GRANT_APPLICATION_PREPARE",
      REVIEWED: "GRANT_APPLICATION_REVIEW",
      APPROVED: "GRANT_APPLICATION_APPROVE",
    };
    // Declining belongs to the officer whose turn it is: it needs the
    // permission of the step that would otherwise come next.
    const nextStep = GRANT_CHAIN[GRANT_CHAIN.indexOf(String(existing?.status)) + 1];
    if (status !== existing?.status)
      permission = stepPermission[status === "DECLINED" ? nextStep : String(status)] ?? permission;
  }
  if (
    table === "grant_application" &&
    request.method === "PATCH" &&
    existing &&
    request.body &&
    typeof request.body === "object" &&
    "status" in request.body
  ) {
    const change = request.body as unknown as Row;
    const order = GRANT_CHAIN;
    const onlyStatus = Object.keys(change).every(
      (key) => key === "status" || key === "status_description"
    );
    if (existing.status === "DECLINED")
      return envelope(422, null, "A declined application is final");
    if (change.status === "DECLINED") {
      const reason = change.status_description;
      if (
        !onlyStatus ||
        existing.status === "APPROVED" ||
        !order.includes(String(existing.status)) ||
        typeof reason !== "string" ||
        !reason.trim()
      )
        return envelope(
          422,
          null,
          "Declining needs a reason and an application that is not yet approved"
        );
      // Maker-checker: whoever signed an earlier step cannot also decide this one.
      const signed = signoffActors(store, existing.id);
      if (
        (existing.status === "PREPARED" && signed.preparedBy === userId) ||
        (existing.status === "REVIEWED" && [signed.preparedBy, signed.reviewedBy].includes(userId))
      )
        return envelope(403, null, "A different officer must decide this sign-off step");
      return permission;
    }
    if (
      !onlyStatus ||
      order.indexOf(String(change.status)) !== order.indexOf(String(existing.status)) + 1
    )
      return envelope(422, null, "Grant sign-off must follow prepared, reviewed, approved order");
    const actors = signoffActors(store, existing.id);
    if (
      (change.status === "REVIEWED" && !actors.preparedBy) ||
      (change.status === "APPROVED" && (!actors.preparedBy || !actors.reviewedBy))
    )
      return envelope(422, null, "A complete audited sign-off history is required");
    if (
      (change.status === "REVIEWED" && actors.preparedBy === userId) ||
      (change.status === "APPROVED" && [actors.preparedBy, actors.reviewedBy].includes(userId))
    )
      return envelope(403, null, "A different officer must complete this sign-off step");
    if (
      change.status === "APPROVED" &&
      store.grant_award.some((award) => !award.is_deleted && award.application_id === existing.id)
    )
      return envelope(422, null, "Application already has an award");
  }
  if (
    table === "grant_application" &&
    request.method === "POST" &&
    request.body &&
    typeof request.body === "object" &&
    "status" in request.body &&
    !["ACTIVE", "PREPARED"].includes(String(request.body.status))
  )
    return envelope(422, null, "New applications can only begin active or prepared");
  // Awards only come into being when an application is approved.
  if (table === "grant_award" && request.method === "POST")
    return envelope(422, null, "Awards are created by application approval");
  if (
    table === "grant_award" &&
    request.method === "PATCH" &&
    request.body &&
    typeof request.body === "object"
  ) {
    if ("application_id" in request.body)
      return envelope(422, null, "An award cannot be moved to another application");
    if ("amount_awarded" in request.body || "currency" in request.body)
      permission = "GRANT_APPLICATION_APPROVE";
  }
  if (
    table === "organisation_assessment" &&
    request.body &&
    typeof request.body === "object" &&
    "overall_recommendation" in request.body
  ) {
    const recommendation = request.body.overall_recommendation;
    const requiresApproval =
      request.method === "POST"
        ? recommendation != null
        : request.method === "PATCH" && recommendation !== existing?.overall_recommendation;
    if (requiresApproval) permission = "ORG_ASSESSMENT_APPROVE";
  }
  if (
    table === "referral" &&
    request.method === "PATCH" &&
    request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
  ) {
    const change = request.body as Row;
    const keys = Object.keys(change);
    if (
      !existing ||
      existing.status !== "NEW" ||
      !keys.length ||
      keys.some((key) => !["status", "trigger_reason", "notes"].includes(key))
    )
      return envelope(422);
    if (change.status === "ACCEPTED" || change.status === "DECLINED") {
      if (keys.some((key) => key !== "status" && key !== "notes")) return envelope(422);
      permission = "REFERRAL_ACCEPT";
    } else if (change.status === "WITHDRAWN" || change.status === undefined) {
      if (change.status === "WITHDRAWN" && keys.some((key) => key !== "status"))
        return envelope(422);
      permission = "REFERRAL_CREATE";
    } else return envelope(422);
  }
  if (
    !permission ||
    (!hasModulePermission(grants, permission) &&
      !(request.method === "GET" && readableAsReference(grants, table)))
  )
    return envelope(403);
  if (pillar && !hasPermission(grants, permission, { pillarId: pillar.id })) return envelope(403);
  return permission;
}
