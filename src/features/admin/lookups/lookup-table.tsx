import Link from "next/link";
import { ChevronRight, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ariaSort, SortHeader } from "@/components/data-table/sort-header";
import type { SortState } from "@/components/data-table/sorting";
import type { LookupView } from "../api";
import type { LookupTable } from "../schemas";
import { isGeoTable, labelFor, lookupConfig, type Option } from "./config";

const isActive = (row: LookupView) => !row.is_deleted && row.status === "ACTIVE";

/** Link from a county to its sub-counties, or a sub-county to its wards. */
function drillHref(table: LookupTable, row: LookupView, parentId: number | undefined) {
  if (table === "county") return `/admin/lookups/sub_county?countyId=${row.id}`;
  return `/admin/lookups/ward?subCountyId=${row.id}&countyId=${parentId ?? row.county_id}`;
}

/** One page of lookup rows with an active switch, edit and audit-history actions. */
export function LookupTableView({
  table,
  rows,
  sort,
  onSortChange,
  totalRows,
  parentId,
  counties,
  subCounties,
  pillars,
  activityTypes = [],
  canViewAudit,
  onEdit,
  onToggle,
}: {
  table: LookupTable;
  /** The current page of filtered rows. */
  rows: readonly LookupView[];
  /** The active sort; column ids are the lookup's column keys, plus "active". */
  sort: SortState | undefined;
  onSortChange: (sort: SortState | undefined) => void;
  /** Unfiltered row count, used to choose the empty-state message. */
  totalRows: number;
  parentId: number | undefined;
  counties: Option[];
  subCounties: Option[];
  pillars: Option[];
  activityTypes?: Option[];
  canViewAudit: boolean;
  onEdit: (row: LookupView) => void;
  onToggle: (row: LookupView) => void;
}) {
  const { columns } = lookupConfig[table];
  const drillable = isGeoTable(table) && table !== "ward";
  const label = (row: LookupView, key: string) =>
    labelFor(row, key, counties, subCounties, pillars, activityTypes);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] text-left text-[14.5px]">
        <thead className="border-b border-creaw-divider bg-creaw-surface text-[13px] font-semibold text-creaw-faint">
          <tr>
            {[...columns.map((column) => [column.key, column.label]), ["active", "Active"]].map(
              ([id, label]) => (
                <th
                  key={id}
                  scope="col"
                  aria-sort={ariaSort(sort, id)}
                  className="px-2.5 py-3 first:pl-[22px]"
                >
                  <SortHeader id={id} sort={sort} onSortChange={onSortChange}>
                    {label}
                  </SortHeader>
                </th>
              )
            )}
            <th className="px-2.5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#F7F2EC] hover:bg-creaw-surface">
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  className={`px-2.5 py-3 first:pl-[22px] ${index === 0 ? "font-semibold" : "font-medium text-creaw-ink-soft"} ${isActive(row) ? "" : "text-[#A39A92]"}`}
                >
                  {index === 0 && drillable ? (
                    <Link
                      href={drillHref(table, row, parentId)}
                      className="inline-flex items-center gap-1 text-creaw-orange hover:underline"
                    >
                      {label(row, column.key)}
                      <ChevronRight size={15} />
                    </Link>
                  ) : (
                    label(row, column.key)
                  )}
                </td>
              ))}
              <td className="px-2.5 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-label={`${row.is_deleted ? "Reactivate" : "Deactivate"} ${row.name}`}
                  aria-checked={isActive(row)}
                  onClick={() => onToggle(row)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isActive(row) ? "bg-[#1F7A4D]" : "bg-[#DCD4CB]"}`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${isActive(row) ? "right-0.5" : "left-0.5"}`}
                  />
                </button>
              </td>
              <td className="whitespace-nowrap py-2 pl-1 pr-3.5 text-right">
                <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                  <Pencil />
                  Edit
                </Button>
                {canViewAudit ? (
                  <Link
                    href={`/audit?module=${table}&targetId=${row.id}`}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-creaw-body hover:bg-creaw-canvas"
                  >
                    <History size={14} />
                    History
                  </Link>
                ) : (
                  <Button variant="ghost" size="sm" disabled title="Audit log permission required">
                    <History />
                    History
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-8 text-center text-sm text-creaw-faint">
          {totalRows === 0 ? "No entries yet." : "No entries match these filters."}
        </p>
      )}
    </div>
  );
}
