"use client";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

export interface DrawerTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Right-hand record panel from the design: avatar, "kind · pillar", title and
 * subtitle, a status badge, record actions, then tabbed sections.
 */
export function RecordDrawer({
  open,
  onClose,
  initials,
  kind,
  title,
  subtitle,
  status,
  actions,
  tabs,
  accent = "#B4552E",
  tint = "#FBEDE5",
}: {
  open: boolean;
  onClose: () => void;
  initials: string;
  /** Small caption above the title, e.g. "Participant · VAWG". */
  kind: string;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
  tabs: DrawerTab[];
  /** Pillar colours for the avatar. */
  accent?: string;
  tint?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="left-auto right-0 top-0 flex h-dvh w-[min(560px,100vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none"
      >
        <header className="border-b border-creaw-divider px-6 pb-4 pt-5">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
              style={{ background: tint, color: accent }}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-creaw-faint">
                {kind}
              </p>
              <DialogTitle className="font-heading text-2xl font-bold">{title}</DialogTitle>
              <DialogDescription className="text-sm text-creaw-faint">
                {subtitle ?? kind}
              </DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Close record"
              onClick={onClose}
              className="rounded-lg p-1.5 text-creaw-faint hover:bg-accent"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {(status || actions) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {status}
              <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
            </div>
          )}
        </header>
        {tabs.length > 1 && (
          <div role="tablist" aria-label={`${title} sections`} className="flex gap-1 border-b px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === current?.id}
                onClick={() => setActive(tab.id)}
                className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${tab.id === current?.id ? "border-primary text-primary" : "border-transparent text-creaw-body"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div role="tabpanel" className="flex-1 overflow-y-auto px-6 py-5 text-sm">
          {current?.content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
