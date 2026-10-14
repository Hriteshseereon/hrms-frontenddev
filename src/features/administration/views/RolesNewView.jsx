import { useSearch } from "@/lib/navigation";
import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useMemo, useState } from "react";
import { ShieldCheck, ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
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
import { useLoginUsers, useRoles, saveRole } from "@/features/auth/data/rbac-store";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { useScope, useScopeMatch } from "@/features/organization/data/tenancy";

const STEPS = [
  "Role Details",
  "Branch Scope",
  "Select Screens",
  "Set Permissions",
  "Assign Users",
  "Review & Submit",
];

const ALL_SCREEN_IDS = RBAC_MODULES.flatMap((m) =>
  m.submodules.flatMap((s) => s.screens.map((sc) => screenId(m.key, s.key, sc.key))),
);

function CreateRole() {
  const { edit } = useSearch(validateSearch);
  const me = useCurrentUser();
  // Reactive read: the server (and the hydration render) see the seed roles, the persisted role arrives right after.
  // The wizard is keyed on the record it prefills from, so a role created in the browser (absent from the seed)
  // remounts with its saved values instead of opening as a blank "Create Role" form.
  const roles = useRoles();
  const existing = edit ? roles.find((r) => r.id === edit) : undefined;
  const key = existing ? `${existing.id}:${existing.updated}:${existing.history.length}` : "new";
  // The wizard writes roles — only roles holding role.manage may use it (the URL was reachable by HR).
  if (!can(me.role, "role.manage")) return <AccessDenied role={me.role} homeTo="/org/dashboard" />;
  // Editing a role id that does not exist silently opened a blank "Create Role" form.
  if (edit && !existing)
    return (
      <div className="border-border text-muted-foreground rounded-xl border p-8 text-center text-sm">
        Role {edit} was not found — it may have been deleted.{" "}
        <Link href="/org/roles" className="text-primary underline">
          Back to Roles
        </Link>
      </div>
    );
  return <RoleWizard key={key} existing={existing} />;
}

function RoleWizard({ existing }) {
  const router = useRouter();
  const me = useCurrentUser();
  const allRoles = useRoles();
  const rolesOfUser = (userId) =>
    allRoles.filter((r) => (r.assignedUsers[userId] ?? []).length > 0);
  // Tenant scope (mirrors Users & Logins): an entity Admin assigns the role only to their own company's users.
  const inScope = useScopeMatch();
  const ORG_USERS = useLoginUsers().filter((u) => inScope(u.orgId, null, u.branch));
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(Object.keys(existing?.permissions ?? {}).map((k) => [k, true])),
  );
  const [perms, setPerms] = useState(existing?.permissions ?? {});
  const [branches, setBranches] = useState(() =>
    Object.fromEntries((existing?.branches ?? []).map((b) => [b, true])),
  );
  /** userId -> branchId[] this role is granted on */
  const [assigned, setAssigned] = useState(existing?.assignedUsers ?? {});
  const [userQ, setUserQ] = useState("");

  const branchIds = useMemo(() => Object.keys(branches).filter((b) => branches[b]), [branches]);
  // The companies' real branches (ids like ORG-SEEREON-BR-02) — the static demo list ("Bhubaneswar HQ::Whitefield")
  // matched no branch anybody works in, so the branch scope of a role could never be applied.
  const scopeCompanies = useScope().companies;
  const MANAGED = useMemo(
    () =>
      scopeCompanies.flatMap((c) =>
        (c.branches ?? [])
          .filter((b) => b.status !== "Inactive")
          .map((b) => ({ id: b.id, name: b.hidden ? "Head Office" : b.name, office: c.name })),
      ),
    [scopeCompanies],
  );
  const offices = useMemo(() => Array.from(new Set(MANAGED.map((b) => b.office))), [MANAGED]);
  const branchName = (id) =>
    MANAGED.find((b) => b.id === id)?.name ??
    ALL_MANAGED_BRANCHES.find((b) => b.id === id)?.name ??
    id;

  const toggleBranch = (id, on) => {
    setBranches((b) => ({ ...b, [id]: on }));
    if (!on)
      setAssigned((a) => {
        const next = {};
        Object.entries(a).forEach(([u, ids]) => {
          next[u] = ids.filter((x) => x !== id);
        });
        return next;
      });
  };

  const toggleAssignment = (userId, branchId, on) =>
    setAssigned((a) => {
      const current = a[userId] ?? [];
      return {
        ...a,
        [userId]: on
          ? Array.from(new Set([...current, branchId]))
          : current.filter((x) => x !== branchId),
      };
    });

  const assignmentCount = Object.values(assigned).reduce((n, ids) => n + ids.length, 0);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const toggleScreen = (id, on) => {
    setSelected((s) => ({ ...s, [id]: on }));
    setPerms((p) => {
      const next = { ...p };
      if (on) next[id] = next[id] ?? { View: true, Edit: false, Delete: false };
      else delete next[id];
      return next;
    });
  };

  const toggleSubmodule = (ids, on) => ids.forEach((id) => toggleScreen(id, on));

  const setPerm = (id, action, on) =>
    setPerms((p) => {
      const current = p[id] ?? { View: true, Edit: false, Delete: false };
      const next = { ...current, [action]: on };
      // Edit/Delete imply View; removing View removes the rest.
      if (action === "View" && !on) {
        next.Edit = false;
        next.Delete = false;
      }
      if (action !== "View" && on) next.View = true;
      return { ...p, [id]: next };
    });

  const nameTaken = allRoles.some(
    (r) => r.id !== existing?.id && r.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  const canNext =
    step === 0
      ? name.trim().length > 1 && !nameTaken
      : step === 1
        ? branchIds.length > 0
        : step === 2
          ? selectedIds.length > 0
          : true;

  const submit = () => {
    const id = saveRole({
      id: existing?.id,
      name: name.trim(),
      description: description.trim(),
      permissions: perms,
      branches: branchIds,
      assignedUsers: assigned,
      by: me.name,
    });
    toast.success(
      `Role "${name}" ${existing ? "updated" : "created"} (${id}) · ${selectedIds.length} screens · ${branchIds.length} branches · ${assignmentCount} user assignments`,
    );
    router.push("/org/roles");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="text-primary h-6 w-6" />{" "}
            {existing ? `Edit Role — ${existing.name}` : "Create Role"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick the modules, submodules and screens this role can reach, then set permissions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/org/roles">
            <ArrowLeft className="h-4 w-4" /> Back to Roles
          </Link>
        </Button>
      </div>

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

      {step === 0 && (
        <Card className="shadow-card">
          <CardContent className="max-w-2xl space-y-4 p-6">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Regional HR Manager"
              />
              {nameTaken && (
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
                placeholder="What is this role responsible for?"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="shadow-card">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Branches this role applies to</div>
                <p className="text-muted-foreground text-sm">
                  A role can be granted on one branch, several branches, or the whole organization.
                  Users can hold different roles in different branches.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBranches(Object.fromEntries(MANAGED.map((b) => [b.id, true])))}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBranches({});
                    setAssigned({});
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offices.map((office) => {
                const list = MANAGED.filter((b) => b.office === office);
                const allOn = list.every((b) => branches[b.id]);
                return (
                  <div
                    key={office}
                    className="border-border bg-muted/30 space-y-2 rounded-lg border p-3"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={allOn}
                        onCheckedChange={(v) => list.forEach((b) => toggleBranch(b.id, !!v))}
                      />
                      {office}
                    </label>
                    <div className="space-y-1.5 pl-6">
                      {list.map((b) => (
                        <label
                          key={b.id}
                          className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={!!branches[b.id]}
                            onCheckedChange={(v) => toggleBranch(b.id, !!v)}
                          />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {branchIds.map((id) => (
                <Badge
                  key={id}
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {branchName(id)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">All modules &amp; screens</div>
                <p className="text-muted-foreground text-xs">
                  {selectedIds.length} of {ALL_SCREEN_IDS.length} screens selected across{" "}
                  {RBAC_MODULES.length} modules
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSubmodule(ALL_SCREEN_IDS, true)}
                >
                  Select all screens
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected({});
                    setPerms({});
                  }}
                >
                  Clear all
                </Button>
              </div>
            </CardContent>
          </Card>
          {RBAC_MODULES.map((m) => {
            const moduleIds = m.submodules.flatMap((s) =>
              s.screens.map((sc) => screenId(m.key, s.key, sc.key)),
            );
            const allOn = moduleIds.every((id) => selected[id]);
            return (
              <Card key={m.key} className="shadow-card">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
                      <Checkbox
                        checked={allOn}
                        onCheckedChange={(v) => toggleSubmodule(moduleIds, !!v)}
                      />
                      {m.name}
                    </label>
                    <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
                      {moduleIds.filter((id) => selected[id]).length}/{moduleIds.length} screens
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {m.submodules.map((s) => {
                      const ids = s.screens.map((sc) => screenId(m.key, s.key, sc.key));
                      const subOn = ids.every((id) => selected[id]);
                      return (
                        <div
                          key={s.key}
                          className="border-border bg-muted/30 space-y-2 rounded-lg border p-3"
                        >
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <Checkbox
                              checked={subOn}
                              onCheckedChange={(v) => toggleSubmodule(ids, !!v)}
                            />
                            {s.name}
                          </label>
                          <div className="space-y-1.5 pl-6">
                            {s.screens.map((sc) => {
                              const id = screenId(m.key, s.key, sc.key);
                              return (
                                <label
                                  key={sc.key}
                                  className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                                >
                                  <Checkbox
                                    checked={!!selected[id]}
                                    onCheckedChange={(v) => toggleScreen(id, !!v)}
                                  />
                                  {sc.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <Card className="shadow-card overflow-hidden">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">Set permissions</div>
              <p className="text-muted-foreground text-xs">
                Apply an action to every selected screen at once, or fine-tune row by row.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERMISSION_ACTIONS.map((a) => (
                <Button
                  key={a}
                  variant="outline"
                  size="sm"
                  onClick={() => selectedIds.forEach((id) => setPerm(id, a, true))}
                >
                  Select all {a}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPerms(
                    Object.fromEntries(
                      selectedIds.map((id) => [id, { View: true, Edit: false, Delete: false }]),
                    ),
                  )
                }
              >
                Reset to view only
              </Button>
            </div>
          </CardContent>
          <div className="border-border overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Module</th>
                  <th className="p-3 text-left">Submodule</th>
                  <th className="p-3 text-left">Screen</th>
                  {PERMISSION_ACTIONS.map((a) => (
                    <th key={a} className="w-24 p-3 text-center">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {RBAC_MODULES.flatMap((m) =>
                  m.submodules.flatMap((s) =>
                    s.screens
                      .filter((sc) => selected[screenId(m.key, s.key, sc.key)])
                      .map((sc) => {
                        const id = screenId(m.key, s.key, sc.key);
                        const p = perms[id] ?? { View: true, Edit: false, Delete: false };
                        return (
                          <tr key={id} className="hover:bg-muted/30">
                            <td className="p-3">{m.name}</td>
                            <td className="text-muted-foreground p-3">{s.name}</td>
                            <td className="p-3 font-medium">{sc.name}</td>
                            {PERMISSION_ACTIONS.map((a) => (
                              <td key={a} className="p-3 text-center">
                                <Checkbox
                                  checked={p[a]}
                                  onCheckedChange={(v) => setPerm(id, a, !!v)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      }),
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="shadow-card overflow-hidden">
          <CardContent className="space-y-1 p-5">
            <div className="font-semibold">Assign this role to users, per branch</div>
            <p className="text-muted-foreground text-sm">
              Tick a branch for a user to grant them this role there. The same user can hold other
              roles in the same branch, and this role across multiple branches.
            </p>
            <Input
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              placeholder="Filter users by name, email, role or department…"
              className="mt-2 h-9 max-w-sm"
            />
          </CardContent>
          <div className="border-border overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="min-w-[220px] p-3 text-left">User</th>
                  <th className="min-w-[200px] p-3 text-left">Existing roles</th>
                  {branchIds.map((id) => (
                    <th key={id} className="p-3 text-center whitespace-nowrap">
                      {branchName(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {ORG_USERS.filter(
                  (u) =>
                    !userQ ||
                    `${u.name} ${u.email} ${u.role} ${u.dept}`
                      .toLowerCase()
                      .includes(userQ.toLowerCase()),
                ).map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          {u.role}
                        </Badge>
                        {rolesOfUser(u.id)
                          .filter((r) => r.id !== existing?.id)
                          .map((r) => (
                            <Badge
                              key={r.id}
                              variant="outline"
                              className="border-border text-muted-foreground"
                            >
                              {r.name}
                            </Badge>
                          ))}
                      </div>
                    </td>
                    {branchIds.map((id) => (
                      <td key={id} className="p-3 text-center">
                        <Checkbox
                          checked={(assigned[u.id] ?? []).includes(id)}
                          onCheckedChange={(v) => toggleAssignment(u.id, id, !!v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="space-y-2 p-5">
              <div className="text-lg font-semibold">{name || "Untitled role"}</div>
              <p className="text-muted-foreground text-sm">
                {description || "No description provided."}
              </p>
              <div className="text-muted-foreground flex flex-wrap gap-4 pt-2 text-xs">
                <span>{selectedIds.length} screens selected</span>
                <span>{selectedIds.filter((id) => perms[id]?.Edit).length} with edit access</span>
                <span>
                  {selectedIds.filter((id) => perms[id]?.Delete).length} with delete access
                </span>
                <span>{branchIds.length} branches in scope</span>
                <span>{assignmentCount} user-branch assignments</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="font-semibold">Branch scope &amp; users</div>
              {branchIds.map((id) => {
                const users = ORG_USERS.filter((u) => (assigned[u.id] ?? []).includes(id));
                return (
                  <div key={id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {branchName(id)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {users.length ? users.map((u) => u.name).join(", ") : "No users assigned yet"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {RBAC_MODULES.map((m) => {
            const rows = m.submodules.flatMap((s) =>
              s.screens
                .filter((sc) => selected[screenId(m.key, s.key, sc.key)])
                .map((sc) => ({
                  sub: s.name,
                  screen: sc.name,
                  id: screenId(m.key, s.key, sc.key),
                })),
            );
            if (!rows.length) return null;
            return (
              <Card key={m.key} className="shadow-card">
                <CardContent className="space-y-3 p-5">
                  <div className="font-semibold">{m.name}</div>
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{r.sub}</span>
                        <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
                        <span className="font-medium">{r.screen}</span>
                        <div className="ml-auto flex gap-1.5">
                          {PERMISSION_ACTIONS.filter((a) => perms[r.id]?.[a]).map((a) => (
                            <Badge
                              key={a}
                              variant="outline"
                              className="border-primary/30 bg-primary/10 text-primary"
                            >
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            disabled={!canNext}
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={!name.trim() || nameTaken || !selectedIds.length || !branchIds.length}
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={submit}
          >
            <Check className="h-4 w-4" /> Submit Role
          </Button>
        )}
      </div>
    </div>
  );
}

/** Query-string contract of this screen (was the route's validateSearch). */
function validateSearch(s) {
  return typeof s.edit === "string" ? { edit: s.edit } : {};
}

export default CreateRole;
