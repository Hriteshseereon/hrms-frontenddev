import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, Check, ShieldCheck, Building2, MapPin, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { initials } from "@/features/employees/data/employee-directory";
import { useSessionStore } from "@/features/auth/data/session-store";
import { useBranchScope } from "@/features/auth/data/module-access";
import {
  CompanyScopeSelect,
  useCompanyScope,
} from "@/features/organization/components/CompanyScopeSelect";
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";
import { getEmployees } from "@/api/employeeApi";
import Branch_api from "@/api/branch";

/** Unwraps `{ data: [...] }`, `{ items: [...] }` or a bare array. */
function listOf(res) {
  const body = res?.data !== undefined && !Array.isArray(res) ? res.data : res;
  if (Array.isArray(body)) return body;
  for (const key of ["items", "employees", "branches", "roles", "assignments", "data"]) {
    if (Array.isArray(body?.[key])) return body[key];
    if (Array.isArray(body?.data?.[key])) return body.data[key];
  }
  return [];
}

const employeeName = (e) =>
  e.full_name || [e.first_name, e.last_name].filter(Boolean).join(" ") || e.name || e.work_email || e.email || "Employee";

const FIELD_ERROR_KEYS = ["company_id", "employee_id", "role_id", "branch_ids"];

/** 422 → { field: message } using detail[0].loc[1]; other errors → null (shown as a toast). */
function fieldErrorOf(err) {
  const detail = err?.response?.data?.detail;
  if (err?.response?.status !== 422 || !Array.isArray(detail) || !detail.length) return null;
  const field = detail[0]?.loc?.[1];
  return FIELD_ERROR_KEYS.includes(field) ? { [field]: detail[0].msg } : null;
}

