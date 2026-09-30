"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/file-drop-field";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import {
  addAttendeeAction,
  attachSessionFileAction,
  logSessionAction,
  removeAttendeeAction,
  updateSessionAction,
} from "../actions";
import type { AttendeeView, SessionPillar, SessionView, SessionWorkspace } from "../model";

/** Document types a session file holds; stored as document.document_type. */
export const sessionFileTypes = [
  ["attendance_sheet", "Attendance sheet"],
  ["group_photo", "Group photo"],
  ["supporting_document", "Supporting document"],
] as const;

const describe = (session: SessionView | null) =>
  session ? `${session.topic} · ${session.activityType}` : undefined;

/** Log a session, or edit one; the edited session's current type and topic stay selectable. */
export function SessionFormDialog({
  open,
  workspace,
  session,
  onClose,
  onDone,
}: {
  open: boolean;
  workspace: SessionWorkspace;
  session: SessionView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [typeId, setTypeId] = useState(session ? String(session.activityTypeId) : "");
  const [topicValue, setTopicValue] = useState(session ? String(session.topicId ?? "other") : "");
  const activeTypes = workspace.activityTypes.filter((type) => type.active);
  const typeOptions =
    session && !activeTypes.some((type) => type.id === session.activityTypeId)
      ? [{ id: session.activityTypeId, name: session.activityType }, ...activeTypes]
      : activeTypes;
  const topics = workspace.topics
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
    topicOptions.some((topic) => String(topic.id) === topicValue) || topicValue === "other"
      ? topicValue
      : topicOptions[0]
        ? String(topicOptions[0].id)
        : "other";
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      pillar: workspace.pillar,
      sessionId: session?.id,
      activityTypeId: Number(typeId),
      topicId: chosenTopic === "other" ? null : Number(chosenTopic),
      topic: String(form.get("topic") ?? ""),
      sessionDate: String(form.get("sessionDate") ?? ""),
      venue: String(form.get("venue") ?? ""),
      notes: String(form.get("notes") ?? ""),
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
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
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
            defaultValue={session?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
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
export function LogSessionButton({ workspace }: { workspace: SessionWorkspace }) {
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
        workspace={workspace}
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

/** Correct attendance: pick a participant who is not already on the list. */
export function AddAttendeeDialog({
  session,
  workspace,
  onClose,
  onDone,
}: {
  session: SessionView | null;
  workspace: Pick<SessionWorkspace, "pillar" | "participants">;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [search, setSearch] = useState("");
  const [participantId, setParticipantId] = useState("");
  const listed = new Set(session?.attendees.map((attendee) => attendee.participantId));
  const needle = search.trim().toLocaleLowerCase();
  const options = workspace.participants.filter(
    (person) =>
      !listed.has(person.id) && (!needle || person.label.toLocaleLowerCase().includes(needle))
  );
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    void submit.run(
      addAttendeeAction({
        pillar: workspace.pillar,
        sessionId: session.id,
        participantId: Number(participantId),
      }),
      "Attendee added"
    );
  }
  return (
    <ActionDialog
      open={session !== null}
      busy={submit.busy}
      onClose={close}
      title="Add attendee"
      description={describe(session)}
      error={submit.error}
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
          >
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
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
