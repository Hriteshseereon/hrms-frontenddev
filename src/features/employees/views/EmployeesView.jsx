import { createEmployee as createEmployeeApi, getEmployees, getEmployeeById } from "@/api/employeeApi";
import { useSearch } from "@/lib/navigation";
import { captureFiles } from "@/lib/attachments";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSessionStore, canCreateEmployee } from "@/features/auth/data/session-store";
import { EditEmployeeDialog } from "@/features/employees/components/EditEmployeeDialog";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";
import Branch_api from "@/api/branch";
import departmentApi from "@/api/departmentApi";
import designationApi from "@/api/designationApi";
import {
  Users,
  CalendarDays,
  Search,
  Download,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  User,
  Briefcase,
  FileText,
  Landmark,
  Building2,
  Upload,
  Trash2,
  IdCard,
  GraduationCap,
  Link2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PromotionsTab } from "@/features/employees/components/PromotionsTab";
import { TransfersTab } from "@/features/employees/components/TransfersTab";
import { ResignationsTab } from "@/features/employees/components/ResignationsTab";
import { TerminationsTab } from "@/features/employees/components/TerminationsTab";
import { WarningsTab } from "@/features/employees/components/WarningsTab";
import { ComplaintsTab } from "@/features/employees/components/ComplaintsTab";
import { ReferralsTab } from "@/features/employees/components/ReferralsTab";
import { InsuranceTab } from "@/features/employees/components/InsuranceTab";
import { RetirementTab } from "@/features/employees/components/RetirementTab";
import { OFFICES } from "@/features/employees/data/hr-data";
import { PAY_COMPONENTS } from "@/features/organization/data/master-data";
import { useSharedList } from "@/lib/shared-list";
import {
  useDirectory,
  findEmployee,
  updateBankDetails,
  updatePersonalDetails,
  updateStatutoryIds,
} from "@/features/employees/data/employee-directory";
import { allUsers, can, hireableRoles, useCurrentUser } from "@/features/auth/data/auth-session";
import { hrPartnerOptions, setHrPartner } from "@/features/organization/data/hr-partner";
import { hireEmployee, validateHireInput } from "@/features/recruitment/data/hiring-data";
import { useDepartments } from "@/features/organization/data/dept-data";
import { useDesignationNames } from "@/features/employees/data/hr-data";
import { setManager } from "@/features/organization/data/manager-data";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { exportCsv } from "@/lib/export-utils";
import { inr } from "@/lib/store";
import { EmployeeDetail } from "@/features/employees/components/EmployeeDetail";
import { EmployeeLeaveSheet } from "@/features/leave/components/LeavePieces";
import { HireEmployeeDialog } from "@/features/employees/components/HireEmployeeDialog";
import { useScope, useScopeMatch } from "@/features/organization/data/tenancy";

