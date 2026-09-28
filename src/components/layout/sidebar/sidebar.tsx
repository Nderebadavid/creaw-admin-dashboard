"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, ChevronsLeftIcon } from "lucide-react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Variants,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { useCurrentRole, useCurrentUser } from "@/lib/auth/current-role";
import { CURRENT_ORG } from "@/lib/auth/current-user";
import type {
  NavItem,
  NavItemComponentProps,
  SidebarProps,
  UserRole,
} from "@/types/navigation";
import NAV_ITEMS, { NAV_SECONDARY } from "./nav-config";
import { MobileSidebarControls } from "./mobile-sidebar-controls";
import { useSidebarCollapsed } from "./use-sidebar-state";

const hasAccess = (roles: UserRole[], userRole: UserRole): boolean =>
  roles.includes(userRole);

// Stagger the nav lists in on mount, and each item slides up from the left.
const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" } },
};
// The shared "pill" that slides between the active item.
const activeSpring = { type: "spring", stiffness: 500, damping: 40 } as const;

function ActivePill() {
  return (
    <motion.span
      layoutId="sidebar-active"
      transition={activeSpring}
      className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
    />
  );
}

function BadgePill({
  value,
  isNew,
}: {
  value: string | number;
  /** String badges only: "new" (primary-tinted) vs "pro" (violet) accent. */
  isNew?: boolean;
}) {
  const isCount = typeof value === "number";
  return (
    <span
      className={cn(
        "ml-auto shrink-0 text-[11px] font-semibold leading-none",
        isCount
          ? "rounded-md bg-destructive px-1.5 py-0.5 text-white"
          : isNew
            ? "rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-primary"
            : "rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-violet-600 dark:text-violet-400"
      )}
    >
      {value}
    </span>
  );
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";

const NavItemComponent: React.FC<NavItemComponentProps> = ({
  item,
  isOpen,
  userRole,
  activeItem,
  expandedItems,
  onToggleExpand,
  onCloseMobile,
}) => {
  if (!hasAccess(item.roles, userRole)) return null;

  const collapsed = !isOpen;
  const accessibleChildren =
    item.children?.filter((c) => hasAccess(c.roles, userRole)) ?? [];
  const hasChildren = accessibleChildren.length > 0;
  const isActive =
    activeItem === item.href ||
    (hasChildren && activeItem.startsWith(`${item.href}/`));
  const isExpanded = expandedItems.includes(item.id);

  // Parent rows only host the sliding pill when there's no visible submenu to
  // carry it (collapsed rail, or a leaf item).
  const showPill = isActive && (collapsed || !hasChildren);
  const asButton = hasChildren && !collapsed;

  const rowClass = cn(
    "group relative isolate flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    focusRing,
    collapsed && "justify-center",
    isActive
      ? "text-foreground"
      : "text-foreground/80 hover:bg-accent hover:text-foreground"
  );

  const row = (
    <>
      {showPill && <ActivePill />}
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {item.icon}
      </span>

      {!collapsed && (
        <span className="flex-1 truncate text-left">{item.label}</span>
      )}

      {!collapsed && item.badge != null && (
        <BadgePill value={item.badge} isNew={item.isNew} />
      )}

      {!collapsed && hasChildren && (
        <ChevronDownIcon
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      )}

      {collapsed && typeof item.badge === "number" && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      )}

      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </>
  );

  return (
    <motion.li variants={itemVariants}>
      {asButton ? (
        <button
          type="button"
          onClick={() => onToggleExpand(item.id)}
          aria-label={item.label}
          aria-expanded={isExpanded}
          className={rowClass}
        >
          {row}
        </button>
      ) : (
        <Link
          href={hasChildren ? accessibleChildren[0].href : item.href}
          onClick={() => onCloseMobile?.()}
          aria-label={collapsed ? item.label : undefined}
          aria-current={isActive ? "page" : undefined}
          className={rowClass}
        >
          {row}
        </Link>
      )}

      <AnimatePresence initial={false}>
        {!collapsed && hasChildren && isExpanded && (
          <motion.ul
            key="submenu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="mt-1 space-y-1 overflow-hidden pl-4"
          >
            {accessibleChildren.map((child, i) => {
              const childActive = activeItem === child.href;
              return (
                <motion.li
                  key={child.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.16 }}
                >
                  <Link
                    href={child.href}
                    onClick={() => onCloseMobile?.()}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "relative isolate flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      focusRing,
                      childActive
                        ? "font-medium text-foreground"
                        : "text-foreground/70 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {childActive && <ActivePill />}
                    <span
                      className={cn(
                        "shrink-0",
                        childActive ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {child.icon}
                    </span>
                    <span className="flex-1 truncate text-left">
                      {child.label}
                    </span>
                    {child.badge != null && (
                      <BadgePill value={child.badge} isNew={child.isNew} />
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggleCollapsed,
  mobileOpen,
  animateWidth = true,
  userRole,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const collapsed = !isOpen;
  const activeItem = pathname;

  // Sections whose route contains the current path start expanded.
  const autoExpanded = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => item.children && pathname.startsWith(item.href)
      ).map((item) => item.id),
    [pathname]
  );

  const [expandedItems, setExpandedItems] = useState<string[]>(autoExpanded);

  // Re-sync expansion when path or role changes, adjusting state during render
  // (React's recommended pattern) rather than in an effect.
  const [syncKey, setSyncKey] = useState(`${pathname}|${userRole}`);
  const currentKey = `${pathname}|${userRole}`;
  if (syncKey !== currentKey) {
    setSyncKey(currentKey);
    setExpandedItems(autoExpanded);
  }

  const toggleExpand = (id: string) =>
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <NavItemComponent
        key={item.id}
        item={item}
        isOpen={isOpen}
        userRole={userRole}
        activeItem={activeItem}
        expandedItems={expandedItems}
        onToggleExpand={toggleExpand}
        onCloseMobile={onCloseMobile}
      />
    ));

  const secondaryVisible = NAV_SECONDARY.filter((i) =>
    hasAccess(i.roles, userRole)
  );

  return (
    <aside
      className={cn(
        "z-40 flex flex-col rounded-2xl border border-border bg-sidebar text-sidebar-foreground shadow-sm",
        // Mobile: fixed slide-in drawer inset from the edges.
        // Desktop (md+): in-flow flex column with a gutter all around.
        "fixed inset-y-3 left-3 md:relative md:inset-y-auto md:left-auto md:m-3 md:shrink-0",
        "duration-300 ease-in-out",
        animateWidth ? "transition-[width,transform]" : "transition-transform",
        mobileOpen
          ? "translate-x-0"
          : "-translate-x-[calc(100%+1.5rem)] md:translate-x-0",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      {/* Collapse toggle -- desktop only, floats in the right gutter */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={`${collapsed ? "Expand" : "Collapse"} sidebar  [`}
        className={cn(
          "absolute -right-3 top-6 z-50 hidden h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground md:grid",
          focusRing
        )}
      >
        <ChevronsLeftIcon
          size={14}
          className={cn("transition-transform", collapsed && "rotate-180")}
        />
      </button>

      {/* Org switcher */}
      <div className="p-3">
        <button
          type="button"
          aria-label="Switch organization"
          className={cn(
            "flex w-full items-center rounded-xl border border-border transition-colors hover:bg-accent",
            focusRing,
            collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2"
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            {CURRENT_ORG.initial}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">
                {CURRENT_ORG.name}
              </span>
              <ChevronDownIcon
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Primary"
        className="flex-1 overflow-y-auto px-3 pb-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
      >
        <motion.ul
          className="space-y-1"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {renderItems(NAV_ITEMS)}
        </motion.ul>

        {secondaryVisible.length > 0 && (
          <>
            <div className="my-3 h-px bg-border" />
            <motion.ul
              className="space-y-1"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {renderItems(NAV_SECONDARY)}
            </motion.ul>
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="border-t border-border p-3">
        <button
          type="button"
          aria-label="Account"
          className={cn(
            "flex w-full items-center rounded-xl transition-colors hover:bg-accent",
            focusRing,
            collapsed ? "justify-center p-1" : "gap-3 p-1.5"
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {user.initials}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

const SidebarWrapper = () => {
  const { collapsed, toggleCollapsed, hydrated } = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const currentRole = useCurrentRole();

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  // Keyboard: Esc closes the mobile drawer, "[" toggles desktop collapse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "Escape") setMobileOpen(false);
      if (e.key === "[" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // The mobile drawer is always full width; collapse only applies on desktop.
  const isOpen = isMobile ? true : !collapsed;

  return (
    <MotionConfig reducedMotion="user">
      <MobileSidebarControls
        isMobileOpen={mobileOpen}
        setIsMobileOpen={setMobileOpen}
      />

      <Sidebar
        isOpen={isOpen}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        animateWidth={hydrated}
        userRole={currentRole}
        onCloseMobile={() => setMobileOpen(false)}
      />
    </MotionConfig>
  );
};

export { Sidebar };
export default SidebarWrapper;
