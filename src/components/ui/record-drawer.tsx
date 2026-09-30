"use client";
import { useId, useState, type ReactNode } from "react";
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
  const baseId = useId();
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
        className="left-auto right-0 top-0 flex h-dvh w-[min(600px,100vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 shadow-[-20px_0_50px_-20px_rgba(34,28,24,.35)] sm:max-w-none"
      >
        <header
          className={`flex flex-col gap-3.5 border-b border-creaw-divider px-6 pt-[22px] ${tabs.length > 1 ? "" : "pb-4"}`}
        >
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-[52px] shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
              style={{ background: tint, color: accent }}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[11.5px] font-bold uppercase tracking-[.08em]"
                style={{ color: accent }}
              >
                {kind}
              </p>
              <DialogTitle className="pr-0 font-heading text-[25px] font-bold leading-[1.1]">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13.5px] text-creaw-faint">
                {subtitle ?? kind}
              </DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Close record"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-creaw-canvas text-creaw-body hover:bg-creaw-line"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {(status || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {status}
              <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
            </div>
          )}
          {tabs.length > 1 && (
            <div role="tablist" aria-label={`${title} sections`} className="-mb-px flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={tab.id === current?.id}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={tab.id === current?.id ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${tab.id === current?.id ? "border-primary text-primary" : "border-transparent text-creaw-body"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </header>
        <div
          role={tabs.length > 1 ? "tabpanel" : undefined}
          id={`${baseId}-panel`}
          aria-labelledby={tabs.length > 1 && current ? `${baseId}-tab-${current.id}` : undefined}
          className="flex-1 overflow-y-auto bg-creaw-surface px-6 pb-8 pt-[22px] text-sm"
        >
          {current?.content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
