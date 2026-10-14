// Working scope in the top bar: Group (all companies) › Company › Branch.
//   • Super Admin of a group: collective view of every company (read-only), or one company, or one branch of it.
//   • Super Admin of a single company / Company Admin: the company (all branches) or one branch.
//   • Branch Admin and everyone else: a fixed chip with where they work.
// The collective view is for dashboards, reports and analytics; to add or change records the Super Admin picks the
// company (and branch) the record belongs to.
import { Building2, Check, ChevronDown, GitBranch, Landmark, Layers, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { visibleBranches } from "@/features/organization/data/group-data";
import {
  setActiveCompany,
  setActiveScopeBranch,
  setGroupView,
  useScope,
} from "@/features/organization/data/tenancy";
import { useOrgs } from "@/features/organization/data/group-data";

/**
 * `compact` renders an icon-only trigger for the collapsed desktop sidebar (the full chip lives in the expanded
 * sidebar; the header stays free of a scope dropdown by client request).
 */
export function ScopeSwitcher({ inSidebar = false, compact = false }) {
  const me = useCurrentUser();
  const scope = useScope();
  const allOrgs = useOrgs();
  const isSuper = me.role === "SuperAdmin";
  const isAdmin = me.role === "Admin";
  const tenantCompanies =
    isSuper && scope.tenant
      ? allOrgs.filter(
          (o) =>
            o.id === scope.tenant.rootOrgId ||
            (scope.tenant.groupId && o.groupId === scope.tenant.groupId),
        )
      : scope.company
        ? [scope.company]
        : [];
  const multiCompany = isSuper && tenantCompanies.length > 1;
  const company = scope.company;
  const branches = visibleBranches(company);
  const label =
    scope.level === "group"
      ? `${scope.tenant?.name ?? "Group"} · all ${tenantCompanies.length} companies`
      : scope.level === "branch"
        ? `${multiCompany ? `${company?.name} › ` : ""}${scope.branch?.name}`
        : `${company?.name ?? ""}${branches.length > 1 ? " · all branches" : ""}`;
  const Icon = scope.level === "group" ? Layers : scope.level === "branch" ? GitBranch : Landmark;
  const chip = compact
    ? "grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/10 text-white"
    : inSidebar
      ? "flex w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white"
      : "flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium max-w-[300px]";

  // Fixed chip: no switching for Branch Admins and non-admin roles.
  if (!isSuper && !isAdmin) {
    const fixed =
      me.role === "BranchAdmin"
        ? `${company?.name ?? ""} › ${scope.branch?.name ?? me.branch}`
        : `${company?.name ?? ""}${me.branch && branches.length > 0 ? ` · ${me.branch}` : ""}`;
    return (
      <span
        className={inSidebar || compact ? chip : `hidden md:flex ${chip}`}
        title={fixed}
        aria-label={compact ? `Working scope: ${fixed}` : undefined}
        data-testid={
          compact
            ? "scope-switcher-compact"
            : inSidebar
              ? "scope-switcher-mobile"
              : "scope-switcher"
        }
      >
        {me.role === "BranchAdmin" ? (
          <Lock className="text-primary h-3.5 w-3.5 shrink-0" />
        ) : (
          <Building2 className="text-primary h-3.5 w-3.5 shrink-0" />
        )}
        {!compact && <span className="truncate">{fixed}</span>}
      </span>
    );
  }

  return (
    <div
      className={
        compact
          ? "flex justify-center"
          : inSidebar
            ? "flex w-full items-center"
            : "hidden items-center md:flex"
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${chip} hover:border-primary/40 transition`}
          title={label}
          aria-label={compact ? `Working scope: ${label}` : undefined}
          data-testid={
            compact
              ? "scope-switcher-compact"
              : inSidebar
                ? "scope-switcher-mobile"
                : "scope-switcher"
          }
        >
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${scope.level === "group" ? "text-gold" : "text-primary"}`}
          />
          {!compact && <span className="truncate">{label}</span>}
          {!compact && <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={compact ? "right" : undefined}
          className="max-h-[70dvh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
        >
          {multiCompany && (
            <>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {scope.tenant?.name ?? "Group"} — Super Admin scope
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  setGroupView();
                  toast.success(`Collective view — all ${tenantCompanies.length} companies`);
                }}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Layers className="text-gold h-4 w-4" /> All companies — collective view
                </span>
                {scope.level === "group" && <Check className="text-primary h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wider uppercase">
                Company
              </DropdownMenuLabel>
              {tenantCompanies.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onSelect={() => {
                    setActiveCompany(o.id);
                    toast.success(`Working in ${o.name}`);
                  }}
                  className="flex items-center justify-between"
                >
                  <span>
                    {o.name}
                    {o.isHolding && (
                      <span className="text-gold ml-1 text-[10px] uppercase">group level</span>
                    )}
                    <div className="text-muted-foreground text-[10px]">
                      {o.legalName} · {visibleBranches(o).length || "no"} branches
                    </div>
                  </span>
                  {scope.level !== "group" && company?.id === o.id && (
                    <Check className="text-primary h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {scope.level !== "group" && branches.length > 0 && (
            <>
              {multiCompany && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wider uppercase">
                Branch · {company?.name}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  setActiveScopeBranch(null);
                  toast.success(`${company?.name} — all branches`);
                }}
                className="flex items-center justify-between"
              >
                All branches
                {!scope.branch && <Check className="text-primary h-4 w-4" />}
              </DropdownMenuItem>
              {branches.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onSelect={() => {
                    setActiveScopeBranch(b.id);
                    toast.success(`Switched to ${b.name}`);
                  }}
                  className="flex items-center justify-between"
                >
                  <span>
                    {b.name}
                    {b.city && <span className="text-muted-foreground ml-1 text-xs">{b.city}</span>}
                  </span>
                  {scope.branch?.id === b.id && <Check className="text-primary h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {!multiCompany && branches.length === 0 && (
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              {company?.name} has no branches — everyone works from the head office.
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
