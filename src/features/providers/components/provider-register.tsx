"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { updatedColumn } from "@/components/data-table/record-columns";
import { auditedExportAction } from "@/components/portal/data-actions";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import { cn } from "@/lib/utils";
import { loadProviderWorkloadAction, setProviderActiveAction } from "../actions";
import {
  providerTypeLabel,
  providerTypes,
  type ProviderDirectory,
  type ProviderView,
} from "../model";
import { DeactivateProviderDialog, ProviderFormDialog } from "./provider-dialogs";
import { ProviderDrawer, type ProviderPermissions } from "./provider-drawer";

const text = "font-medium text-creaw-ink-soft";
const statuses = ["All", "Active", "Inactive"] as const;
type StatusFilter = (typeof statuses)[number];

const columns: DataColumn<ProviderView>[] = [
  {
    id: "name",
    header: "Name",
    sortValue: (row) => row.name,
    cell: (row) => <span className="font-semibold">{row.name}</span>,
  },
  {
    id: "type",
    header: "Type",
    sortValue: (row) => row.type,
    cell: (row) => <span className={text}>{providerTypeLabel(row.type)}</span>,
  },
  {
    id: "service",
    header: "Service",
    sortValue: (row) => row.service ?? "",
    cell: (row) => <span className={text}>{row.service ?? "—"}</span>,
  },
  {
    id: "institution",
    header: "Institution",
    sortValue: (row) => row.institution,
    cell: (row) => <span className={text}>{row.institution}</span>,
  },
  {
    id: "work",
    header: "Linked work",
    sortValue: (row) => row.linkedWork,
    cell: (row) => <span className={text}>{row.linkedWork}</span>,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (row) => (row.active ? 0 : 1),
    cell: (row) => (
      <StatusBadge tone={row.active ? "success" : "neutral"}>
        {row.active ? "Active" : "Inactive"}
      </StatusBadge>
    ),
  },
  updatedColumn((row) => row.updated),
];

/** The external provider directory. Opening a row selects it for the record panel. */
export function ProviderRegister({
  directory,
  can,
}: {
  directory: ProviderDirectory;
  can: ProviderPermissions;
}) {
  const router = useRouter();
  const [type, setType] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | "deactivate" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const detail = useRecordDetail(selectedId, loadProviderWorkloadAction);
  const row = directory.providers.find((item) => item.id === selectedId) ?? null;
  // The drawer shows each group's recent items once they have loaded.
  const selected = row && detail.data ? { ...row, workload: detail.data } : row;
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      directory.providers.filter(
        (row) =>
          (type === "All" || row.type === type) &&
          (status === "All" || row.active === (status === "Active")) &&
          (!needle ||
            [row.name, row.service ?? "", row.institution]
              .join(" ")
              .toLocaleLowerCase()
              .includes(needle))
      ),
    [directory.providers, type, status, needle]
  );
  const { rows, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(rows);

  const done = (message: string) => {
    setModal(null);
    setError("");
    setFeedback(message);
    router.refresh();
  };
  async function reactivate() {
    if (!selected || reactivating) return;
    setFeedback("");
    setError("");
    setReactivating(true);
    // A failure closes the drawer so the banner is not hidden behind it.
    const fail = (message: string) => {
      setSelectedId(null);
      setError(message);
    };
    try {
      const result = await setProviderActiveAction({ id: selected.id, active: true });
      if (result.success) done(`${selected.name} reactivated`);
      else fail(result.message);
    } catch {
      fail("Could not update the provider. Please try again.");
    } finally {
      setReactivating(false);
    }
  }

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{error}</FormBanner>
      <TableCard
        title="Provider directory"
        subtitle="Open a provider to see their linked work or reveal their contact details"
        chipsLabel="Provider type"
        chips={["All", ...providerTypes].map((value) => ({
          label: value === "All" ? value : providerTypeLabel(value),
          active: type === value,
          onSelect: () => {
            setType(value);
            resetPage();
          },
        }))}
        search={{
          value: search,
          label: "Search providers",
          onChange: (value) => {
            setSearch(value);
            resetPage();
          },
        }}
        filters={
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            {statuses.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  resetPage();
                }}
                className={cn(
                  "rounded-[9px] border px-3 py-[7px] text-[13px] font-semibold",
                  status === value
                    ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary"
                    : "border-creaw-line-strong bg-white text-creaw-body"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        }
        actions={
          <>
            {can.export && (
              <ExportButton
                label="CSV"
                exportAction={() =>
                  auditedExportAction({
                    path: "/admin/providers",
                    routeTemplate: "/admin/providers",
                    query: {},
                  })
                }
              />
            )}
            {can.manage && (
              <Button onClick={() => setModal("add")}>
                <Plus />
                Add provider
              </Button>
            )}
          </>
        }
        footer={<Pagination {...pager} hint="Click a row to open the provider" />}
      >
        <DataTable
          framed={false}
          label="Provider directory"
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.id}
          filtered={
            filtered.length === 0 && (type !== "All" || status !== "All" || needle.length > 0)
          }
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.name}`}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
        />
      </TableCard>
      <ProviderDrawer
        provider={modal === null ? selected : null}
        can={can}
        busy={reactivating}
        onClose={() => setSelectedId(null)}
        onEdit={() => setModal("edit")}
        onDeactivate={() => setModal("deactivate")}
        onReactivate={() => void reactivate()}
      />
      <ProviderFormDialog
        key={modal === "edit" ? `edit-${selectedId}` : modal === "add" ? "add" : "closed"}
        open={modal === "add" || modal === "edit"}
        institutions={directory.institutions}
        provider={modal === "edit" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <DeactivateProviderDialog
        provider={modal === "deactivate" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </>
  );
}
