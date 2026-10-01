import { z } from "zod";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
import { listParams, type ListQuery } from "@/lib/api/list";
import type { PaginatedData } from "@/types/api";
import type { PillarCode } from "./schemas";

export interface PillarDomainRecord {
  id: number;
  title: string;
  values: string[];
  status: string;
}
export interface PillarDomainView {
  title: string;
  subtitle: string;
  columns: string[];
  /** The first page of rows; further pages come from `listPillarDomainAction`. */
  rows: PillarDomainRecord[];
  totalItems: number;
  /** Statuses the register can be filtered by. */
  statuses: string[];
}

const applicationSchema = z.object({
  id: z.number().int(),
  status: z.string(),
  updated_at: z.string(),
  participant_id: z.number().int().nullable(),
  organisation_id: z.number().int().nullable(),
  participant_name: z.string().nullish(),
  organisation_name: z.string().nullish(),
  notes: z.string().nullable(),
  requested_amount: z.number(),
});
const applicationList = createEnvelopeSchema(
  z.union([createPaginatedSchema(applicationSchema), z.null()])
);

/** The registers that stay on the generic pillar page; the others have dedicated workspaces. */
export const GENERIC_DOMAIN_CODES: readonly PillarCode[] = ["wee"];

/** Column index (and "status") to the API field a click on its header sorts by. */
export const DOMAIN_SORT_KEYS: Record<string, string> = {
  "0": "participant_name",
  "1": "notes",
  "2": "requested_amount",
  status: "status",
};

/** One page of WEE's grant applications for the generic pillar register. */
export async function loadPillarDomain(
  client: ApiClient,
  token: string,
  code: PillarCode,
  query: ListQuery = {}
): Promise<PillarDomainView | null> {
  if (!GENERIC_DOMAIN_CODES.includes(code)) return null;
  const result = await client.request(
    {
      method: "GET",
      path: `/pillars/${code}`,
      routeTemplate: "/pillars/:pillar",
      token,
      query: { table: "grant_application", ...listParams(query, DOMAIN_SORT_KEYS) },
    },
    applicationList
  );
  if (!result.success || !result.data) return null;
  const page: PaginatedData<z.infer<typeof applicationSchema>> = result.data;
  return {
    title: "Grant applications",
    subtitle: "Prepared → Reviewed → Approved sign-off chain",
    columns: ["Applicant", "Business", "Requested"],
    rows: page.items.map((row) => ({
      id: row.id,
      title: `Application #${row.id}`,
      values: [
        row.participant_name ?? row.organisation_name ?? "Applicant record",
        row.notes ?? "Not recorded",
        `KES ${row.requested_amount.toLocaleString("en-KE")}`,
      ],
      status: row.status,
    })),
    totalItems: page.totalItems,
    statuses: ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED", "DECLINED"],
  };
}
