import type { ReactNode } from "react";

// Stubbed until real auth exists -- see src/lib/auth/current-role.tsx.
// Ordered loosely most-privileged first; used only for nav gating today.
export type UserRole = "super_admin" | "admin" | "manager" | "member" | "guest";

/** Every UserRole value, in the same order -- for the header's role switcher. */
export const ALL_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "member",
  "guest",
];

export interface NavItem {
  id: string;
  icon: ReactNode;
  label: string;
  href: string;
  /** Every item must declare its allowed roles explicitly -- no "visible to all" default. */
  roles: UserRole[];
  badge?: string | number;
  isNew?: boolean;
  children?: NavItem[];
}

export interface SidebarProps {
  /** Desktop: labels visible (expanded). Mobile drawer is always expanded. */
  isOpen: boolean;
  /** Toggles the desktop collapsed/expanded state. */
  onToggleCollapsed: () => void;
  /** Mobile drawer visibility. */
  mobileOpen: boolean;
  /** Enable the width transition (off until collapse state is hydrated). */
  animateWidth?: boolean;
  userRole: UserRole;
  onCloseMobile?: () => void;
}

export interface BadgeProps {
  children: ReactNode;
  variant?: "new" | "pro" | "default";
}

export interface NavItemComponentProps {
  item: NavItem;
  isOpen: boolean;
  userRole: UserRole;
  activeItem: string;
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
  onCloseMobile?: () => void;
}
