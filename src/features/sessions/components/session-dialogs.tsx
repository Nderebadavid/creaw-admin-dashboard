"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/file-drop-field";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { useLoadedOptions } from "@/components/ui/use-loaded-options";
import {
  addAttendeeAction,
  attachSessionFileAction,
  loadSessionOptionsAction,
  logSessionAction,
  removeAttendeeAction,
  searchParticipantsAction,
  updateSessionAction,
} from "../actions";
import type { AttendeeView, SessionPillar, SessionView } from "../model";

/** Document types a session file holds; stored as document.document_type. */
export const sessionFileTypes = [
  ["attendance_sheet", "Attendance sheet"],
  ["group_photo", "Group photo"],
  ["supporting_document", "Supporting document"],
] as const;

/** "staff:9" or "provider:2" from the facilitator select. */
function parseFacilitator(value: string) {
  const [kind, id] = value.split(":");
  return { kind: kind as "staff" | "provider", id: Number(id) };
}

const describe = (session: SessionView | null) =>
  session ? `${session.topic} · ${session.activityType}` : undefined;

/** Log a session, or edit one; the edited session's current type and topic stay selectable. */
export function SessionFormDialog({
  open,
  pillar,
  currentUser,
  session,
  onClose,
  onDone,
}: {
  open: boolean;
  pillar: SessionPillar;
  currentUser: { id: number; name: string } | null;
  session: SessionView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [typeId, setTypeId] = useState(session ? String(session.activityTypeId) : "");
  const [topicValue, setTopicValue] = useState(session ? String(session.topicId ?? "other") : "");
  const options = useLoadedOptions(open, () => loadSessionOptionsAction(pillar));
  const activityTypes = options.data?.activityTypes ?? [];
  const allTopics = options.data?.topics ?? [];
  const facilitators = options.data?.facilitators ?? [];
  const activeTypes = activityTypes.filter((type) => type.active);
  const typeOptions =
    session && !activeTypes.some((type) => type.id === session.activityTypeId)
      ? [{ id: session.activityTypeId, name: session.activityType }, ...activeTypes]
      : activeTypes;
  const topics = allTopics
    .filter((topic) => topic.active && String(topic.activityTypeId) === typeId)
    .sort((a, b) => a.sequenceNo - b.sequenceNo);
  const topicOptions =
    session?.topicId != null &&
    String(session.activityTypeId) === typeId &&
    !topics.some((topic) => topic.id === session.topicId)
      ? [{ id: session.topicId, name: session.topic }, ...topics]
      : topics;
  // The select shows its first option when nothing is chosen, so submit that one.
  const chosenTopic =
    typeId === ""
      ? ""
      : topicOptions.some((topic) => String(topic.id) === topicValue) || topicValue === "other"
        ? topicValue
        : topicOptions[0]
          ? String(topicOptions[0].id)
          : "other";
  const ref = session?.facilitatorRef ?? null;
  const staff = facilitators.filter((item) => item.kind === "staff");
  const providers = facilitators.filter((item) => item.kind === "provider");
  const offered = (kind: string, id: number) =>
    facilitators.some((item) => item.kind === kind && item.id === id);
  // Only the signed-in user when the picker could not load; an edited session keeps its own.
  const fallbackMe =
    facilitators.length === 0 && currentUser
      ? { value: `staff:${currentUser.id}`, label: `Me (${currentUser.name || "CREAW staff"})` }
      : null;
  const keptCurrent =
    session && ref && !offered(ref.kind, ref.id)
      ? { value: `${ref.kind}:${ref.id}`, label: session.facilitator.name }
      : null;
  const defaultFacilitator = ref
    ? `${ref.kind}:${ref.id}`
    : session || !currentUser
      ? ""
      : `staff:${currentUser.id}`;
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      pillar,
      sessionId: session?.id,
      activityTypeId: Number(typeId),
      topicId: chosenTopic === "other" ? null : Number(chosenTopic),
      topic: String(form.get("topic") ?? ""),
      sessionDate: String(form.get("sessionDate") ?? ""),
      venue: String(form.get("venue") ?? ""),
      notes: String(form.get("notes") ?? ""),
      facilitator: parseFacilitator(String(form.get("facilitator") ?? "")),
    };
    void submit.run(
      session ? updateSessionAction(input) : logSessionAction(input),
      session ? "Session updated" : "Session logged"
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title={session ? "Edit session" : "Log session"}
      description={describe(session)}
      error={submit.error || options.error}
      className="sm:max-w-[640px]"
    >
      <form
        key={options.data ? "loaded" : "loading"}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={send}
      >
        <label className="text-sm">
          Activity type
          <select
            required
            value={typeId}
            onChange={(event) => {
              setTypeId(event.target.value);
              setTopicValue("");
            }}
            className={fieldClass}
          >
            <option value="" disabled>
              Choose an activity type
            </option>
            {typeOptions.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Topic
          <select
            required
            value={chosenTopic}
            onChange={(event) => setTopicValue(event.target.value)}
            className={fieldClass}
          >
            {typeId === "" && (
              <option value="" disabled>
                Choose an activity type first
              </option>
            )}
            {topicOptions.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </label>
        {chosenTopic === "other" && (
          <label className="text-sm sm:col-span-2">
            Describe the topic
            <input
              name="topic"
              required
              maxLength={200}
              defaultValue={session?.freeTopic ?? ""}
              className={fieldClass}
            />
          </label>
        )}
        <label className="text-sm">
          Date
          <input
            name="sessionDate"
            type="date"
            required
            defaultValue={session?.date.slice(0, 10) ?? localToday()}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Venue
          <input
            name="venue"
            maxLength={160}
            defaultValue={session?.venue ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Facilitator
          <select
            name="facilitator"
            required
            defaultValue={defaultFacilitator}
            className={fieldClass}
          >
            {defaultFacilitator === "" && (
              <option value="" disabled>
                Choose a facilitator
              </option>
            )}
            {keptCurrent && <option value={keptCurrent.value}>{keptCurrent.label}</option>}
            {fallbackMe && <option value={fallbackMe.value}>{fallbackMe.label}</option>}
            {staff.length > 0 && (
              <optgroup label="CREAW staff">
                {staff.map((item) => (
                  <option key={item.id} value={`staff:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            )}
            {providers.length > 0 && (
              <optgroup label="External providers">
                {providers.map((item) => (
                  <option key={item.id} value={`provider:${item.id}`}>
                    {`${item.name} · ${item.detail}`}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={session?.notes ?? ""}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {session ? "Save changes" : "Log session"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The page heading's "Log session" button. */
export function LogSessionButton({
  pillar,
  currentUser,
}: {
  pillar: SessionPillar;
  currentUser: { id: number; name: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Log session
      </Button>
      <SessionFormDialog
        key={open ? "open" : "closed"}
        open={open}
        pillar={pillar}
        currentUser={currentUser}
        session={null}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

/** Correct attendance: search for a participant who is not already on the list. */
export function AddAttendeeDialog({
  session,
  attendees,
  pillar,
  onClose,
  onDone,
}: {
  session: SessionView | null;
  /** Who is already on the list, so they cannot be added twice. */
  attendees: readonly AttendeeView[];
  pillar: SessionPillar;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [search, setSearch] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [found, setFound] = useState<{ id: number; label: string }[]>([]);
  const [settled, setSettled] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const listed = new Set(attendees.map((attendee) => attendee.participantId));
  const options = found.filter((person) => !listed.has(person.id));
  const open = session !== null;
  // Busy until the search for what is typed has answered.
  const loading = open && settled !== search;

  // Search as you type: a small page of matches, never the whole register.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(
      () => {
        searchParticipantsAction(pillar, search)
          .then((result) => {
            if (!active) return;
            setSearchError(result.success ? "" : result.message);
            setFound(result.data ?? []);
          })
          .catch(() => {
            if (active) setSearchError("Could not search participants.");
          })
          .finally(() => {
            if (active) setSettled(search);
          });
      },
      search ? 250 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, pillar, search]);

  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    void submit.run(
      addAttendeeAction({
        pillar,
        sessionId: session.id,
        participantId: Number(participantId),
      }),
      "Attendee added"
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title="Add attendee"
      description={describe(session)}
      error={submit.error || searchError}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Find participant
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Participant
          <select
            size={6}
            required
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            className={fieldClass}
            aria-busy={loading}
          >
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
        {!loading && options.length === 0 && (
          <p className="text-[13px] text-creaw-faint">
            {search ? "No participants match that search." : "No participants to show."}
          </p>
        )}
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submit.busy || !options.some((person) => String(person.id) === participantId)}
          >
            Add attendee
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Confirm taking someone off the attendance list. */
export function RemoveAttendeeDialog({
  session,
  pillar,
  attendee,
  onClose,
  onDone,
}: {
  session: SessionView | null;
  pillar: SessionPillar;
  attendee: AttendeeView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const close = () => {
    submit.clearError();
    onClose();
  };
  return (
    <ActionDialog
      open={session !== null && attendee !== null}
      busy={submit.busy}
      onClose={close}
      title="Remove attendee"
      description={describe(session)}
      error={submit.error}
    >
      {session && attendee && (
        <div className="space-y-4">
          <p className="text-sm">{`Remove ${attendee.name} from this session's attendance?`}</p>
          <div>
            <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submit.busy}
              onClick={() =>
                void submit.run(
                  removeAttendeeAction({
                    pillar,
                    sessionId: session.id,
                    attendanceId: attendee.attendanceId,
                  }),
                  "Attendee removed"
                )
              }
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </ActionDialog>
  );
}

/** Attach an attendance sheet, group photo or other file to the session. */
export function AttachSessionFileDialog({
  session,
  pillar,
  onClose,
  onDone,
}: {
  session: SessionView | null;
  pillar: SessionPillar;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [ready, setReady] = useState(false);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const type = String(form.get("documentType"));
    void submit.run(
      attachSessionFileAction({
        pillar,
        sessionId: session.id,
        documentType: type,
        fileUrl: String(form.get("fileUrl") ?? ""),
      }),
      `${sessionFileTypes.find(([code]) => code === type)?.[1] ?? "Document"} attached`
    );
  }
  return (
    <ActionDialog
      open={session !== null}
      busy={submit.busy}
      onClose={close}
      title="Attach file"
      description={describe(session)}
      error={submit.error}
      className="sm:max-w-[560px]"
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Document type
          <select name="documentType" defaultValue="attendance_sheet" className={fieldClass}>
            {sessionFileTypes.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <FileDropField
          name="fileUrl"
          target={session ? describe(session) : undefined}
          onChange={setReady}
        />
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy || !ready}>
            Upload &amp; attach
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Today's date in the browser's own time zone as YYYY-MM-DD (not UTC, which lags EAT overnight). */
function localToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
