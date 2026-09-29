"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { MaskedField } from "@/components/ui/masked-field";
import { ExportButton } from "@/components/ui/export-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EffectiveGrant } from "@/lib/auth/permissions";
import type { ParticipantCatalog, ParticipantPage, ParticipantQuery, ParticipantView } from "./api";
import {
  exportParticipantsAction,
  listParticipantsAction,
  registerParticipantAction,
  revealParticipantAction,
  updateParticipantAction,
} from "./actions";

const date = (value: string) =>
  new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
const can = (grants: EffectiveGrant[], code: string, pillarId: number) =>
  grants.some(
    (item) => item.permissionCode === code && (item.pillarId === null || item.pillarId === pillarId)
  );

export function ParticipantsContent({
  initial,
  catalog,
  grants,
}: {
  initial: ParticipantPage;
  catalog: ParticipantCatalog;
  grants: EffectiveGrant[];
}) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState<ParticipantQuery>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<ParticipantView | null>(null);
  const [modal, setModal] = useState<"register" | "edit" | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRender = useRef(true);
  const availablePillars = catalog.pillars.filter((item) =>
    can(grants, "PARTICIPANT_EDIT", item.id)
  );
  const pillarName = (id: number) =>
    catalog.pillars.find((item) => item.id === id)?.name ?? `Pillar #${id}`;
  const refresh = async (next: ParticipantQuery) => {
    setLoading(true);
    setError("");
    const response = await listParticipantsAction(next);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
    setLoading(false);
  };
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await listParticipantsAction(query);
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
          setError("");
        } else setError(response.message);
        setLoading(false);
      },
      query.search ? 250 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  function filter(patch: Partial<ParticipantQuery>) {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }
  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await registerParticipantAction({
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      gender: String(form.get("gender") ?? "") || undefined,
      dateOfBirth: String(form.get("dateOfBirth") ?? "") || undefined,
      phoneNumber: String(form.get("phoneNumber") ?? "") || undefined,
      idNumber: String(form.get("idNumber") ?? "") || undefined,
      wardId: Number(form.get("wardId")) || undefined,
      pillarId: Number(form.get("pillarId")),
      remarks: String(form.get("remarks") ?? "") || undefined,
      consentGiven: form.get("consentGiven") === "on",
    });
    setBusy(false);
    if (response.success) {
      setModal(null);
      setFeedback("Participant registered. Attach the signed consent form next.");
      await refresh(query);
    } else setError(response.message);
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await updateParticipantAction({
      id: selected.id,
      remarks: String(form.get("remarks") ?? ""),
      consentGiven: form.get("consentGiven") === "on",
    });
    setBusy(false);
    if (response.success) {
      setModal(null);
      setFeedback("Participant updated.");
      await refresh(query);
    } else setError(response.message);
  }
  const columns: DataColumn<ParticipantView>[] = [
    {
      id: "participant",
      header: "Participant",
      cell: (row) => (
        <div>
          <span className="font-semibold">{row.name}</span>
          <p className="text-xs text-[#81766d]">
            {row.idNumber ? `ID ${row.idNumber}` : "No ID recorded"}
          </p>
        </div>
      ),
    },
    {
      id: "county",
      header: "County",
      cell: (row) => (
        <div>
          {row.county}
          <p className="text-xs text-[#81766d]">{row.ward}</p>
        </div>
      ),
    },
    {
      id: "pillars",
      header: "Pillars",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.pillarIds.map((id) => (
            <span
              key={id}
              className="rounded-full bg-[#FBEDE5] px-2 py-1 text-xs font-semibold text-primary"
            >
              {pillarName(id)}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "stage",
      header: "Current stage",
      cell: (row) => (
        <div>
          {row.currentStage}
          <p className="text-xs text-[#81766d]">
            {row.enrollments.length} enrollment{row.enrollments.length === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    { id: "registered", header: "Registered", cell: (row) => date(row.registered) },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>
          {row.status}
        </StatusBadge>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Participant registry</h2>
          <p className="text-sm text-[#81766d]">
            IDs and contact details stay masked until an audited reveal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {grants.some((item) => item.permissionCode === "REPORT_EXPORT_CSV") && (
            <ExportButton exportAction={() => exportParticipantsAction(query)} />
          )}
          {availablePillars.length > 0 && (
            <Button
              onClick={() => {
                setError("");
                setModal("register");
              }}
            >
              <UserPlus size={16} />
              Register participant
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pillar filter">
        <button
          type="button"
          aria-pressed={!query.pillarId}
          className={`rounded-full border px-3 py-1.5 text-sm ${!query.pillarId ? "bg-[#FBEDE5] text-primary" : "bg-white"}`}
          onClick={() => filter({ pillarId: undefined })}
        >
          All
        </button>
        {catalog.pillars.map((pillar) => (
          <button
            key={pillar.id}
            type="button"
            aria-pressed={query.pillarId === pillar.id}
            className={`rounded-full border px-3 py-1.5 text-sm ${query.pillarId === pillar.id ? "bg-[#FBEDE5] text-primary" : "bg-white"}`}
            onClick={() => filter({ pillarId: pillar.id })}
          >
            {pillar.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search participants</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              filter({ search: event.target.value || undefined });
            }}
            placeholder="Search participants…"
            className="min-w-0 flex-1 outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          County
          <select
            aria-label="County"
            value={query.countyId ?? ""}
            onChange={(event) => filter({ countyId: Number(event.target.value) || undefined })}
            className="rounded-xl border bg-white px-3 py-2"
          >
            <option value="">All counties</option>
            {catalog.counties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {feedback && (
        <p role="status" className="rounded-xl bg-[#EAF5ED] px-4 py-3 text-sm text-[#246842]">
          {feedback}
        </p>
      )}
      {error && !modal && (
        <p role="alert" className="rounded-xl bg-[#FBE9E6] px-4 py-3 text-sm text-[#B8352C]">
          {error}
        </p>
      )}
      <DataTable
        label="Participants"
        columns={columns}
        rows={data.items}
        getRowId={(row) => row.id}
        loading={loading}
        filtered={Boolean(query.pillarId || query.countyId || query.search)}
        rowActions={(row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(row)}
            aria-label={`Open participant ${row.id}`}
          >
            View
          </Button>
        )}
      />
      <Pagination
        page={data.page}
        pageSize={data.pageSize as PageSize}
        totalItems={data.totalItems}
        onPageChange={(page) => {
          setLoading(true);
          setQuery((current) => ({ ...current, page }));
        }}
        onPageSizeChange={(pageSize) => {
          setLoading(true);
          setQuery((current) => ({ ...current, pageSize, page: 1 }));
        }}
      />
      <Dialog
        open={selected !== null && modal === null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{selected?.name}</DialogTitle>
          <DialogDescription>One participant record across all enrolled pillars.</DialogDescription>
          {selected && (
            <div className="space-y-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <p>
                  <span className="text-[#81766d]">County / ward</span>
                  <br />
                  {selected.county} · {selected.ward}
                </p>
                <p>
                  <span className="text-[#81766d]">Registered</span>
                  <br />
                  {date(selected.registered)}
                </p>
                <p>
                  <span className="text-[#81766d]">ID number</span>
                  <br />
                  <MaskedField
                    label="ID number"
                    maskedValue={selected.idNumber ?? "—"}
                    revealAction={
                      selected.pillarIds.some((id) => can(grants, "SENSITIVE_REVEAL", id))
                        ? () => revealParticipantAction(selected.id, "id_number")
                        : undefined
                    }
                  />
                </p>
                <p>
                  <span className="text-[#81766d]">Phone number</span>
                  <br />
                  <MaskedField
                    label="Phone number"
                    maskedValue={selected.phoneNumber ?? "—"}
                    revealAction={
                      selected.pillarIds.some((id) => can(grants, "SENSITIVE_REVEAL", id))
                        ? () => revealParticipantAction(selected.id, "phone_number")
                        : undefined
                    }
                  />
                </p>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold">Cross-pillar enrollments</h3>
                <ul className="mt-2 space-y-2">
                  {selected.enrollments.map((item) => (
                    <li key={item.id} className="rounded-xl border p-3">
                      <span className="font-semibold">{pillarName(item.pillarId)}</span> ·{" "}
                      {item.category}
                      <span className="block text-xs text-[#81766d]">
                        Stage: {item.currentStage ?? "Not started"} · Since {date(item.date)} ·{" "}
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold">History</h3>
                <p className="mt-2 text-[#81766d]">
                  Registered {date(selected.registered)}; {selected.enrollments.length} enrollment
                  {selected.enrollments.length === 1 ? "" : "s"} recorded.
                </p>
              </div>
              {selected.pillarIds.some((id) => can(grants, "PARTICIPANT_EDIT", id)) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setError("");
                    setModal("edit");
                  }}
                >
                  Edit participant
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "register"}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Register participant</DialogTitle>
          <DialogDescription>
            One participant record, shared across every pillar they join.
          </DialogDescription>
          {error && (
            <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">
              {error}
            </p>
          )}
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitRegister}>
            <label className="text-sm">
              First name
              <input
                name="firstName"
                required
                maxLength={80}
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Last name
              <input
                name="lastName"
                required
                maxLength={80}
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Gender
              <select name="gender" className="mt-1 w-full rounded-lg border p-2">
                <option value="">Not recorded</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
            <label className="text-sm">
              Date of birth
              <input name="dateOfBirth" type="date" className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="text-sm">
              Phone number
              <input
                name="phoneNumber"
                type="tel"
                maxLength={30}
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              National ID number
              <input name="idNumber" maxLength={40} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="text-sm">
              Ward
              <select name="wardId" className="mt-1 w-full rounded-lg border p-2">
                <option value="">Not recorded</option>
                {catalog.wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Enrol into pillar
              <select name="pillarId" required className="mt-1 w-full rounded-lg border p-2">
                {availablePillars.map((pillar) => (
                  <option key={pillar.id} value={pillar.id}>
                    {pillar.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Intake notes
              <textarea name="remarks" rows={3} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="consentGiven" />
              Consent recorded
            </label>
            <div className="sm:col-span-2">
              <Button disabled={busy} type="submit">
                {busy ? "Registering…" : "Register participant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "edit"}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Edit participant</DialogTitle>
          <DialogDescription>{selected?.name}</DialogDescription>
          {error && (
            <p role="alert" className="rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">
              {error}
            </p>
          )}
          <form onSubmit={submitEdit} className="space-y-4">
            <label className="block text-sm">
              Remarks
              <textarea
                name="remarks"
                defaultValue={selected?.remarks ?? ""}
                rows={4}
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentGiven" defaultChecked={selected?.consentGiven} />
              Consent recorded
            </label>
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
