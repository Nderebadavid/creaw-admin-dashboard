"use client";
import { useState, type FormEvent } from "react";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import {
  createReferralAction,
  editReferralAction,
  respondReferralAction,
  withdrawReferralAction,
} from "../actions";
import type { ReferralView } from "../api";
import type { ReferralDestinationCatalog } from "../schemas";

const field = "mt-1 w-full rounded-lg border border-creaw-line-strong bg-white p-2";

export interface ReferralOriginOption {
  enrollmentId: number;
  pillarId: number;
  participant: string;
  category: string;
}

/** Refers one of the user's enrollments to another pillar or an outside partner. */
export function NewReferralDialog({
  open,
  origins,
  pillars,
  catalog,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Enrollments the user may refer from (REFERRAL_CREATE in their pillar). */
  origins: ReferralOriginOption[];
  pillars: { id: number; name: string }[];
  catalog: ReferralDestinationCatalog;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [originId, setOriginId] = useState(origins[0]?.enrollmentId ?? 0);
  const [kind, setKind] = useState<"internal" | "external">("internal");
  const origin = origins.find((item) => item.enrollmentId === originId);
  // An internal referral must go to another pillar that accepts referrals; an
  // external one names the pillar that stays responsible for the participant.
  const destinations =
    kind === "external"
      ? pillars
      : pillars.filter(
          (item) => item.id !== origin?.pillarId && catalog.internalPillarIds.includes(item.id)
        );

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      createReferralAction({
        enrollmentId: origin.enrollmentId,
        fromPillarId: origin.pillarId,
        toPillarId: Number(form.get("toPillarId")),
        partnerInstitutionId:
          kind === "external" ? Number(form.get("partnerInstitutionId")) : undefined,
        reason: String(form.get("reason") ?? ""),
        notes: String(form.get("notes") ?? ""),
      }),
      "Referral sent to the receiving pillar."
    );
  }

  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        setKind("internal");
        onClose();
      }}
      title="New referral"
      description="Refer a participant to a pillar project or partner institution."
      error={submit.error}
      className="sm:max-w-lg"
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Participant and origin enrollment
          <select
            value={originId}
            onChange={(event) => setOriginId(Number(event.target.value))}
            className={field}
          >
            {origins.map((item) => (
              <option key={item.enrollmentId} value={item.enrollmentId}>
                {item.participant} · {pillars.find((p) => p.id === item.pillarId)?.name} ·{" "}
                {item.category}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Destination type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "internal" | "external")}
            className={field}
          >
            <option value="internal">Pillar project</option>
            <option value="external">Partner institution</option>
          </select>
        </label>
        <label className="block text-sm">
          {kind === "external" ? "Responsible pillar" : "To pillar"}
          <select name="toPillarId" required className={field}>
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {kind === "external" && (
          <label className="block text-sm">
            Partner institution
            <select name="partnerInstitutionId" required className={field}>
              {catalog.partnerInstitutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          Reason
          <textarea name="reason" required rows={3} className={field} />
        </label>
        <label className="block text-sm">
          Note to receiving team
          <textarea name="notes" rows={2} className={field} />
        </label>
        <Button
          type="submit"
          disabled={
            submit.busy ||
            destinations.length === 0 ||
            (kind === "external" && catalog.partnerInstitutions.length === 0)
          }
        >
          Send referral
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Accept (creating the destination enrollment) or decline a new referral. */
export function RespondDialog({
  referral,
  onClose,
  onDone,
}: {
  referral: ReferralView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referral) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      respondReferralAction({
        id: referral.id,
        decision: form.get("decision"),
        note: String(form.get("note") ?? ""),
      }),
      "Referral decision recorded."
    );
  }

  return (
    <ActionDialog
      open={referral !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Respond to referral"
      description={
        referral && `${referral.participant} · ${referral.fromPillar} → ${referral.destinationName}`
      }
      error={submit.error}
    >
      <form onSubmit={send} className="space-y-4">
        <p>{referral?.reason}</p>
        <label className="block text-sm">
          Decision
          <select name="decision" className={field}>
            <option value="ACCEPTED">
              {referral?.external
                ? `Confirm hand-off to ${referral.destinationName}`
                : `Accept — create ${referral?.toPillar} enrollment`}
            </option>
            <option value="DECLINED">Decline</option>
          </select>
        </label>
        <label className="block text-sm">
          Note to referring officer
          <textarea
            name="note"
            rows={3}
            placeholder={
              referral?.referredBy
                ? `Referred by ${referral.referredBy}: “${referral.reason}”`
                : undefined
            }
            className={field}
          />
        </label>
        <Button disabled={submit.busy} type="submit">
          Save response
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Edits the reason on a referral that has not been decided yet. */
export function EditReferralDialog({
  referral,
  onClose,
  onDone,
}: {
  referral: ReferralView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referral) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      editReferralAction({ id: referral.id, reason: String(form.get("reason") ?? "") }),
      "Referral updated."
    );
  }

  return (
    <ActionDialog
      open={referral !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Edit referral"
      description={referral?.participant}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Reason
          <textarea
            key={referral?.id}
            name="reason"
            required
            defaultValue={referral?.reason}
            rows={4}
            className={field}
          />
        </label>
        <Button disabled={submit.busy} type="submit">
          Save changes
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Withdraws a new referral; it stays in history with a withdrawn status. */
export function WithdrawReferralDialog({
  referral,
  onClose,
  onDone,
}: {
  referral: ReferralView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  return (
    <ActionDialog
      open={referral !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Withdraw referral"
      description={referral?.participant}
      error={submit.error}
    >
      <p>
        Withdraw this referral? The receiving team is notified and the referral is kept in history.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={submit.busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={submit.busy}
          variant="destructive"
          onClick={() =>
            referral &&
            void submit.run(
              withdrawReferralAction(referral.id),
              "Referral withdrawn and kept in history."
            )
          }
        >
          Withdraw
        </Button>
      </div>
    </ActionDialog>
  );
}
