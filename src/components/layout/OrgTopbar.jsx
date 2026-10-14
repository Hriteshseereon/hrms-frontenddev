import { Menu, HelpCircle, ChevronRight } from "lucide-react";
import Link from "@/lib/router";
import { usePathname, useRouter } from "@/lib/router";
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
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { AlertsBell } from "@/components/layout/EmpTopbar";
import { useEmployeeAvatar } from "@/features/auth/data/emp-session";
import {
  canOpenPath,
  roleInitials,
  signOut,
  useCurrentUser,
} from "@/features/auth/data/auth-session";
import { workspaceLoginPath } from "@/features/organization/data/tenancy";

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <nav className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      <Link href="/org/dashboard" className="text-muted-foreground hover:text-foreground">
        Home
      </Link>
      {parts.slice(1).map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
          <span
            className={
              i === parts.length - 2
                ? "text-foreground font-semibold capitalize"
                : "text-muted-foreground capitalize"
            }
          >
            {p.replace(/-/g, " ")}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function OrgTopbar({ onMenu }) {
  const router = useRouter();
  const me = useCurrentUser();
  const avatar = useEmployeeAvatar();
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
      <div className="flex-1" />

      <GlobalSearch portal="org" />

      <ThemeToggle />

      <Link
        href="/helpdesk"
        aria-label="Help & support"
        className="hover:bg-muted relative grid h-9 w-9 shrink-0 place-items-center rounded-lg"
      >
        <HelpCircle className="text-muted-foreground h-5 w-5" />
      </Link>

      {/* Real in-app alerts for the signed-in person (role grants, password resets, approvals) instead of a bell that always showed an unread dot. */}
      <AlertsBell empId={me.id} />

      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-muted flex shrink-0 items-center gap-2.5 rounded-lg py-1 pl-1 transition xl:pr-2">
          <Avatar className="border-gold/40 h-8 w-8 border">
            {avatar && <AvatarImage src={avatar} alt={me.name} />}
            <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
              {roleInitials(me.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden max-w-[180px] min-w-0 text-left leading-tight xl:block">
            <div className="truncate text-sm font-semibold">{me.name}</div>
            <div className="text-muted-foreground truncate text-[11px]">
              {me.role} · {me.designation}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            {me.name} · {me.role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/emp/profile">My profile &amp; personalisation</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/emp/dashboard">My employee portal</Link>
          </DropdownMenuItem>
          {canOpenPath(me.role, "/org/settings") && (
            <DropdownMenuItem asChild>
              <Link href="/org/settings">Settings</Link>
            </DropdownMenuItem>
          )}
          {canOpenPath(me.role, "/org/roles") && (
            <DropdownMenuItem asChild>
              <Link href="/org/roles">Users & Roles</Link>
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
