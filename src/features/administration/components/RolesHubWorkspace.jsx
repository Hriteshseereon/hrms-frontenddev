import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Lock,
  Layers,
  Sparkles,
  Loader2,
  RefreshCw,
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
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";

export function RolesHub() {
  const me = useCurrentUser();
  const fallbackRoles = useRoles();
  const fallbackRolesRef = useRef(fallbackRoles);
  fallbackRolesRef.current = fallbackRoles;

  const [apiRoles, setApiRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  const canManage = can(me.role, "role.manage");
  const inFlightRolesRef = useRef(false);

  const loadRoles = useCallback(async () => {
    if (inFlightRolesRef.current) return;
    inFlightRolesRef.current = true;
    try {
      setLoading(true);
      const data = await rbacApi.getRoles();
      if (Array.isArray(data) && data.length > 0) {
        setApiRoles(data);
      } else {
        setApiRoles(fallbackRolesRef.current);
      }
    } catch {
      // Graceful fallback to local store if backend service isn't active
      setApiRoles(fallbackRolesRef.current);
    } finally {
      setLoading(false);
      inFlightRolesRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const roles = useMemo(() => {
    return apiRoles.length > 0 ? apiRoles : fallbackRoles;
  }, [apiRoles, fallbackRoles]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = roles.length;
    const active = roles.filter((r) => r.status === "Active").length;
    const builtIn = roles.filter((r) => r.built_in || r.builtIn).length;
    const custom = total - builtIn;
    return { total, active, builtIn, custom };
  }, [roles]);

  // View Details handler
  const handleViewRole = async (r) => {
    setView(r);
    setViewLoading(true);
    try {
      const detail = await rbacApi.getRoleById(r.id);
      setViewDetail(detail || r);
    } catch {
      setViewDetail(r);
    } finally {
      setViewLoading(false);
    }
  };

  // Status toggle handler
  const handleToggleStatus = async (r, e) => {
    e.stopPropagation();
    const nextStatus = r.status === "Active" ? "Draft" : "Active";
    setActionInProgress(r.id);
    try {
      await rbacApi.toggleRoleStatus(r.id, nextStatus);
      toast.success(`Role "${r.name}" set to ${nextStatus}`);
      setRoleStatus(r.id, nextStatus, me.name);
      await loadRoles();
    } catch (err) {
      toast.error(extractErrorMessage(err));
      // Local fallback
      setRoleStatus(r.id, nextStatus, me.name);
      await loadRoles();
    } finally {
      setActionInProgress(null);
    }
  };

  // Delete role handler
  const handleDeleteRole = async (r, e) => {
    e.stopPropagation();
    if (r.built_in || r.builtIn) {
      toast.error("System built-in roles cannot be deleted");
      return;
    }
    const holders = r.users ?? Object.values(r.assignedUsers ?? {}).filter((b) => b?.length).length;
    if (holders > 0) {
      toast.error(`Cannot delete role: granted to ${holders} user(s). Reassign them first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete role "${r.name}"?`)) return;

    setActionInProgress(r.id);
    try {
      await rbacApi.deleteRole(r.id);
      const removed = deleteRole(r.id);
      if (removed) {
        archiveRecord({
          module: "Roles & Permissions",
          recordId: removed.id,
          title: removed.name,
          summary: `${roleScreens(removed).length} screens · no users`,
          reason: `Deleted by ${me.name}`,
          payload: removed,
        });
      }
      toast.success(`Role "${r.name}" deleted successfully`);
      await loadRoles();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="text-primary h-6 w-6" /> Roles &amp; Permissions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Fine-grained role definition, multi-branch permission scoping, and access control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRoles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {canManage && (
            <Button asChild size="sm" className="bg-gradient-emerald shadow-premium text-white">
              <Link href="/org/roles/new">
                <Plus className="h-4 w-4" /> Create Role
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">Total Roles</div>
              <Layers className="text-primary/70 h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{kpis.total}</div>
            <p className="text-muted-foreground text-[11px] mt-0.5">Across all branches</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">Active Roles</div>
              <ShieldCheck className="text-emerald-500 h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpis.active}
            </div>
            <p className="text-muted-foreground text-[11px] mt-0.5">In operational effect</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-sky-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">System Built-In</div>
              <Lock className="text-sky-500 h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{kpis.builtIn}</div>
            <p className="text-muted-foreground text-[11px] mt-0.5">Pre-seeded core roles</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">Custom Roles</div>
              <Sparkles className="text-amber-500 h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{kpis.custom}</div>
            <p className="text-muted-foreground text-[11px] mt-0.5">Tenant tailored roles</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles">
        <ScrollTabsList>
          <TabsTrigger value="roles">Roles Overview</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
          <TabsTrigger value="assignment">User Assignment</TabsTrigger>
          <TabsTrigger value="branches">Branch Access</TabsTrigger>
          <TabsTrigger value="temp">Temporary Access</TabsTrigger>
          <TabsTrigger value="subs">Substitute Management</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="roles" className="pt-4">
          {loading && roles.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((r) => {
                const isBuiltIn = r.built_in || r.builtIn;
                const userCount = r.users ?? Object.values(r.assignedUsers ?? {}).filter((b) => b?.length).length;
                const screenCount = r.screens ?? Object.keys(r.permissions ?? {}).length;
                const branchCount = Array.isArray(r.branches) ? r.branches.length : ALL_MANAGED_BRANCHES.length;
                const isBusy = actionInProgress === r.id;

                return (
                  <Card
                    key={r.id}
                    className="shadow-card hover:shadow-premium cursor-pointer transition relative group"
                    onClick={() => handleViewRole(r)}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>{r.name}</span>
                            {isBuiltIn && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-normal bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              >
                                Built-in
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {r.code || r.id} · updated {r.updated || "Recent"}
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

                      <p className="text-muted-foreground text-sm line-clamp-2 min-h-[40px]">
                        {r.description || "No description specified for this role."}
                      </p>

                      <div
                        className="text-muted-foreground flex items-center gap-4 pt-1 text-xs border-t border-border/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex items-center gap-1.5" title="Active users">
                          <Users className="h-3.5 w-3.5" /> {userCount} users
                        </span>
                        <span className="flex items-center gap-1.5" title="Configured screens">
                          <MonitorSmartphone className="h-3.5 w-3.5" /> {screenCount} screens
                        </span>
                        <span className="flex items-center gap-1.5" title="Branch coverage">
                          <MapPinned className="h-3.5 w-3.5" /> {branchCount} branches
                        </span>

                        {canManage && (
                          <div className="ml-auto flex items-center gap-1">
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              <Link
                                href={buildHref({ to: "/org/roles/new", search: { edit: r.id } })}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              disabled={isBusy}
                              title={r.status === "Active" ? "Set to Draft" : "Activate"}
                              onClick={(e) => handleToggleStatus(r, e)}
                            >
                              <Power
                                className={`h-3.5 w-3.5 ${
                                  r.status === "Active" ? "text-emerald-600" : "text-muted-foreground"
                                }`}
                              />
                            </Button>

                            {!isBuiltIn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                disabled={isBusy || userCount > 0}
                                title={
                                  userCount > 0
                                    ? `Granted to ${userCount} users — unassign first`
                                    : "Delete custom role"
                                }
                                onClick={(e) => handleDeleteRole(r, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="matrix" className="pt-4">
          <PermissionMatrixTab />
        </TabsContent>

        <TabsContent value="assignment" className="pt-4">
          <UserAssignmentTab />
        </TabsContent>

        <TabsContent value="branches" className="pt-4">
          <BranchAccessTab />
        </TabsContent>

        <TabsContent value="temp" className="pt-4">
          <TemporaryAccessTab />
        </TabsContent>

        <TabsContent value="subs" className="pt-4">
          <SubstitutesTab />
        </TabsContent>
      </Tabs>

      {/* Role Detail Dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {view && (() => {
            const r = viewDetail || view;
            const isBuiltIn = r.built_in || r.builtIn;
            const assignedList = r.assigned_users
              ? Object.entries(r.assigned_users)
              : Object.entries(r.assignedUsers ?? {});
            const branchesList = Array.isArray(r.branches) ? r.branches : [];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="text-primary h-5 w-5" /> {r.name}
                  </DialogTitle>
                  <DialogDescription>
                    {r.code || r.id} · {r.description || "Detailed role overview and permission layout"}
                  </DialogDescription>
                </DialogHeader>

                {viewLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="text-primary h-6 w-6 animate-spin" />
                  </div>
                ) : (
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
                      {isBuiltIn && <Badge variant="secondary">System Built-In</Badge>}

                      {canManage && (
                        <div className="ml-auto flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              handleToggleStatus(r, e);
                              setView((prev) => ({
                                ...prev,
                                status: prev.status === "Active" ? "Draft" : "Active",
                              }));
                            }}
                          >
                            {r.status === "Active" ? "Set to Draft" : "Activate"}
                          </Button>
                          <Button asChild size="sm" className="bg-gradient-emerald text-white">
                            <Link
                              href={buildHref({ to: "/org/roles/new", search: { edit: r.id } })}
                            >
                              <Pencil className="h-4 w-4" /> Edit Role
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>

                    <KV
                      items={[
                        ["Role Name", r.name],
                        ["Role Code", r.code || r.id],
                        ["Assigned Users", `${assignedList.length}`],
                        ["Branches in Scope", branchesList.map(branchName).join(", ") || "All Branches"],
                        ["Updated On", r.updated || "Recent"],
                      ]}
                    />

                    {/* Permissions Map Display */}
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                        Screen Permissions
                      </div>
                      <div className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-lg border">
                        {r.permissions && Object.keys(r.permissions).length > 0 ? (
                          Object.entries(r.permissions).map(([screenKey, perms]) => {
                            const activeActions = [];
                            if (perms.View) activeActions.push("View");
                            if (perms.Edit) activeActions.push("Edit");
                            if (perms.Delete) activeActions.push("Delete");

                            return (
                              <div
                                key={screenKey}
                                className="flex items-center justify-between p-2.5 text-sm"
                              >
                                <span className="font-mono text-xs text-muted-foreground">
                                  {screenKey}
                                </span>
                                <div className="flex gap-1">
                                  {activeActions.map((a) => (
                                    <Badge
                                      key={a}
                                      variant="outline"
                                      className="text-[10px] border-primary/30 bg-primary/10 text-primary"
                                    >
                                      {a}
                                    </Badge>
                                  ))}
                                  {activeActions.length === 0 && (
                                    <span className="text-xs text-muted-foreground">No Access</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            No permissions mapped
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Users Assigned */}
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                        Assigned Users
                      </div>
                      {assignedList.length === 0 ? (
                        <div className="text-muted-foreground text-xs p-2 border rounded-lg">
                          No users assigned to this role yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                          {assignedList.map(([uid, branchIds]) => (
                            <div
                              key={uid}
                              className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm"
                            >
                              <span className="font-medium text-xs">
                                {userById(uid)?.name || uid}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(branchIds) ? branchIds : []).map((b) => (
                                  <Badge key={b} variant="outline" className="text-[10px]">
                                    {branchName(b)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RolesHub;
