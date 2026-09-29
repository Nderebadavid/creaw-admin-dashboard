import type { LookupView } from "../api";
import type { LookupTable } from "../schemas";

export type Option = { id: number; name: string };
export type Field = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "select" | "checkbox";
  source?: "county" | "pillar";
  choices?: { value: string; label: string }[];
  required?: boolean;
};
export type Config = {
  label: string;
  singular: string;
  subtitle: string;
  columns: { key: string; label: string }[];
  fields: Field[];
};
/** Per-table labels, list columns and form fields for the generic lookup screen. */
export const lookupConfig: Record<LookupTable, Config> = {
  pillar: {
    label: "Pillars",
    singular: "pillar",
    subtitle: "pillar · programme areas",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "lead_user_id", label: "Lead ID" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "focus_description", label: "Focus description", kind: "textarea" },
    ],
  },
  county: {
    label: "Counties",
    singular: "county",
    subtitle: "county · geographic reference",
    columns: [{ key: "name", label: "County" }],
    fields: [{ key: "name", label: "County", required: true }],
  },
  sub_county: {
    label: "Sub-counties",
    singular: "sub-county",
    subtitle: "sub_county · geographic reference",
    columns: [
      { key: "name", label: "Sub-county" },
      { key: "county_id", label: "County" },
    ],
    fields: [{ key: "name", label: "Sub-county", required: true }],
  },
  ward: {
    label: "Wards",
    singular: "ward",
    subtitle: "ward · participants and organisations reference ward_id",
    columns: [
      { key: "name", label: "Ward" },
      { key: "sub_county_id", label: "Sub-county" },
    ],
    fields: [{ key: "name", label: "Ward", required: true }],
  },
  donor: {
    label: "Donors",
    singular: "donor",
    subtitle: "donor · linked to reports and grants",
    columns: [
      { key: "name", label: "Name" },
      { key: "notes", label: "Notes" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  business_sector: {
    label: "Business sectors",
    singular: "business sector",
    subtitle: "business_sector · WEE grant awards",
    columns: [{ key: "name", label: "Name" }],
    fields: [{ key: "name", label: "Name", required: true }],
  },
  case_type: {
    label: "Case types",
    singular: "case type",
    subtitle: "case_type · VAWG legal cases",
    columns: [
      { key: "name", label: "Name" },
      { key: "requires_p3_prc_forms", label: "P3/PRC forms" },
      { key: "default_route", label: "Default route" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "pillar_id", label: "Pillar", kind: "select", source: "pillar" },
      { key: "requires_p3_prc_forms", label: "P3/PRC forms", kind: "checkbox" },
      {
        key: "default_route",
        label: "Default route",
        kind: "select",
        required: true,
        choices: [
          { value: "mediation_adr_first", label: "Mediation/ADR first" },
          { value: "court_direct", label: "Court, direct" },
        ],
      },
    ],
  },
  partner_institution: {
    label: "Partner institutions",
    singular: "institution",
    subtitle: "partner_institution · shared across pillars",
    columns: [
      { key: "name", label: "Name" },
      { key: "institution_type", label: "Type" },
      { key: "county_id", label: "County" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "institution_type", label: "Institution type", required: true },
      { key: "county_id", label: "County", kind: "select", source: "county" },
    ],
  },
  activity_type_definition: {
    label: "Activity types",
    singular: "activity type",
    subtitle: "activity_type_definition · group sessions",
    columns: [
      { key: "pillar_id", label: "Pillar" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
    ],
    fields: [
      { key: "pillar_id", label: "Pillar", kind: "select", source: "pillar", required: true },
      { key: "name", label: "Name", required: true },
      { key: "description", label: "Description", kind: "textarea" },
    ],
  },
};
/** Category tabs; the three geography tables share the first tab. */
export const lookupTabs: { label: string; table: LookupTable }[] = [
  { label: "Geography", table: "county" },
  { label: "Pillars", table: "pillar" },
  { label: "Donors", table: "donor" },
  { label: "Business sectors", table: "business_sector" },
  { label: "Case types", table: "case_type" },
  { label: "Partner institutions", table: "partner_institution" },
  { label: "Activity types", table: "activity_type_definition" },
];
/** Display text for one cell, resolving foreign keys to names. */
export function labelFor(
  row: LookupView,
  key: string,
  counties: Option[],
  subCounties: Option[],
  pillars: Option[]
) {
  const value = row[key as keyof LookupView];
  if (key === "county_id") return counties.find((item) => item.id === value)?.name ?? "—";
  if (key === "sub_county_id") return subCounties.find((item) => item.id === value)?.name ?? "—";
  if (key === "pillar_id") return pillars.find((item) => item.id === value)?.name ?? "—";
  if (key === "requires_p3_prc_forms") return value ? "Yes" : "No";
  if (key === "default_route")
    return value === "court_direct" ? "Court, direct" : "Mediation/ADR first";
  return value == null || value === "" ? "—" : String(value);
}

/** County, sub-county and ward form a drill-down hierarchy. */
export const isGeoTable = (table: LookupTable) =>
  table === "county" || table === "sub_county" || table === "ward";

/** Reads the dialog form into API values: blank optional fields become `null`. */
export function readLookupValues(data: FormData, fields: Field[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === "checkbox") values[field.key] = data.has(field.key);
    else if (field.source) {
      const raw = String(data.get(field.key) ?? "");
      if (raw) values[field.key] = Number(raw);
      else if (!field.required) values[field.key] = null;
    } else {
      const raw = String(data.get(field.key) ?? "").trim();
      values[field.key] = raw || (field.required ? "" : null);
    }
  }
  return values;
}
