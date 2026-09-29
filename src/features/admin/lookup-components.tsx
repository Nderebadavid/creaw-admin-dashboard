"use client";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, History, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { ExportButton } from "@/components/ui/export-button";
import type { LookupView } from "./api";
import type { LookupTable } from "./schemas";
import {
  createLookupAction,
  exportLookupAction,
  setLookupActiveAction,
  updateLookupAction,
} from "./lookup-actions";

type Option = { id: number; name: string };
type Field = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "select" | "checkbox";
  source?: "county" | "pillar";
  choices?: { value: string; label: string }[];
  required?: boolean;
};
type Config = {
  label: string;
  singular: string;
  subtitle: string;
  columns: { key: string; label: string }[];
  fields: Field[];
};
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
const tabs: { label: string; table: LookupTable }[] = [
  { label: "Geography", table: "county" },
  { label: "Pillars", table: "pillar" },
  { label: "Donors", table: "donor" },
  { label: "Business sectors", table: "business_sector" },
  { label: "Case types", table: "case_type" },
  { label: "Partner institutions", table: "partner_institution" },
  { label: "Activity types", table: "activity_type_definition" },
];
const inputClass =
  "mt-1 w-full rounded-lg border border-[#E2DBD3] bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
function labelFor(
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
export function LookupContent({
  table,
  rows,
  parent,
  counties,
  subCounties,
  pillars,
  canViewAudit = false,
  canExport = false,
}: {
  table: LookupTable;
  rows: LookupView[];
  parent: { id: number; name: string; parentId: number | null } | null;
  counties: Option[];
  subCounties: Option[];
  pillars: Option[];
  canViewAudit?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const config = lookupConfig[table];
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState<PageSize>(10);
  const [modal, setModal] = useState<"add" | "edit" | "toggle" | null>(null),
    [target, setTarget] = useState<LookupView | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!query ||
            config.columns.some((col) =>
              labelFor(row, col.key, counties, subCounties, pillars)
                .toLowerCase()
                .includes(query.toLowerCase())
            )) &&
          (status === "all" ||
            (status === "active") === (!row.is_deleted && row.status === "ACTIVE"))
      ),
    [rows, query, status, config.columns, counties, subCounties, pillars]
  );
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isGeo = ["county", "sub_county", "ward"].includes(table);
  const start = (kind: typeof modal, row: LookupView | null = null) => {
    setError("");
    setTarget(row);
    setModal(kind);
  };
  async function execute(promise: Promise<{ success: boolean; message: string }>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await promise;
      if (response.success) {
        setFeedback(message);
        setModal(null);
        router.refresh();
      } else setError(response.message);
    } catch {
      setError("Could not save this entry. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    for (const field of config.fields) {
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
    if (modal === "add" && table === "sub_county" && parent) values.county_id = parent.id;
    if (modal === "add" && table === "ward" && parent) values.sub_county_id = parent.id;
    if (modal === "add")
      void execute(createLookupAction({ table, values }), `${config.singular} added.`);
    if (modal === "edit" && target)
      void execute(updateLookupAction({ table, id: target.id, values }), "Entry saved.");
  }
  const drillHref = (row: LookupView) =>
    table === "county"
      ? `/admin/lookups/sub_county?countyId=${row.id}`
      : table === "sub_county"
        ? `/admin/lookups/ward?subCountyId=${row.id}&countyId=${parent?.id ?? row.county_id}`
        : "";
  return (
    <div className="space-y-5">
      <nav
        aria-label="Lookup categories"
        className="flex gap-1 overflow-x-auto border-b border-[#E2DBD3]"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.table}
            href={`/admin/lookups/${tab.table}`}
            aria-current={
              table === tab.table || (isGeo && tab.table === "county") ? "page" : undefined
            }
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${table === tab.table || (isGeo && tab.table === "county") ? "border-[#B4552E] text-[#B4552E]" : "border-transparent text-[#6B625B]"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {feedback && (
        <p role="status" className="rounded-lg bg-[#EAF5ED] p-3 text-sm text-[#246842]">
          {feedback}
        </p>
      )}
      {error && !modal && (
        <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">
          {error}
        </p>
      )}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#ECE6DF] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1ECE6] p-5">
          <div>
            <h2 className="font-heading text-2xl font-bold">
              {parent ? `${parent.name} · ${config.label.toLowerCase()}` : config.label}
            </h2>
            <p className="text-sm text-[#8A8078]">
              {config.subtitle} · {rows.length} rows
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <ExportButton
                exportAction={() =>
                  exportLookupAction({
                    table,
                    parentId: parent?.id,
                    ids: filtered.map((row) => row.id),
                  })
                }
              />
            )}
            <Button
              disabled={busy || ((table === "sub_county" || table === "ward") && !parent)}
              onClick={() => start("add")}
            >
              <Plus />
              Add {config.singular}
            </Button>
          </div>
        </div>
        {isGeo && (
          <nav
            aria-label="Geography breadcrumb"
            className="flex flex-wrap items-center gap-2 px-5 pt-4 text-sm"
          >
            <Link
              href="/admin/lookups/county"
              className="rounded-full bg-[#F7F4F0] px-3 py-1 font-semibold"
            >
              Kenya
            </Link>
            {(table === "sub_county" || table === "ward") && (
              <>
                <ChevronRight size={15} />
                {parent?.parentId ? (
                  <Link
                    href={`/admin/lookups/sub_county?countyId=${parent.parentId}`}
                    className="rounded-full bg-[#F7F4F0] px-3 py-1 font-semibold"
                  >
                    {counties.find((row) => row.id === parent.parentId)?.name ?? "County"}
                  </Link>
                ) : (
                  <span className="rounded-full bg-[#B4552E] px-3 py-1 font-semibold text-white">
                    {parent?.name ?? "All counties"}
                  </span>
                )}
              </>
            )}
            {table === "ward" && (
              <>
                <ChevronRight size={15} />
                <span className="rounded-full bg-[#B4552E] px-3 py-1 font-semibold text-white">
                  {parent?.name ?? "All sub-counties"}
                </span>
              </>
            )}
          </nav>
        )}
        {isGeo && !parent && table !== "county" && (
          <p className="px-5 pt-3 text-sm text-[#8A8078]">
            Open a {table === "ward" ? "sub-county" : "county"} from the geography hierarchy to add
            a child.
          </p>
        )}
        <div className="flex flex-wrap gap-3 p-5">
          <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border bg-[#F7F4F0] px-3 py-2">
            <Search size={16} />
            <span className="sr-only">Search {config.label.toLowerCase()}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${config.label.toLowerCase()}`}
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="ml-2 rounded-lg border bg-white p-2"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-sm">
            <thead className="bg-[#FCFAF7] text-xs text-[#6B625B]">
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key} className="p-3">
                    {column.label}
                  </th>
                ))}
                <th className="p-3">Active</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-t border-[#F7F2EC]">
                  {config.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`p-3 ${index === 0 ? "font-semibold" : "text-[#6B625B]"}`}
                    >
                      {index === 0 && isGeo && table !== "ward" ? (
                        <Link
                          href={drillHref(row)}
                          className="inline-flex items-center gap-1 text-[#B4552E] hover:underline"
                        >
                          {labelFor(row, column.key, counties, subCounties, pillars)}
                          <ChevronRight size={15} />
                        </Link>
                      ) : (
                        labelFor(row, column.key, counties, subCounties, pillars)
                      )}
                    </td>
                  ))}
                  <td className="p-3">
                    <button
                      type="button"
                      role="switch"
                      aria-label={`${row.is_deleted ? "Reactivate" : "Deactivate"} ${row.name}`}
                      aria-checked={!row.is_deleted && row.status === "ACTIVE"}
                      onClick={() => start("toggle", row)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${!row.is_deleted && row.status === "ACTIVE" ? "bg-[#3D9B72]" : "bg-[#C9C0B7]"}`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${!row.is_deleted && row.status === "ACTIVE" ? "right-0.5" : "left-0.5"}`}
                      />
                    </button>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <Button variant="ghost" size="sm" onClick={() => start("edit", row)}>
                      <Pencil />
                      Edit
                    </Button>
                    {canViewAudit ? (
                      <Link
                        href={`/audit?module=${table}&targetId=${row.id}`}
                        className="ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#6B625B] hover:bg-[#F7F4F0]"
                      >
                        <History size={14} />
                        History
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title="Audit log permission required"
                      >
                        <History />
                        History
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageRows.length === 0 && (
            <p className="p-8 text-center text-sm text-[#8A8078]">
              {rows.length === 0 ? "No entries yet." : "No entries match these filters."}
            </p>
          )}
        </div>
        <div className="px-5">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
        {table === "pillar" && (
          <p className="mx-5 mb-5 rounded-lg bg-[#F7F4F0] p-3 text-sm text-[#6B625B]">
            Leadership has a pillar row but no pipeline yet. Configure its pathway under Pipeline
            config.
          </p>
        )}
      </section>
      <Dialog
        open={modal !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle>
            {modal === "add"
              ? `Add ${config.singular}`
              : modal === "edit"
                ? "Edit entry"
                : target?.is_deleted
                  ? "Reactivate entry?"
                  : "Deactivate entry?"}
          </DialogTitle>
          <DialogDescription>
            {modal === "toggle"
              ? target?.is_deleted
                ? `Reactivate “${target.name}”? It will be selectable in forms again.`
                : `Deactivate “${target?.name}”? Existing records keep their reference.`
              : parent
                ? `Under ${parent.name}`
                : config.subtitle}
          </DialogDescription>
          {error && (
            <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">
              {error}
            </p>
          )}
          {modal === "toggle" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy || !target}
                variant={target?.is_deleted ? "default" : "destructive"}
                onClick={() => {
                  if (target)
                    void execute(
                      setLookupActiveAction({ table, id: target.id, active: target.is_deleted }),
                      target.is_deleted ? "Entry reactivated." : "Entry deactivated."
                    );
                }}
              >
                {busy ? "Saving…" : target?.is_deleted ? "Reactivate" : "Deactivate"}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {config.fields.map((field) => {
                const value = target?.[field.key as keyof LookupView];
                const options =
                  field.source === "county" ? counties : field.source === "pillar" ? pillars : [];
                return (
                  <label key={field.key} className="block text-sm font-medium">
                    {field.kind === "checkbox" ? (
                      <span className="flex items-center gap-2">
                        <input type="checkbox" name={field.key} defaultChecked={Boolean(value)} />
                        {field.label}
                      </span>
                    ) : (
                      <>
                        {field.label}
                        {field.kind === "textarea" ? (
                          <textarea
                            className={inputClass}
                            name={field.key}
                            defaultValue={
                              typeof value === "string" && !value.startsWith("••") ? value : ""
                            }
                          />
                        ) : field.kind === "select" ? (
                          <select
                            className={inputClass}
                            name={field.key}
                            required={field.required}
                            defaultValue={value == null ? "" : String(value)}
                          >
                            <option value="">{field.required ? "Select" : "None"}</option>
                            {field.choices
                              ? field.choices.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))
                              : options
                                  .filter((option) => option.id > 0)
                                  .map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name}
                                    </option>
                                  ))}
                          </select>
                        ) : (
                          <input
                            className={inputClass}
                            name={field.key}
                            required={field.required}
                            readOnly={
                              modal === "edit" && table === "pillar" && field.key === "code"
                            }
                            maxLength={
                              field.key === "code"
                                ? 20
                                : field.key === "institution_type"
                                  ? 30
                                  : 160
                            }
                            defaultValue={typeof value === "string" ? value : ""}
                          />
                        )}
                      </>
                    )}
                  </label>
                );
              })}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : modal === "add" ? "Add" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
