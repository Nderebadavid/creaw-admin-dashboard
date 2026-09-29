"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { ExportButton } from "@/components/ui/export-button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { EffectiveGrant } from "@/lib/auth/permissions";
import type { ReferralPage, ReferralQuery, ReferralView } from "./api";
import type { ReferralDestinationCatalog } from "./schemas";
import { createReferralAction, editReferralAction, exportReferralsAction, listReferralsAction, respondReferralAction, withdrawReferralAction } from "./actions";

export interface ReferralOriginOption { enrollmentId: number; pillarId: number; participant: string; category: string }
const tone = (status: string): StatusTone => status === "NEW" ? "warning" : status === "ACCEPTED" ? "success" : "neutral";
const date = (value: string) => new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
const can = (grants: EffectiveGrant[], code: string, pillarId: number) => grants.some(item => item.permissionCode === code && (item.pillarId === null || item.pillarId === pillarId));

export function ReferralsContent({ initial, pillars, origins, catalog = { internalPillarIds: [], partnerInstitutions: [] }, grants }: { initial: ReferralPage; pillars: { id: number; name: string }[]; origins: ReferralOriginOption[]; catalog?: ReferralDestinationCatalog; grants: EffectiveGrant[] }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState<ReferralQuery>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<ReferralView | null>(null);
  const [modal, setModal] = useState<"create" | "decide" | "edit" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRender = useRef(true);
  const allowedOrigins = origins.filter(item => can(grants, "REFERRAL_CREATE", item.pillarId));
  const [originEnrollment, setOriginEnrollment] = useState(allowedOrigins[0]?.enrollmentId ?? 0);
  const [destinationKind, setDestinationKind] = useState<"internal" | "external">("internal");
  const selectedOrigin = allowedOrigins.find(item => item.enrollmentId === originEnrollment);
  const destinations = destinationKind === "external" ? pillars : pillars.filter(item => item.id !== selectedOrigin?.pillarId && catalog.internalPillarIds.includes(item.id));
  async function refresh(next: ReferralQuery) {
    setLoading(true); setError("");
    const response = await listReferralsAction(next);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
    setLoading(false);
  }
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    let active = true;
    const timer = setTimeout(async () => {
      const response = await listReferralsAction(query);
      if (!active) return;
      if (response.success && response.data) { setData(response.data); setError(""); }
      else setError(response.message);
      setLoading(false);
    }, query.search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  function filter(patch: Partial<ReferralQuery>) { setLoading(true); setQuery(current => ({ ...current, ...patch, page: 1 })); }
  function done(success: boolean, message: string) {
    setBusy(false);
    if (success) { setModal(null); setSelected(null); setFeedback(message); void refresh(query); }
    else setError(message);
  }
  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedOrigin) return;
    setBusy(true); const form = new FormData(event.currentTarget);
    const response = await createReferralAction({ enrollmentId: selectedOrigin.enrollmentId, fromPillarId: selectedOrigin.pillarId,
      toPillarId: Number(form.get("toPillarId")), partnerInstitutionId: destinationKind === "external" ? Number(form.get("partnerInstitutionId")) : undefined,
      reason: String(form.get("reason") ?? ""), notes: String(form.get("notes") ?? "") });
    done(response.success, response.success ? "Referral sent to the receiving pillar." : response.message);
  }
  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); const form = new FormData(event.currentTarget);
    const response = await respondReferralAction({ id: selected.id, decision: form.get("decision"), note: String(form.get("note") ?? "") });
    done(response.success, response.success ? "Referral decision recorded." : response.message);
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); const form = new FormData(event.currentTarget);
    const response = await editReferralAction({ id: selected.id, reason: String(form.get("reason") ?? "") });
    done(response.success, response.success ? "Referral updated." : response.message);
  }
  async function withdraw() {
    if (!selected) return;
    setBusy(true); const response = await withdrawReferralAction(selected.id);
    done(response.success, response.success ? "Referral withdrawn and kept in history." : response.message);
  }
  const columns: DataColumn<ReferralView>[] = [
    { id: "participant", header: "Participant", cell: row => <div><span className="font-semibold">{row.participant}</span><p className="text-xs text-[#81766d]">{row.fromPillar} → {row.destinationName}{row.external ? " (external)" : ""}</p></div> },
    { id: "route", header: "From → to", cell: row => <div className="flex flex-wrap gap-1"><span className="rounded-full bg-[#FBEDE5] px-2 py-1 text-xs text-primary">{row.fromPillar}</span><span aria-hidden="true">→</span><span className="rounded-full bg-[#E9EEF9] px-2 py-1 text-xs text-[#36548e]">{row.destinationName}</span></div> },
    { id: "reason", header: "Reason", cell: row => <span className="max-w-xs line-clamp-2">{row.reason}</span> },
    { id: "source", header: "Source", cell: row => row.source },
    { id: "date", header: "Date", cell: row => <div>{date(row.date)}<p className="text-xs text-[#81766d]">{row.ageDays} days ago</p></div> },
    { id: "status", header: "Status", cell: row => <StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge> },
  ];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-bold">All referrals</h2><p className="text-sm text-[#81766d]">Accepting an internal referral adds a destination enrollment to the same participant.</p></div><div className="flex flex-wrap gap-2">{grants.some(item => item.permissionCode === "REPORT_EXPORT_CSV") && <ExportButton exportAction={() => exportReferralsAction(query)} />}{allowedOrigins.length > 0 && <Button onClick={() => { setError(""); setDestinationKind("internal"); setModal("create"); }}><ArrowLeftRight size={16} />New referral</Button>}</div></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Referral status">{["All", "NEW", "ACCEPTED", "DECLINED", "WITHDRAWN"].map(status => <button key={status} type="button" aria-pressed={(query.status ?? "All") === status} className={`rounded-full border px-3 py-1.5 text-sm ${(query.status ?? "All") === status ? "bg-[#FBEDE5] text-primary" : "bg-white"}`} onClick={() => filter({ status: status === "All" ? undefined : status })}>{status === "NEW" ? "New" : status[0] + status.slice(1).toLowerCase()}</button>)}</div>
    <div className="flex flex-wrap gap-3"><label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><Search size={16} aria-hidden="true" /><span className="sr-only">Search referrals</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); filter({ search: event.target.value || undefined }); }} placeholder="Search referrals…" className="min-w-0 flex-1 outline-none" /></label><label className="flex items-center gap-2 text-sm">Pillar<select aria-label="Pillar" value={query.pillarId ?? ""} onChange={event => filter({ pillarId: Number(event.target.value) || undefined })} className="rounded-xl border bg-white px-3 py-2"><option value="">All pillars</option>{pillars.map(pillar => <option key={pillar.id} value={pillar.id}>{pillar.name}</option>)}</select></label></div>
    {feedback && <p role="status" className="rounded-xl bg-[#EAF5ED] px-4 py-3 text-sm text-[#246842]">{feedback}</p>}{error && !modal && <p role="alert" className="rounded-xl bg-[#FBE9E6] px-4 py-3 text-sm text-[#B8352C]">{error}</p>}
    <DataTable label="Referrals" columns={columns} rows={data.items} getRowId={row => row.id} loading={loading} filtered={Boolean(query.status || query.pillarId || query.search)} rowActions={row => <div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="outline" disabled={!row.canRespond} title={row.respondDisabledReason ?? undefined} onClick={() => { setError(""); setSelected(row); setModal("decide"); }}>Decide</Button><Button size="sm" variant="ghost" disabled={!row.canEdit} title={!row.canEdit ? "Only the referring pillar can edit a new referral" : undefined} onClick={() => { setError(""); setSelected(row); setModal("edit"); }}>Edit</Button><Button size="sm" variant="ghost" disabled={!row.canWithdraw} title={!row.canWithdraw ? "Only the referring pillar can withdraw a new referral" : undefined} onClick={() => { setError(""); setSelected(row); setModal("withdraw"); }}>Withdraw</Button></div>} />
    <Pagination page={data.page} pageSize={data.pageSize as PageSize} totalItems={data.totalItems} onPageChange={page => { setLoading(true); setQuery(current => ({ ...current, page })); }} onPageSizeChange={pageSize => { setLoading(true); setQuery(current => ({ ...current, pageSize, page: 1 })); }} />
    <Dialog open={modal === "create"} onOpenChange={open => { if (!open && !busy) setModal(null); }}><DialogContent className="sm:max-w-lg"><DialogTitle>New referral</DialogTitle><DialogDescription>Refer a participant to a pillar project or partner institution.</DialogDescription>{error && <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">{error}</p>}<form className="space-y-4" onSubmit={submitCreate}><label className="block text-sm">Participant and origin enrollment<select value={originEnrollment} onChange={event => setOriginEnrollment(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2">{allowedOrigins.map(item => <option key={item.enrollmentId} value={item.enrollmentId}>{item.participant} · {pillars.find(p => p.id === item.pillarId)?.name} · {item.category}</option>)}</select></label><label className="block text-sm">Destination type<select value={destinationKind} onChange={event => setDestinationKind(event.target.value as "internal" | "external")} className="mt-1 w-full rounded-lg border p-2"><option value="internal">Pillar project</option><option value="external">Partner institution</option></select></label><label className="block text-sm">{destinationKind === "external" ? "Responsible pillar" : "To pillar"}<select name="toPillarId" required className="mt-1 w-full rounded-lg border p-2">{destinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{destinationKind === "external" && <label className="block text-sm">Partner institution<select name="partnerInstitutionId" required className="mt-1 w-full rounded-lg border p-2">{catalog.partnerInstitutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label className="block text-sm">Reason<textarea name="reason" required rows={3} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">Note to receiving team<textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border p-2" /></label><Button disabled={busy || destinations.length === 0 || destinationKind === "external" && catalog.partnerInstitutions.length === 0} type="submit">Send referral</Button></form></DialogContent></Dialog>
    <Dialog open={modal === "decide"} onOpenChange={open => { if (!open && !busy) setModal(null); }}><DialogContent><DialogTitle>Respond to referral</DialogTitle><DialogDescription>{selected?.participant} · {selected?.fromPillar} → {selected?.destinationName}</DialogDescription>{error && <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">{error}</p>}<form onSubmit={submitDecision} className="space-y-4"><p>{selected?.reason}</p><label className="block text-sm">Decision<select name="decision" className="mt-1 w-full rounded-lg border p-2"><option value="ACCEPTED">Accept{selected?.external ? " external hand-off" : " and create enrollment"}</option><option value="DECLINED">Decline</option></select></label><label className="block text-sm">Note to referring officer<textarea name="note" rows={3} className="mt-1 w-full rounded-lg border p-2" /></label><Button disabled={busy} type="submit">Save response</Button></form></DialogContent></Dialog>
    <Dialog open={modal === "edit"} onOpenChange={open => { if (!open && !busy) setModal(null); }}><DialogContent><DialogTitle>Edit referral</DialogTitle><DialogDescription>{selected?.participant}</DialogDescription>{error && <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">{error}</p>}<form className="space-y-4" onSubmit={submitEdit}><label className="block text-sm">Reason<textarea key={selected?.id} name="reason" required defaultValue={selected?.reason} rows={4} className="mt-1 w-full rounded-lg border p-2" /></label><Button disabled={busy} type="submit">Save changes</Button></form></DialogContent></Dialog>
    <Dialog open={modal === "withdraw"} onOpenChange={open => { if (!open && !busy) setModal(null); }}><DialogContent><DialogTitle>Withdraw referral</DialogTitle><DialogDescription>{selected?.participant}</DialogDescription>{error && <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">{error}</p>}<p>This referral will remain in history with a withdrawn status.</p><Button disabled={busy} variant="destructive" onClick={withdraw}>Withdraw referral</Button></DialogContent></Dialog>
  </div>;
}
