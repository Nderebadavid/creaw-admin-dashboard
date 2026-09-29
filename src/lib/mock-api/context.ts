import type { ApiRequest } from "../api/transport";
import type { EffectiveGrant } from "../auth/permissions";
import type { MockStore, TableName } from "@/types/db";
import type { Row } from "./core";

/** Everything a route handler needs about the incoming request and caller. */
export interface MockContext {
  request: ApiRequest<unknown>;
  store: MockStore;
  url: URL;
  query: URLSearchParams;
  /** Path segments, e.g. `/admin/users/4` -> `["admin", "users", "4"]`. */
  parts: string[];
  userId: number;
  grants: EffectiveGrant[];
}

/** The table and row a generic resource request resolves to. */
export interface ResourceTarget {
  /** Route family: the first path segment, or `admin/<section>` for admin routes. */
  family: string;
  /** Set for `/pillars/:pillar` requests, which are scoped to one pillar. */
  pillar?: MockStore["pillar"][number];
  table: TableName;
  id?: number;
  rows: Row[];
  existing?: Row;
}

/** A resolved resource request plus the permission the caller must hold. */
export interface ResourceContext extends MockContext, ResourceTarget {
  permission: string;
}
