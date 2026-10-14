import { useMemo, useState } from "react";
import { UserPlus, Check, ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RBAC_MODULES, PERMISSION_ACTIONS, screenId } from "@/features/auth/data/rbac";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { initials } from "@/features/employees/data/employee-directory";
import {
  can,
  passwordPolicyError,
  useCurrentUser,
  userByLogin,
} from "@/features/auth/data/auth-session";
import { useRoles, saveRole, issueTemporaryPassword } from "@/features/auth/data/rbac-store";
import { useOrgUsers, grantRole, addOrgUser } from "@/features/auth/data/user-store";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const STEPS = ["User & Credentials", "Role", "Permissions", "Review & Submit"];
const branchName = (id) => ALL_MANAGED_BRANCHES.find((b) => b.id === id)?.name ?? id;

export function UserAssignmentTab() {
  const me = useCurrentUser();
  const users = useOrgUsers();
  // Roles designed in Roles & Permissions (built-in + created in the wizard) — the static seed list hid new roles.
  const ROLES = useRoles().filter((r) => r.status === "Active");
  // Employees of the active entity (or the whole group for a Super Admin in group view).
  const EMPLOYEES = useScopedEmployees();
  const canManage = can(me.role, "role.manage");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [detail, setDetail] = useState(null);

  const [empId, setEmpId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPasswordDraft] = useState("");
  const [branches, setBranches] = useState({});

  const [roleMode, setRoleMode] = useState("predefined");
  const [roleName, setRoleName] = useState(ROLES[0]?.name ?? "");
  const [customName, setCustomName] = useState("");
  const [selected, setSelected] = useState({});
  const [perms, setPerms] = useState({});

  const employee = EMPLOYEES.find((e) => e.id === empId);
  const branchIds = useMemo(() => Object.keys(branches).filter((b) => branches[b]), [branches]);
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allScreenIds = useMemo(
    () =>
      RBAC_MODULES.flatMap((m) =>
        m.submodules.flatMap((s) => s.screens.map((sc) => screenId(m.key, s.key, sc.key))),
      ),
    [],
  );
  const finalRoleName = roleMode === "custom" ? customName.trim() : roleName;

  const reset = () => {
    setStep(0);
    setEmpId("");
    setEmail("");
    setPasswordDraft("");
    setBranches({});
    setRoleMode("predefined");
    setRoleName(ROLES[0]?.name ?? "");
    setCustomName("");
    setSelected({});
    setPerms({});
  };

  const pickEmployee = (id) => {
    setEmpId(id);
    const e = EMPLOYEES.find((x) => x.id === id);
    if (e) setEmail(e.email);
  };

  const toggleScreen = (id, on) => {
    setSelected((s) => ({ ...s, [id]: on }));
    setPerms((p) => {
      const next = { ...p };
      if (on) next[id] = next[id] ?? { View: true, Edit: false, Delete: false };
      else delete next[id];
      return next;
    });
  };
  const toggleMany = (ids, on) => ids.forEach((id) => toggleScreen(id, on));

  const setPerm = (id, action, on) =>
    setPerms((p) => {
      const current = p[id] ?? { View: true, Edit: false, Delete: false };
      const next = { ...current, [action]: on };
      if (action === "View" && !on) {
        next.Edit = false;
        next.Delete = false;
      }
      if (action !== "View" && on) next.View = true;
      return { ...p, [id]: next };
    });

  // Skip the permissions step entirely when a predefined role is chosen.
  const visibleSteps = roleMode === "custom" ? STEPS : STEPS.filter((s) => s !== "Permissions");
  const stepName = visibleSteps[step];

  const customNameTaken =
    roleMode === "custom" &&
    ROLES.some((r) => r.name.trim().toLowerCase() === customName.trim().toLowerCase());
  // A typed temporary password must meet the sign-in policy (it used to be collected and silently discarded).
  const passwordError = password ? passwordPolicyError(password) : null;
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canNext =
    stepName === "User & Credentials"
      ? !!empId && emailValid && !passwordError && branchIds.length > 0
      : stepName === "Role"
        ? finalRoleName.length > 1 && !customNameTaken
        : stepName === "Permissions"
          ? selectedIds.length > 0
          : true;

  const submit = () => {
    if (!employee) return;
    // addOrgUser returns the existing record's id for a known e-mail, or the id it just created.
    const target = addOrgUser(employee.name, email.trim());
    // A custom role is a real RBAC role: persist its screens / permissions and the branch-scoped assignment, so it
    // shows up in Roles & Permissions and in Users & Logins (the permission step used to be discarded).
    if (roleMode === "custom") {
      saveRole({
        name: finalRoleName,
        description: `Custom role created from User Assignment for ${employee.name}`,
        permissions: perms,
        branches: branchIds,
        assignedUsers: { [employee.id]: branchIds },
        by: me.name,
      });
    }
    grantRole(target, finalRoleName, branchIds, me.name);
    // The temporary password now actually applies to the person's login (it was typed and thrown away).
    const login = userByLogin(email.trim());
    if (password && login) {
      const r = issueTemporaryPassword(login.id, password, me.name);
      if (!r.ok) toast.error(r.message);
    }
    toast.success(
      `${finalRoleName} assigned to ${employee.name} across ${branchIds.length} branch(es)${password && login ? " · temporary password set" : ""}`,
    );
    setOpen(false);
    reset();
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card overflow-hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="font-semibold">User assignments</div>
            <p className="text-muted-foreground text-sm">
              Pick an employee, set their login credentials and assign a predefined or custom role.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            disabled={!canManage}
            title={canManage ? undefined : "Your role cannot grant access"}
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" /> Assign User
          </Button>
        </CardContent>
        <div className="border-border overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Roles by branch</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {users.map((u) => (
                <tr key={u.id} className={clickableRow} onClick={() => setDetail(u)}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="border-gold/30 h-8 w-8 border">
                        <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-semibold">
                        {u.name}
                        <div className="text-muted-foreground text-xs font-normal">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground p-3">{u.email}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.assignments.length === 0 && (
                        <span className="text-muted-foreground text-xs">No roles assigned</span>
                      )}
                      {u.assignments.flatMap((a) =>
                        a.roles.map((r) => (
                          <Badge
                            key={a.branchId + r}
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary"
                          >
                            {r} · {branchName(a.branchId)}
                          </Badge>
                        )),
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        u.status === "Active"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/30 bg-gold/10 text-gold"
                      }
                    >
                      {u.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail &&
        (() => {
          const emp = EMPLOYEES.find((e) => e.email.toLowerCase() === detail.email.toLowerCase());
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.name}
              subtitle={`${detail.id} · ${detail.email}`}
              badges={
                <Badge
                  variant="outline"
                  className={
                    detail.status === "Active"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-gold/30 bg-gold/10 text-gold"
                  }
                >
                  {detail.status}
                </Badge>
              }
              record={{
                id: detail.id,
                name: detail.name,
                email: detail.email,
                status: detail.status,
                employeeId: emp?.id ?? "—",
                department: emp?.dept ?? "—",
                designation: emp?.role ?? "—",
                branch: emp?.branch ?? "—",
                assignments: detail.assignments.map((a) => ({
                  branch: branchName(a.branchId),
                  roles: a.roles.join(", "),
                })),
              }}
              labels={{ id: "User ID", employeeId: "Employee ID", assignments: "Roles by branch" }}
              sections={[
                { title: "User", keys: ["id", "name", "email", "status"] },
                { title: "Employee", keys: ["employeeId", "department", "designation", "branch"] },
                { title: "Roles by branch", keys: ["assignments"] },
              ]}
            />
          );
        })()}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign user access</DialogTitle>
            <DialogDescription>
              Select the employee, set credentials and grant a role.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            {visibleSteps.map((s, i) => (
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
                {i < visibleSteps.length - 1 && (
                  <ChevronRight className="text-muted-foreground/50 h-4 w-4" />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {stepName === "User & Credentials" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={empId} onValueChange={pickEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEES.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} · {e.role} · {e.branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Login email</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                  {email && !emailValid && (
                    <p className="text-destructive text-xs">Enter a valid e-mail address.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Temporary password
                  </Label>
                  <Input
                    value={password}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder="Leave blank to keep the current password"
                  />
                  {passwordError && <p className="text-destructive text-xs">{passwordError}</p>}
                </div>
                {employee && (
                  <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm">
                    <div className="font-semibold">{employee.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {employee.id} · {employee.dept} · {employee.role}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Branches this user can manage</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ALL_MANAGED_BRANCHES.map((b) => (
                    <label
                      key={b.id}
                      className="border-border bg-muted/30 flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm"
                    >
                      <Checkbox
                        checked={!!branches[b.id]}
                        onCheckedChange={(v) => setBranches((p) => ({ ...p, [b.id]: !!v }))}
                      />
                      <span>
                        {b.name}
                        <span className="text-muted-foreground text-xs"> · {b.office}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stepName === "Role" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRoleMode("predefined")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    roleMode === "predefined"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="text-primary h-4 w-4" /> Predefined role
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Use one of the roles already configured.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setRoleMode("custom")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    roleMode === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="text-gold h-4 w-4" /> Custom role
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Pick modules, submodules, screens and permissions.
                  </p>
                </button>
              </div>
              {roleMode === "predefined" ? (
                <div className="max-w-md space-y-1.5">
                  <Label>Role</Label>
                  <Select value={roleName} onValueChange={setRoleName}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {ROLES.find((r) => r.name === roleName)?.description}
                  </p>
                </div>
              ) : (
                <div className="max-w-md space-y-1.5">
                  <Label>Custom role name</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Regional Payroll Reviewer"
                  />
                  {customNameTaken && (
                    <p className="text-destructive text-xs">
                      A role with this name already exists — pick it as a predefined role instead.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {stepName === "Permissions" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                  {selectedIds.length} of {allScreenIds.length} screens selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMany(allScreenIds, true)}
                  >
                    Select all screens
                  </Button>
                  {PERMISSION_ACTIONS.map((a) => (
                    <Button
                      key={a}
                      variant="outline"
                      size="sm"
                      onClick={() => selectedIds.forEach((id) => setPerm(id, a, true))}
                    >
                      All {a}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected({});
                      setPerms({});
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                {RBAC_MODULES.map((m) => {
                  const moduleIds = m.submodules.flatMap((s) =>
                    s.screens.map((sc) => screenId(m.key, s.key, sc.key)),
                  );
                  const allOn = moduleIds.every((id) => selected[id]);
                  return (
                    <div key={m.key} className="border-border space-y-3 rounded-lg border p-4">
                      <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
                        <Checkbox
                          checked={allOn}
                          onCheckedChange={(v) => toggleMany(moduleIds, !!v)}
                        />
                        {m.name}
                        <Badge
                          variant="outline"
                          className="border-gold/30 bg-gold/10 text-gold ml-auto"
                        >
                          {moduleIds.filter((id) => selected[id]).length}/{moduleIds.length}
                        </Badge>
                      </label>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                                  onCheckedChange={(v) => toggleMany(ids, !!v)}
                                />
                                {s.name}
                              </label>
                              <div className="space-y-2 pl-6">
                                {s.screens.map((sc) => {
                                  const id = screenId(m.key, s.key, sc.key);
                                  const p = perms[id];
                                  return (
                                    <div key={sc.key} className="space-y-1">
                                      <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
                                        <Checkbox
                                          checked={!!selected[id]}
                                          onCheckedChange={(v) => toggleScreen(id, !!v)}
                                        />
                                        {sc.name}
                                      </label>
                                      {p && (
                                        <div className="flex flex-wrap gap-3 pl-6">
                                          {PERMISSION_ACTIONS.map((a) => (
                                            <label
                                              key={a}
                                              className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs"
                                            >
                                              <Checkbox
                                                checked={p[a]}
                                                onCheckedChange={(v) => setPerm(id, a, !!v)}
                                              />
                                              {a}
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stepName === "Review & Submit" && (
            <div className="space-y-4">
              <div className="border-border bg-muted/30 grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground text-xs tracking-wider uppercase">
                    Employee
                  </div>
                  <div className="font-medium">{employee?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs tracking-wider uppercase">
                    Login email
                  </div>
                  <div className="font-medium">{email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs tracking-wider uppercase">
                    Password
                  </div>
                  <div className="font-medium">
                    {password ? "•".repeat(password.length) : "Unchanged"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs tracking-wider uppercase">Role</div>
                  <div className="font-medium">
                    {finalRoleName}{" "}
                    <span className="text-muted-foreground text-xs">({roleMode})</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1.5 text-xs tracking-wider uppercase">
                  Branches
                </div>
                <div className="flex flex-wrap gap-1.5">
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
              </div>
              {roleMode === "custom" && (
                <div className="border-border max-h-[35vh] overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                      <tr>
                        <th className="p-3 text-left">Screen</th>
                        {PERMISSION_ACTIONS.map((a) => (
                          <th key={a} className="p-3 text-center">
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
                                <tr key={id}>
                                  <td className="p-3">
                                    {m.name} › {s.name} ›{" "}
                                    <span className="font-medium">{sc.name}</span>
                                  </td>
                                  {PERMISSION_ACTIONS.map((a) => (
                                    <td key={a} className="p-3 text-center">
                                      {p[a] ? (
                                        <Check className="text-primary mx-auto h-4 w-4" />
                                      ) : (
                                        "—"
                                      )}
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
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < visibleSteps.length - 1 ? (
              <Button
                className="bg-gradient-emerald text-white"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="bg-gradient-emerald text-white" onClick={submit}>
                Submit assignment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
