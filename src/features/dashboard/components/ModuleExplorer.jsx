import { useState } from "react";
import Link from "@/lib/router";
import { ChevronDown, LayoutGrid, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { canOpen, useCurrentUser } from "@/features/auth/data/auth-session";
import { ORG_NAV_GROUPS, orgNavVisible } from "@/components/layout/OrgSidebar";
import { EMP_NAV_ITEMS } from "@/components/layout/EmpSidebar";

/**
 * @typedef {Object} Leaf
 * @property {string} to
 * @property {string} label
 * @property {any} icon
 */
/**
 * @typedef {Object} Module
 * @property {string} label
 * @property {any} icon
 * @property {Leaf[]} children
 */

function modulesFor(portal, role) {
  if (portal === "org")
    return ORG_NAV_GROUPS.map((g) => ({
      label: g.label,
      icon: g.items[0]?.icon,
      children: g.items.filter((i) => orgNavVisible(role, i)),
    })).filter((g) => g.children.length);
  if (portal === "emp")
    return EMP_NAV_ITEMS.map((i) =>
      "children" in i
        ? { label: i.label, icon: i.icon, children: i.children.filter((c) => canOpen(role, c.to)) }
        : { label: i.label, icon: i.icon, children: canOpen(role, i.to) ? [i] : [] },
    ).filter((g) => g.children.length);
  // Only the org and employee portals exist (the retired Seereon console's /app/* menu is gone).
  return [];
}

/**
 * A second way into every module from the dashboard itself: each module is a
 * card that expands to its sub-modules; every entry is a real link and is
 * filtered by the same role permissions as the sidebar.
 */
export function ModuleExplorer({ portal, compact = false }) {
  const me = useCurrentUser();
  const modules = modulesFor(portal, me.role);
  const [open, setOpen] = useState(null);
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <LayoutGrid className="text-primary h-4 w-4" /> Modules
            </div>
            <div className="text-muted-foreground text-xs">
              Click a module to see its sub-modules —{" "}
              {modules.reduce((s, m) => s + m.children.length, 0)} screens available to your role.
            </div>
          </div>
        </div>
        <div
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {modules.map((m) => {
            const Icon = m.icon;
            const expanded = open === m.label;
            return (
              <div
                key={m.label}
                className={cn(
                  "rounded-xl border transition",
                  expanded
                    ? "border-primary bg-primary/5 sm:col-span-2 lg:col-span-3 xl:col-span-4"
                    : "border-border hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : m.label)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      expanded ? "bg-gradient-emerald text-white" : "bg-primary/10 text-primary",
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.label}</span>
                    <span className="text-muted-foreground block text-[11px] whitespace-nowrap">
                      {m.children.length} sub-module{m.children.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground h-4 w-4 shrink-0 transition",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && (
                  <div className="border-border/60 grid grid-cols-1 gap-1.5 border-t p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {m.children.map((c) => (
                      <Link
                        href={c.to}
                        key={c.to}
                        className="group border-border bg-card hover:border-primary/40 hover:bg-primary/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <c.icon className="text-primary h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        <ArrowUpRight className="text-muted-foreground group-hover:text-primary h-3.5 w-3.5 shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
