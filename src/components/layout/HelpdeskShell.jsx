import Link from "@/lib/router";
import { usePathname, useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { WorkspaceLoading } from "@/components/common/WorkspaceLoading";
import {
  LifeBuoy,
  PlusCircle,
  Ticket,
  Inbox,
  Users,
  Settings2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Menu,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AIAssistant } from "@/components/layout/AIAssistant";
import { cn } from "@/lib/utils";
import { initials } from "@/features/employees/data/employee-directory";
import {
  ORGANIZATION,
  signOut,
  useCurrentUser,
  useHydrated,
  useIsSignedIn,
} from "@/features/auth/data/auth-session";
import { lastWorkspacePath } from "@/features/organization/data/tenancy";
import {
  agentDepartments,
  autoCloseResolved,
  canViewTicket,
  isHelpdeskAdmin,
  useTickets,
  OPEN_STATUSES,
  useHelpdeskConfig,
} from "@/features/helpdesk/data/helpdesk-data";

function HelpdeskShell({ children }) {
  const [collapsedPref, setCollapsed] = useState(false);
  // Below lg the sidebar is an off-canvas drawer — as a fixed 260 px column it covered two-thirds of a phone screen.
  const [mobileOpen, setMobileOpen] = useState(false);
  // The icon-only rail is desktop-only; the mobile drawer always shows labels.
  const collapsed = collapsedPref && !mobileOpen;
  const me = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const tickets = useTickets();
  const deskCfg = useHelpdeskConfig();
  // Resolved tickets past the auto-close window are closed when the desk is opened (no background job in the UI build).
  useEffect(() => {
    autoCloseResolved(deskCfg);
  }, [deskCfg, tickets]);
  const myOpen = tickets.filter(
    (t) =>
      (t.requesterId === me.id || t.watchers.some((w) => w.id === me.id)) &&
      OPEN_STATUSES.includes(t.status),
  ).length;
  const depts = agentDepartments(me);
  const queue = tickets.filter(
    (t) =>
      depts.some((d) => d.id === t.departmentId) &&
      OPEN_STATUSES.includes(t.status) &&
      canViewTicket(me, t),
  ).length;
  const admin = isHelpdeskAdmin(me);
  const backTo = me.portal === "org" ? "/org/dashboard" : "/emp/dashboard";

  const items = [
    { to: "/helpdesk", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/helpdesk/new", label: "Raise a Ticket", icon: PlusCircle },
    { to: "/helpdesk/tickets", label: "My Tickets", icon: Ticket, badge: myOpen },
    ...(depts.length || admin
      ? [{ to: "/helpdesk/queue", label: "Team Queue", icon: Inbox, badge: queue }]
      : []),
    ...(admin || depts.length ? [{ to: "/helpdesk/all", label: "All Tickets", icon: Users }] : []),
    { to: "/helpdesk/catalog", label: "Service Catalogue", icon: BookOpen },
    ...(admin ? [{ to: "/helpdesk/settings", label: "Desk Settings", icon: Settings2 }] : []),
  ];
  const isActive = (to, exact) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  // Same guard as the other portals: signed-out visitors go to /login; role-dependent UI waits for the session.
  const signedIn = useIsSignedIn();
  const hydrated = useHydrated();
  useEffect(() => {
    if (!signedIn) router.replace(lastWorkspacePath());
  }, [signedIn, router]);
  if (!signedIn) return null;
  if (!hydrated) return <WorkspaceLoading />;

  return (
    <div className="bg-background min-h-dvh">
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 flex flex-col border-r transition-all duration-300",
          collapsed ? "w-[76px]" : "w-[260px]",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div className="border-sidebar-border/60 flex h-16 items-center justify-between border-b px-4">
          {!collapsed ? (
            <BrandLogo variant="dark" />
          ) : (
            <LifeBuoy className="text-gold mx-auto h-7 w-7" />
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hidden h-7 w-7 place-items-center rounded-md lg:grid"
              aria-label="Collapse"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="border-sidebar-border/60 flex justify-center border-b py-2">
            <button
              onClick={() => setCollapsed(false)}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent grid h-8 w-8 place-items-center rounded-md"
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
              Service Desk · {admin ? "Admin" : depts.length ? "Agent" : "Requester"}
            </div>
          )}
          {items.map((i) => {
            const active = isActive(i.to, i.exact);
            return (
              <Link
                href={i.to}
                key={i.to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? i.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent border-gold border-l-2 text-white shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                  collapsed && "justify-center px-0",
                )}
              >
                <i.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-gold")} />
                {!collapsed && <span className="flex-1 truncate">{i.label}</span>}
                {!collapsed && i.badge ? (
                  <span className="bg-gold/90 rounded-full px-1.5 text-[10px] font-bold text-[oklch(0.2_0.02_85)]">
                    {i.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {!collapsed && depts.length > 0 && (
            <div className="text-sidebar-foreground/50 mt-4 px-3 text-[10px] tracking-widest uppercase">
              Your desks
            </div>
          )}
          {!collapsed &&
            depts.map((d) => (
              <div key={d.id} className="text-sidebar-foreground/70 px-3 py-1 text-xs">
                • {d.name}
              </div>
            ))}
        </nav>
        <div className="border-sidebar-border/60 border-t p-3">
          <Link
            href={backTo}
            className={cn(
              "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            {!collapsed && (
              <span>Back to {me.portal === "org" ? "Organisation" : "Employee"} portal</span>
            )}
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={cn(
          "transition-all duration-300",
          collapsedPref ? "lg:pl-[76px]" : "lg:pl-[260px]",
        )}
      >
        <header className="border-border bg-card/95 shadow-card pt-safe sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 border-b px-4 backdrop-blur md:gap-4 md:px-6">
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() =>
              typeof window !== "undefined" && window.innerWidth < 1024
                ? setMobileOpen((v) => !v)
                : setCollapsed((v) => !v)
            }
            className="hover:bg-muted grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden shrink-0 items-center gap-2 text-sm md:flex">
            <LifeBuoy className="text-primary h-4 w-4" />
            <span className="font-semibold">Seereon Helpdesk</span>
          </div>
          <Badge
            variant="outline"
            className="border-gold/40 bg-gold/10 text-gold hidden max-w-[260px] min-w-0 truncate xl:inline-flex"
          >
            {ORGANIZATION.name} · {me.id}
          </Badge>
          <div className="flex-1" />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-muted flex shrink-0 items-center gap-2.5 rounded-lg py-1 pl-1 transition xl:pr-2">
              <Avatar className="border-gold/40 h-8 w-8 border">
                <AvatarFallback className="bg-gradient-emerald text-xs text-white">
                  {initials(me.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden max-w-[180px] min-w-0 text-left md:block">
                <div className="truncate text-sm leading-tight font-semibold">{me.name}</div>
                <div className="text-muted-foreground truncate text-[11px]">{me.designation}</div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{me.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(buildHref({ to: backTo }))}>
                Back to portal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="app-main max-w-full min-w-0 overflow-x-clip p-4 md:p-6 lg:p-8">
          <>{children}</>
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}

export default HelpdeskShell;
