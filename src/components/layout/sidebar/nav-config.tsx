import {
  HomeIcon,
  BellIcon,
  UsersIcon,
  UserPlusIcon,
  UsersRoundIcon,
  SettingsIcon,
  LifeBuoyIcon,
  DownloadCloud,
} from "lucide-react";
import type { NavItem } from "@/types/navigation";

// Data only -- role gating and rendering live in sidebar.tsx, not here.
// Every item declares its `roles` explicitly.
//
// NOTE: `/notifications`, `/settings` and `/support` are placeholder routes
// added to match the sidebar design -- create their pages (or drop the items)
// when you get to them. A numeric `badge` renders as a red count pill (and a
// red dot when the sidebar is collapsed). A string `badge` renders as a
// pill, colored by `isNew`: true -> primary-tinted "new", false/unset ->
// violet "pro".
const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    icon: <HomeIcon size={20} />,
    label: "Dashboard",
    href: "/dashboard",
    roles: ["super_admin", "admin", "manager", "member"],
  },
  {
    id: "notifications",
    icon: <BellIcon size={20} />,
    label: "Notifications",
    href: "/notifications",
    roles: ["super_admin", "admin", "manager", "member"],
    badge: 4,
  },
  {
    id: "members",
    icon: <UsersIcon size={20} />,
    label: "Members",
    href: "/members",
    roles: ["super_admin", "admin", "manager"],
    children: [
      {
        id: "members-all",
        icon: <UsersIcon size={18} />,
        label: "All Members",
        href: "/members",
        roles: ["super_admin", "admin", "manager"],
      },
      {
        id: "members-new",
        icon: <UserPlusIcon size={18} />,
        label: "Add Member",
        href: "/members/new",
        roles: ["super_admin", "admin"],
      },
      {
        id: "members-groups",
        icon: <UsersRoundIcon size={18} />,
        label: "Groups",
        href: "/members/groups",
        roles: ["super_admin", "admin", "manager"],
        badge: "new",
        isNew: true,
      },
    ],
  },
  {
    id: "Test",
    icon: <DownloadCloud size={20} />,
    label: "Members-test",
    href: "/members-test",
    roles: ["super_admin", "admin", "manager"],
    children: [
      {
        id: "members-all",
        icon: <UsersIcon size={18} />,
        label: "All tests",
        href: "/members",
        roles: ["super_admin", "admin", "manager"],
      },
      {
        id: "tests-new",
        icon: <UserPlusIcon size={18} />,
        label: "Add Member",
        href: "/members/new",
        roles: ["super_admin", "admin"],
      },
      {
        id: "tests-groups",
        icon: <UsersRoundIcon size={18} />,
        label: "Groups",
        href: "/members/groups",
        roles: ["super_admin", "admin", "manager"],
      },
    ],
  },
] satisfies NavItem[];

// Rendered below a divider, above the user profile.
export const NAV_SECONDARY: NavItem[] = [
  {
    id: "settings",
    icon: <SettingsIcon size={20} />,
    label: "Settings",
    href: "/settings",
    roles: ["super_admin", "admin", "manager", "member"],
  },
  {
    id: "support",
    icon: <LifeBuoyIcon size={20} />,
    label: "Support",
    href: "/support",
    roles: ["super_admin", "admin", "manager", "member"],
  },
] satisfies NavItem[];

export default NAV_ITEMS;
