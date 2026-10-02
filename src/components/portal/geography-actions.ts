"use server";
import { z } from "zod";
import { createEnvelopeSchema } from "@/lib/api/contracts";
import { withSessionApi } from "@/lib/api/session-api";

export interface Geography {
  counties: { id: number; name: string }[];
  subCounties: { id: number; name: string; countyId: number }[];
  wards: { id: number; name: string; subCountyId: number }[];
}

const named = { id: z.number().int(), name: z.string() };
const geographySchema = createEnvelopeSchema(
  z
    .object({
      tables: z.object({
        county: z.array(z.object(named)).default([]),
        sub_county: z.array(z.object({ ...named, county_id: z.number().int() })).default([]),
        ward: z.array(z.object({ ...named, sub_county_id: z.number().int() })).default([]),
      }),
    })
    .nullable()
);

const byName = <T extends { name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));

/** Counties, sub-counties and wards for the location filter, in one lookup call. */
export async function loadGeographyAction(): Promise<{
  success: boolean;
  message: string;
  data: Geography | null;
}> {
  try {
    const { client, token } = await withSessionApi((client, token) => ({ client, token }));
    const response = await client.request(
      {
        method: "GET",
        path: "/lookups",
        routeTemplate: "/lookups",
        token,
        query: { tables: "county,sub_county,ward" },
      },
      geographySchema
    );
    if (!response.success || !response.data)
      return { success: false, message: response.message, data: null };
    const { county, sub_county, ward } = response.data.tables;
    return {
      success: true,
      message: "OK",
      data: {
        counties: byName(county.map(({ id, name }) => ({ id, name }))),
        subCounties: byName(
          sub_county.map((row) => ({ id: row.id, name: row.name, countyId: row.county_id }))
        ),
        wards: byName(
          ward.map((row) => ({ id: row.id, name: row.name, subCountyId: row.sub_county_id }))
        ),
      },
    };
  } catch {
    return { success: false, message: "Could not load locations.", data: null };
  }
}
