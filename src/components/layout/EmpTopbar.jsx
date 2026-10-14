import { Bell, Menu, ChevronRight, HelpCircle } from "lucide-react";
import Link from "@/lib/router";
import { usePathname, useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/features/employees/data/employee-directory";
import { useCurrentEmployee, useEmployeeAvatar } from "@/features/auth/data/emp-session";
import { signOut, useCurrentUser } from "@/features/auth/data/auth-session";
import { workspaceLoginPath } from "@/features/organization/data/tenancy";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { markAlertsRead, useMyAlerts } from "@/features/communications/data/employee-alerts";

/** In-app alerts: comp-off credited, quarterly leave credit, loan decisions, grievance updates, review launched. */
export function AlertsBell({ empId }) {
  const alerts = useMyAlerts(empId);
  const unread = alerts.filter((a) => !a.read).length;
  const router = useRouter();
  return (
    <DropdownMenu
      onOpenChange={(o) => {
        if (!o && unread) markAlertsRead(empId);
      }}
    >
      <DropdownMenuTrigger
        aria-label="Alerts"
        className="hover:bg-muted relative grid h-9 w-9 shrink-0 place-items-center rounded-lg"
      >
        <Bell className="text-muted-foreground h-5 w-5" />
        {unread > 0 && (
          <span className="bg-gold ring-card absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-emerald-950 ring-2">
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel>Alerts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 && (
          <div className="text-muted-foreground p-3 text-xs">No alerts yet.</div>
        )}
        {alerts.slice(0, 8).map((a) => (
          <DropdownMenuItem
            key={a.id}
            className="flex-col items-start gap-0.5"
            onClick={() => a.to && router.push(buildHref({ to: a.to }))}
          >
            <div className="flex w-full items-center gap-2">
              <span className={a.read ? "font-medium" : "font-semibold"}>{a.title}</span>
              {!a.read && <span className="bg-gold ml-auto h-2 w-2 rounded-full" />}
            </div>
            <div className="text-muted-foreground line-clamp-2 text-xs">{a.body}</div>
            <div className="text-muted-foreground text-[10px]">
              {new Date(a.at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              })}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/emp/notices">Company notices →</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <nav className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      <Link href="/emp/dashboard" className="text-muted-foreground hover:text-foreground">
        My Space
      </Link>
      {parts.slice(1).map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
          <span className="text-foreground font-semibold capitalize">{p.replace(/-/g, " ")}</span>
        </span>
      ))}
    </nav>
  );
}

export function EmpTopbar({ onMenu }) {
  const me = useCurrentEmployee();
  const user = useCurrentUser();
  const avatar = useEmployeeAvatar();
  const router = useRouter();

  return (
    <header className="border-border bg-card/95 shadow-card glass-topbar pt-safe sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 border-b px-3 backdrop-blur md:gap-3 md:px-6">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="hover:bg-muted grid h-9 w-9 shrink-0 place-items-center rounded-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Breadcrumbs />
      <Badge
        variant="outline"
        className="border-border bg-muted/40 hidden max-w-[200px] min-w-0 shrink truncate font-medium xl:inline-flex"
        title={`${me.branch} · ${me.id}`}
      >
        {me.branch || me.dept}
      </Badge>
      <div className="flex-1" />
      <GlobalSearch portal="emp" />

      <ThemeToggle />
      <Link
        href="/helpdesk"
        aria-label="Help & support"
        className="hover:bg-muted relative grid h-9 w-9 shrink-0 place-items-center rounded-lg"
      >
        <HelpCircle className="text-muted-foreground h-5 w-5" />
      </Link>
      <AlertsBell empId={me.id} />

      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-muted flex shrink-0 items-center gap-2.5 rounded-lg py-1 pl-1 transition xl:pr-2">
          <Avatar className="border-gold/40 h-8 w-8 border">
            {avatar && <AvatarImage src={avatar} alt={me.name} />}
            <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
              {initials(me.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden max-w-[180px] min-w-0 text-left leading-tight xl:block">
            <div className="truncate text-sm font-semibold">{me.name}</div>
            <div className="text-muted-foreground truncate text-[11px]">{me.role}</div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            {me.name} · {user.role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/emp/profile">My Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/emp/tasks">My Tasks</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/emp/resignation">Resignation & Exit</Link>
          </DropdownMenuItem>
          {user.role !== "Employee" && (
            <DropdownMenuItem asChild>
              <Link href="/org/dashboard">Switch to admin portal</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => {
              const back = workspaceLoginPath();
              signOut();
              toast.success("Signed out");
              router.push(back);
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
