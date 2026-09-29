import Link from "next/link";
import { ChevronRight, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  totalRows,
  parentId,
  counties,
  subCounties,
  pillars,
  canViewAudit,
  onEdit,
  onToggle,
}: {
  table: LookupTable;
  /** The current page of filtered rows. */
  rows: LookupView[];
  /** Unfiltered row count, used to choose the empty-state message. */
  totalRows: number;
  parentId: number | undefined;
  counties: Option[];
  subCounties: Option[];
  pillars: Option[];
  canViewAudit: boolean;
  onEdit: (row: LookupView) => void;
  onToggle: (row: LookupView) => void;
}) {
  const { columns } = lookupConfig[table];
  const drillable = isGeoTable(table) && table !== "ward";
  const label = (row: LookupView, key: string) =>
    labelFor(row, key, counties, subCounties, pillars);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] text-left text-sm">
        <thead className="bg-creaw-surface text-xs text-creaw-body">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="p-3">
                {column.label}
              </th>
            ))}
            <th className="p-3">Active</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#F7F2EC]">
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  className={`p-3 ${index === 0 ? "font-semibold" : "text-creaw-body"}`}
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
              <td className="p-3">
                <button
                  type="button"
                  role="switch"
                  aria-label={`${row.is_deleted ? "Reactivate" : "Deactivate"} ${row.name}`}
                  aria-checked={isActive(row)}
                  onClick={() => onToggle(row)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isActive(row) ? "bg-[#3D9B72]" : "bg-[#C9C0B7]"}`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${isActive(row) ? "right-0.5" : "left-0.5"}`}
                  />
                </button>
              </td>
              <td className="whitespace-nowrap p-3">
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
