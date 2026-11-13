
import { useState } from "react";
import Link from "@/lib/router";
import { usePathname } from "@/lib/router";
import {
  Scale,
  BookOpen,
  Boxes,
  BellRing,
  Network,
  LayoutDashboard,
  Users,
  Clock,
  Plane,
  DollarSign,
  Megaphone,
  ShieldCheck,
  LifeBuoy,
  Building,
  Settings,
  Settings2,
  Sparkles,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Target,
  GraduationCap,
  KanbanSquare,
  ListTodo,
  FolderKanban,
  Timer,
  ReceiptText,
  BarChart3,
  Flag,
  UserCog,
  FileBadge,
  DoorOpen,
  FileBarChart,
  Archive,
  UsersRound,
  UserCircle,
  Wallet,
  Plane as PlaneIcon,
  IndianRupee,
  KeyRound,
  SlidersHorizontal,
  Eye,
  Layers,
  Tags,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";

import {
  ORGANIZATION,
  ROLE_NAV,
  canOpen,
  roleInitials,
  signOut,
  useCurrentUser,
} from "@/features/auth/data/auth-session";

import {
  OPEN_STATUSES,
  agentDepartments,
  useTickets,
} from "@/features/helpdesk/data/helpdesk-data";

import {
  leaveOrgOf,
  useLeaveApplications,
} from "@/features/leave/data/leave-engine";

import { usePayrollRuns } from "@/features/payroll/data/payroll-engine";

import {
  useScope,
  useScopeMatch,
  workspaceLoginPath,
} from "@/features/organization/data/tenancy";

// Company/branch scope dropdown disabled.
// import { ScopeSwitcher } from "@/components/layout/ScopeSwitcher";

import { useModuleAccess, useOrgMode } from "@/features/auth/data/module-access";

export const ORG_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/org/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/org/masters", label: "Master Data", icon: Building },
      { to: "/org/announcements", label: "Announcements", icon: Megaphone },
      { to: "/org/notifications", label: "Notification Centre", icon: BellRing },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/org/roles", label: "Roles & Permissions", icon: ShieldCheck },
      { to: "/org/users", label: "Users & Logins", icon: KeyRound },
      { to: "/org/delegation", label: "Role Delegation", icon: UserCog },
      { to: "/org/archive", label: "System Archive & Soft Delete", icon: Archive },
      { to: "/org/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Organisation",
    items: [
      {
        to: "/org/organisation-setup",
        label: "Organisation Setup",
        icon: Settings2,
        superOnly: true,
      },
      {
        to: "/org/groups",
        label: "Companies & Branches",
        icon: Network,
        superOnly: true,
      },
      {
        to: "/org/configuration",
        label: "Configuration",
        icon: SlidersHorizontal,
        superOnly: true,
      },
      {
        to: "/org/asset-rollup",
        label: "Group Asset Rollup",
        icon: Boxes,
        superOnly: true,
        groupOnly: true,
      },
    ],
  },
  {
    label: "Company Configuration",
    items: [
      {
        to: "/org/departments",
        label: "Department",
        icon: Building,
      },
      {
        to: "/org/designations",
        label: "Designation",
        icon: FileBadge,
      },
      {
        to: "/org/grades",
        label: "Department Grade",
        icon: Layers,
      },
      {
        to: "/org/categories",
        label: "Category",
        icon: Tags,
      },
      {
        to: "/org/sections",
        label: "Department Section",
        icon: Network,
      },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/org/employees", label: "Employees", icon: Users },
      { to: "/org/recruitment", label: "Recruitment", icon: KanbanSquare },
      { to: "/org/exits", label: "Exit, Retention & F&F", icon: DoorOpen },
      { to: "/org/grievances", label: "Grievance Redressal", icon: Scale },
      { to: "/org/training", label: "Training", icon: GraduationCap },
    ],
  },
  {
    label: "Time & Leave",
    items: [
      { to: "/org/attendance", label: "Attendance & Shifts", icon: Clock },
      { to: "/org/leave", label: "Leave & Comp-off", icon: Plane },
      { to: "/org/timesheets", label: "Timesheets", icon: Timer },
      { to: "/org/tours", label: "Tours & Travel", icon: PlaneIcon },
    ],
  },
  {
    label: "Payroll & Finance",
    items: [
      { to: "/org/finance", label: "Payroll, Payslips & Loans", icon: DollarSign },
      { to: "/org/claims", label: "Claims & Insurance", icon: ReceiptText },
      { to: "/org/expenditure", label: "Expenditure Booking", icon: IndianRupee },
      { to: "/org/tax", label: "Proof of Investment", icon: FileBadge },
      { to: "/org/compliance", label: "Statutory Compliance", icon: ShieldCheck },
    ],
  },
  {
    label: "Performance",
    items: [
      { to: "/org/performance", label: "Reviews & Appraisals", icon: Target },
      { to: "/org/goals", label: "Goals", icon: Flag },
    ],
  },
  {
    label: "Work & Assets",
    items: [
      { to: "/org/projects", label: "Projects & Assignments", icon: FolderKanban },
      { to: "/org/tasks", label: "Tasks", icon: ListTodo },
      { to: "/org/assets", label: "Asset Lifecycle", icon: Boxes },
      { to: "/helpdesk", label: "Helpdesk", icon: LifeBuoy },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/org/reports", label: "Reports & Analytics", icon: BarChart3 },
      { to: "/org/payroll-reports", label: "Payroll Reports", icon: FileBarChart },
    ],
  },
  {
    label: "My Workspace",
    items: [
      { to: "/emp/dashboard", label: "My Self-Service", icon: UserCircle },
      { to: "/org/team", label: "My Team", icon: UsersRound },
      { to: "/emp/attendance", label: "My Attendance", icon: Clock },
      { to: "/emp/leave", label: "My Leave", icon: PlaneIcon },
      { to: "/emp/payslips", label: "My Payslips", icon: Wallet },
      { to: "/emp/reimbursements", label: "My Claims", icon: ReceiptText },
      { to: "/emp/goals", label: "My Goals & Appraisals", icon: Flag },
      { to: "/emp/handbook", label: "Employee Handbook", icon: BookOpen },
      { to: "/helpdesk/tickets", label: "My Helpdesk Tickets", icon: LifeBuoy },
    ],
  },
];