export function UserAssignmentTab() {
  const scope = useCompanyScope();
  const { isSuper, companyId } = scope;
  const role = useSessionStore((s) => s.role);
  // Branch Admins and employees get 403 on these endpoints, so they never see the assign UI.
  const canAssign = isSuper || String(role ?? "").toUpperCase() === "COMPANY_ADMIN";
  const allowedBranchIds = useBranchScope();

  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [userSearch, setUserSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [empId, setEmpId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchIds, setBranchIds] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  // Company Admins act inside their own company (the backend reads it from the token); the Super Admin needs a company.
  const needsCompany = isSuper && !companyId;

  const loadAssignments = useCallback(async () => {
    if (!canAssign) return;
    setLoading(true);
    try {
      const res = await rbacApi.getUserRoleAssignments(isSuper && companyId ? { company_id: companyId } : undefined);
      setAssignments(listOf(res));
    } catch (err) {
      setAssignments([]);
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canAssign, isSuper, companyId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Employees, Active roles and branches of the chosen company, for the dialog.
  useEffect(() => {
    if (!canAssign || needsCompany) {
      setEmployees([]);
      setRoles([]);
      setBranches([]);
      return undefined;
    }
    let alive = true;
    const params = isSuper ? { company_id: companyId } : undefined;
    getEmployees({ limit: 100, company_id: isSuper ? companyId : "" })
      .then((res) => alive && setEmployees(listOf(res)))
      .catch(() => alive && setEmployees([]));
    rbacApi
      .getRoles(params)
      .then((res) => alive && setRoles(listOf(res).filter((r) => r.status === "Active")))
      .catch(() => alive && setRoles([]));
    Branch_api.getBranches(isSuper ? companyId : null)
      .then((res) => alive && setBranches(listOf(res)))
      .catch(() => alive && setBranches([]));
    return () => {
      alive = false;
    };
  }, [canAssign, needsCompany, isSuper, companyId]);

  const branchOptions = useMemo(
    () =>
      branches
        .map((b) => ({ id: String(b.id), name: b.name || b.branch_name || b.city || String(b.id) }))
        .filter((b) => !allowedBranchIds || allowedBranchIds.includes(b.id)),
    [branches, allowedBranchIds],
  );
  const chosenBranchIds = useMemo(
    () => Object.keys(branchIds).filter((id) => branchIds[id]),
    [branchIds],
  );

  const filteredAssignments = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      [a.employee_name, a.employee_code, a.email, a.role_name, a.company_name].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [assignments, userSearch]);

  const resetForm = () => {
    setEmpId("");
    setRoleId("");
    setBranchIds({});
    setFieldErrors({});
  };

  const handleAssign = async () => {
    if (!empId || !roleId) {
      toast.error("Please select an employee and a role.");
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      // Empty branch_ids = all branches of the company.
      await rbacApi.assignUserRole({
        employee_id: empId,
        role_id: roleId,
        branch_ids: chosenBranchIds,
        ...(isSuper ? { company_id: companyId } : {}),
      });
      const who = employees.find((e) => String(e.id) === empId);
      const what = roles.find((r) => String(r.id) === roleId);
      toast.success(`Assigned "${what?.name ?? "role"}" to ${who ? employeeName(who) : "employee"}`);
      resetForm();
      setOpen(false);
      loadAssignments();
    } catch (err) {
      const fields = fieldErrorOf(err);
      if (fields) setFieldErrors(fields);
      else toast.error(extractErrorMessage(err)); // 409 "Already assigned", 403, 404
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (a) => {
    if (!window.confirm(`Revoke "${a.role_name}" from ${a.employee_name}?`)) return;
    try {
      await rbacApi.revokeAssignment(a.id);
      setAssignments((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Role assignment revoked.");
    } catch (err) {
      if (err?.response?.status === 404) loadAssignments(); // already gone
      toast.error(extractErrorMessage(err));
    }
  };

  if (!canAssign) {
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-6 text-sm">
          Only the Super Admin and Company Admins can assign roles to employees.
        </CardContent>
      </Card>
    );
  }

  const FieldError = ({ name }) =>
    fieldErrors[name] ? <p className="text-destructive text-xs">{fieldErrors[name]}</p> : null;

  return (
    <div className="space-y-4">
      <Card className="shadow-card overflow-hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="font-semibold">User Role Assignments</div>
            <p className="text-muted-foreground text-sm">
              Assign employees to roles. A role with no branch selected applies to all branches.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CompanyScopeSelect scope={scope} />
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
              <Input
                placeholder="Search assigned users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 w-48 pl-8 text-xs sm:w-64"
              />
            </div>
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-xs text-white"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              <UserPlus className="mr-1.5 h-4 w-4" /> Assign Role to Employee
            </Button>
          </div>
        </CardContent>

        <div className="border-border overflow-x-auto border-t">
          {loading && assignments.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {assignments.length === 0 ? "No roles have been assigned yet." : "No assignments match your search."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Company</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Branches</th>
                  <th className="p-3 text-left">Assigned on</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="border-gold/30 h-8 w-8 border">
                          <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                            {initials(a.employee_name || "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{a.employee_name}</div>
                          <div className="text-muted-foreground text-xs font-normal">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs font-medium">{a.company_name}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary text-xs font-medium"
                      >
                        {a.role_name}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground p-3 text-xs">
                      {a.all_branches ? "All branches" : (a.branch_names ?? []).join(", ")}
                    </td>
                    <td className="text-muted-foreground p-3 text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive h-7 w-7"
                        title="Revoke role assignment"
                        onClick={() => handleRevoke(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary h-5 w-5" /> Assign Role to Employee
            </DialogTitle>
            <DialogDescription>
              Choose the employee, the role and, optionally, the branches it applies to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isSuper && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Building2 className="text-primary h-3.5 w-3.5" /> Company{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={companyId}
                  onValueChange={(val) => {
                    scope.setCompanyId(val);
                    resetForm();
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scope.companies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError name="company_id" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Employee <span className="text-destructive">*</span>
              </Label>
              <Select value={empId} onValueChange={setEmpId} disabled={needsCompany}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder={needsCompany ? "Select a company first" : "Choose an employee..."} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)} className="text-xs">
                      {employeeName(e)} ({[e.employee_code, e.work_email || e.email].filter(Boolean).join(" · ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError name="employee_id" />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="text-primary h-3.5 w-3.5" /> Role <span className="text-destructive">*</span>
              </Label>
              <Select value={roleId} onValueChange={setRoleId} disabled={needsCompany}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError name="role_id" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <MapPin className="text-primary h-3.5 w-3.5" /> Branches{" "}
                  <span className="text-muted-foreground text-[11px] font-normal">
                    (Optional — none selected means all branches)
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => setBranchIds({})}
                >
                  Clear
                </Button>
              </div>
              <div className="bg-muted/20 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                {branchOptions.length === 0 && (
                  <span className="text-muted-foreground text-xs">
                    No branches for this company. The role will apply company-wide.
                  </span>
                )}
                {branchOptions.map((b) => (
                  <label
                    key={b.id}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded p-1 text-xs"
                  >
                    <Checkbox
                      checked={Boolean(branchIds[b.id])}
                      onCheckedChange={(val) => setBranchIds((prev) => ({ ...prev, [b.id]: Boolean(val) }))}
                    />
                    <span className="truncate">{b.name}</span>
                  </label>
                ))}
              </div>
              <FieldError name="branch_ids" />
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-xs text-white"
              onClick={handleAssign}
              disabled={submitting || !empId || !roleId}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserAssignmentTab;
