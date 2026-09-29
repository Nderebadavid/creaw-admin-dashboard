"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PillarDomainRecord, PillarDomainView } from "./domain-api";

export function PillarDomainTable({
  domain,
  actions,
}: {
  domain: PillarDomainView;
  actions?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [selected, setSelected] = useState<PillarDomainRecord | null>(null);
  const statuses = useMemo(
    () => ["All", ...new Set(domain.rows.map((row) => row.status))],
    [domain.rows]
  );
  const filtered = useMemo(
    () =>
      domain.rows.filter(
        (row) =>
          (status === "All" || row.status === status) &&
          (!search.trim() ||
            `${row.title} ${row.values.join(" ")}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()))
      ),
    [domain.rows, search, status]
  );
  const columns: DataColumn<PillarDomainRecord>[] = domain.columns.map((header, index) => ({
    id: String(index),
    header,
    cell: (row) => row.values[index] ?? "—",
  }));
  columns.push({
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge
        tone={/approved|complete|passed|active/i.test(row.status) ? "success" : "neutral"}
      >
        {row.status.replaceAll("_", " ")}
      </StatusBadge>
    ),
  });
  return (
    <section aria-label={domain.title} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold">{domain.title}</h2>
          <p className="text-sm text-creaw-muted">{domain.subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${domain.title} status`}>
        {statuses.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status === value ? "border-primary bg-creaw-orange-soft text-primary" : "bg-white text-creaw-body"}`}
          >
            {value.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <label className="flex max-w-sm items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search {domain.title.toLowerCase()}</span>
        <input
          aria-label={`Search ${domain.title.toLowerCase()}`}
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="min-w-0 flex-1 outline-none"
        />
      </label>
      <DataTable
        columns={columns}
        rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
        getRowId={(row) => row.id}
        label={domain.title}
        filtered={filtered.length === 0 && (status !== "All" || search.length > 0)}
        rowActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(row)}
            aria-label={`View ${row.title}`}
          >
            View
          </Button>
        )}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{selected?.title}</DialogTitle>
          <DialogDescription>
            Read-only programme record. Identity details remain masked.
          </DialogDescription>
          {selected && (
            <dl className="space-y-3 text-sm">
              {domain.columns.map((header, index) => (
                <div key={header} className="grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="text-creaw-muted">{header}</dt>
                  <dd>{selected.values[index] ?? "—"}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-creaw-muted">Status</dt>
                <dd>{selected.status.replaceAll("_", " ")}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
