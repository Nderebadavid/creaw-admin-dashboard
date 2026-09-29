"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/modal-form";
import {
  createPillarDomainAction,
  createPillarRecordAction,
  updatePillarRecordAction,
} from "./actions";
import type { PillarCode } from "./schemas";

export function PillarCreateButton({ code, name }: { code: PillarCode; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add {name} record
      </Button>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title={`Add ${name} record`}
        description="Enroll an existing participant in this pillar. Their identity remains in the shared participant registry."
        submitLabel="Add record"
        action={async (data) => {
          const result = await createPillarRecordAction(
            code,
            Number(data.get("participantId")),
            String(data.get("entryCategory") ?? "")
          );
          if (result.success) router.refresh();
          return result.success ? { success: true } : { success: false, error: result.message };
        }}
      >
        <div>
          <label htmlFor="pillar-participant-id" className="mb-1 block text-sm font-medium">
            Participant ID
          </label>
          <input
            id="pillar-participant-id"
            name="participantId"
            type="number"
            min="1"
            required
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="pillar-category" className="mb-1 block text-sm font-medium">
            Programme category
          </label>
          <input
            id="pillar-category"
            name="entryCategory"
            required
            maxLength={120}
            placeholder="e.g. Legal aid & counselling"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </ModalForm>
    </>
  );
}

export function PillarEditButton({
  code,
  id,
  category,
}: {
  code: PillarCode;
  id: number;
  category: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Edit record ${id}`}
      >
        <Pencil size={14} />
        Edit
      </Button>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title={`Edit record #${id}`}
        description="Update the programme category for this pillar enrollment."
        submitLabel="Save changes"
        action={async (data) => {
          const result = await updatePillarRecordAction(
            code,
            id,
            String(data.get("entryCategory") ?? "")
          );
          if (result.success) router.refresh();
          return result.success ? { success: true } : { success: false, error: result.message };
        }}
      >
        <div>
          <label htmlFor={`pillar-category-${id}`} className="mb-1 block text-sm font-medium">
            Programme category
          </label>
          <input
            id={`pillar-category-${id}`}
            name="entryCategory"
            defaultValue={category}
            required
            maxLength={120}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </ModalForm>
    </>
  );
}

const domainForms = {
  vawg: {
    label: "Open legal case",
    fields: [
      ["enrollmentId", "Enrollment ID", "number"],
      ["caseTypeId", "Case type ID", "number"],
      ["openedDate", "Opened date", "date"],
    ],
  },
  wee: {
    label: "New application",
    fields: [
      ["projectId", "Project ID", "number"],
      ["participantId", "Participant ID", "number"],
      ["requestedAmount", "Requested amount (KES)", "number"],
      ["grantType", "Grant type", "text"],
    ],
  },
  srhr: {
    label: "Log session",
    fields: [
      ["activityTypeId", "Activity type ID", "number"],
      ["sessionDate", "Session date", "date"],
      ["topic", "Topic", "text"],
      ["venue", "Venue", "text"],
    ],
  },
  skilling: {
    label: "Enrol trainee",
    fields: [
      ["enrollmentId", "Enrollment ID", "number"],
      ["pathway", "Pathway", "text"],
      ["courseName", "Course name", "text"],
      ["startDate", "Start date", "date"],
    ],
  },
  wros: {
    label: "Add organisation",
    fields: [
      ["name", "Organisation name", "text"],
      ["legalForm", "Legal form", "text"],
      ["entryCategory", "Programme category", "text"],
    ],
  },
} as const;

export function PillarDomainCreateButton({ code }: { code: PillarCode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (code === "leadership") return null;
  const form = domainForms[code];
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        {form.label}
      </Button>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title={form.label}
        description="Create a scoped programme record. Changes are logged in the audit trail."
        submitLabel={form.label}
        action={async (data) => {
          const values = Object.fromEntries(
            form.fields.map(([name, , type]) => [
              name,
              type === "number" ? Number(data.get(name)) : String(data.get(name) ?? ""),
            ])
          );
          const result = await createPillarDomainAction(code, values);
          if (result.success) router.refresh();
          return result.success ? { success: true } : { success: false, error: result.message };
        }}
      >
        {form.fields.map(([name, label, type]) => (
          <div key={name}>
            <label htmlFor={`domain-${code}-${name}`} className="mb-1 block text-sm font-medium">
              {label}
            </label>
            <input
              id={`domain-${code}-${name}`}
              name={name}
              type={type}
              min={type === "number" ? "1" : undefined}
              step={name === "requestedAmount" ? "0.01" : undefined}
              required
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
        ))}
      </ModalForm>
    </>
  );
}
