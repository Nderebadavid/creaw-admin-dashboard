"use client";
import { useEffect, useRef, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { ExportButton } from "@/components/ui/export-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listAuditAction, exportAuditAction } from "./actions";
import type { AuditPage, AuditRow } from "./api";
import type { AuditQuery } from "./schemas";

const displayDate = (iso: string) => new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
function formattedJson(text: string | null) { if (!text) return "—"; try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } }
export function AuditContent({ initial, initialQuery = { page: 1, pageSize: 25 }, canExport }: { initial: AuditPage; initialQuery?: AuditQuery; canExport: boolean }) {
  const [data, setData] = useState(initial), [query, setQuery] = useState<AuditQuery>(initialQuery);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [selected, setSelected] = useState<AuditRow | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    let active = true;
    const timer = setTimeout(async () => {
      const response = await listAuditAction(query);
      if (!active) return;
      if (response.success && response.data) { setData(response.data); setError(""); } else setError(response.message);
      setLoading(false);
    }, query.search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const filter = (patch: Partial<AuditQuery>) => { setLoading(true); setQuery(current => ({ ...current, ...patch, page: 1 })); };
  const modules = [...new Set([...initial.items, ...data.items].map(row => row.entity_type).filter((item): item is string => !!item))].sort();
  const actions = [...new Set([...initial.items, ...data.items].map(row => row.action))].sort();
  const actors = [...new Map([...initial.items, ...data.items].filter(row => row.performed_by && row.performed_by_name).map(row => [row.performed_by!, row.performed_by_name!])).entries()];
  const filtered = Boolean(query.search || query.source || query.module || query.targetId || query.action || query.userId || query.from || query.to);
  const columns: DataColumn<AuditRow>[] = [
    { id: "entity", header: "Entity", cell: row => <span className="font-semibold">{row.entity_type ?? "System"}{row.entity_id ? <span className="block font-mono text-xs text-[#8A8078]">#{row.entity_id}</span> : null}</span> },
    { id: "action", header: "Action", cell: row => <span className="rounded-full bg-[#FBEDE5] px-2.5 py-1 text-xs font-semibold text-[#B4552E]">{row.action}</span> },
    { id: "source", header: "Source", cell: row => <span className="text-sm">{row.source === "KAFKA" ? "Kafka (system)" : row.source === "HTTP" ? "Portal / API" : "System"}</span> },
    { id: "actor", header: "Performed by", cell: row => row.performed_by_name ?? "System (background job)" },
    { id: "when", header: "Performed at", cell: row => <time dateTime={row.performed_at} className="whitespace-nowrap text-[#6B625B]">{displayDate(row.performed_at)}</time> },
  ];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-bold">Activity trail</h2><p className="text-sm text-[#8A8078]">Portal, integration and background activity. Records are immutable.</p></div><span title={!canExport ? "CSV export permission required" : undefined}><ExportButton disabled={!canExport} exportAction={() => exportAuditAction(query)} /></span></div>
    <section aria-label="Audit filters" className="rounded-2xl border border-[#ECE6DF] bg-white p-4 sm:p-5">
      {query.targetId && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-[#FBEDE5] px-3 py-1 font-semibold text-[#B4552E]">History for {query.module ?? "record"} #{query.targetId}</span><Button size="sm" variant="outline" onClick={() => filter({ targetId: undefined, module: undefined })}>Clear record filter</Button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-lg border bg-[#F7F4F0] px-3 py-2 sm:col-span-2"><Search size={17} aria-hidden="true" /><span className="sr-only">Search audit entries</span><input type="search" value={query.search ?? ""} onChange={event => filter({ search: event.target.value || undefined })} placeholder="Search entity, target or performed by" className="min-w-0 w-full bg-transparent text-sm outline-none" /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">Module<select aria-label="Module" value={query.module ?? ""} onChange={event => filter({ module: event.target.value || undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal"><option value="">All modules</option>{modules.map(module => <option key={module} value={module}>{module.replaceAll("_", " ")}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">Action<select aria-label="Action" value={query.action ?? ""} onChange={event => filter({ action: event.target.value || undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal"><option value="">All actions</option>{actions.map(action => <option key={action}>{action}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">Source<select aria-label="Source" value={query.source ?? ""} onChange={event => filter({ source: event.target.value ? event.target.value as "HTTP" | "KAFKA" : undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal"><option value="">All sources</option><option value="HTTP">Portal / API</option><option value="KAFKA">Kafka (system)</option></select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">Performed by<select aria-label="Performed by" value={query.userId ?? ""} onChange={event => filter({ userId: Number(event.target.value) || undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal"><option value="">All users</option>{actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">From date<input aria-label="From date" type="date" value={query.from ?? ""} max={query.to} onChange={event => filter({ from: event.target.value || undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal" /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6B625B]">To date<input aria-label="To date" type="date" value={query.to ?? ""} min={query.from} onChange={event => filter({ to: event.target.value || undefined })} className="rounded-lg border bg-white p-2 text-sm font-normal" /></label>
      </div>
    </section>
    {error && <p role="alert" className="rounded-xl bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">{error}</p>}
    <div className="rounded-2xl border border-[#ECE6DF] bg-white p-3 sm:p-5"><DataTable label="Audit entries" columns={columns} rows={data.items} getRowId={row => row.id} loading={loading} filtered={filtered} rowActions={row => <Button size="sm" variant="outline" onClick={() => setSelected(row)}>View changes</Button>} /><Pagination page={data.page} pageSize={data.pageSize as PageSize} totalItems={data.totalItems} onPageChange={page => { setLoading(true); setQuery(current => ({ ...current, page })); }} onPageSizeChange={pageSize => { setLoading(true); setQuery(current => ({ ...current, pageSize, page: 1 })); }} /></div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogTitle className="flex items-center gap-2"><ShieldCheck size={20} />Audit entry #{selected?.id}</DialogTitle><DialogDescription>{selected?.action} · {selected?.entity_type ?? "System"} · {selected && displayDate(selected.performed_at)}</DialogDescription>{selected && <div className="space-y-4 text-sm"><dl className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F4F0] p-3"><div><dt className="text-[#8A8078]">Performed by</dt><dd>{selected.performed_by_name ?? "System"}</dd></div><div><dt className="text-[#8A8078]">Source</dt><dd>{selected.source ?? "System"}</dd></div><div className="col-span-2"><dt className="text-[#8A8078]">Endpoint / event</dt><dd className="break-all font-mono text-xs">{selected.endpoint ?? selected.event_name ?? "—"}</dd></div></dl>{[["Input", selected.input_payload], ["Before", selected.previous_state], ["After", selected.new_state]].map(([label, value]) => <section key={label}><h3 className="mb-1 font-semibold">{label}</h3><pre className="max-h-52 overflow-auto rounded-xl border bg-[#FCFAF7] p-3 text-xs whitespace-pre-wrap break-words">{formattedJson(value)}</pre></section>)}</div>}</DialogContent></Dialog>
  </div>;
}
