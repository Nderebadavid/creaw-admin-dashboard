"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, MoreHorizontal, Pencil } from "lucide-react";
import DataTable, { createColumn, createDisplayColumn, type SortingState } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Member } from "@/types/member";
import { CreateMemberModal } from "./create-member-modal";
import { UpdateMemberModal } from "./update-member-modal";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  inactive: "bg-destructive/10 text-destructive",
  suspended: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function formatStatus(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface MembersTableProps {
  members: Member[];
  error?: string;
}

function ActionsCell({ member, onRefresh }: { member: Member; onRefresh: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="p-1 rounded-md hover:bg-muted cursor-pointer">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <UpdateMemberModal
          member={member}
          trigger={
            // closeOnClick=false: this item's trigger opens a nested Dialog:
            // Base UI's default (close the menu on click) would race with
            // the dialog opening. Radix's equivalent was
            // onSelect={(e) => e.preventDefault()}.
            <DropdownMenuItem closeOnClick={false}>
              <Pencil className="w-4 h-4" />
              Edit Member
            </DropdownMenuItem>
          }
          onUpdated={onRefresh}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MembersTable({ members, error }: MembersTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSize = 10;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter((m) =>
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      m.phone_number?.toLowerCase().includes(q) ||
      m.national_id?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const sorted = useMemo(() => {
    if (sorting.length === 0) return filtered;
    const { id, desc } = sorting[0];
    return [...filtered].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[id];
      const bVal = (b as unknown as Record<string, unknown>)[id];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return desc ? -cmp : cmp;
    });
  }, [filtered, sorting]);

  const paginated = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage]
  );

  const columns = useMemo(() => [
    createColumn<Member>("first_name", "Member", (_v, row) => (
      <div>
        <p className="text-sm font-medium text-foreground">{row.first_name} {row.last_name}</p>
        <p className="text-xs text-muted-foreground">{row.national_id ?? "—"}</p>
      </div>
    ), { sortable: true }),
    createColumn<Member>("phone_number", "Phone", (v) => (
      <span className="text-sm">{(v as string | null) ?? "—"}</span>
    )),
    createColumn<Member>("gender", "Gender", (v) => (
      <span className="text-sm capitalize">{(v as string | null) ?? "—"}</span>
    )),
    createColumn<Member>("status", "Status", (v) => (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-normal ${STATUS_COLORS[v as string] ?? "bg-muted text-muted-foreground"}`}>
        {formatStatus(v as string)}
      </span>
    ), { sortable: true }),
    createColumn<Member>("date_joined", "Joined", (v) => (
      <span className="text-sm">{v ? format(new Date(v as string), "MMM d, yyyy") : "—"}</span>
    ), { sortable: true }),
    createDisplayColumn<Member>("actions", "Actions", (row) => (
      <ActionsCell member={row} onRefresh={() => router.refresh()} />
    )),
  ], [router]);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage village group members</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage village group members</p>
        </div>
        <CreateMemberModal onCreated={() => router.refresh()} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, national ID..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <DataTable
        data={paginated}
        columns={columns}
        emptyMessage="No members found. Add your first member."
        stickyColumn="actions"
        sorting={sorting}
        onSortingChange={(s) => { setSorting(s); setCurrentPage(1); }}
        pagination={{ currentPage, pageSize, totalItems: filtered.length, onPageChange: setCurrentPage }}
      />
    </div>
  );
}
