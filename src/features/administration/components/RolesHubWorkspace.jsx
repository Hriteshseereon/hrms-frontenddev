import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Users,
  MonitorSmartphone,
  Pencil,
  Power,
  Trash2,
  MapPinned,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KV } from "@/features/employees/components/CasePieces";
import { can, useCurrentUser, userById } from "@/features/auth/data/auth-session";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { useRoles, deleteRole, setRoleStatus, roleScreens } from "@/features/auth/data/rbac-store";
import { archiveRecord } from "@/features/administration/data/archive-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { PermissionMatrixTab } from "@/features/administration/components/PermissionMatrixTab";
import { UserAssignmentTab } from "@/features/administration/components/UserAssignmentTab";
import { BranchAccessTab } from "@/features/administration/components/BranchAccessTab";
import { TemporaryAccessTab } from "@/features/administration/components/TemporaryAccessTab";
import { SubstitutesTab } from "@/features/administration/components/SubstitutesTab";

export function RolesHub() {
  const me = useCurrentUser();
  const roles = useRoles();
  const [view, setView] = useState(null);
  // Designing roles needs the role.manage action (HR can open this screen but holds no role.manage — it used to be able
  // to create, edit, activate and delete roles all the same).
  const canManage = can(me.role, "role.manage");
  const branchName = (id) => ALL_MANAGED_BRANCHES.find((b) => b.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="text-primary h-6 w-6" /> Roles &amp; Permissions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Roles, permissions and user access — all in one module.
          </p>
        </div>
        {canManage && (
          <Button asChild size="sm" className="bg-gradient-emerald shadow-premium text-white">
            <Link href="/org/roles/new">
              <Plus className="h-4 w-4" /> Create Role
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="roles">
        <ScrollTabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
          <TabsTrigger value="assignment">User Assignment</TabsTrigger>
          <TabsTrigger value="temp">Temporary Access</TabsTrigger>
          <TabsTrigger value="subs">Substitute Management</TabsTrigger>
          <TabsTrigger value="branches">Branch Access</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="roles" className="pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) => (
              <Card
                key={r.id}
                className="shadow-card hover:shadow-premium cursor-pointer transition"
                onClick={() => setView(r)}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.id} · updated {r.updated}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "Active"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/30 bg-gold/10 text-gold"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{r.description}</p>
                  <div
                    className="text-muted-foreground flex items-center gap-4 pt-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {r.users} users
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MonitorSmartphone className="h-3.5 w-3.5" /> {r.screens} screens
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPinned className="h-3.5 w-3.5" /> {r.branches.length}
                    </span>
                    {canManage && (
                      <Button asChild variant="ghost" size="sm" className="ml-auto">
                        <Link href={buildHref({ to: "/org/roles/new", search: { edit: r.id } })}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                      </Button>
                    )}
                    {canManage &&
                      !r.builtIn &&
                      (() => {
                        const holders = Object.values(r.assignedUsers).filter(
                          (b) => b.length,
                        ).length;
                        return (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title={
                                r.status === "Active"
                                  ? "Deactivate — holders keep their other roles, this one stops applying"
                                  : "Activate the role"
                              }
                              onClick={() => {
                                setRoleStatus(
                                  r.id,
                                  r.status === "Active" ? "Draft" : "Active",
                                  me.name,
                                );
                                toast.success(
                                  `${r.name} ${r.status === "Active" ? "deactivated" : "activated"}`,
                                );
                              }}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {r.status === "Active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive disabled:opacity-40"
                              disabled={holders > 0}
                              title={
                                holders > 0
                                  ? `Granted to ${holders} user(s) — remove the assignments first`
                                  : "Delete role"
                              }
                              onClick={() => {
                                if (
                                  typeof window !== "undefined" &&
                                  !window.confirm(`Delete role "${r.name}"?`)
                                )
                                  return;
                                const removed = deleteRole(r.id);
                                // Soft delete — restorable from System Archive.
                                if (removed)
                                  archiveRecord({
                                    module: "Roles & Permissions",
                                    recordId: removed.id,
                                    title: removed.name,
                                    summary: `${roleScreens(removed).length} screens · no users`,
                                    reason: `Deleted by ${me.name}`,
                                    payload: removed,
                                  });
                                toast.success(`${r.name} deleted — restorable from System Archive`);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        );
                      })()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="pt-4">
          <PermissionMatrixTab />
        </TabsContent>
        <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            {view &&
              (() => {
                const r = roles.find((x) => x.id === view.id) ?? view;
                const screens = roleScreens(r);
                const assigned = Object.entries(r.assignedUsers).filter(([, b]) => b.length);
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="text-primary h-5 w-5" /> {r.name}
                      </DialogTitle>
                      <DialogDescription>
                        {r.id} · {r.description}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            r.status === "Active"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-gold/30 bg-gold/10 text-gold"
                          }
                        >
                          {r.status}
                        </Badge>
                        {r.builtIn && <Badge variant="outline">Built-in</Badge>}
                        {canManage && (
                          <div className="ml-auto flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRoleStatus(
                                  r.id,
                                  r.status === "Active" ? "Draft" : "Active",
                                  me.name,
                                );
                                toast.success(
                                  `Role ${r.status === "Active" ? "set to draft" : "activated"}`,
                                );
                              }}
                            >
                              {r.status === "Active" ? "Set to draft" : "Activate"}
                            </Button>
                            <Button asChild size="sm" className="bg-gradient-emerald text-white">
                              <Link
                                href={buildHref({ to: "/org/roles/new", search: { edit: r.id } })}
                              >
                                <Pencil className="h-4 w-4" /> Edit role
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                      <KV
                        items={[
                          ["Screens", `${screens.length}`],
                          ["Users", `${assigned.length}`],
                          ["Branches", r.branches.map(branchName).join(", ") || "—"],
                          ["Created", r.createdOn ? `${r.createdOn} by ${r.createdBy}` : "—"],
                          ["Updated", r.updated],
                        ]}
                      />
                      <div className="space-y-1.5">
                        <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                          Screens & permissions
                        </div>
                        <div className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-lg border">
                          {screens.map((s) => (
                            <div
                              key={`${s.module}.${s.screen}`}
                              className="flex items-center gap-2 p-2 text-sm"
                            >
                              <span className="text-muted-foreground w-44 shrink-0 truncate text-xs">
                                {s.module}
                              </span>
                              <span className="flex-1">{s.screen}</span>
                              {s.actions.map((a) => (
                                <Badge key={a} variant="outline" className="text-[10px]">
                                  {a}
                                </Badge>
                              ))}
                            </div>
                          ))}
                          {screens.length === 0 && (
                            <div className="text-muted-foreground p-3 text-sm">
                              No screens selected yet.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                          Assigned users
                        </div>
                        {assigned.length === 0 && (
                          <div className="text-muted-foreground text-sm">
                            Nobody yet — grant it from Users & Logins or by editing the role.
                          </div>
                        )}
                        {assigned.map(([uid, b]) => (
                          <div
                            key={uid}
                            className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
                          >
                            <span className="font-medium">{userById(uid)?.name ?? uid}</span>
                            <span className="text-muted-foreground text-xs">
                              {b.map(branchName).join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                      {r.history.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                            History
                          </div>
                          {r.history.map((h, i) => (
                            <div key={i} className="text-muted-foreground text-xs">
                              {h.at} · {h.by} · {h.action}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
          </DialogContent>
        </Dialog>
        <TabsContent value="assignment" className="pt-4">
          <UserAssignmentTab />
        </TabsContent>
        <TabsContent value="temp" className="pt-4">
          <TemporaryAccessTab />
        </TabsContent>
        <TabsContent value="subs" className="pt-4">
          <SubstitutesTab />
        </TabsContent>
        <TabsContent value="branches" className="pt-4">
          <BranchAccessTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
