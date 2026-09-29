import { LayoutDashboard, Camera, Gavel, Store, ShieldPlus, GraduationCap, Users, ArrowLeftRight, Receipt, ClipboardCheck, CalendarDays, History, UserCog, ShieldCheck, Workflow, SlidersHorizontal, Megaphone, type LucideIcon } from "lucide-react";
import type { EffectiveGrant } from "@/lib/auth/permissions";

export interface NavigationItem {
  label: string;
  href: string;
  permissions: string[];
  icon: LucideIcon;
  pillarId?: number;
  color?: string;
}
export const implementedPortalRoutes: readonly string[] = [
  "/dashboard", "/field-submissions", "/pillars/vawg", "/pillars/wee", "/pillars/srhr",
  "/pillars/leadership", "/pillars/wros", "/pillars/skilling",
  "/participants", "/referrals", "/grants", "/assessments", "/reporting", "/audit", "/admin/users", "/admin/permissions",
];
export const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: "Overview", items: [
    {label:"Dashboard",href:"/dashboard",permissions:["DASHBOARD_VIEW"],icon:LayoutDashboard},
    {label:"Field submissions",href:"/field-submissions",permissions:["FIELD_SUBMISSION_VIEW"],icon:Camera},
  ]},
  { label: "Pillars", items: [
    {label:"VAWG",href:"/pillars/vawg",permissions:["DASHBOARD_VIEW"],pillarId:1,icon:Gavel,color:"var(--pillar-vawg)"},
    {label:"WEE",href:"/pillars/wee",permissions:["DASHBOARD_VIEW"],pillarId:2,icon:Store,color:"var(--pillar-wee)"},
    {label:"SRHR",href:"/pillars/srhr",permissions:["DASHBOARD_VIEW"],pillarId:3,icon:ShieldPlus,color:"var(--pillar-srhr)"},
    {label:"Leadership",href:"/pillars/leadership",permissions:["DASHBOARD_VIEW"],pillarId:4,icon:Megaphone,color:"var(--pillar-leadership)"},
    {label:"Skilling",href:"/pillars/skilling",permissions:["DASHBOARD_VIEW"],pillarId:6,icon:GraduationCap,color:"var(--pillar-skilling)"},
    {label:"WROs",href:"/pillars/wros",permissions:["DASHBOARD_VIEW"],pillarId:5,icon:Users,color:"var(--pillar-wros)"},
  ]},
  { label: "Records", items: [
    {label:"Participants",href:"/participants",permissions:["PARTICIPANT_VIEW"],icon:Users},
    {label:"Referral queue",href:"/referrals",permissions:["REFERRAL_VIEW"],icon:ArrowLeftRight},
    {label:"Grants",href:"/grants",permissions:["GRANT_APPLICATION_VIEW"],icon:Receipt},
    {label:"Org assessments",href:"/assessments",permissions:["ORG_ASSESSMENT_VIEW"],icon:ClipboardCheck},
  ]},
  { label: "Reporting", items: [
    {label:"Reporting calendar",href:"/reporting",permissions:["NARRATIVE_REPORT_MANAGE","GRANT_REPORT_VIEW"],icon:CalendarDays},
    {label:"Audit log",href:"/audit",permissions:["AUDIT_LOG_VIEW"],icon:History},
  ]},
  { label: "Admin", items: [
    {label:"Users & roles",href:"/admin/users",permissions:["USER_MANAGE"],icon:UserCog},
    {label:"Roles & permissions",href:"/admin/permissions",permissions:["PERMISSION_MANAGE","ROLE_MANAGE"],icon:ShieldCheck},
    {label:"Pipeline config",href:"/admin/pipelines",permissions:["PILLAR_CONFIG_MANAGE"],icon:Workflow},
    {label:"Lookup tables",href:"/admin/lookups/pillar",permissions:["LOOKUP_MANAGE"],icon:SlidersHorizontal},
  ]},
];

export function permittedNavigation(grants: readonly EffectiveGrant[], availableRoutes: readonly string[] = implementedPortalRoutes) {
  return navigationGroups.map(group => ({ ...group, items: group.items.filter(item =>
    availableRoutes.includes(item.href) && grants.some(grant => item.permissions.includes(grant.permissionCode) &&
      (item.pillarId === undefined || grant.pillarId === null || grant.pillarId === item.pillarId)))
  })).filter(group => group.items.length > 0);
}
