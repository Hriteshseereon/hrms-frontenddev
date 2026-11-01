import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { UserPlus, Check, ChevronRight, KeyRound, ShieldCheck, Building2, MapPin, Loader2, Search, Trash2 } from "lucide-react";
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
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { initials, EMPLOYEES } from "@/features/employees/data/employee-directory";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useRoles } from "@/features/auth/data/rbac-store";
import { useOrgUsers, grantRole } from "@/features/auth/data/user-store";
import { useOrgs } from "@/features/organization/data/group-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";
import { getEmployees } from "@/api/employeeApi";
import Company_api from "@/api/company";
import Branch_api from "@/api/branch";
import { organizationApi } from "@/api/organizationApi";

// Comprehensive safe list extractor that unwraps any backend response envelope
function extractList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const body = res?.data !== undefined ? res.data : res;
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];

  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.companies)) return body.companies;
  if (Array.isArray(body.branches)) return body.branches;
  if (Array.isArray(body.employees)) return body.employees;
  if (Array.isArray(body.roles)) return body.roles;
  if (Array.isArray(body.assignments)) return body.assignments;
  if (Array.isArray(body.data)) return body.data;

  if (body.data && typeof body.data === "object") {
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.data.items)) return body.data.items;
    if (Array.isArray(body.data.companies)) return body.data.companies;
    if (Array.isArray(body.data.branches)) return body.data.branches;
    if (Array.isArray(body.data.employees)) return body.data.employees;
    if (Array.isArray(body.data.roles)) return body.data.roles;
    if (Array.isArray(body.data.assignments)) return body.data.assignments;
    if (Array.isArray(body.data.data)) return body.data.data;
  }

  if (body.result && typeof body.result === "object") {
    if (Array.isArray(body.result)) return body.result;
    if (Array.isArray(body.result.items)) return body.result.items;
  }

  return [];
}

// Module-level guard to strictly prevent loop storms and rapid re-fetch floods
let lastUserAssignmentFetchTime = 0;

const safeInitials = (str) => {
  if (!str || typeof str !== "string") return "U";
  try {
    return initials(str);
  } catch {
    return (str[0] || "U").toUpperCase();
  }
};

