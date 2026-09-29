"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Camera,
  CalendarClock,
  ArrowLeftRight,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import type { NavigationStatus } from "./navigation";
import { usePopover } from "./use-popover";

interface Notice {
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  tone: "crit" | "warn" | "info";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One notice per module with waiting work, most urgent first. */
function noticesFor(status: NavigationStatus | undefined): Notice[] {
  if (!status) return [];
  const notices: (Notice | false)[] = [
    status.overdueReports > 0 && {
      icon: CalendarClock,
      title: `${plural(status.overdueReports, "donor report")} overdue`,
      detail: "Reporting calendar",
      href: "/reporting",
      tone: "crit",
    },
    status.pendingSubmissions > 0 && {
      icon: Camera,
      title: `${plural(status.pendingSubmissions, "field submission")} awaiting review`,
      detail: "Synced from mobile app",
      href: "/field-submissions",
      tone: "warn",
    },
    status.newReferrals > 0 && {
      icon: ArrowLeftRight,
      title: `${plural(status.newReferrals, "new referral")} to decide`,
      detail: "Referral queue",
      href: "/referrals",
      tone: "warn",
    },
    status.grantsAwaiting > 0 && {
      icon: Receipt,
      title: `${plural(status.grantsAwaiting, "grant application")} awaiting sign-off`,
      detail: "Grants",
      href: "/grants",
      tone: "info",
    },
  ];
  return notices.filter((notice): notice is Notice => Boolean(notice));
}

const toneClass = {
  crit: "bg-creaw-danger-soft text-creaw-danger",
  warn: "bg-[#FDEFD9] text-[#9A5A0E]",
  info: "bg-[#E9EEF9] text-[#36548e]",
};

/** Bell button with an unread dot and a dropdown of waiting work. */
export function NotificationsMenu({ status }: { status?: NavigationStatus }) {
  const notices = noticesFor(status);
  const [read, setRead] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { ref: popoverRef, open: menuOpen, toggle: toggleMenu, close: closeMenu } = usePopover();
  const unread = read ? 0 : notices.length;

  return (
    <div ref={popoverRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={menuOpen}
        onClick={toggleMenu}
        className="relative rounded-full"
      >
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2 size-2 rounded-full border-2 border-white bg-[#E0822F]"
          />
        )}
      </Button>
      {menuOpen && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-creaw-line bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-creaw-divider px-4 py-3.5">
            <h2 className="font-heading text-lg font-bold">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-[13px] font-semibold text-primary"
              >
                Mark all read
              </button>
            )}
          </div>
          {notices.map((notice) => (
            <Link
              key={notice.href}
              href={notice.href}
              onClick={closeMenu}
              className="flex items-start gap-3 border-b border-[#F7F2EC] px-4 py-3 hover:bg-creaw-surface"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${toneClass[notice.tone]}`}
              >
                <notice.icon size={18} aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold leading-snug">{notice.title}</span>
                <span className="text-[12.5px] text-creaw-faint">{notice.detail}</span>
              </span>
            </Link>
          ))}
          {notices.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-creaw-faint">
              You&apos;re all caught up.
            </p>
          )}
        </section>
      )}
      <ActionDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Mark all as read?"
        description="Mark every notification as read?"
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setRead(true);
              setConfirming(false);
            }}
          >
            Mark all read
          </Button>
        </div>
      </ActionDialog>
    </div>
  );
}
