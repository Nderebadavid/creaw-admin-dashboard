"use client";
import { Pencil, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { FieldGrid, SectionTitle } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { revealProviderContactAction } from "../actions";
import { providerTypeLabel, type ProviderView, type WorkloadGroup } from "../model";

export interface ProviderPermissions {
  manage: boolean;
  reveal: boolean;
  export: boolean;
}

const RECENT_LIMIT = 5;

const workGroups: [string, keyof ProviderView["workload"]][] = [
  ["Sessions facilitated", "sessions"],
  ["Counselling sessions", "counselling"],
  ["Trainees", "trainees"],
  ["Legal cases", "cases"],
];

function WorkGroup({ title, group }: { title: string; group: WorkloadGroup }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle note={`${group.count} in total`}>{title}</SectionTitle>
      {group.recent.slice(0, RECENT_LIMIT).map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-creaw-line bg-white px-3.5 py-3 text-sm"
        >
          <span className="font-semibold">
            {item.label}
            {item.pillar && <span className="font-normal text-creaw-faint"> · {item.pillar}</span>}
          </span>
          <span className="whitespace-nowrap text-[12.5px] text-creaw-faint">
            {formatDate(item.date)}
          </span>
        </div>
      ))}
      {group.recent.length === 0 && <p className="text-[13.5px] text-creaw-faint">None yet</p>}
    </section>
  );
}

/** An external provider as the record panel: overview with masked contacts, and linked work. */
export function ProviderDrawer({
  provider,
  can,
  busy = false,
  onClose,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  provider: ProviderView | null;
  can: ProviderPermissions;
  /** A status change is in flight, so the lifecycle buttons wait. */
  busy?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  if (!provider) return null;
  const reveal = (field: "phone_number" | "email") =>
    can.reveal ? () => revealProviderContactAction(provider.id, field) : undefined;
  const fields: [string, React.ReactNode][] = [
    ["Type", providerTypeLabel(provider.type)],
    ["Service", provider.service ?? "—"],
    ["Institution", provider.institution],
    [
      "Phone",
      provider.phone ? (
        <MaskedField
          label="Phone"
          maskedValue={provider.phone}
          revealAction={reveal("phone_number")}
        />
      ) : (
        "—"
      ),
    ],
    [
      "Email",
      provider.email ? (
        <MaskedField label="Email" maskedValue={provider.email} revealAction={reveal("email")} />
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={`${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}`.toUpperCase()}
      kind="External provider"
      title={provider.name}
      subtitle={`${providerTypeLabel(provider.type)} · ${provider.institution}`}
      status={
        <StatusBadge tone={provider.active ? "success" : "neutral"}>
          {provider.active ? "Active" : "Inactive"}
        </StatusBadge>
      }
      actions={
        <>
          <Button variant="outline" size="sm" disabled={!can.manage} onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          {provider.active ? (
            <Button variant="outline" size="sm" disabled={!can.manage} onClick={onDeactivate}>
              <PowerOff />
              Deactivate
            </Button>
          ) : (
            <Button size="sm" disabled={!can.manage || busy} onClick={onReactivate}>
              <Power />
              Reactivate
            </Button>
          )}
        </>
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-[22px]">
              <FieldGrid fields={fields} />
              <RecordSection
                status={provider.active ? "ACTIVE" : "INACTIVE"}
                statusDescription={provider.statusDescription}
                created={provider.created}
                updated={provider.updated}
                notes={[["Notes", provider.notes ?? "—"]]}
              />
            </div>
          ),
        },
        {
          id: "work",
          label: `Linked work (${provider.linkedWork})`,
          content: (
            <div className="flex flex-col gap-5">
              {workGroups.map(([title, key]) => (
                <WorkGroup key={key} title={title} group={provider.workload[key]} />
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}
