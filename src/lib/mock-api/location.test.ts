import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { ApiRouteTemplate } from "../api/transport";
import { handleMockRequest } from "./handlers";
import { getMockStore, issueMockToken, resetMockStore } from "./store";

const ADMIN = 1;
/** Head of MERL: edits participants everywhere, but may not correct identity details. */
const HEAD_OF_MERL = 2;

const call = (
  path: string,
  routeTemplate: ApiRouteTemplate,
  query: Record<string, string | number> = {},
  {
    method = "GET",
    body,
    user = ADMIN,
  }: { method?: "GET" | "PATCH"; body?: unknown; user?: number } = {}
) =>
  handleMockRequest({
    method,
    path,
    routeTemplate,
    correlationId: "location",
    token: issueMockToken(user),
    query,
    body,
  });

type Page = { items: { id: number }[]; totalItems: number };
const ids = async (path: string, template: ApiRouteTemplate, query = {}) =>
  ((await call(path, template, { pageSize: 100, ...query })).data as Page).items.map(
    (row) => row.id
  );

/** A ward with a participant in it, with its sub-county and county. */
function placedParticipant() {
  const store = getMockStore();
  const person = store.participant.find((row) => row.ward_id !== null && !row.is_deleted)!;
  const ward = store.ward.find((row) => row.id === person.ward_id)!;
  const subCounty = store.sub_county.find((row) => row.id === ward.sub_county_id)!;
  return { person, ward, subCounty, countyId: subCounty.county_id };
}

beforeEach(() => resetMockStore());

describe("location filters on lists", () => {
  it("narrows participants by county, sub-county and ward", async () => {
    const { person, ward, subCounty, countyId } = placedParticipant();
    const store = getMockStore();
    const inWard = store.participant.filter((row) => !row.is_deleted && row.ward_id === ward.id);
    const byWard = await ids("/participants", "/participants", { wardId: ward.id });
    expect(byWard.sort()).toEqual(inWard.map((row) => row.id).sort());
    expect(await ids("/participants", "/participants", { subCountyId: subCounty.id })).toContain(
      person.id
    );
    expect(await ids("/participants", "/participants", { countyId })).toContain(person.id);
    // A ward outside the county matches nothing.
    const elsewhere = store.county.find((row) => row.id !== countyId)!;
    expect(
      await ids("/participants", "/participants", { countyId: elsewhere.id, wardId: ward.id })
    ).toEqual([]);
  });

  it("places records through their enrollment, e.g. referrals and legal cases", async () => {
    const store = getMockStore();
    const referral = store.referral.find((row) => !row.is_deleted)!;
    const enrollment = store.enrollment.find((row) => row.id === referral.enrollment_id)!;
    const person = store.participant.find((row) => row.id === enrollment.participant_id)!;
    // Move the referred person to a known ward so the test does not depend on seed geography.
    const ward = store.ward[0];
    person.ward_id = ward.id;
    expect(await ids("/referrals", "/referrals", { wardId: ward.id })).toContain(referral.id);
    const other = store.ward.find((row) => row.id !== ward.id)!;
    expect(await ids("/referrals", "/referrals", { wardId: other.id })).not.toContain(referral.id);
  });

  it("refuses a location on lists that have no place, and malformed ids", async () => {
    expect((await call("/donors", "/donors", { countyId: 1 })).resultCode).toBe(422);
    expect((await call("/participants", "/participants", { countyId: "abc" })).resultCode).toBe(
      422
    );
    expect((await call("/participants", "/participants", { wardId: 0 })).resultCode).toBe(422);
  });

  it("lets any signed-in user read geography for the filter", async () => {
    // A user whose only permission is COUNSELLING_VIEW: no participant, referral or
    // dashboard access, which used to be required to read geography.
    const store = getMockStore();
    const user = store.user.find((row) => row.id === 13)!;
    user.status = "ACTIVE";
    for (const link of store.user_role) if (link.user_id === 13) link.is_deleted = true;
    const permission = store.permission.find((row) => row.code === "COUNSELLING_VIEW")!;
    store.role.push({ ...store.role[10], id: 99, code: "COUNSEL_ONLY", is_system_role: false });
    store.role_permission.push({
      ...store.role_permission[0],
      id: 9999,
      role_id: 99,
      permission_id: permission.id,
    });
    store.user_role.push({
      ...store.user_role[0],
      id: 9999,
      user_id: 13,
      role_id: 99,
      pillar_id: null,
    });
    const response = await call(
      "/lookups",
      "/lookups",
      { tables: "county,sub_county,ward,pillar" },
      {
        user: 13,
      }
    );
    expect(response.resultCode).toBe(200);
    // Geography is readable; pillars still need participant or referral access.
    expect((response.data as { denied: string[] }).denied).toEqual(["pillar"]);
  });
});

describe("dashboard location and disability", () => {
  it("counts persons with disability and narrows every people figure to the area", async () => {
    const { countyId } = placedParticipant();
    const store = getMockStore();
    store.participant[0].is_person_with_disability = true;
    const all = (
      await call("/dashboard", "/dashboard", {
        view: "overview",
        from: "2026-01-01",
        to: "2026-12-31",
      })
    ).data as { participant_count: number; pwd_count: number };
    expect(all.pwd_count).toBe(
      store.participant.filter((row) => !row.is_deleted && row.is_person_with_disability).length
    );
    const area = (
      await call("/dashboard", "/dashboard", {
        view: "overview",
        from: "2026-01-01",
        to: "2026-12-31",
        countyId,
      })
    ).data as { participant_count: number; pwd_count: number };
    expect(area.participant_count).toBeGreaterThan(0);
    expect(area.participant_count).toBeLessThanOrEqual(all.participant_count);
    expect(
      (await call("/dashboard", "/dashboard", { view: "overview", wardId: "x" })).resultCode
    ).toBe(422);
  });
});

describe("participant identity corrections", () => {
  const patch = (id: number, body: unknown, user: number) =>
    call(`/participants/${id}`, "/participants/:id", {}, { method: "PATCH", body, user });

  it("needs PARTICIPANT_RECORD_MANAGE for identity fields, not for everyday edits", async () => {
    const person = getMockStore().participant.find((row) => !row.is_deleted)!;
    expect((await patch(person.id, { remarks: "Called back" }, HEAD_OF_MERL)).resultCode).toBe(200);
    expect(
      (await patch(person.id, { is_person_with_disability: true }, HEAD_OF_MERL)).resultCode
    ).toBe(403);
    expect((await patch(person.id, { is_person_with_disability: true }, ADMIN)).resultCode).toBe(
      200
    );
    expect(
      getMockStore().participant.find((row) => row.id === person.id)?.is_person_with_disability
    ).toBe(true);
  });

  it("keeps ID numbers unique when one is corrected", async () => {
    const [first, second] = getMockStore().participant.filter(
      (row) => !row.is_deleted && row.id_number
    );
    expect(
      (await patch(second.id, { id_number: first.id_number!.toUpperCase() }, ADMIN)).resultCode
    ).toBe(422);
    // Re-saving the participant's own number is not a clash.
    expect((await patch(first.id, { id_number: first.id_number }, ADMIN)).resultCode).toBe(200);
  });
});