/** What a Super Admin sees before picking a company: only the organisation-level screens. */
export const ORG_MODE_GROUPS = [
  {
    label: "Organisation",
    items: [
      { to: "/org/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/org/groups", label: "Companies", icon: Building },
      { to: "/org/company-modules", label: "Company Modules", icon: Boxes },
      { to: "/org/reports", label: "Reports & Analytics", icon: BarChart3 },
      { to: "/org/organisation-setup", label: "Organisation Profile", icon: Settings },
    ],
  },
];

/**
 * One visibility rule for org navigation.
 */
export function orgNavVisible(role, item) {
  if (!canOpen(role, item.to)) return false;

  if (!item.superOnly || role === "SuperAdmin") return true;

  const nav = ROLE_NAV[role];
  return nav !== "*" && nav.includes(item.to);
}

/** Groups that hold transactional modules. */
const MODULE_GROUPS = new Set([
  "People",
  "Time & Leave",
  "Payroll & Finance",
  "Performance",
  "Work & Assets",
]);

const COLLECTIVE_ORDER = ["Overview", "Reports", "Group", "Administration"];

export function OrgSidebar({
  collapsed: collapsedPref,
  onToggle,
  mobileOpen = false,
  onClose,
}) {
  const collapsed = collapsedPref && !mobileOpen;

  const pathname = usePathname();

  const isActive = (to) =>
    pathname === to || pathname.startsWith(to + "/");

  const [closed, setClosed] = useState({
    "Work & Assets": true,
  });

  const toggleGroup = (label, wasClosed) =>
    setClosed((p) => ({
      ...p,
      [label]: !wasClosed,
    }));

  const me = useCurrentUser();
  const moduleOn = useModuleAccess();
  const orgMode = useOrgMode();
  const scope = useScope();
  const inScope = useScopeMatch();

  const activeOrg = scope.company;
  const collective = scope.readOnly;
  const isGroupTenant = scope.tenant?.kind === "group";

  // Live work-queue badges.
  const tickets = useTickets();
  const myDesks = agentDepartments(me);
  const [leaveApps] = useLeaveApplications();
  const runs = usePayrollRuns();

  const badges = {
    "/helpdesk": tickets.filter(
      (t) =>
        OPEN_STATUSES.includes(t.status) &&
        (myDesks.some((d) => d.id === t.departmentId)
          ? t.assigneeId === me.id || t.status === "New"
          : t.requesterId === me.id),
    ).length,

    "/org/leave": leaveApps.filter(
      (l) =>
        l.status === "Pending" &&
        inScope(leaveOrgOf(l), l.empId),
    ).length,

    "/org/finance": runs.filter(
      (r) =>
        inScope(r.orgId) &&
        r.status === "Pending Approval",
    ).length,
  };

  const visibleGroups = (orgMode ? ORG_MODE_GROUPS : ORG_NAV_GROUPS).map((g) => ({
    ...g,
    readOnly: collective && MODULE_GROUPS.has(g.label),
    items: g.items
      .filter(
        (i) =>
          (orgMode || orgNavVisible(me.role, i)) &&
          moduleOn(i.to) &&
          (!i.groupOnly || isGroupTenant),
      )
      .map((i) => ({
        ...i,
        badge: badges[i.to]
          ? String(badges[i.to])
          : i.badge,
      })),
  }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => {
      if (!collective) return 0;

      const rank = (g) => {
        const i = COLLECTIVE_ORDER.indexOf(g.label);

        return i === -1
          ? COLLECTIVE_ORDER.length +
              (g.label === "My Workspace" ? 1 : 0)
          : i;
      };

      return rank(a) - rank(b);
    });

  const isClosed = (g) =>
    g.label in closed ? closed[g.label] : g.readOnly;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border glass-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300",
          "w-[260px] lg:w-auto",
          collapsed ? "lg:w-[76px]" : "lg:w-[260px]",
          mobileOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="border-sidebar-border/60 flex h-16 items-center justify-between border-b px-4">
          {!collapsed ? (
            <BrandLogo variant="dark" />
          ) : (
            <div className="bg-gradient-emerald ring-gold/40 mx-auto grid h-9 w-9 place-items-center rounded-xl ring-1">
              <Sparkles className="text-gold h-4 w-4" />
            </div>
          )}

          {!collapsed && (
            <button
              onClick={onToggle}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground hidden h-7 w-7 place-items-center rounded-md transition lg:grid"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed sidebar expand button */}
        {collapsed && (
          <div className="border-sidebar-border/60 flex flex-col items-center gap-2 border-b py-3">
            <button
              onClick={onToggle}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground grid h-8 w-8 place-items-center rounded-md transition"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/*
              TEMPORARILY DISABLED:
              Company/branch scope dropdown.
              <ScopeSwitcher inSidebar compact />
            */}
          </div>
        )}

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">

          {/*
            TEMPORARILY DISABLED:
            User profile card.

            {!collapsed && (
              <div className="border-sidebar-border/60 bg-sidebar-accent/40 mb-2 rounded-xl border px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="bg-gold/20 text-gold ring-gold/40 grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold ring-1">
                    {roleInitials(me.name)}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">
                      {me.name}
                    </div>

                    <div className="text-gold truncate text-[10px] tracking-widest uppercase">
                      {me.role === "SuperAdmin"
                        ? "Admin"
                        : me.role === "BranchAdmin"
                          ? "Branch Admin"
                          : me.role}{" "}
                      ·{" "}
                      {collective
                        ? (scope.tenant?.name ?? "All companies")
                        : (activeOrg?.name ?? ORGANIZATION.name)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          */}

          {!collapsed && collective && !orgMode && (
            <div className="border-gold/30 bg-gold/10 text-sidebar-foreground/80 rounded-lg border px-3 py-2 text-[11px] leading-snug">
              Collective view of all companies. Module screens show combined data and are view-only
              — pick a company in the scope chip to add or change records.
            </div>
          )}

          {/* Navigation groups */}
          {visibleGroups.map((g) => {
            const groupActive = g.items.some((i) => isActive(i.to));
            const open = collapsed || !isClosed(g) || groupActive;

            return (
              <div key={g.label} className="space-y-0.5">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() =>
                      toggleGroup(g.label, isClosed(g))
                    }
                    aria-expanded={open}
                    className="text-sidebar-foreground/50 hover:text-sidebar-foreground/80 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition"
                  >
                    <span className="flex-1 truncate text-left">
                      {g.label}
                    </span>

                    {g.readOnly && (
                      <Eye
                        className="h-3 w-3 shrink-0"
                        aria-label="View only in collective view"
                      />
                    )}

                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        !open && "-rotate-90",
                      )}
                    />
                  </button>
                )}

                {open &&
                  g.items.map((item) => {
                    const active = isActive(item.to);
                    const Icon = item.icon;

                    return (
                      <Link
                        href={item.to}
                        key={item.to}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          active
                            ? "bg-sidebar-accent border-gold border-l-2 text-white shadow-sm"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                          collapsed && "justify-center px-0",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active && "text-gold",
                          )}
                        />

                        {!collapsed && (
                          <span className="flex-1 truncate">
                            {item.label}
                          </span>
                        )}

                        {!collapsed && item.badge && (
                          <span className="bg-gold/90 ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-[oklch(0.2_0.02_85)]">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-sidebar-border/60 border-t p-3">
          <Link
            href={workspaceLoginPath(me)}
            onClick={() => signOut()}
            className={cn(
              "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Logout</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
