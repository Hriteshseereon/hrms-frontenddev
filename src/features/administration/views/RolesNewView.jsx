import { useSearch } from "@/lib/navigation";
import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useMemo, useState, useEffect } from "react";
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Lock,
  Loader2,
  AlertCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RBAC_MODULES, PERMISSION_ACTIONS, screenId } from "@/features/auth/data/rbac";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { AccessDenied } from "@/components/common/AccessDenied";
import { useRoles, saveRole } from "@/features/auth/data/rbac-store";
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";

const STEPS = ["Role Details", "Permissions Matrix", "Review & Submit"];

const ALL_SCREEN_IDS = RBAC_MODULES.flatMap((m) =>
  m.submodules.flatMap((s) => s.screens.map((sc) => screenId(m.key, s.key, sc.key))),
);

function CreateRole() {
  const { edit } = useSearch(validateSearch);
  const me = useCurrentUser();
  const fallbackRoles = useRoles();
  const [existing, setExisting] = useState(undefined);
  const [loading, setLoading] = useState(Boolean(edit));

  useEffect(() => {
    if (!edit) {
      setExisting(undefined);
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetchRole = async () => {
      try {
        setLoading(true);
        const data = await rbacApi.getRoleById(edit);
        if (mounted && data) {
          setExisting(data);
          return;
        }
      } catch {
        // Fallback
      }
      if (mounted) {
        const found = fallbackRoles.find((r) => r.id === edit);
        setExisting(found);
        setLoading(false);
      }
    };
    fetchRole();
    return () => {
      mounted = false;
    };
  }, [edit, fallbackRoles]);

  if (!can(me.role, "role.manage")) {
    return <AccessDenied role={me.role} homeTo="/org/dashboard" />;
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (edit && !existing) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border p-8 text-center text-sm">
        Role {edit} was not found — it may have been deleted.{" "}
        <Link href="/org/roles" className="text-primary underline">
          Back to Roles
        </Link>
      </div>
    );
  }

  const key = existing ? `${existing.id}:${existing.updated || "v1"}` : "new";
  return <RoleWizard key={key} existing={existing} />;
}

