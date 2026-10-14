import { useState } from "react";
import Link from "@/lib/router";
import { usePathname } from "@/lib/router";
import {
  BookOpen,
  Boxes,
  LayoutDashboard,
  UserCircle,
  Clock,
  Plane,
  Wallet,
  FolderKanban,
  Megaphone,
  CalendarDays,
  Repeat,
  MessageSquareWarning,
  UserPlus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Timer,
  ReceiptText,
  Target,
  GraduationCap,
  LifeBuoy,
  Flag,
  FileBadge,
  DoorOpen,
  FileText,
  BarChart3,
  ScrollText,
  ClipboardSignature,
  Building2,
  ClipboardList,
  ListTodo,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SEEREON_LOGO_DATA_URL } from "@/features/administration/data/brand-logo";
import { cn } from "@/lib/utils";
import { canOpen, signOut, useCurrentUser } from "@/features/auth/data/auth-session";
import { workspaceLoginPath } from "@/features/organization/data/tenancy";

/**
 * @typedef {Object} Leaf
 * @property {string} to
 * @property {string} label
 * @property {typeof Wallet} icon
 */
/**
 * @typedef {Leaf | { label: string, icon: typeof Wallet, children: Leaf[] }} Item
 */

export const EMP_NAV_ITEMS = [
  { to: "/emp/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { to: "/emp/profile", label: "My Profile", icon: UserCircle },
  {
    label: "Time & Attendance",
    icon: Clock,
    children: [
      { to: "/emp/attendance", label: "Attendance", icon: Clock },
      { to: "/emp/timesheets", label: "My Timesheets", icon: Timer },
      { to: "/emp/leave", label: "Leave", icon: Plane },
      { to: "/emp/holidays", label: "Holiday Calendar", icon: CalendarDays },
      { to: "/emp/handbook", label: "Employee Handbook", icon: BookOpen },
    ],
  },
  {
    label: "Payroll & Payslips",
    icon: Wallet,
    children: [
      { to: "/emp/payslips", label: "Salary & Payslips", icon: FileText },
      { to: "/emp/reports", label: "My Reports", icon: BarChart3 },
      { to: "/emp/ytd", label: "YTD Reports", icon: BarChart3 },
      { to: "/emp/it-statement", label: "IT Statement", icon: ScrollText },
      { to: "/emp/it-declaration", label: "IT Declaration", icon: ClipboardSignature },
      { to: "/emp/tax", label: "Proof of Investment", icon: FileBadge },
      { to: "/emp/reimbursements", label: "Claims & Insurance", icon: ReceiptText },
      { to: "/emp/loans", label: "Loans & Advances", icon: Wallet },
    ],
  },
  {
    label: "Performance & Growth",
    icon: Target,
    children: [
      { to: "/emp/goals", label: "My Goals", icon: Flag },
      { to: "/emp/tasks", label: "My Tasks", icon: ListTodo },
      { to: "/emp/projects", label: "Projects & Assignments", icon: FolderKanban },
      { to: "/emp/assets", label: "My Assets", icon: Boxes },
      { to: "/emp/tours", label: "My Tours", icon: Plane },
      { to: "/emp/appraisals", label: "My Appraisals", icon: ClipboardList },
      { to: "/emp/reviews", label: "Team Reviews", icon: Target },
      { to: "/emp/training", label: "My Trainings", icon: GraduationCap },
    ],
  },
  {
    label: "Workplace",
    icon: Megaphone,
    children: [
      { to: "/emp/notices", label: "Notices & Circulars", icon: Megaphone },
      { to: "/helpdesk", label: "Helpdesk", icon: LifeBuoy },
      { to: "/emp/complaints", label: "Raise a Grievance", icon: MessageSquareWarning },
      { to: "/emp/referrals", label: "Refer a Candidate", icon: UserPlus },
    ],
  },
  {
    label: "Career & Exit",
    icon: DoorOpen,
    children: [
      { to: "/emp/movements", label: "My Movements & Letters", icon: Repeat },
      { to: "/emp/resignation", label: "Resignation & Exit", icon: DoorOpen },
    ],
  },
];

export function EmpSidebar({ collapsed: collapsedPref, onToggle, mobileOpen = false, onClose }) {
  // Icon-only rail is desktop-only — the mobile drawer always shows labels.
  const collapsed = collapsedPref && !mobileOpen;
  const pathname = usePathname();
  const me = useCurrentUser();
  const visible = EMP_NAV_ITEMS.map((i) =>
    "children" in i ? { ...i, children: i.children.filter((c) => canOpen(me.role, c.to)) } : i,
  ).filter((i) => ("children" in i ? i.children.length > 0 : canOpen(me.role, i.to)));

  const isActive = (to) => pathname === to || pathname.startsWith(to + "/");
  const [open, setOpen] = useState({});
  const linkClass = (active, nested = false) =>
    cn(
      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
      active
        ? "bg-sidebar-accent text-white shadow-sm border-l-2 border-gold"
        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
      nested && "py-2 pl-9 text-[13px]",
      collapsed && "justify-center px-0 pl-0",
    );

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
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-sidebar-border/60 flex h-16 items-center justify-between border-b px-4">
          {!collapsed ? (
            <BrandLogo variant="dark" />
          ) : (
            <img
              src={SEEREON_LOGO_DATA_URL}
              alt="Seereon HRMS"
              className="ring-gold/40 mx-auto h-9 w-9 rounded-xl bg-white object-contain p-0.5 ring-1"
            />
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
        {collapsed && (
          <div className="border-sidebar-border/60 flex justify-center border-b py-2">
            <button
              onClick={onToggle}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground grid h-8 w-8 place-items-center rounded-md transition"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <div className="text-sidebar-foreground/50 px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase">
              Employee Portal · {me.role}
            </div>
          )}
          {visible.map((item) => {
            const Icon = item.icon;
            if (!("children" in item)) {
              const active = isActive(item.to);
              return (
                <Link
                  href={item.to}
                  key={item.to}
                  className={linkClass(active)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-gold")} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                </Link>
              );
            }
            const groupActive = item.children.some((c) => isActive(c.to));
            const expanded = open[item.label] ?? groupActive;
            if (collapsed) {
              return item.children.map((c) => (
                <Link href={c.to} key={c.to} className={linkClass(isActive(c.to))} title={c.label}>
                  <c.icon
                    className={cn("h-[18px] w-[18px] shrink-0", isActive(c.to) && "text-gold")}
                  />
                </Link>
              ));
            }
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [item.label]: !expanded }))}
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    groupActive
                      ? "text-white"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", groupActive && "text-gold")} />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                  />
                </button>
                {expanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((c) => (
                      <Link href={c.to} key={c.to} className={linkClass(isActive(c.to), true)}>
                        <c.icon className={cn("h-4 w-4 shrink-0", isActive(c.to) && "text-gold")} />
                        <span className="flex-1 truncate">{c.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-sidebar-border/60 border-t p-3">
          {me.role !== "Employee" && (
            <Link
              href="/org/dashboard"
              className={cn(
                "text-gold hover:bg-sidebar-accent/60 mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? "Back to admin portal" : undefined}
            >
              <Building2 className="h-[18px] w-[18px]" />
              {!collapsed && <span>Back to {me.role} portal</span>}
            </Link>
          )}
          <Link
            href={workspaceLoginPath(me)}
            onClick={() => signOut()}
            className={cn(
              "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Sign out</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