function Employees() {
  const { id: presetId } = useSearch(validateSearch);
  const [openAdd, setOpenAdd] = useState(false);
  const [picked, setPicked] = useState(null);
  const setSelected = setPicked;
  // Global search / deep links open a record directly: /org/employees?id=SRN-0006
  useEffect(() => {
    if (presetId) {
      const e = findEmployee(presetId);
      if (e) {
        setPicked(e);
      } else {
        getEmployeeById(presetId)
          .then((emp) => {
            if (emp) setPicked(emp);
          })
          .catch((err) => {
            console.warn("Could not find employee for presetId:", err);
          });
      }
    }
  }, [presetId]);
  const [leaveFor, setLeaveFor] = useState(null);
  const orgId = useActiveOrgId();
  const inScope = useScopeMatch();
  const collective = useScope().readOnly;
  const me = useCurrentUser();
  const session = useSessionStore();
  const roleUpper = String(session.role || me?.role || "").toUpperCase();
  const isEmployeeRole = roleUpper === "EMPLOYEE";
  const canManagePeople = (can(me.role, "employee.manage") || canCreateEmployee(session.role)) && !isEmployeeRole;
  const orgName = useOrgs().find((o) => o.id === orgId)?.name ?? "Organization";
  const directory = useDirectory();
  // Always show the live record — the dialog kept the row captured at click time, so a promotion / transfer made from
  // the record's own tabs left the header showing the old designation and branch until it was reopened.
  // A deep link (?id=…) or global-search hit opens a record only inside the working scope — the URL used to open any
  // employee of any company or organisation.
  const pickedLive = picked ? (directory.find((e) => e.id === picked.id) ?? picked) : null;
  const selected = pickedLive;
  /** Row selection — the Export button exports the selection when one exists, otherwise the filtered list. */
  const [checked, setChecked] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [designation, setDesignation] = useState("all");
  const [office, setOffice] = useState("all");
  const [status, setStatus] = useState("all");

  // Backend API Pagination & Data State
  const [backendEmployees, setBackendEmployees] = useState(null);
  const [backendTotal, setBackendTotal] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loadingList, setLoadingList] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Debounce search query by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // Fetch employees from backend API
  const fetchBackendEmployees = useCallback(async () => {
    setLoadingList(true);
    setApiError(null);
    try {
      const res = await getEmployees({
        page,
        limit,
        search: debouncedQ,
        status: status !== "all" ? status : undefined,
        branch_id: office !== "all" ? office : undefined,
        department_id: designation !== "all" ? designation : undefined,
      });

      if (res && Array.isArray(res.items)) {
        const mapped = res.items.map((e) => ({
          ...e,
          id: e.id,
          user_id: e.user_id,
          name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.name || e.work_email,
          email: e.work_email || e.email,
          phone: e.phone || "—",
          dept: e.department || e.department_id || "—",
          role: e.designation || e.role || "—",
          branch: e.branch_name || e.branch || "—",
          status: e.status || (e.is_active ? "Active" : "Inactive"),
        }));
        setBackendEmployees(mapped);
        setBackendTotal(res.total ?? mapped.length);
      } else if (Array.isArray(res)) {
        setBackendEmployees(res);
        setBackendTotal(res.length);
      } else {
        setBackendEmployees([]);
        setBackendTotal(0);
      }
    } catch (err) {
      console.warn("Backend getEmployees request failed:", err);
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        "Could not load employees from backend.";
      setApiError(String(detail));
      setBackendEmployees(null);
      setBackendTotal(null);
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, debouncedQ, status, office, designation]);

  useEffect(() => {
    fetchBackendEmployees();
  }, [fetchBackendEmployees]);

  const orgEmployees = useMemo(
    // Working scope: all companies (collective view), one company, or one branch.
    () => directory.filter((e) => inScope(e.orgId, null, e.branch)),
    [directory, inScope],
  );

  const fallbackRows = useMemo(
    () =>
      orgEmployees.filter((e) => {
        const t = q.trim().toLowerCase();
        if (t && !`${e.name} ${e.id} ${e.email} ${e.dept} ${e.role}`.toLowerCase().includes(t))
          return false;
        if (designation !== "all" && e.role !== designation) return false;
        if (office !== "all" && e.branch !== office) return false;
        if (status !== "all" && e.status !== status) return false;
        return true;
      }),
    [orgEmployees, q, designation, office, status],
  );

  const rows = backendEmployees !== null ? backendEmployees : fallbackRows;
  const total = backendTotal !== null ? backendTotal : fallbackRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const branches = new Set(orgEmployees.map((e) => e.branch)).size;
  const departments = new Set(orgEmployees.map((e) => e.dept)).size;
  const designations = useMemo(
    () => Array.from(new Set(orgEmployees.map((e) => e.role))).sort(),
    [orgEmployees],
  );
  const offices = useMemo(
    () => Array.from(new Set(orgEmployees.map((e) => e.branch))).sort(),
    [orgEmployees],
  );
  const chosen = rows.filter((e) => checked.has(e.id));
  const allChecked = rows.length > 0 && chosen.length === rows.length;
  const toggleAll = (on) => setChecked(on ? new Set(rows.map((e) => e.id)) : new Set());
  const toggleOne = (id, on) =>
    setChecked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const exportList = () => {
    const list = chosen.length ? chosen : rows;
    exportCsv(
      "employees",
      ["Emp ID", "Name", "Email", "Phone", "Department", "Designation", "Office", "Status"],
      list.map((e) => [e.id, e.name, e.email, e.phone, e.dept, e.role, e.branch, e.status]),
    );
    toast.success(`${list.length} employees exported`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary h-6 w-6" /> Employees
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {orgEmployees.length} employees · {branches} branch{branches === 1 ? "" : "es"} ·{" "}
            {departments} departments · {orgName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            <Download className="h-4 w-4" /> Export
            {chosen.length ? ` (${chosen.length} selected)` : ""}
          </Button>
          {/* Creating people needs employee.manage (custom roles can open this screen without it); the Super Admin's
              collective view keeps Hire, which asks for the company itself. */}
          {canManagePeople && <HireEmployeeDialog />}
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            {canManagePeople && (
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                  <Plus className="h-4 w-4" /> Add Employee (Detailed Form)
                </Button>
              </DialogTrigger>
            )}
            <AddEmployeeDialog onClose={() => setOpenAdd(false)} onCreated={() => fetchBackendEmployees()} />
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all">
        <ScrollTabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="resignations">Resignations</TabsTrigger>
          <TabsTrigger value="terminations">Terminations</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="retirement">Retirement</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="all" className="space-y-6 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                  placeholder="Search by name, ID, email, department…"
                  className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Select
                value={designation}
                onValueChange={(v) => {
                  setDesignation(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All designations</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={office}
                onValueChange={(v) => {
                  setOffice(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["Active", "On Leave", "Notice", "Inactive", "Suspended"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fetchBackendEmployees()}
                title="Refresh employee list from backend"
                disabled={loadingList}
              >
                <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
              </Button>
              <div className="text-muted-foreground ml-auto text-xs">
                Showing {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="w-10 p-3 text-left">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Select all employees in view"
                      />
                    </th>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Contact</th>
                    <th className="p-3 text-left">Department</th>
                    <th className="p-3 text-left">Designation</th>
                    <th className="p-3 text-left">Office</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="w-10 p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {loadingList ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-muted-foreground text-sm font-medium">
                            Loading employees from HRMS backend…
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : apiError ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                          <AlertCircle className="h-6 w-6" />
                          <p className="text-sm font-semibold">{apiError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchBackendEmployees()}
                            className="mt-2 text-xs"
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-semibold text-sm">No employees match the current filters.</p>
                          <p className="text-muted-foreground text-xs">
                            Try adjusting search keywords or clearing status/office filters.
                          </p>
                          {(q || status !== "all" || office !== "all" || designation !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => {
                                setQ("");
                                setStatus("all");
                                setOffice("all");
                                setDesignation("all");
                                setPage(1);
                              }}
                            >
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className="hover:bg-muted/30 cursor-pointer transition"
                      >
                        <td className="p-3" onClick={(ev) => ev.stopPropagation()}>
                          <Checkbox
                            checked={checked.has(e.id)}
                            onCheckedChange={(v) => toggleOne(e.id, v === true)}
                            aria-label={`Select ${e.name}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="border-gold/30 h-9 w-9 border">
                              <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                                {e.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold">{e.name}</div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span title="Employee Profile ID">Emp ID: {e.id}</span>
                                {e.user_id && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1 border-muted text-muted-foreground"
                                    title="Login User Account ID"
                                  >
                                    User: {e.user_id.slice(0, 8)}…
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" /> {e.email}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" /> {e.phone}
                          </div>
                        </td>
                        <td className="p-3">{e.dept}</td>
                        <td className="p-3">{e.role}</td>
                        <td className="text-muted-foreground p-3">{e.branch}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              e.status === "Active"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : e.status === "Notice"
                                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                                  : "border-gold/30 bg-gold/10 text-gold"
                            }
                          >
                            {e.status}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setLeaveFor(e.id)}
                              aria-label={`Leave record of ${e.name}`}
                            >
                              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Leave
                            </Button>
                            {canManagePeople && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary font-medium"
                                onClick={() => setEditingEmployee(e)}
                                aria-label={`Edit ${e.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelected(e)}
                              aria-label={`View ${e.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="border-t bg-muted/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-medium text-foreground">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{" "}
                <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span> employees
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Rows per page:</span>
                  <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                      setLimit(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[68px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1 || loadingList}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages || loadingList}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="promotions" className="pt-4">
          <PromotionsTab />
        </TabsContent>
        <TabsContent value="transfers" className="pt-4">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="resignations" className="pt-4">
          <ResignationsTab />
        </TabsContent>
        <TabsContent value="terminations" className="pt-4">
          <TerminationsTab />
        </TabsContent>
        <TabsContent value="warnings" className="pt-4">
          <WarningsTab />
        </TabsContent>
        <TabsContent value="complaints" className="pt-4">
          <ComplaintsTab />
        </TabsContent>
        <TabsContent value="referrals" className="pt-4">
          <ReferralsTab />
        </TabsContent>
        <TabsContent value="insurance" className="pt-4">
          <InsuranceTab />
        </TabsContent>
        <TabsContent value="retirement" className="pt-4">
          <RetirementTab />
        </TabsContent>
      </Tabs>

      <EmployeeLeaveSheet empId={leaveFor} onClose={() => setLeaveFor(null)} />

      {/* Details Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.name} — Employee record</DialogTitle>
            <DialogDescription>
              Complete employee profile, payroll, attendance, performance and training details.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <EmployeeDetail
              employee={selected}
              onEdit={() => setEditingEmployee(selected)}
              onUpdated={() => fetchBackendEmployees()}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      {editingEmployee && (
        <EditEmployeeDialog
          open={!!editingEmployee}
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onUpdated={(updated) => {
            fetchBackendEmployees();
            if (selected?.id === updated?.id) {
              setSelected((prev) => ({ ...prev, ...updated }));
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Add Employee — multi-tab premium form
// ============================================================

function FieldRow({ children }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}


/** `name` is the multipart field name sent to the backend (see POST /employees/form). */
function FileUpload({ label, hint, name, file, onSelect, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">{label}</Label>
      <label className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 transition">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-gradient-emerald grid h-8 w-8 shrink-0 place-items-center rounded-md text-white">
            <Upload className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{file?.name ?? "Click to upload"}</div>
            <div className="text-muted-foreground text-[11px]">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Selected`
                : (hint ?? "PDF, JPG, PNG · max 5 MB")}
            </div>
          </div>
        </div>
        {file ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (inputRef.current) inputRef.current.value = "";
              if (onRemove) onRemove(name);
            }}
            className="text-muted-foreground hover:text-destructive p-1 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
            Upload
          </Badge>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5 * 1024 * 1024) {
                toast.error(`${f.name} exceeds maximum size of 5 MB`);
                if (inputRef.current) inputRef.current.value = "";
                return;
              }
              if (onSelect) onSelect(name, f);
            }
          }}
        />
      </label>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <div className="bg-gradient-emerald grid h-9 w-9 place-items-center rounded-lg text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground text-xs">{desc}</div>
      </div>
    </div>
  );
}

function PrevEmploymentBlock({ index, onRemove }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Employer #{index}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={!onRemove}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
        <FieldRow>
          <Field label="Company Name" required>
            <Input name={`prev${index}_company`} placeholder="e.g. Infosys Ltd." />
          </Field>
          <Field label="Designation" required>
            <Input name={`prev${index}_role`} placeholder="e.g. Senior Engineer" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="From">
            <Input name={`prev${index}_from`} type="month" />
          </Field>
          <Field label="To">
            <Input name={`prev${index}_to`} type="month" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="CTC (Annual)">
            <Input name={`prev${index}_ctc`} placeholder="₹\u00A012,00,000" />
          </Field>
          <Field label="Reason for Leaving">
            <Input name={`prev${index}_reason`} placeholder="Career growth" />
          </Field>
        </FieldRow>
        <Separator />
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Documents
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FileUpload label="Relieving Letter" />
          <FileUpload label="Experience / Service Letter" />
          <FileUpload label="Payslip — Last Month" />
          <FileUpload label="Payslip — 2 Months Ago" />
          <FileUpload label="Payslip — 3 Months Ago" />
          <FileUpload label="Form 16 (Optional)" />
        </div>
      </CardContent>
    </Card>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (x) => typeof x === "string" && UUID_RE.test(x);

/** Random temp password containing upper, lower, digit and symbol. */
function makeTempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$!%*"];
  const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const all = sets.join("");
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 12) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function AddEmployeeDialog({ onClose, onCreated }) {
  const me = useCurrentUser();
  const session = useSessionStore();
  const {
    userId: sessionUserId,
    role: sessionRole,
    organizationId: sessionOrgId,
    companyId: sessionCompanyId,
    branchId: sessionBranchId,
  } = session;

  const roleUpper = String(sessionRole || me?.backendRole || me?.role || "").toUpperCase();
  const isSuperAdmin = roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN";
  const isCompanyAdmin = roleUpper === "COMPANY_ADMIN";
  const isBranchAdmin = roleUpper === "BRANCH_ADMIN" || roleUpper === "BRANCHADMIN";
  const isEmployee = roleUpper === "EMPLOYEE";

  const [tab, setTab] = useState("personal");
  const [prevJobs, setPrevJobs] = useState([1]);
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const orgId = useActiveOrgId();

  // Scope selection states
  const [backendCompanies, setBackendCompanies] = useState([]);
  const [backendBranches, setBackendBranches] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(sessionCompanyId || "");
  const [selectedBranchId, setSelectedBranchId] = useState(sessionBranchId || "");
  const [loadingScope, setLoadingScope] = useState(false);

  // Document files state
  const [docFiles, setDocFiles] = useState({});
  const handleDocSelect = (name, file) => setDocFiles((prev) => ({ ...prev, [name]: file }));
  const handleDocRemove = (name) =>
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

  // Load backend companies (for SuperAdmin) and branches (for selected/assigned company)
  useEffect(() => {
    let isMounted = true;
    async function loadScope() {
      setLoadingScope(true);
      try {
        if (isSuperAdmin) {
          const res = await SuperAdmin_auth.getCompanies();
          const data = res?.data ?? res;
          const list = Array.isArray(data) ? data : data?.items ?? data?.companies ?? [];
          if (isMounted) setBackendCompanies(list);
        }

        const compIdForBranches = isSuperAdmin ? selectedCompanyId : sessionCompanyId;
        if (compIdForBranches && isUuid(compIdForBranches)) {
          const bRes = await Branch_api.getBranches(compIdForBranches);
          const bData = bRes?.data ?? bRes;
          const bList = Array.isArray(bData) ? bData : bData?.items ?? bData?.branches ?? [];
          if (isMounted) setBackendBranches(bList);
        } else {
          if (isMounted) setBackendBranches([]);
        }
      } catch (err) {
        console.warn("Failed to load backend scope options:", err);
      } finally {
        if (isMounted) setLoadingScope(false);
      }
    }
    loadScope();
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, selectedCompanyId, sessionCompanyId]);

  const orgBranchList = useOrgs().find((o) => o.id === orgId)?.branches ?? [];
  const orgBranches = orgBranchList.map((b) => b.name);
  const branchOptions = orgBranches.length ? orgBranches : OFFICES;
  const orgDepartments = useDepartments().filter((d) => d.orgId === orgId);
  const deptOptions = orgDepartments.map((d) => d.name);
  const designationOptions = useDesignationNames(orgId);
  const jobDepartmentOptions = deptOptions.length
    ? deptOptions
    : ["Human Resources", "Engineering", "Finance", "Operations"];
  const jobDesignationOptions = designationOptions.length
    ? designationOptions
    : ["HR Executive", "Software Engineer", "Accountant", "Operations Manager"];
  const reportingManagerOptions = allUsers().filter(
    (u) =>
      u.orgId === orgId &&
      u.role !== "BranchAdmin" &&
      u.role !== "Employee" &&
      u.role !== "Admin" &&
      u.role !== "SuperAdmin",
  );
  const jobReportingManagerOptions = reportingManagerOptions.length
    ? reportingManagerOptions
    : [
        { id: "demo-manager-1", orgId, role: "Manager", name: "Aarav Sharma", designation: "Engineering Manager" },
        { id: "demo-manager-2", orgId, role: "Manager", name: "Priya Patel", designation: "HR Manager" },
        { id: "demo-manager-3", orgId, role: "Manager", name: "Rahul Verma", designation: "Finance Manager" },
        { id: "demo-manager-4", orgId, role: "Manager", name: "Ananya Rao", designation: "Operations Manager" },
      ];

  const [payComponents] = useSharedList("pay-components", PAY_COMPONENTS);
  const [ctcDraft, setCtcDraft] = useState(0);
  const monthlyGross = Math.round(ctcDraft / 12);
  const basic = Math.round(monthlyGross * 0.4);
  const deductions = Math.round(basic * 0.12) + 200 + 850 + Math.round(monthlyGross * 0.08);

  /** Reads the form, validates it, creates the employee through the backend API, then mirrors it in the local store. */
  async function create() {
    const root = formRef.current;
    if (!root || submittingRef.current) return;

    if (isEmployee) {
      toast.error("Employees are not authorized to create or onboard employees.");
      return;
    }

    const v = {};
    root.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "file") return;
      v[el.name] = el.value;
    });

    const required = [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["dob", "Date of birth"],
      ["personalEmail", "Personal email"],
      ["phone", "Mobile number"],
      ["doj", "Date of joining"],
      ["dept", "Department"],
      ["designation", "Designation"],
      ["ctc", "Annual CTC"],
    ];
    const missing = required.filter(([k]) => !v[k]?.trim()).map(([, l]) => l);
    if (missing.length) {
      toast.error(`Complete the required fields: ${missing.join(", ")}`);
      setTab(
        missing.some((m) =>
          ["First name", "Last name", "Date of birth", "Personal email", "Mobile number"].includes(m),
        )
          ? "personal"
          : "job",
      );
      return;
    }

    const fail = (msg, t) => {
      toast.error(msg);
      setTab(t);
    };

    const pan = (v.pan ?? "").trim().toUpperCase();
    const aadhaar = (v.aadhaar ?? "").replace(/\s+/g, "");
    const uan = (v.uan ?? "").replace(/\s+/g, "");
    const acct = (v.accountNo ?? "").replace(/\s+/g, "");
    const ifsc = (v.ifsc ?? "").trim().toUpperCase();

    if (aadhaar && !/^\d{12}$/.test(aadhaar)) return fail("Aadhaar number must be 12 digits", "legal");
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))
      return fail("PAN must be in the format ABCDE1234F", "legal");
    if (uan && !/^\d{12}$/.test(uan)) return fail("UAN must be 12 digits", "legal");
    if (acct && !/^\d{9,18}$/.test(acct)) return fail("Account number must be 9–18 digits", "bank");
    if (acct && acct !== (v.accountNo2 ?? "").replace(/\s+/g, ""))
      return fail("The re-entered account number does not match", "bank");
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return fail("IFSC must look like HDFC0001234", "bank");

    const workEmail = v.workEmail?.trim() || v.personalEmail.trim();
    if (!workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
      return fail("Enter a valid work email address", "personal");
    }

    const validationError = validateHireInput({
      firstName: v.firstName,
      lastName: v.lastName,
      personalEmail: v.personalEmail,
      phone: v.phone,
      dob: v.dob,
      doj: v.doj,
      ctc: Number(v.ctc),
      workEmail: v.workEmail,
    });
    if (validationError) {
      return fail(
        validationError,
        /ctc|date of joining is required/i.test(validationError) ? "job" : "personal",
      );
    }

    const tempPassword = makeTempPassword();

    // Determine tenant IDs based on caller's role and placement rules
    const effectiveOrgId = isUuid(sessionOrgId) ? sessionOrgId : (isUuid(orgId) ? orgId : undefined);

    let effectiveCompanyId = undefined;
    if (isBranchAdmin || isCompanyAdmin) {
      if (isUuid(sessionCompanyId)) effectiveCompanyId = sessionCompanyId;
    } else if (isSuperAdmin) {
      if (isUuid(selectedCompanyId)) effectiveCompanyId = selectedCompanyId;
    }

    let effectiveBranchId = undefined;
    if (isBranchAdmin) {
      if (isUuid(sessionBranchId)) effectiveBranchId = sessionBranchId;
    } else if (isCompanyAdmin || isSuperAdmin) {
      if (effectiveCompanyId && isUuid(selectedBranchId)) {
        effectiveBranchId = selectedBranchId;
      }
    }

    const branchIdParam = effectiveBranchId;
    const departmentIdParam = orgDepartments.find((d) => d.name === v.dept)?.id;

    const apiFields = {
      first_name: v.firstName.trim(),
      last_name: v.lastName?.trim() || "",
      work_email: workEmail,
      password: tempPassword,
      personal_email: v.personalEmail?.trim() || "",
      phone: v.phone?.trim() || "",
      date_of_birth: v.dob || "",
      gender: v.gender || "",
      department: v.dept || "",
      department_id: isUuid(departmentIdParam) ? departmentIdParam : undefined,
      designation: v.designation || "",
      role: v.role || "Employee",
      employment_type: v.employmentType || "Full-time",
      manager_id: isUuid(v.managerId) ? v.managerId : undefined,
      date_of_joining: v.doj || "",
      probation_months: v.probationMonths || "3",
      status: "ACTIVE",
      ctc: v.ctc ? String(Number(v.ctc)) : "",
      grade: v.grade || "",
      wage_type: v.wageType || "Salaried",
      attendance_pattern_id: v.patternId || undefined,
      pan_number: pan || undefined,
      aadhaar_number: aadhaar || undefined,
      uan_number: uan || undefined,
      esic_number: v.esiNo?.trim() || undefined,
      bank_name: v.bankName?.trim() || undefined,
      bank_account_number: acct || undefined,
      ifsc_code: ifsc || undefined,
    };

    // Append valid UUIDs only
    if (effectiveOrgId) apiFields.organization_id = effectiveOrgId;
    if (effectiveCompanyId) apiFields.company_id = effectiveCompanyId;
    if (branchIdParam) apiFields.branch_id = branchIdParam;

    // Build FormData from text fields and File objects
    const formData = new FormData();
    Object.entries(apiFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        formData.append(key, String(value).trim());
      }
    });

    Object.entries(docFiles).forEach(([name, file]) => {
      if (file instanceof File && file.size > 0) {
        formData.append(name, file);
      }
    });

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const apiEmployee = await createEmployeeApi(formData);

      // Store in Zustand session store distinct from logged-in user scope
      useSessionStore.getState().setLastCreatedEmployee(apiEmployee);

      const employeeProfileId = apiEmployee?.id || apiEmployee?.employee_id;
      const userAccountId = apiEmployee?.user_id;

      // Keep existing local directory and profile store in sync
      const row = hireEmployee({
        id: employeeProfileId || undefined,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        personalEmail: v.personalEmail.trim(),
        phone: v.phone.trim(),
        dob: v.dob || "",
        gender: v.gender || "",
        orgId,
        branch: v.branch || "",
        dept: v.dept,
        designation: v.designation,
        role: v.role || "Employee",
        employmentType: v.employmentType || "Full-time",
        managerId: v.managerId || null,
        doj: v.doj,
        probationMonths: Number(v.probationMonths || 3),
        ctc: Number(v.ctc),
        grade: v.grade || undefined,
        workEmail,
      });

      if (v.hrPartnerId) setHrPartner(row.id, v.hrPartnerId);
      if (v.managerId) setManager(row.id, v.managerId);

      updateStatutoryIds(row.id, {
        pan,
        aadhaar,
        uan: uan || undefined,
        esiNo: v.esiNo?.trim() || undefined,
      });

      updateBankDetails(row.id, {
        holder: v.bankHolder?.trim() || "",
        bankName: v.bankName?.trim() || "",
        accountNo: acct,
        ifsc,
        mode: `${v.payMode || "NEFT"} — Salary Account`,
      });

      const t = (k) => (v[k] ?? "").trim();
      const experience = prevJobs
        .map((n) => ({
          company: t(`prev${n}_company`),
          role: t(`prev${n}_role`),
          from: t(`prev${n}_from`),
          to: t(`prev${n}_to`),
          ctc: t(`prev${n}_ctc`),
          reason: t(`prev${n}_reason`),
        }))
        .filter((x) => x.company);

      updatePersonalDetails(row.id, {
        personal: {
          maritalStatus: t("maritalStatus"),
          bloodGroup: t("bloodGroup"),
          nationality: t("nationality"),
          emergencyContact: [t("emergencyName"), t("emergencyPhone")].filter(Boolean).join(" · "),
          currentAddress: t("currentAddress"),
          permanentAddress: t("permanentAddress"),
          personalEmail: t("personalEmail"),
        },
        job: {
          noticePeriodDays: Number(v.noticeDays) || undefined,
          workMode: { office: "On-site", remote: "Remote", hybrid: "Hybrid" }[t("workMode")] ?? "",
          shift:
            {
              gen: "General (10:00 – 19:00)",
              morn: "Morning (06:00 – 14:00)",
              eve: "Evening (14:00 – 22:00)",
              night: "Night (22:00 – 06:00)",
            }[t("shift")] ?? "",
        },
        education: t("qualification")
          ? [
              {
                degree: t("qualification"),
                institute: t("institution"),
                year: t("yearOfPassing"),
                score: t("eduScore"),
              },
            ]
          : [],
        experience,
        other: Object.fromEntries(
          [
            "religion",
            "whatsapp",
            "linkedin",
            "github",
            "twitter",
            "website",
            "drivingLicence",
            "passport",
            "bankBranch",
            "accountType",
            "payFrequency",
            ...Object.keys(v).filter((k) => k.startsWith("pc_")),
          ]
            .filter((k) => t(k))
            .map((k) => [k, t(k)]),
        ),
      });

      const employeeName = apiEmployee?.first_name
        ? `${apiEmployee.first_name} ${apiEmployee.last_name ?? ""}`.trim()
        : `${row.firstName} ${row.lastName}`;

      toast.success(
        `${employeeName} created successfully (Employee ID: ${employeeProfileId || row.id}, User Account ID: ${userAccountId || "N/A"}) · Login: ${workEmail}`,
        { duration: 8000 },
      );
      if (typeof onCreated === "function") {
        onCreated(apiEmployee);
      }
      onClose();
    } catch (error) {
      console.error("Create employee API failed:", error);
      const detail =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        error?.message ??
        "Could not create employee. Please try again.";
      toast.error(
        Array.isArray(detail)
          ? detail
              .map((d) => `${(d.loc ?? []).filter((p) => p !== "body").join(".")}: ${d.msg}`)
              .join(", ")
          : String(detail),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const tabs = [
    { id: "personal", label: "Personal", icon: User },
    { id: "previous", label: "Previous Employment", icon: Briefcase },
    { id: "legal", label: "Legal & Documents", icon: FileText },
    { id: "bank", label: "Bank Details", icon: Landmark },
    { id: "job", label: "Job & Role", icon: Building2 },
  ];

  return (
    <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
      <form
        ref={formRef}
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-11 w-11 place-items-center rounded-xl text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Add New Employee</DialogTitle>
              <DialogDescription>
                Onboard a new team member with complete personal, legal and job details.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
          <div className="bg-muted/30 overflow-x-auto border-b px-6 pt-4">
            <TabsList className="inline-flex h-auto w-max flex-nowrap gap-1 bg-transparent p-0">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:border-primary gap-2 rounded-md data-[state=active]:border-b-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Personal */}
            <TabsContent
              value="personal"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={User}
                title="Basic Information"
                desc="Legal name, contact details and identity"
              />

              <FieldRow>
                <Field label="First Name" required>
                  <Input name="firstName" placeholder="Ananya" />
                </Field>
                <Field label="Last Name" required>
                  <Input name="lastName" placeholder="Sharma" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Date of Birth" required>
                  <Input name="dob" type="date" />
                </Field>
                <Field label="Gender">
                  <Select name="gender">
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Marital Status">
                  <Select name="maritalStatus">
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Blood Group">
                  <Select name="bloodGroup">
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Nationality">
                  <Input name="nationality" placeholder="Indian" defaultValue="Indian" />
                </Field>
                <Field label="Religion (Optional)">
                  <Input name="religion" placeholder="—" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle icon={Phone} title="Contact" desc="How we reach the employee" />
              <FieldRow>
                <Field label="Personal Email" required>
                  <Input name="personalEmail" type="email" placeholder="ananya@gmail.com" />
                </Field>
                <Field label="Work Email">
                  <Input
                    name="workEmail"
                    type="email"
                    placeholder="auto-generated from name if left blank"
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Mobile Number" required>
                  <Input name="phone" placeholder="+91 98450 12345" />
                </Field>
                <Field label="WhatsApp Number">
                  <Input name="whatsapp" placeholder="+91 98450 12345" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Emergency Contact Name">
                  <Input name="emergencyName" placeholder="Full name" />
                </Field>
                <Field label="Emergency Contact Number">
                  <Input name="emergencyPhone" placeholder="+91 98450 00000" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={Building2}
                title="Address"
                desc="Current and permanent addresses"
              />
              <Field label="Current Address">
                <Textarea
                  name="currentAddress"
                  placeholder="House / street / city / state / PIN"
                  rows={2}
                />
              </Field>
              <Field label="Permanent Address">
                <Textarea
                  name="permanentAddress"
                  placeholder="Same as current, or provide separately"
                  rows={2}
                />
              </Field>

              <Separator />
              <SectionTitle
                icon={Link2}
                title="Social Profiles"
                desc="Optional — enrich the employee profile"
              />

              <FieldRow>
                <Field label="LinkedIn">
                  <Input name="linkedin" placeholder="linkedin.com/in/…" />
                </Field>
                <Field label="GitHub">
                  <Input name="github" placeholder="github.com/…" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="X / Twitter">
                  <Input name="twitter" placeholder="x.com/…" />
                </Field>
                <Field label="Personal Website">
                  <Input name="website" placeholder="https://…" />
                </Field>
              </FieldRow>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setTab("previous")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Previous Employment
                </Button>
              </div>
            </TabsContent>

            {/* Previous Employment */}
            <TabsContent
              value="previous"
              forceMount
              className="mt-0 space-y-4 data-[state=inactive]:hidden"
            >
              <div className="flex items-center justify-between">
                <SectionTitle
                  icon={Briefcase}
                  title="Previous Employment"
                  desc="History, tenure and supporting documents"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrevJobs([...prevJobs, prevJobs.length + 1])}
                >
                  <Plus className="h-4 w-4" /> Add Employer
                </Button>
              </div>
              <div className="space-y-4">
                {prevJobs.map((n) => (
                  <PrevEmploymentBlock
                    key={n}
                    index={n}
                    onRemove={
                      prevJobs.length > 1
                        ? () => setPrevJobs((p) => p.filter((x) => x !== n))
                        : undefined
                    }
                  />
                ))}
              </div>
              <Separator />
              <SectionTitle
                icon={GraduationCap}
                title="Education"
                desc="Highest qualification and certifications"
              />

              <FieldRow>
                <Field label="Highest Qualification">
                  <Input name="qualification" placeholder="B.Tech — Computer Science" />
                </Field>
                <Field label="Institution">
                  <Input name="institution" placeholder="IIT Bombay" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Year of Passing">
                  <Input name="yearOfPassing" placeholder="2019" />
                </Field>
                <Field label="Grade / CGPA">
                  <Input name="eduScore" placeholder="8.4" />
                </Field>
              </FieldRow>

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("personal")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("legal")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Legal & Documents
                </Button>
              </div>
            </TabsContent>

            {/* Legal & Documents */}
            <TabsContent
              value="legal"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={IdCard}
                title="Government IDs"
                desc="Statutory identity documents (KYC)"
              />

              <FieldRow>
                <Field label="Aadhar Number" required>
                  <Input name="aadhaar" inputMode="numeric" placeholder="1234 5678 9012" />
                </Field>
                <Field label="PAN Number" required>
                  <Input name="pan" placeholder="ABCDE1234F" className="uppercase" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Driving License No.">
                  <Input name="drivingLicence" placeholder="KA01 20220001234" />
                </Field>
                <Field label="Passport No.">
                  <Input name="passport" placeholder="M1234567" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="UAN (PF)">
                  <Input name="uan" inputMode="numeric" placeholder="1000 1234 5678" />
                </Field>
                <Field label="ESI No.">
                  <Input name="esiNo" placeholder="—" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={FileText}
                title="Document Uploads"
                desc="Attach scanned copies — all files stored securely"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FileUpload
                  name="aadhaar_card"
                  label="Aadhar Card"
                  file={docFiles["aadhaar_card"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="pan_card"
                  label="PAN Card"
                  file={docFiles["pan_card"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="driving_license"
                  label="Driving License"
                  file={docFiles["driving_license"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="passport"
                  label="Passport"
                  file={docFiles["passport"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="resume"
                  label="Resume / CV"
                  file={docFiles["resume"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="offer_letter"
                  label="Offer Letter (Signed)"
                  file={docFiles["offer_letter"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="appointment_letter"
                  label="Appointment Letter"
                  file={docFiles["appointment_letter"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="educational_certificate"
                  label="Educational Certificates"
                  file={docFiles["educational_certificate"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="address_proof"
                  label="Address Proof"
                  file={docFiles["address_proof"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="passbook"
                  label="Cancelled Cheque / Passbook"
                  file={docFiles["passbook"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
              </div>

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("previous")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("bank")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Bank Details
                </Button>
              </div>
            </TabsContent>

            {/* Bank */}
            <TabsContent
              value="bank"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={Landmark}
                title="Salary Account"
                desc="Primary bank account for payroll credit"
              />

              <FieldRow>
                <Field label="Account Holder Name" required>
                  <Input name="bankHolder" placeholder="As per bank records" />
                </Field>
                <Field label="Bank Name" required>
                  <Input name="bankName" placeholder="HDFC Bank" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Account Number" required>
                  <Input name="accountNo" inputMode="numeric" placeholder="50100XXXXXXXX" />
                </Field>
                <Field label="Re-enter Account Number" required>
                  <Input name="accountNo2" inputMode="numeric" placeholder="Confirm" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="IFSC Code" required>
                  <Input name="ifsc" placeholder="HDFC0001234" className="uppercase" />
                </Field>
                <Field label="Branch">
                  <Input name="bankBranch" placeholder="Khandagiri, Bhubaneswar" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Account Type">
                  <Select name="accountType" defaultValue="savings">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payment Mode">
                  <Select name="payMode" defaultValue="NEFT">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="IMPS">IMPS</SelectItem>
                      <SelectItem value="RTGS">RTGS</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <Separator />
              <SectionTitle
                icon={Upload}
                title="Verification"
                desc="Cheque leaf / passbook for verification"
              />

              <FileUpload
                name="passbook"
                label="Cancelled Cheque / Passbook First Page"
                file={docFiles["passbook"]}
                onSelect={handleDocSelect}
                onRemove={handleDocRemove}
              />

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("legal")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("job")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Job & Role
                </Button>
              </div>
            </TabsContent>

            {/* Job & Role */}
            <TabsContent
              value="job"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={Building2}
                title="Placement"
                desc="Where the employee sits in the organization"
              />

              {/* Tenant Placement Scope Card */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-950 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                    Backend Tenant Placement
                  </div>
                  <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-800 text-[11px] font-medium dark:bg-black dark:text-emerald-300">
                    {isSuperAdmin
                      ? (selectedCompanyId
                          ? (selectedBranchId ? "Branch Placement (All 3 IDs)" : "Company Placement (Org + Company)")
                          : "Organization Placement (Org ID Only)")
                      : (isCompanyAdmin
                          ? (selectedBranchId ? "Branch Placement" : "Company Placement")
                          : (isBranchAdmin ? "Branch Placement (Locked)" : "Restricted"))}
                  </Badge>
                </div>

                {isEmployee && (
                  <p className="text-xs font-medium text-destructive">
                    Access Restricted: Employees cannot create or onboard other employees.
                  </p>
                )}

                {isSuperAdmin && (
                  <FieldRow>
                    <Field label="Company Placement (Optional)">
                      <Select
                        value={selectedCompanyId || "none"}
                        onValueChange={(val) => {
                          setSelectedCompanyId(val === "none" ? "" : val);
                          setSelectedBranchId("");
                        }}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Organization Level (No Company)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Organization Level (No Company)</SelectItem>
                          {backendCompanies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.code ? `(${c.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Leave unselected to place employee at Organization level.
                      </p>
                    </Field>

                    <Field label="Branch Placement (Optional)">
                      <Select
                        disabled={!selectedCompanyId || backendBranches.length === 0}
                        value={selectedBranchId || "none"}
                        onValueChange={(val) => setSelectedBranchId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue
                            placeholder={
                              !selectedCompanyId
                                ? "Select a company first"
                                : backendBranches.length
                                  ? "Company Level (No Branch)"
                                  : "No branches registered"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Company Level (No Branch)</SelectItem>
                          {backendBranches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} {b.code ? `(${b.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Select a branch to place employee at Branch level.
                      </p>
                    </Field>
                  </FieldRow>
                )}

                {isCompanyAdmin && (
                  <FieldRow>
                    <Field label="Company Scope (Locked to your session)">
                      <Input
                        value={sessionCompanyId || "Assigned Company"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>

                    <Field label="Branch Placement (Optional)">
                      <Select
                        value={selectedBranchId || "none"}
                        onValueChange={(val) => setSelectedBranchId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue
                            placeholder={
                              backendBranches.length
                                ? "Company Level (No Branch)"
                                : "No branches registered"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Company Level (No Branch)</SelectItem>
                          {backendBranches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} {b.code ? `(${b.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldRow>
                )}

                {isBranchAdmin && (
                  <FieldRow>
                    <Field label="Company Scope (Locked)">
                      <Input
                        value={sessionCompanyId || "Assigned Company"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>
                    <Field label="Branch Scope (Locked to your branch)">
                      <Input
                        value={sessionBranchId || "Assigned Branch"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>
                  </FieldRow>
                )}
              </div>

              <FieldRow>
                <Field label="Employee ID">
                  <Input placeholder="Auto-assigned on create" disabled />
                </Field>
                <Field label="Date of Joining" required>
                  <Input name="doj" type="date" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Branch" required>
                  <Select name="branch">
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Department" required>
                  <Select name="dept">
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobDepartmentOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Designation" required>
                  <Select name="designation">
                    <SelectTrigger>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobDesignationOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Role (Access)">
                  <Select name="role" defaultValue="Employee">
                    <SelectTrigger>
                      <SelectValue placeholder="Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only access roles the creator could manage (a Branch Admin could issue an HR login). */}
                      {hireableRoles(me.role)
                        .filter((r) => ["Employee", "Manager", "HOD", "HR"].includes(r))
                        .map((r) => (
                          <SelectItem key={r} value={r}>
                            {r === "HOD" ? "Head of Department" : r}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Reporting Manager" required>
                  <Select name="managerId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select reporting manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobReportingManagerOptions
                        .filter(
                          (u) =>
                            u.orgId === orgId &&
                            u.role !== "BranchAdmin" &&
                            u.role !== "Employee" &&
                            u.role !== "Admin" &&
                            u.role !== "SuperAdmin",
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} — {u.designation}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Employment Type">
                  <Select name="employmentType" defaultValue="Full-time">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Assign HR Partner" required>
                  <Select name="hrPartnerId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select HR business partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {(hrPartnerOptions(orgId).length
                        ? hrPartnerOptions(orgId)
                        : hrPartnerOptions()
                      ).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    All HR approvals raised by this employee route to their HR partner.
                  </p>
                </Field>
                <Field label="Notice Period">
                  <Select name="noticeDays" defaultValue="60">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Work Location">
                  <Select name="workMode" defaultValue="office">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">On-site</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Shift">
                  <Select name="shift" defaultValue="gen">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gen">General (10:00 – 19:00)</SelectItem>
                      <SelectItem value="morn">Morning (06:00 – 14:00)</SelectItem>
                      <SelectItem value="eve">Evening (14:00 – 22:00)</SelectItem>
                      <SelectItem value="night">Night (22:00 – 06:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={Landmark}
                title="Compensation"
                desc="Salary structure — components come from Payroll Configuration in Masters"
              />

              <FieldRow>
                <Field label="Annual CTC (₹)" required>
                  <Input
                    name="ctc"
                    type="number"
                    min={1}
                    placeholder="1200000"
                    onChange={(e) => setCtcDraft(Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Probation Period">
                  <Select name="probationMonths" defaultValue="3">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Pay Frequency">
                  <Select name="payFrequency" defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Salary Grade">
                  <Select name="grade">
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {["G1", "G2", "G3", "G4", "G5", "M1", "M2", "M3"].map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>

              {["Earning", "Allowance", "Deduction", "Statutory"].map((kind) => {
                const comps = payComponents.filter((c) => c.showInEmployeeForm && c.kind === kind);
                if (!comps.length) return null;
                return (
                  <div key={kind} className="space-y-3">
                    <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      {kind === "Statutory" ? "Statutory (PF / ESI)" : `${kind}s`}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {comps.map((c) => (
                        <Field key={c.id} label={`${c.name} (${c.code}) · ${c.calculation}`}>
                          <Input name={`pc_${c.code}`} placeholder={c.value} />
                        </Field>
                      ))}
                    </div>
                  </div>
                );
              })}

              <Card className="shadow-card bg-muted/30">
                <CardContent className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wider uppercase">
                      Gross (Monthly)
                    </div>
                    <div className="text-lg font-bold">
                      {ctcDraft > 0 ? inr(monthlyGross) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wider uppercase">
                      Total Deductions
                    </div>
                    <div className="text-destructive text-lg font-bold">
                      {ctcDraft > 0 ? inr(deductions) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs tracking-wider uppercase">
                      Net Take-home
                    </div>
                    <div className="text-primary text-lg font-bold">
                      {ctcDraft > 0 ? inr(monthlyGross - deductions) : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("bank")}>
                  ← Back
                </Button>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Checkbox id="notify" />{" "}
                  <Label htmlFor="notify">Send welcome email with credentials</Label>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="bg-muted/30 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || isEmployee}
            className="bg-gradient-emerald shadow-premium text-white flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Creating Employee…</span>
              </>
            ) : (
              "Create Employee"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Query-string contract of this screen (was the route's validateSearch). */
function validateSearch(s) {
  return typeof s.id === "string" ? { id: s.id } : {};
}

export default Employees;