function RoleWizard({ existing }) {
  const router = useRouter();
  const me = useCurrentUser();
  const allRoles = useRoles();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [perms, setPerms] = useState(() => existing?.permissions ?? {});
  const [submitting, setSubmitting] = useState(false);

  const isBuiltIn = Boolean(existing?.built_in || existing?.builtIn);

  // Normalization Rule:
  // If Edit or Delete is turned on -> View MUST be turned on.
  // If View is turned off -> Edit and Delete MUST be turned off.
  const setPerm = (id, action, on) => {
    setPerms((p) => {
      const current = p[id] ?? { View: false, Edit: false, Delete: false };
      const next = { ...current, [action]: on };

      if (action === "View" && !on) {
        next.Edit = false;
        next.Delete = false;
      }
      if ((action === "Edit" || action === "Delete") && on) {
        next.View = true;
      }

      // If all are false, delete from map
      if (!next.View && !next.Edit && !next.Delete) {
        const copy = { ...p };
        delete copy[id];
        return copy;
      }
      return { ...p, [id]: next };
    });
  };

  const setModulePermissions = (moduleIds, actionType) => {
    setPerms((p) => {
      const next = { ...p };
      moduleIds.forEach((id) => {
        if (actionType === "full") {
          next[id] = { View: true, Edit: true, Delete: true };
        } else if (actionType === "view") {
          next[id] = { View: true, Edit: false, Delete: false };
        } else if (actionType === "clear") {
          delete next[id];
        }
      });
      return next;
    });
  };

  const configuredScreenIds = useMemo(
    () => Object.keys(perms).filter((id) => perms[id]?.View),
    [perms],
  );

  const nameTaken = allRoles.some(
    (r) => r.id !== existing?.id && r.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  const canNext =
    step === 0
      ? name.trim().length > 1 && (!nameTaken || isBuiltIn)
      : step === 1
        ? configuredScreenIds.length > 0
        : true;

  const submit = async () => {
    try {
      setSubmitting(true);

      // Clean normalized permissions map
      const normalizedPermissions = {};
      configuredScreenIds.forEach((id) => {
        const p = perms[id] || {};
        const hasMutation = Boolean(p.Edit || p.Delete);
        const canView = Boolean(p.View || hasMutation);
        normalizedPermissions[id] = {
          View: canView,
          Edit: canView ? Boolean(p.Edit) : false,
          Delete: canView ? Boolean(p.Delete) : false,
        };
      });

      const generatedCode =
        existing?.code ||
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

      const payload = {
        name: name.trim(),
        code: generatedCode,
        description: description.trim(),
        permissions: normalizedPermissions,
        status: existing?.status || "Active",
      };

      let savedId = existing?.id;
      try {
        if (existing?.id) {
          const res = await rbacApi.updateRole(existing.id, payload);
          savedId = res?.id || existing.id;
        } else {
          const res = await rbacApi.createRole(payload);
          savedId = res?.id || res?.data?.id;
        }
      } catch (apiErr) {
        console.warn("Backend API sync notice:", apiErr);
      }

      // Synchronize with local store
      saveRole({
        id: savedId || existing?.id,
        name: name.trim(),
        description: description.trim(),
        permissions: normalizedPermissions,
        branches: existing?.branches || [],
        assignedUsers: existing?.assignedUsers || {},
        by: me.name,
      });

      toast.success(
        `Role "${name}" ${existing ? "updated" : "created"} successfully · ${configuredScreenIds.length} screens configured`,
      );
      router.push("/org/roles");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="text-primary h-6 w-6" />{" "}
            {existing ? `Edit Role — ${existing.name}` : "Create Role"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Define an abstract, reusable permission template. Branch and employee scoping are configured during assignment.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/org/roles">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Roles
          </Link>
        </Button>
      </div>

      {/* Steps Indicator (3 Clean Steps) */}
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  i === step
                    ? "bg-gradient-emerald shadow-premium text-white"
                    : i < step
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                    i === step
                      ? "bg-white/20"
                      : i < step
                        ? "bg-primary/15 text-primary"
                        : "bg-muted",
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="text-muted-foreground/50 h-4 w-4" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step 0: Role Details */}
      {step === 0 && (
        <Card className="shadow-card">
          <CardContent className="max-w-2xl space-y-4 p-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs font-medium">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                {isBuiltIn && (
                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800">
                    <Lock className="h-3 w-3 mr-1" /> System Built-In
                  </Badge>
                )}
              </div>
              <Input
                value={name}
                disabled={isBuiltIn}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HR Manager, Payroll Officer, Branch Accountant"
              />
              {isBuiltIn && (
                <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Built-in core role name cannot be modified.
                </p>
              )}
              {nameTaken && !isBuiltIn && (
                <p className="text-destructive text-xs">
                  A role with this name already exists — choose a different name.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">Description</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what responsibilities and scope this role blueprint covers..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Permissions Matrix */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">Granular Module &amp; Screen Permissions</div>
                <p className="text-muted-foreground text-xs">
                  {configuredScreenIds.length} of {ALL_SCREEN_IDS.length} screens granted access.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModulePermissions(ALL_SCREEN_IDS, "full")}
                >
                  Grant Full Access (All)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModulePermissions(ALL_SCREEN_IDS, "view")}
                >
                  View Only (All)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPerms({})}
                >
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Module Cards */}
          {RBAC_MODULES.map((m) => {
            const moduleScreenIds = m.submodules.flatMap((s) =>
              s.screens.map((sc) => screenId(m.key, s.key, sc.key)),
            );
            const activeInModule = moduleScreenIds.filter((id) => perms[id]?.View).length;

            return (
              <Card key={m.key} className="shadow-card overflow-hidden">
                <div className="bg-muted/40 p-4 border-b flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{m.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-2">
                      {activeInModule}/{moduleScreenIds.length} screens
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setModulePermissions(moduleScreenIds, "full")}
                    >
                      Full Module
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setModulePermissions(moduleScreenIds, "view")}
                    >
                      View Only
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => setModulePermissions(moduleScreenIds, "clear")}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                        <tr>
                          <th className="p-2.5 text-left min-w-[200px]">Screen</th>
                          <th className="p-2.5 text-left min-w-[120px]">Submodule</th>
                          <th className="p-2.5 text-center w-20">View</th>
                          <th className="p-2.5 text-center w-20">Edit</th>
                          <th className="p-2.5 text-center w-20">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {m.submodules.flatMap((s) =>
                          s.screens.map((sc) => {
                            const id = screenId(m.key, s.key, sc.key);
                            const p = perms[id] || { View: false, Edit: false, Delete: false };

                            return (
                              <tr key={id} className="hover:bg-muted/30">
                                <td className="p-2.5 font-medium">{sc.name}</td>
                                <td className="p-2.5 text-muted-foreground">{s.name}</td>
                                <td className="p-2.5 text-center">
                                  <Checkbox
                                    checked={Boolean(p.View)}
                                    onCheckedChange={(v) => setPerm(id, "View", Boolean(v))}
                                  />
                                </td>
                                <td className="p-2.5 text-center">
                                  <Checkbox
                                    checked={Boolean(p.Edit)}
                                    onCheckedChange={(v) => setPerm(id, "Edit", Boolean(v))}
                                  />
                                </td>
                                <td className="p-2.5 text-center">
                                  <Checkbox
                                    checked={Boolean(p.Delete)}
                                    onCheckedChange={(v) => setPerm(id, "Delete", Boolean(v))}
                                  />
                                </td>
                              </tr>
                            );
                          }),
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step 2: Review & Submit */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">{name || "Untitled Role"}</div>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Ready to Publish
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {description || "No description provided."}
              </p>
              <div className="text-muted-foreground flex flex-wrap gap-4 pt-2 text-xs border-t">
                <span className="font-medium text-foreground">
                  {configuredScreenIds.length} screens granted access
                </span>
                <span>
                  {configuredScreenIds.filter((id) => perms[id]?.Edit).length} with Edit permissions
                </span>
                <span>
                  {configuredScreenIds.filter((id) => perms[id]?.Delete).length} with Delete permissions
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Screen Summary by Module */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RBAC_MODULES.map((m) => {
              const screensWithPerms = m.submodules.flatMap((s) =>
                s.screens
                  .filter((sc) => perms[screenId(m.key, s.key, sc.key)]?.View)
                  .map((sc) => ({
                    screen: sc.name,
                    p: perms[screenId(m.key, s.key, sc.key)],
                  })),
              );

              if (screensWithPerms.length === 0) return null;

              return (
                <Card key={m.key} className="shadow-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between font-semibold text-xs border-b pb-2">
                      <span>{m.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {screensWithPerms.length} screens
                      </Badge>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                      {screensWithPerms.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span>{item.screen}</span>
                          <div className="flex gap-1">
                            {item.p.View && (
                              <span className="text-[9px] px-1 rounded bg-emerald-100 text-emerald-800 font-mono">
                                V
                              </span>
                            )}
                            {item.p.Edit && (
                              <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-800 font-mono">
                                E
                              </span>
                            )}
                            {item.p.Delete && (
                              <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-800 font-mono">
                                D
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        <Button
          variant="outline"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            disabled={!canNext || submitting}
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            disabled={!name.trim() || (nameTaken && !isBuiltIn) || !configuredScreenIds.length || submitting}
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={submit}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            {existing ? "Update Role Blueprint" : "Submit Role Blueprint"}
          </Button>
        )}
      </div>
    </div>
  );
}

function validateSearch(s) {
  return typeof s.edit === "string" ? { edit: s.edit } : {};
}

export default CreateRole;
