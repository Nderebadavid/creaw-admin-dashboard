"use client";
import { FormBanner } from "@/components/ui/form-banner";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { isGeoTable, labelFor, lookupConfig, lookupTabs, type Option } from "./lookups/config";
import { GeoBreadcrumb } from "./lookups/geo-breadcrumb";
import { LookupEntryDialog, ToggleActiveDialog } from "./lookups/lookup-dialogs";
import { LookupTableView } from "./lookups/lookup-table";

type Modal = { kind: "add" } | { kind: "edit" | "toggle"; row: LookupView } | null;

/**
 * Generic reference-data screen for one lookup table. Search, status filter and
 * paging run client-side over the rows the page loaded; every change goes
 * through a Server Action and then refreshes the route.
 */
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
  /** The county or sub-county whose children are listed, for geography drill-down. */
  parent: { id: number; name: string; parentId: number | null } | null;
  counties: Option[];
  subCounties: Option[];
  pillars: Option[];
  canViewAudit?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const config = lookupConfig[table];
  const isGeo = isGeoTable(table);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!query ||
            config.columns.some((column) =>
              labelFor(row, column.key, counties, subCounties, pillars)
                .toLowerCase()
                .includes(query.toLowerCase())
            )) &&
          (status === "all" ||
            (status === "active") === (!row.is_deleted && row.status === "ACTIVE"))
      ),
    [rows, query, status, config.columns, counties, subCounties, pillars]
  );
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const open = (next: Modal) => {
    setError("");
    setModal(next);
  };

  /** Runs a mutation, then closes the dialog and refreshes on success. */
  async function run(action: Promise<{ success: boolean; message: string }>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await action;
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

  function saveEntry(values: Record<string, unknown>) {
    if (modal?.kind === "edit") {
      void run(updateLookupAction({ table, id: modal.row.id, values }), "Entry saved.");
      return;
    }
    // New geographic children always belong to the parent being viewed.
    if (table === "sub_county" && parent) values.county_id = parent.id;
    if (table === "ward" && parent) values.sub_county_id = parent.id;
    void run(createLookupAction({ table, values }), `${config.singular} added.`);
  }

  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <div className="space-y-5">
      <nav
        aria-label="Lookup categories"
        className="flex gap-1 overflow-x-auto border-b border-creaw-line-strong"
      >
        {lookupTabs.map((tab) => {
          const current = table === tab.table || (isGeo && tab.table === "county");
          return (
            <Link
              key={tab.table}
              href={`/admin/lookups/${tab.table}`}
              aria-current={current ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${current ? "border-creaw-orange text-creaw-orange" : "border-transparent text-creaw-body"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{error}</FormBanner>}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-creaw-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-creaw-divider p-5">
          <div>
            <h2 className="font-heading text-2xl font-bold">
              {parent ? `${parent.name} · ${config.label.toLowerCase()}` : config.label}
            </h2>
            <p className="text-sm text-creaw-faint">
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
              onClick={() => open({ kind: "add" })}
            >
              <Plus />
              Add {config.singular}
            </Button>
          </div>
        </div>
        {isGeo && <GeoBreadcrumb table={table} parent={parent} counties={counties} />}
        <div className="flex flex-wrap gap-3 p-5">
          <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border bg-creaw-canvas px-3 py-2">
            <Search size={16} />
            <span className="sr-only">Search {config.label.toLowerCase()}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => resetPage(setQuery)(event.target.value)}
              placeholder={`Search ${config.label.toLowerCase()}`}
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              value={status}
              onChange={(event) => resetPage(setStatus)(event.target.value)}
              className="ml-2 rounded-lg border bg-white p-2"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <LookupTableView
          table={table}
          rows={pageRows}
          totalRows={rows.length}
          parentId={parent?.id}
          counties={counties}
          subCounties={subCounties}
          pillars={pillars}
          canViewAudit={canViewAudit}
          onEdit={(row) => open({ kind: "edit", row })}
          onToggle={(row) => open({ kind: "toggle", row })}
        />
        <div className="px-5">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={resetPage(setPageSize)}
          />
        </div>
        {table === "pillar" && (
          <p className="mx-5 mb-5 rounded-lg bg-creaw-canvas p-3 text-sm text-creaw-body">
            Leadership has a pillar row but no pipeline yet. Configure its pathway under Pipeline
            config.
          </p>
        )}
      </section>
      <LookupEntryDialog
        open={modal?.kind === "add" || modal?.kind === "edit"}
        table={table}
        entry={modal?.kind === "edit" ? modal.row : null}
        parentName={parent?.name}
        counties={counties}
        pillars={pillars}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onSubmit={saveEntry}
      />
      <ToggleActiveDialog
        entry={modal?.kind === "toggle" ? modal.row : null}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onConfirm={(row) =>
          void run(
            setLookupActiveAction({ table, id: row.id, active: row.is_deleted }),
            row.is_deleted ? "Entry reactivated." : "Entry deactivated."
          )
        }
      />
    </div>
  );
}
