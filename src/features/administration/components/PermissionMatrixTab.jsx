import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Minus, Grid3X3, Search, Layers, Loader2 } from "lucide-react";
import { RBAC_MODULES, PERMISSION_ACTIONS, screenId } from "@/features/auth/data/rbac";
import { useRoles } from "@/features/auth/data/rbac-store";
import { rbacApi } from "@/api/rbacApi";
import { cn } from "@/lib/utils";

/** Module-level actions a role holds = union of its screen-level permissions inside that module. */
function moduleActions(role, moduleKey) {
  const m = RBAC_MODULES.find((x) => x.key === moduleKey);
  if (!m) return [];
  const held = new Set();
  m.submodules.forEach((s) =>
    s.screens.forEach((sc) => {
      const p = role.permissions?.[screenId(m.key, s.key, sc.key)];
      if (p) {
        PERMISSION_ACTIONS.forEach((a) => {
          if (p[a]) held.add(a);
        });
      }
    }),
  );
  return PERMISSION_ACTIONS.filter((a) => held.has(a));
}

export function PermissionMatrixTab() {
  const fallbackRoles = useRoles();
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("screen"); // "screen" | "module"

  useEffect(() => {
    let mounted = true;
    const fetchMatrix = async () => {
      try {
        setLoading(true);
        const data = await rbacApi.getPermissionMatrix();
        if (mounted && data) {
          setMatrixData(data);
        }
      } catch {
        // Fallback to local computed matrix
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMatrix();
    return () => {
      mounted = false;
    };
  }, []);

  const roles = useMemo(() => {
    if (matrixData?.roles && Array.isArray(matrixData.roles)) {
      return matrixData.roles;
    }
    return fallbackRoles;
  }, [matrixData, fallbackRoles]);

  // Flattened screen list for granular screen view
  const allScreens = useMemo(() => {
    return RBAC_MODULES.flatMap((m) =>
      m.submodules.flatMap((s) =>
        s.screens.map((sc) => ({
          id: screenId(m.key, s.key, sc.key),
          module: m.name,
          submodule: s.name,
          screen: sc.name,
        })),
      ),
    );
  }, []);

  const filteredScreens = useMemo(() => {
    if (!search.trim()) return allScreens;
    const q = search.toLowerCase();
    return allScreens.filter(
      (s) =>
        s.screen.toLowerCase().includes(q) ||
        s.module.toLowerCase().includes(q) ||
        s.submodule.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [allScreens, search]);

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Grid3X3 className="text-primary h-4 w-4" /> Permission Matrix
            </div>
            <p className="text-muted-foreground text-sm">
              Cross-role comparison of access permissions across all system modules and screens.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search screens..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48 sm:w-64"
              />
            </div>
            <div className="flex rounded-md border p-0.5 bg-muted/40 text-xs">
              <Button
                variant={viewMode === "screen" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setViewMode("screen")}
              >
                Screen Detail
              </Button>
              <Button
                variant={viewMode === "module" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setViewMode("module")}
              >
                Module Summary
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <div className="border-border overflow-x-auto border-t">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : viewMode === "module" ? (
          /* MODULE LEVEL SUMMARY */
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="bg-muted/40 sticky left-0 min-w-[220px] p-3 text-left">Module</th>
                {roles.map((r) => (
                  <th key={r.id} className="min-w-[150px] p-3 text-center whitespace-nowrap">
                    {r.name}
                    {r.status && r.status !== "Active" && (
                      <span className="text-muted-foreground block text-[10px] font-normal tracking-normal normal-case">
                        {r.status}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {RBAC_MODULES.map((m) => (
                <tr key={m.key} className="hover:bg-muted/30">
                  <td className="bg-card sticky left-0 p-3 font-medium flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary/70" /> {m.name}
                  </td>
                  {roles.map((r) => {
                    const actions = moduleActions(r, m.key);
                    return (
                      <td key={r.id} className="p-3 text-center">
                        {actions.length === 0 ? (
                          <Minus className="text-muted-foreground/40 mx-auto h-4 w-4" />
                        ) : (
                          <div className="flex flex-wrap justify-center gap-1">
                            {actions.map((a) => (
                              <Badge
                                key={a}
                                variant="outline"
                                className={cn(
                                  "px-1.5 text-[10px]",
                                  a === "Delete"
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : "border-primary/30 bg-primary/10 text-primary",
                                )}
                              >
                                <Check className="h-2.5 w-2.5 mr-0.5" /> {a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* SCREEN LEVEL DETAILED GRID */
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] tracking-wider uppercase">
              <tr>
                <th className="bg-muted/40 sticky left-0 min-w-[260px] p-2.5 text-left">Screen</th>
                {roles.map((r) => (
                  <th key={r.id} className="min-w-[130px] p-2.5 text-center whitespace-nowrap">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filteredScreens.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="bg-card sticky left-0 p-2.5">
                    <div className="font-medium text-foreground">{s.screen}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {s.module} › {s.submodule}
                    </div>
                  </td>
                  {roles.map((r) => {
                    // Check if permission exists in matrix or role
                    const p =
                      matrixData?.matrix?.find((m) => m.screen_code === s.id)?.permissions?.[r.id] ??
                      r.permissions?.[s.id];

                    const canView = p?.View ?? p?.can_view ?? false;
                    const canEdit = p?.Edit ?? p?.can_edit ?? false;
                    const canDelete = p?.Delete ?? p?.can_delete ?? false;

                    const hasAny = canView || canEdit || canDelete;

                    return (
                      <td key={r.id} className="p-2.5 text-center">
                        {!hasAny ? (
                          <Minus className="text-muted-foreground/30 mx-auto h-3.5 w-3.5" />
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={cn(
                                "h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold font-mono",
                                canView
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground/40",
                              )}
                              title={canView ? "Can View" : "No View"}
                            >
                              V
                            </span>
                            <span
                              className={cn(
                                "h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold font-mono",
                                canEdit
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-muted text-muted-foreground/40",
                              )}
                              title={canEdit ? "Can Edit" : "No Edit"}
                            >
                              E
                            </span>
                            <span
                              className={cn(
                                "h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold font-mono",
                                canDelete
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-muted text-muted-foreground/40",
                              )}
                              title={canDelete ? "Can Delete" : "No Delete"}
                            >
                              D
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

export default PermissionMatrixTab;
