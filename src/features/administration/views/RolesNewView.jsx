import { useSearch } from "@/lib/navigation";
import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { Fragment, useMemo, useState, useEffect } from "react";
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
import { RBAC_MODULES, PERMISSION_ACTIONS, DEFAULT_SCREEN_ACTIONS, actionsForScreen, screenId } from "@/features/auth/data/rbac";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { AccessDenied } from "@/components/common/AccessDenied";
import { CompanyScopeSelect, useCompanyScope } from "@/features/organization/components/CompanyScopeSelect";
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";

const STEPS = ["Role Details", "Modules", "Tabs & Permissions", "Review & Submit"];

const SCREEN_ACTIONS = Object.fromEntries(
  RBAC_MODULES.flatMap((m) => m.submodules.flatMap((s) => s.screens.map((sc) => [screenId(m.key, s.key, sc.key), actionsForScreen(sc)]))),
);

function CreateRole() {
  const { edit } = useSearch(validateSearch);
  const me = useCurrentUser();
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
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Could not load role from the server:", error);
      }
      if (mounted) {
        setExisting(null);
        setLoading(false);
      }
    };
    fetchRole();
    return () => {
      mounted = false;
    };
  }, [edit]);

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
  const scope = useCompanyScope();
  const [allRoles, setAllRoles] = useState([]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [perms, setPerms] = useState(() => existing?.permissions ?? {});
  const [selectedModuleKeys, setSelectedModuleKeys] = useState(() => {
    const saved = existing?.permissions ?? {};
    return RBAC_MODULES.filter((module) => module.submodules.some((submodule) =>
      submodule.screens.some((screen) => PERMISSION_ACTIONS.some((action) => saved[screenId(module.key, submodule.key, screen.key)]?.[action])),
    )).map((module) => module.key);
  });
  const [selectedModuleKey, setSelectedModuleKey] = useState(() => {
    const saved = existing?.permissions ?? {};
    return RBAC_MODULES.find((module) => module.submodules.some((submodule) =>
      submodule.screens.some((screen) => PERMISSION_ACTIONS.some((action) => saved[screenId(module.key, submodule.key, screen.key)]?.[action])),
    ))?.key ?? RBAC_MODULES[0]?.key;
  });
  const [selectedSubmoduleKey, setSelectedSubmoduleKey] = useState(() => {
    const module = RBAC_MODULES.find((item) => item.key === selectedModuleKey) ?? RBAC_MODULES[0];
    return module?.submodules[0]?.key;
  });
  const [submitting, setSubmitting] = useState(false);
  // Holders of an "Admin portal access" role land in the org portal after login.
  const [isAdminPortal, setIsAdminPortal] = useState(Boolean(existing?.is_admin_portal));

  useEffect(() => {
    let mounted = true;
    rbacApi
      .getRoles(scope.companyId ? { company_id: scope.companyId } : undefined)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.roles ?? [];
        if (mounted) setAllRoles(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        console.error("Could not load roles from the server:", error);
        if (mounted) setAllRoles([]);
      });
    return () => {
      mounted = false;
    };
  }, [scope.companyId]);

  const isBuiltIn = Boolean(existing?.built_in || existing?.builtIn);

  // Normalization Rule:
  // Any granted operation also grants access to the screen.
  const setPerm = (id, action, on) => {
    setPerms((p) => {
      const current = p[id] ?? {};
      const next = { ...current, [action]: on };

      if (action === "View" && !on) {
        PERMISSION_ACTIONS.forEach((permission) => { if (permission !== "View") next[permission] = false; });
      }
      if (action !== "View" && on) {
        next.View = true;
      }

      // If all are false, delete from map
      if (!PERMISSION_ACTIONS.some((permission) => next[permission])) {
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
          next[id] = Object.fromEntries((SCREEN_ACTIONS[id] ?? DEFAULT_SCREEN_ACTIONS).map((action) => [action, true]));
        } else if (actionType === "view") {
          next[id] = Object.fromEntries((SCREEN_ACTIONS[id] ?? DEFAULT_SCREEN_ACTIONS).map((action) => [action, action === "View"]));
        } else if (actionType === "rw") {
          next[id] = Object.fromEntries((SCREEN_ACTIONS[id] ?? DEFAULT_SCREEN_ACTIONS).map((action) => [action, ["View", "Create", "Edit"].includes(action)]));
        } else if (actionType === "clear") {
          delete next[id];
        }
      });
      return next;
    });
  };

  const configuredScreenIds = useMemo(
    () => Object.keys(perms).filter((id) => PERMISSION_ACTIONS.some((action) => perms[id]?.[action])),
    [perms],
  );
  const activeModule = RBAC_MODULES.find((module) => module.key === selectedModuleKey) ?? RBAC_MODULES[0];
  const activeSubmodule = activeModule?.submodules.find((submodule) => submodule.key === selectedSubmoduleKey) ?? activeModule?.submodules[0];

  const toggleModule = (moduleKey, checked) => {
    const module = RBAC_MODULES.find((item) => item.key === moduleKey);
    if (!module) return;
    if (checked) {
      setSelectedModuleKeys((current) => current.includes(moduleKey) ? current : [...current, moduleKey]);
      setSelectedModuleKey(moduleKey);
      setSelectedSubmoduleKey(module.submodules[0]?.key);
      return;
    }
    setSelectedModuleKeys((current) => current.filter((key) => key !== moduleKey));
    const ids = module.submodules.flatMap((submodule) => submodule.screens.map((screen) => screenId(module.key, submodule.key, screen.key)));
    setPerms((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
    if (selectedModuleKey === moduleKey) {
      const next = RBAC_MODULES.find((item) => item.key !== moduleKey && selectedModuleKeys.includes(item.key));
      setSelectedModuleKey(next?.key ?? RBAC_MODULES.find((item) => item.key !== moduleKey)?.key);
      setSelectedSubmoduleKey(next?.submodules[0]?.key);
    }
  };

  const nameTaken = allRoles.some(
    (r) => r.id !== existing?.id && r.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  const canNext =
    step === 0
      ? name.trim().length > 1 && (!nameTaken || isBuiltIn)
      : step === 1
        ? selectedModuleKeys.length > 0
        : step === 2
          ? configuredScreenIds.some((id) => selectedModuleKeys.some((moduleKey) => id.startsWith(`${moduleKey}.`)))
          : true;

  const submit = async () => {
    if (scope.isSuper && !existing && !scope.companyId) {
      toast.error("Select the company this role belongs to");
      return;
    }

    try {
      setSubmitting(true);

      // Clean normalized permissions map
      const normalizedPermissions = {};
      configuredScreenIds.forEach((id) => {
        const p = perms[id] || {};
        const hasAccess = PERMISSION_ACTIONS.some((action) => p[action]);
        normalizedPermissions[id] = Object.fromEntries(
          (SCREEN_ACTIONS[id] ?? DEFAULT_SCREEN_ACTIONS).map((action) => [action, action === "View" ? Boolean(p.View || hasAccess) : Boolean(p[action])]),
        );
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
        // The matrix tree drawn on this screen. The backend registers any module / screen it has not seen yet
        // from it, so adding one to RBAC_MODULES is all a new screen needs to become permissionable.
        screen_catalog: RBAC_MODULES,
        status: existing?.status || "Active",
        is_admin_portal: isAdminPortal,
        ...(scope.isSuper && !existing ? { company_id: scope.companyId } : {}),
      };

      if (existing?.id) await rbacApi.updateRole(existing.id, payload);
      else await rbacApi.createRole(payload);

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
            {!existing && <CompanyScopeSelect scope={scope} allowAll={false} />}
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
            {/* <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={isAdminPortal}
                onCheckedChange={(v) => setIsAdminPortal(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium">Admin portal access</span>
                <span className="text-muted-foreground block text-xs">
                  People with this role open the admin portal after login instead of the employee portal.
                </span>
              </span>
            </label> */}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Choose modules */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">Select modules</div>
                <p className="text-muted-foreground text-xs">
                  Choose the modules this role can access. You will select submodules and actions next.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => RBAC_MODULES.forEach((module) => toggleModule(module.key, true))}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedModuleKeys([]); setPerms({}); }}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RBAC_MODULES.map((module, index) => (
            <Fragment key={module.key}>
              <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleModule(module.key, !selectedModuleKeys.includes(module.key)); } }} onClick={() => toggleModule(module.key, !selectedModuleKeys.includes(module.key))} className={cn("w-full cursor-pointer rounded-xl border p-4 text-left transition-colors hover:border-primary", selectedModuleKeys.includes(module.key) ? "border-primary bg-primary/5" : "border-border bg-card")}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={selectedModuleKeys.includes(module.key)} onCheckedChange={(checked) => toggleModule(module.key, Boolean(checked))} onClick={(event) => event.stopPropagation()} />
                  <div className="min-w-0 flex-1"><div className="font-semibold text-sm">{module.name}</div><div className="text-muted-foreground mt-1 text-xs">{module.submodules.length} submodules · {module.submodules.reduce((count, submodule) => count + submodule.screens.length, 0)} screens</div></div>
                  {selectedModuleKeys.includes(module.key) && <Badge variant="outline">{module.submodules.reduce((count, submodule) => count + submodule.screens.filter((screen) => PERMISSION_ACTIONS.some((action) => perms[screenId(module.key, submodule.key, screen.key)]?.[action])).length, 0)} selected</Badge>}
                </div>
              </div>
            </Fragment>
          ))}
          </div>
        </div>
      )}

      {/* Step 2: Choose a submodule and its screen actions */}
      {step === 2 && activeModule && activeSubmodule && (
        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected modules</div>
              {RBAC_MODULES.filter((module) => selectedModuleKeys.includes(module.key)).map((module) => (
                <div key={module.key} className="space-y-1">
                  <button type="button" onClick={() => { setSelectedModuleKey(module.key); setSelectedSubmoduleKey(module.submodules[0]?.key); }} className={cn("w-full rounded-md px-3 py-2 text-left text-sm font-semibold", activeModule.key === module.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{module.name}</button>
                  {activeModule.key === module.key && module.submodules.map((submodule) => {
                    const ids = submodule.screens.map((screen) => screenId(module.key, submodule.key, screen.key));
                    const granted = ids.filter((id) => PERMISSION_ACTIONS.some((action) => perms[id]?.[action])).length;
                    return <button key={submodule.key} type="button" onClick={() => setSelectedSubmoduleKey(submodule.key)} className={cn("ml-2 flex w-[calc(100%-0.5rem)] items-center justify-between rounded-md px-3 py-2 text-left text-xs", activeSubmodule.key === submodule.key ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60")}>{submodule.name}<span>{granted}/{submodule.screens.length}</span></button>;
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-4">
              <div><div className="font-semibold">{activeSubmodule.name}</div><p className="text-muted-foreground mt-1 text-xs">{activeModule.name} · choose the allowed actions for each screen.</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setModulePermissions(activeSubmodule.screens.map((screen) => screenId(activeModule.key, activeSubmodule.key, screen.key)), "view")}>View only</Button><Button variant="outline" size="sm" onClick={() => setModulePermissions(activeSubmodule.screens.map((screen) => screenId(activeModule.key, activeSubmodule.key, screen.key)), "rw")}>R/W</Button><Button variant="outline" size="sm" onClick={() => setModulePermissions(activeSubmodule.screens.map((screen) => screenId(activeModule.key, activeSubmodule.key, screen.key)), "full")}>Full</Button></div>
            </div>
            <CardContent className="max-h-[520px] space-y-3 overflow-y-auto p-4">
              {activeSubmodule.screens.map((screen) => {
                const id = screenId(activeModule.key, activeSubmodule.key, screen.key);
                const allowedActions = actionsForScreen(screen);
                const current = perms[id] ?? {};
                const selectedCount = allowedActions.filter((action) => current[action]).length;
                return <div key={id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <Checkbox checked={selectedCount > 0} onCheckedChange={(checked) => setModulePermissions([id], checked ? "full" : "clear")} />
                      {screen.name}
                    </label>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{selectedCount} {selectedCount === 1 ? "action" : "actions"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pl-6">
                    {allowedActions.map((action) => <label key={action} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground"><Checkbox checked={Boolean(current[action])} onCheckedChange={(checked) => setPerm(id, action, Boolean(checked))} />{action}</label>)}
                  </div>
                </div>;
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
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
                            {item.p.Create && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-mono">C</span>}
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
                            {item.p.Export && <span className="text-[9px] px-1 rounded bg-violet-100 text-violet-800 font-mono">EX</span>}
                            {item.p["Bulk Upload"] && <span className="text-[9px] px-1 rounded bg-cyan-100 text-cyan-800 font-mono">BU</span>}
                            {item.p.Approve && <span className="text-[9px] px-1 rounded bg-orange-100 text-orange-800 font-mono">AP</span>}
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