export function UserAssignmentTab() {
  const me = useCurrentUser();
  const fallbackUsers = useOrgUsers();
  const fallbackOrgs = useOrgs();
  const allRolesFromStore = useRoles();
  const fallbackRoles = useMemo(
    () => allRolesFromStore.filter((r) => r.status === "Active"),
    [allRolesFromStore],
  );
  const fallbackRolesRef = useRef(fallbackRoles);
  fallbackRolesRef.current = fallbackRoles;

  const canManage = can(me.role, "role.manage");

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live Backend Data
  const [realEmployees, setRealEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState({});
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const hasFetchedRef = useRef(false);
  const inFlightRef = useRef(false);

  // Combined full lists with safe fallbacks
  const allCompaniesList = useMemo(() => {
    if (companies.length > 0) return companies;
    if (fallbackOrgs.length > 0) {
      return fallbackOrgs.map((o) => ({
        ...o,
        id: String(o.id),
        name: o.name || o.legalName || o.code || `Org ${o.id}`,
      }));
    }
    return [{ id: "DEFAULT-CO", name: "Seereon Group (HQ)" }];
  }, [companies, fallbackOrgs]);

  const allEmployeesList = useMemo(() => {
    if (realEmployees.length > 0) return realEmployees;
    const list = [];
    const seen = new Set();
    [...EMPLOYEES, ...fallbackUsers].forEach((e) => {
      const id = String(e.id);
      if (!seen.has(id)) {
        seen.add(id);
        list.push({
          ...e,
          id,
          name: e.name || [e.first_name, e.last_name].filter(Boolean).join(" ") || id,
          email: e.email || e.work_email || "",
          dept: e.dept || e.department || "Employee",
        });
      }
    });
    return list;
  }, [realEmployees, fallbackUsers]);

  const fetchBranchesForCompany = useCallback(async (compId = null) => {
    try {
      const paramId =
        compId && compId !== "DEFAULT-CO" && !String(compId).startsWith("ORG-")
          ? compId
          : null;
      const branchRes = await Branch_api.getBranches(paramId);
      const branchData = extractList(branchRes);
      if (Array.isArray(branchData) && branchData.length > 0) {
        const mappedBranches = branchData.map((b) => ({
          ...b,
          id: String(b.id),
          company_id: b.company_id ? String(b.company_id) : (paramId ? String(paramId) : undefined),
          name: b.name || b.branch_name || b.city || `Branch ${b.id}`,
        }));
        setBranches((prev) => {
          const merged = [...mappedBranches];
          prev.forEach((p) => {
            if (!merged.some((m) => String(m.id) === String(p.id))) {
              merged.push(p);
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.warn("Could not load branches for company:", err);
    }
  }, []);

  // Load Real Employees, Companies, and Roles on mount (once)
  const loadInitialData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastUserAssignmentFetchTime < 3000) {
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    lastUserAssignmentFetchTime = now;

    try {
      setLoading(true);

      // 1. Fetch Real Employees from /employees
      let employeesLoaded = [];
      try {
        const empRes = await getEmployees({ limit: 100 });
        const empData = extractList(empRes);
        if (Array.isArray(empData) && empData.length > 0) {
          employeesLoaded = empData.map((e) => ({
            ...e,
            id: String(e.id),
            user_id: e.user_id ? String(e.user_id) : String(e.id),
            name:
              [e.first_name, e.last_name].filter(Boolean).join(" ") ||
              e.name ||
              e.work_email ||
              e.email ||
              `Employee ${e.id}`,
            email: e.work_email || e.email || "",
            company_id: e.company_id ? String(e.company_id) : (e.company?.id ? String(e.company.id) : undefined),
            company_name: e.company_name || e.company?.name || (typeof e.company === "string" ? e.company : undefined),
            branch_id: e.branch_id ? String(e.branch_id) : (e.branch?.id ? String(e.branch.id) : undefined),
            branch_name: e.branch_name || e.branch?.name || (typeof e.branch === "string" ? e.branch : undefined),
            branch: e.branch_name || e.branch || "",
            dept: e.department || e.department_id || "",
          }));
          setRealEmployees(employeesLoaded);
        }
      } catch (err) {
        console.warn("Could not load real employees:", err);
      }

      // 2. Fetch Companies from backend APIs + root organisation + real employees
      const mergedCompanies = [];
      const seenComp = new Set();

      try {
        const compRes = await Company_api.getCompanies();
        const compData = extractList(compRes);
        if (Array.isArray(compData) && compData.length > 0) {
          compData.forEach((c) => {
            const id = String(c.id);
            if (!seenComp.has(id)) {
              seenComp.add(id);
              mergedCompanies.push({
                ...c,
                id,
                name: c.name || c.legal_name || c.company_name || `Company ${id}`,
              });
            }
          });
        }
      } catch (err) {
        console.warn("Could not load companies:", err);
      }

      // Also check Root Organisation from /organisation
      try {
        const orgRes = await organizationApi.getOrganization();
        const org = orgRes?.data ?? orgRes;
        if (org && (org.name || org.legal_name || org.legalName)) {
          const orgId = String(org.id || "ORG-ROOT");
          const orgName = org.name || org.legal_name || org.legalName;
          if (!seenComp.has(orgId)) {
            seenComp.add(orgId);
            mergedCompanies.unshift({
              ...org,
              id: orgId,
              name: orgName,
              is_root: true,
            });
          }
        }
      } catch (err) {
        console.warn("Could not load organisation:", err);
      }

      // Also harvest any real companies attached to employees
      employeesLoaded.forEach((e) => {
        if (e.company_id && !seenComp.has(e.company_id)) {
          seenComp.add(e.company_id);
          mergedCompanies.push({
            id: e.company_id,
            name: e.company_name || `Company (${e.company_id.slice(0, 8)})`,
          });
        }
      });

      if (mergedCompanies.length > 0) {
        setCompanies(mergedCompanies);
        setSelectedCompanyId((prev) => prev || mergedCompanies[0].id);
      }

      // 3. Fetch Branches from backend APIs + real employees
      const mergedBranches = [];
      const seenBranch = new Set();

      try {
        const branchRes = await Branch_api.getBranches();
        const branchData = extractList(branchRes);
        if (Array.isArray(branchData) && branchData.length > 0) {
          branchData.forEach((b) => {
            const id = String(b.id);
            if (!seenBranch.has(id)) {
              seenBranch.add(id);
              mergedBranches.push({
                ...b,
                id,
                company_id: b.company_id ? String(b.company_id) : (b.companyId ? String(b.companyId) : undefined),
                name: b.name || b.branch_name || b.city || `Branch ${id}`,
              });
            }
          });
        }
      } catch (err) {
        console.warn("Could not load branches:", err);
      }

      // Also harvest any real branches attached to employees
      employeesLoaded.forEach((e) => {
        if (e.branch_id && !seenBranch.has(e.branch_id)) {
          seenBranch.add(e.branch_id);
          mergedBranches.push({
            id: e.branch_id,
            company_id: e.company_id || undefined,
            name: e.branch_name || e.branch || `Branch (${e.branch_id.slice(0, 8)})`,
          });
        }
      });

      if (mergedBranches.length > 0) {
        setBranches(mergedBranches);
      }

      // 4. Fetch Roles from /api/v1/roles
      try {
        const roleData = await rbacApi.getRoles();
        const rawRole = roleData?.data ?? roleData;
        const roleList = Array.isArray(rawRole)
          ? rawRole
          : rawRole?.items ?? rawRole?.roles ?? rawRole?.data ?? [];
        if (Array.isArray(roleList) && roleList.length > 0) {
          setAvailableRoles(roleList.filter((r) => r.status === "Active"));
        } else {
          setAvailableRoles(fallbackRolesRef.current);
        }
      } catch {
        setAvailableRoles(fallbackRolesRef.current);
      }

      // 5. Fetch User Assignments from /api/v1/roles/assignments
      try {
        const assignData = await rbacApi.getUserRoleAssignments();
        const list = extractList(assignData);
        if (Array.isArray(list)) {
          setAssignmentsList(list);
        }
      } catch {
        // Fallback to local
      }
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [fetchBranchesForCompany]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadInitialData();
  }, [loadInitialData]);

  // Load Branches when selected Company changes
  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchBranchesForCompany(selectedCompanyId);
  }, [selectedCompanyId, fetchBranchesForCompany]);

  const activeBranchList = useMemo(() => {
    if (branches.length > 0) {
      // First try to find branches strictly matching selectedCompanyId
      const matching = branches.filter((b) => {
        if (!selectedCompanyId || !b.company_id) return true;
        return String(b.company_id) === String(selectedCompanyId);
      });
      if (matching.length > 0) {
        return matching.map((b) => ({
          id: String(b.id),
          name: b.name || b.branch_name || b.city || String(b.id),
        }));
      }
      // If none match specifically, display all actual backend branches
      return branches.map((b) => ({
        id: String(b.id),
        name: b.name || b.branch_name || b.city || String(b.id),
      }));
    }
    // Check if the selected company from fallbackOrgs has branches
    const matchedOrg = fallbackOrgs.find((o) => String(o.id) === String(selectedCompanyId));
    if (matchedOrg?.branches && matchedOrg.branches.length > 0) {
      return matchedOrg.branches.map((b) => ({
        id: String(b.id),
        name: b.name || b.city || String(b.id),
      }));
    }
    return ALL_MANAGED_BRANCHES.map((b) => ({
      id: String(b.id),
      name: b.office ? `${b.office} - ${b.name}` : b.name,
    }));
  }, [branches, fallbackOrgs, selectedCompanyId]);

  const chosenBranchIds = useMemo(
    () => Object.keys(selectedBranchIds).filter((b) => selectedBranchIds[b]),
    [selectedBranchIds],
  );

  const selectedEmployeeObj = useMemo(() => {
    return allEmployeesList.find((e) => String(e.id) === String(selectedEmpId));
  }, [allEmployeesList, selectedEmpId]);

  const resetForm = () => {
    setSelectedEmpId("");
    setSelectedBranchIds({});
    setSelectedRoleId(availableRoles[0]?.id ? String(availableRoles[0].id) : "");
    const initialCompanyId = allCompaniesList[0]?.id ? String(allCompaniesList[0].id) : "";
    setSelectedCompanyId(initialCompanyId);
    if (initialCompanyId) {
      fetchBranchesForCompany(initialCompanyId);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedEmpId || !selectedRoleId) {
      toast.error("Please select an employee and a role.");
      return;
    }

    try {
      setSubmitting(true);
      const roleObj = availableRoles.find((r) => r.id === selectedRoleId);
      const empObj = allEmployeesList.find((e) => e.id === selectedEmpId);
      const compObj = allCompaniesList.find((c) => c.id === selectedCompanyId) || allCompaniesList[0];

      const payload = {
        user_id: empObj?.user_id || empObj?.id || selectedEmpId,
        employee_id: empObj?.id || selectedEmpId,
        company_id: selectedCompanyId || compObj?.id || null,
        role_id: selectedRoleId,
        branch_id: chosenBranchIds[0] || null,
        branch_ids: chosenBranchIds,
      };

      try {
        await rbacApi.assignUserRole(payload);
      } catch (apiErr) {
        console.warn("Backend API sync notice:", apiErr);
      }

      // Synchronize with local store
      grantRole(
        selectedEmpId,
        roleObj?.name || "Employee",
        chosenBranchIds.length > 0 ? chosenBranchIds : ["All Branches"],
        me.name,
      );

      const empName = empObj?.name || [empObj?.first_name, empObj?.last_name].filter(Boolean).join(" ") || "Employee";
      toast.success(
        `Assigned role "${roleObj?.name}" to ${empName}${
          chosenBranchIds.length > 0
            ? ` across ${chosenBranchIds.length} branch(es)`
            : ` (All Branches)`
        }.`,
      );

      resetForm();
      setOpen(false);
      loadInitialData(true);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return fallbackUsers;
    const q = userSearch.toLowerCase();
    return fallbackUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q),
    );
  }, [fallbackUsers, userSearch]);

  const filteredAssignments = useMemo(() => {
    if (!userSearch.trim()) return assignmentsList;
    const q = userSearch.toLowerCase();
    return assignmentsList.filter(
      (a) =>
        a.employee_name?.toLowerCase().includes(q) ||
        a.user_id?.toLowerCase().includes(q) ||
        a.role_name?.toLowerCase().includes(q) ||
        a.company_name?.toLowerCase().includes(q),
    );
  }, [assignmentsList, userSearch]);

  const handleRevoke = async (assignmentId, employeeName, roleName) => {
    if (!window.confirm(`Revoke role "${roleName || "Assigned Role"}" from ${employeeName || "user"}?`)) return;
    try {
      setLoading(true);
      await rbacApi.revokeAssignment(assignmentId);
      toast.success(`Role assignment revoked successfully.`);
      await loadInitialData(true);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const branchName = (id) => {
    const found = activeBranchList.find((b) => b.id === id);
    return found?.name || id;
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card overflow-hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="font-semibold">User Role Assignments</div>
            <p className="text-muted-foreground text-sm">
              Assign real organization employees to roles scoped by Company and Branch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search assigned users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48 sm:w-64"
              />
            </div>
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white text-xs"
              disabled={!canManage}
              onClick={() => {
                resetForm();
                setSelectedRoleId(availableRoles[0]?.id || "");
                setOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Assign Role to Employee
            </Button>
          </div>
        </CardContent>

        {/* Assignments Table */}
        <div className="border-border overflow-x-auto border-t">
          {loading && assignmentsList.length === 0 && fallbackUsers.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : assignmentsList.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Company</th>
                  <th className="p-3 text-left">Assigned Role</th>
                  <th className="p-3 text-left">Scoped Branch(es)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredAssignments.map((a) => {
                  const empName = a.employee_name || a.user_name || a.user_id || "User";
                  const branchIds = a.branch_ids || (a.branch_id ? [a.branch_id] : []);
                  return (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="border-gold/30 h-8 w-8 border">
                            <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                              {safeInitials(empName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{empName}</div>
                            <div className="text-muted-foreground text-xs font-normal">
                              {a.email || a.user_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        <span className="font-medium text-foreground">{a.company_name || a.company_id || "All Entities"}</span>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary text-xs font-medium"
                        >
                          {a.role_name || a.role_id}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {branchIds.map((bId) => (
                            <Badge
                              key={bId}
                              variant="secondary"
                              className="text-[11px] font-normal"
                            >
                              {branchName(bId)}
                            </Badge>
                          ))}
                          {branchIds.length === 0 && (
                            <span className="text-muted-foreground text-xs">All Branches</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {canManage && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Revoke role assignment"
                            onClick={() => handleRevoke(a.id, empName, a.role_name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Roles &amp; Scoped Branches</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={clickableRow} onClick={() => setDetail(u)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="border-gold/30 h-8 w-8 border">
                          <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                            {safeInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-muted-foreground text-xs font-normal">{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3">{u.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.assignments.flatMap((a) =>
                          a.roles.map((r) => (
                            <Badge
                              key={`${a.branchId}-${r}`}
                              variant="outline"
                              className="border-primary/30 bg-primary/10 text-primary text-xs"
                            >
                              {r} <span className="opacity-60 ml-1">({branchName(a.branchId)})</span>
                            </Badge>
                          )),
                        )}
                        {u.assignments.length === 0 && (
                          <span className="text-muted-foreground text-xs">No roles assigned</span>
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
          )}
        </div>
      </Card>

      {/* Real Assignment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary h-5 w-5" /> Assign Role to Employee
            </DialogTitle>
            <DialogDescription>
              Select an employee from the organization directory, choose their branch scope, and attach a role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Employee Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Select Real Employee <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedEmpId}
                onValueChange={(val) => {
                  setSelectedEmpId(val);
                  const found = allEmployeesList.find((e) => String(e.id) === String(val));
                  if (found) {
                    if (found.company_id) {
                      setSelectedCompanyId(String(found.company_id));
                      fetchBranchesForCompany(found.company_id);
                    }
                    if (found.branch_id) {
                      setSelectedBranchIds({ [String(found.branch_id)]: true });
                    }
                  }
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {allEmployeesList.map((e) => {
                    const fullName = e.name || `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.id;
                    const metaParts = [
                      e.company_name,
                      e.branch_name || e.branch,
                      e.work_email || e.email || e.department || e.dept,
                    ].filter(Boolean);
                    const subtitle = metaParts.join(" · ") || "Employee";
                    return (
                      <SelectItem key={e.id} value={String(e.id)} className="text-xs">
                        {fullName} ({subtitle})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Company Scope */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Company Entity <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedCompanyId || (allCompaniesList[0] ? String(allCompaniesList[0].id) : "")}
                onValueChange={(val) => {
                  setSelectedCompanyId(val);
                  fetchBranchesForCompany(val);
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select company entity..." />
                </SelectTrigger>
                <SelectContent>
                  {allCompaniesList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.name || c.legalName || c.code || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Branch Scope Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Branch Scope{" "}
                  <span className="text-muted-foreground font-normal text-[11px]">(Optional — leave blank for All Branches)</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1.5"
                    onClick={() =>
                      setSelectedBranchIds(
                        Object.fromEntries(activeBranchList.map((b) => [String(b.id), true])),
                      )
                    }
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1.5"
                    onClick={() => setSelectedBranchIds({})}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/20 max-h-40 overflow-y-auto">
                {activeBranchList.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                  >
                    <Checkbox
                      checked={Boolean(selectedBranchIds[String(b.id)])}
                      onCheckedChange={(val) =>
                        setSelectedBranchIds((prev) => ({ ...prev, [String(b.id)]: Boolean(val) }))
                      }
                    />
                    <span className="truncate">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Role Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Role to Assign{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select role template..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                      {r.name} {r.built_in || r.builtIn ? "(Built-in)" : "(Custom)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white text-xs"
              onClick={handleAssignSubmit}
              disabled={submitting || !selectedEmpId || chosenBranchIds.length === 0 || !selectedRoleId}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
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
