import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Grid3X3 } from "lucide-react";
import { RBAC_MODULES, PERMISSION_ACTIONS, screenId } from "@/features/auth/data/rbac";
import { useRoles } from "@/features/auth/data/rbac-store";
import { cn } from "@/lib/utils";

/** Module-level actions a role holds = union of its screen-level permissions inside that module. */
function moduleActions(role, moduleKey) {
  const m = RBAC_MODULES.find((x) => x.key === moduleKey);
  if (!m) return [];
  const held = new Set();
  m.submodules.forEach((s) =>
    s.screens.forEach((sc) => {
      const p = role.permissions[screenId(m.key, s.key, sc.key)];
      if (p)
        PERMISSION_ACTIONS.forEach((a) => {
          if (p[a]) held.add(a);
        });
    }),
  );
  return PERMISSION_ACTIONS.filter((a) => held.has(a));
}

/** Read-only role × module permission grid. */
export function PermissionMatrixTab() {
  // Live roles from Roles & Permissions — edits made in the wizard and custom roles are reflected here
  // (the grid used to read the static seed presets, so it never changed).
  const roles = useRoles();
  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Grid3X3 className="text-primary h-4 w-4" /> Permission matrix
        </div>
        <p className="text-muted-foreground text-sm">
          Effective module access for every role. Open a role in the Roles tab to change it.
        </p>
      </CardContent>
      <div className="border-border overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className="bg-muted/40 sticky left-0 min-w-[200px] p-3 text-left">Module</th>
              {roles.map((r) => (
                <th key={r.id} className="min-w-[150px] p-3 text-center whitespace-nowrap">
                  {r.name}
                  {r.status !== "Active" && (
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
                <td className="bg-card sticky left-0 p-3 font-medium">{m.name}</td>
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
                              <Check className="h-2.5 w-2.5" /> {a}
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
      </div>
    </Card>
  );
}
