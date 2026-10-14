import { useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { useRoles } from "@/features/auth/data/rbac-store";
import { useOrgUsers, setUserAssignments } from "@/features/auth/data/user-store";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";

/** Branch × user role coverage with per-user editing. */
export function BranchAccessTab() {
  const users = useOrgUsers();
  const me = useCurrentUser();
  const canManage = can(me.role, "role.manage");
  // Roles from Roles & Permissions (including ones created in the wizard) — the static seed hid new roles.
  // Draft roles stay listed only when the user already holds them, so they can still be removed.
  const allRoles = useRoles();
  const [draft, setDraft] = useState(null);
  const ROLES = allRoles.filter(
    (r) => r.status === "Active" || draft?.assignments.some((a) => a.roles.includes(r.name)),
  );

  const toggleRole = (branchId, role, on) =>
    setDraft((u) => {
      if (!u) return u;
      const rest = u.assignments.filter((a) => a.branchId !== branchId);
      const current = u.assignments.find((a) => a.branchId === branchId)?.roles ?? [];
      const roles = on
        ? Array.from(new Set([...current, role]))
        : current.filter((r) => r !== role);
      return { ...u, assignments: roles.length ? [...rest, { branchId, roles }] : rest };
    });

  const save = () => {
    if (!draft) return;
    setUserAssignments(draft.id, draft.assignments, me.name);
    toast.success(`Branch access updated for ${draft.name}`);
    setDraft(null);
  };

  return (
    <>
      <Card className="shadow-card overflow-hidden">
        <CardContent className="space-y-1 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="text-primary h-4 w-4" /> Branch access
          </div>
          <p className="text-muted-foreground text-sm">
            Which roles each user holds in each branch. Use Edit to change a user&apos;s branch
            access.
          </p>
        </CardContent>
        <div className="border-border overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="min-w-[180px] p-3 text-left">User</th>
                {ALL_MANAGED_BRANCHES.map((b) => (
                  <th key={b.id} className="p-3 text-left whitespace-nowrap">
                    {b.name}
                  </th>
                ))}
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </td>
                  {ALL_MANAGED_BRANCHES.map((b) => {
                    const roles = u.assignments.find((a) => a.branchId === b.id)?.roles ?? [];
                    return (
                      <td key={b.id} className="p-3">
                        {roles.length ? (
                          <div className="flex flex-wrap gap-1">
                            {roles.map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className="border-primary/30 bg-primary/10 text-primary"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      onClick={() =>
                        setDraft({
                          ...u,
                          assignments: u.assignments.map((a) => ({ ...a, roles: [...a.roles] })),
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={!!draft}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit branch access — {draft?.name}</DialogTitle>
            <DialogDescription>Tick the roles this user holds in each branch.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {ALL_MANAGED_BRANCHES.map((b) => {
                const roles = draft.assignments.find((a) => a.branchId === b.id)?.roles ?? [];
                return (
                  <div
                    key={b.id}
                    className="border-border bg-muted/30 space-y-2 rounded-lg border p-3"
                  >
                    <div className="text-sm font-semibold">
                      {b.name}{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        · {b.office}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {ROLES.map((r) => (
                        <label
                          key={r.id}
                          className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={roles.includes(r.name)}
                            onCheckedChange={(v) => toggleRole(b.id, r.name, !!v)}
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button className="bg-gradient-emerald text-white" onClick={save}>
              Save access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
