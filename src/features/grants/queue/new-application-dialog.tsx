"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useEffect, useState, type FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { listParticipantsAction } from "@/features/participants/actions";
import { titleCase } from "@/lib/format";
import { createGrantApplicationAction, listGrantRecommendationsAction } from "../actions";
import type { GrantProgramme, GrantRecommendation } from "../api";
import { GRANT_TYPES } from "../schemas";

/** The most applicants one dropdown offers; the dialog says so when a pillar has more. */
const APPLICANT_LIMIT = 100;
/** Skilling recommends graduates to WEE, so only WEE programmes offer them. */
const WEE_PILLAR_ID = 2;

interface Applicants {
  pillarId: number;
  items: { id: number; name: string }[];
  total: number;
  error?: string;
}

/**
 * Files a grant application from the queue. The applicant is chosen from the
 * participants enrolled in the programme's pillar; for WEE programmes, graduates
 * Skilling recommended (and WEE accepted) lead the list and pre-fill the notes.
 */
export function NewApplicationDialog({
  open,
  programmes,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Programmes the user may file applications for. */
  programmes: readonly GrantProgramme[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id);
  const programme = programmes.find((item) => item.id === programmeId);
  const pillarId = programme?.pillarId;
  const [applicants, setApplicants] = useState<Applicants | null>(null);
  const current = applicants?.pillarId === pillarId ? applicants : null;
  const [recommendations, setRecommendations] = useState<GrantRecommendation[]>([]);
  const [applicant, setApplicant] = useState("");
  const [notes, setNotes] = useState("");
  const recommended = pillarId === WEE_PILLAR_ID ? recommendations : [];
  const recommendedIds = new Set(recommended.map((item) => item.participantId));
  const others = current?.items.filter((item) => !recommendedIds.has(item.id)) ?? [];

  // A failed read just leaves the group out; the ordinary applicant list still works.
  useEffect(() => {
    if (!open) return;
    let active = true;
    void listGrantRecommendationsAction()
      .then((result) => {
        if (active) setRecommendations(result.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  function chooseApplicant(value: string) {
    setApplicant(value);
    const pick = recommended.find((item) => String(item.participantId) === value);
    if (pick) setNotes(pick.suggestedNotes);
  }

  useEffect(() => {
    if (!open || pillarId === undefined) return;
    let active = true;
    void listParticipantsAction({ pillarId, page: 1, pageSize: APPLICANT_LIMIT })
      .then((result) => {
        if (!active) return;
        setApplicants({
          pillarId,
          items: result.data?.items.map(({ id, name }) => ({ id, name })) ?? [],
          total: result.data?.totalItems ?? 0,
          error: result.success ? undefined : result.message,
        });
      })
      .catch(() => {
        if (active)
          setApplicants({ pillarId, items: [], total: 0, error: "Could not load applicants." });
      });
    return () => {
      active = false;
    };
  }, [open, pillarId]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      createGrantApplicationAction({
        projectId: Number(form.get("projectId")),
        participantId: Number(form.get("participantId")),
        requestedAmount: Number(form.get("requestedAmount")),
        grantType: String(form.get("grantType")),
        notes: String(form.get("notes") ?? ""),
      }),
      "Application filed and marked as prepared. A different officer reviews it next."
    );
  }

  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="New application"
      description="File a grant application for an enrolled participant"
      error={submit.error || current?.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Programme
          <SearchableSelect
            name="projectId"
            required
            emptyLabel="Choose a programme"
            value={programmeId}
            onChange={(id) => {
              setProgrammeId(Number(id));
              setApplicant("");
            }}
            options={programmes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </label>
        <label className="block text-sm">
          Applicant
          <SearchableSelect
            name="participantId"
            required
            value={applicant}
            onChange={(id) => chooseApplicant(id ?? "")}
            disabled={!current}
            emptyLabel={current ? "Choose a participant" : "Loading participants…"}
            options={[
              ...(current
                ? recommended.map((item) => ({
                    value: item.participantId,
                    label: item.course ? `${item.name} · ${item.course}` : item.name,
                    group: "Recommended by Skilling",
                  }))
                : []),
              ...others.map((item) => ({
                value: item.id,
                label: `${item.name} · Participant #${item.id}`,
                group: current && recommended.length > 0 ? "Enrolled participants" : undefined,
              })),
            ]}
          />
        </label>
        {current && current.total > current.items.length && (
          <p className="-mt-2 text-xs text-creaw-faint">
            Showing the first {current.items.length} of {current.total} participants in this pillar.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Amount requested (KES)
            <input
              name="requestedAmount"
              type="number"
              min="1"
              step="0.01"
              required
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            Grant type
            <select name="grantType" required className={fieldClass}>
              {GRANT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Business or purpose
          <input
            name="notes"
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={fieldClass}
          />
        </label>
        <Button
          type="submit"
          disabled={submit.busy || !current || others.length + recommended.length === 0}
        >
          File application
        </Button>
      </form>
    </ActionDialog>
  );
}
