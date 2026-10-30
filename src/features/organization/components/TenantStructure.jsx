import { useCallback, useEffect, useRef, useState } from "react";
import Branch_api from "@/api/branch";
import Company_api from "@/api/company";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";
import organizationApi from "@/api/organizationApi";
import uploadApi from "@/api/uploadApi";
import Link, { useRouter } from "@/lib/router";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  GitBranch,
  Globe,
  Landmark,
  Laptop,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Network,
  Pencil,
  Phone,
  Plus,
  Power,
  Receipt,
  ShieldCheck,
  Square,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { allUsers, userByLogin } from "@/features/auth/data/auth-session";
import {
  credentialsEmail,
  provisionBranchAdmin,
  provisionEntityAdmin,
  useTenantUsers,
} from "@/features/auth/data/tenant-users";
import {
  groupsStore,
  useOrgs,
  visibleBranches,
} from "@/features/organization/data/group-data";
import {
  companiesOf,
  setActiveCompany,
  structureByKeyName,
} from "@/features/organization/data/tenancy";
import { directoryEmployees } from "@/features/employees/data/employee-directory";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Available HRMS Module Catalog for Company Entitlements
const SYSTEM_MODULES = [
  {
    key: "employee",
    label: "Employee Lifecycle & Records",
    desc: "Directory, Profiles, Onboarding & Documents",
    icon: Users,
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    key: "attendance",
    label: "Time & Attendance",
    desc: "Biometrics, Shifts, Overtime & Geo-tracking",
    icon: Clock,
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    key: "leave",
    label: "Leave & Holidays",
    desc: "Policy balances, approvals & holiday calendars",
    icon: Calendar,
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    key: "timesheet",
    label: "Timesheet & Work Logs",
    desc: "Project tracking, billable hours & approvals",
    icon: FileText,
    color: "text-cyan-500 bg-cyan-500/10",
  },
  {
    key: "payroll",
    label: "Salary, Compliance & Taxes",
    desc: "PF, ESI, TDS, Payslips & Salary Structures",
    icon: Receipt,
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    key: "recruitment",
    label: "Job Postings & ATS",
    desc: "Candidate pipeline, interviews & offers",
    icon: Briefcase,
    color: "text-rose-500 bg-rose-500/10",
  },
  {
    key: "performance",
    label: "Appraisals & Reviews",
    desc: "KPIs, OKRs, 360 Feedback & Appraisals",
    icon: Award,
    color: "text-orange-500 bg-orange-500/10",
  },
  {
    key: "grievance",
    label: "Disciplinary & Grievances",
    desc: "Ticket resolution, committee cases & policies",
    icon: AlertCircle,
    color: "text-red-500 bg-red-500/10",
  },
  {
    key: "assets",
    label: "Asset Management",
    desc: "Hardware assignment, warranties & returns",
    icon: Laptop,
    color: "text-indigo-500 bg-indigo-500/10",
  },
];

function normalizeBranch(branch) {
  return {
    ...branch,
    id: branch.id,
    companyId: branch.company_id ?? branch.companyId,
    name: branch.name,
    code: branch.code ?? "",
    city: branch.city ?? "",
    state: branch.state ?? "",
    pincode: branch.pincode ?? "",
    address: branch.address ?? "",
    is_headquarters: Boolean(
      branch.is_headquarters || branch.is_head_office,
    ),
    head: branch.branch_head ?? branch.head ?? "",
    status:
      String(branch.status ?? "ACTIVE").toUpperCase() === "ACTIVE"
        ? "Active"
        : "Inactive",
    employeesCount: branch.employees_count ?? branch.employee_count ?? 0,
  };
}

function getApiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  if (error?.response?.data?.message) return error.response.data.message;
  if (!error?.response) {
    return "Cannot connect to the backend. Check that the API server is running.";
  }
  return fallback;
}

export function TenantStructure({
  tenant,
  canManage,
  actor,
  limitToOrgId,
}) {
  useOrgs();
  useTenantUsers();

  const [rootOrg, setRootOrg] = useState(null);
  const [apiCompanies, setApiCompanies] = useState(null);
  const [apiBranches, setApiBranches] = useState(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [issued, setIssued] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const users = allUsers();
  const people = directoryEmployees();
  const isGroup = tenant.kind === "group";

  // Load root organisation data
  const loadRootOrg = useCallback(async () => {
    try {
      const data = await organizationApi.getOrganization();
      if (data) setRootOrg(data);
    } catch (err) {
      console.warn("Could not fetch root organisation:", err);
    }
  }, []);

  // GET /api/v1/super-admin/companies
  const loadCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true);
      const response = await Company_api.getCompanies();
      const result = response?.data ?? response;
      const data = Array.isArray(result)
        ? result
        : result?.items ?? result?.companies ?? result?.data;

      if (Array.isArray(data)) {
        setApiCompanies(data);
      } else {
        setApiCompanies([]);
      }
    } catch (error) {
      console.error(
        "GET Companies API error:",
        error?.response?.data ?? error.message,
      );
      toast.error("Failed to load companies from the backend");
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  // GET /api/v1/super-admin/branches
  const loadBranches = useCallback(async (companyId = null) => {
    try {
      setBranchesLoading(true);
      const response = await Branch_api.getBranches(companyId);
      const result = response?.data ?? response;
      const data = Array.isArray(result)
        ? result
        : result?.items ?? result?.branches ?? result?.data;

      if (Array.isArray(data)) {
        setApiBranches(data.map(normalizeBranch));
      } else {
        setApiBranches([]);
      }
    } catch (error) {
      console.error(
        "GET Branches API error:",
        error?.response?.data ?? error.message,
      );
      toast.error("Failed to load branches from the backend");
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRootOrg();
    void loadCompanies();
    void loadBranches();
  }, [loadRootOrg, loadCompanies, loadBranches]);

  // Merge companies list with fallback
  const companies = (
    apiCompanies === null
      ? companiesOf(tenant)
      : apiCompanies.map((company) => ({
          ...company,
          legalName:
            company.legal_name ?? company.legalName ?? company.name,
          status:
            String(company.status ?? "ACTIVE").toUpperCase() === "ACTIVE"
              ? "Active"
              : "Inactive",
          isHolding: false,
          modules: Array.isArray(company.modules)
            ? company.modules
            : typeof company.modules === "string"
              ? company.modules.split(",").map((s) => s.trim())
              : [],
        }))
  ).filter((company) => !limitToOrgId || company.id === limitToOrgId);

  const canManageGroup = canManage && !limitToOrgId;

  const totalBranches = companies.reduce((total, company) => {
    if (apiBranches !== null) {
      return (
        total +
        apiBranches.filter(
          (branch) => String(branch.companyId) === String(company.id),
        ).length
      );
    }
    return total + Number(company.branch_count ?? company.branches_count ?? 0);
  }, 0);

  const totalEmployees = companies.reduce((total, company) => {
    if (apiCompanies !== null) {
      return (
        total +
        Number(company.employee_count ?? company.employees_count ?? 0)
      );
    }
    return (
      total +
      people.filter((employee) => employee.orgId === company.id).length
    );
  }, 0);

  // Handle Delete Confirmation (Company or Branch)
  const handleDeleteExecute = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      if (deleteConfirm.type === "company") {
        await Company_api.deleteCompany(deleteConfirm.id);
        toast.success(`Company "${deleteConfirm.name}" deleted successfully`);
        await loadCompanies();
        await loadBranches();
      } else if (deleteConfirm.type === "branch") {
        await Branch_api.deleteBranch(deleteConfirm.id);
        toast.success(`Branch "${deleteConfirm.name}" deleted successfully`);
        await loadBranches();
      }
      setDeleteConfirm(null);
    } catch (error) {
      const msg = getApiErrorMessage(
        error,
        `Failed to delete ${deleteConfirm.type}`,
      );
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 🏢 ROOT ORGANISATION PROFILE CARD */}
      <Card className="shadow-card border-primary/20 bg-card/60 backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="bg-primary/10 text-primary grid h-12 w-12 place-items-center rounded-xl shrink-0 overflow-hidden border border-primary/20">
            {rootOrg?.logo_url ? (
              <img
                src={rootOrg.logo_url}
                alt="Logo"
                className="h-full w-full object-contain p-1"
              />
            ) : isGroup ? (
              <Network className="h-6 w-6" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">
                {rootOrg?.name ?? tenant.name}
              </span>
              {rootOrg?.legal_name && (
                <Badge variant="outline" className="text-xs font-normal">
                  {rootOrg.legal_name}
                </Badge>
              )}
            </div>

            <div className="text-muted-foreground text-xs mt-1 flex flex-wrap items-center gap-2">
              <span>{structureByKeyName(tenant.structure)}</span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {companies.length}{" "}
                {companies.length === 1 ? "Company" : "Companies"}
              </span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {totalBranches} Branches
              </span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {totalEmployees} Employees
              </span>
              {rootOrg?.gstin && (
                <>
                  <span>·</span>
                  <span className="text-[11px]">GSTIN: {rootOrg.gstin}</span>
                </>
              )}
              {rootOrg?.website && (
                <>
                  <span>·</span>
                  <a
                    href={rootOrg.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <Globe className="h-3 w-3" /> Website
                  </a>
                </>
              )}
            </div>
          </div>

          {canManageGroup && (
            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" size="sm" asChild>
                <Link href="/org/organisation-setup">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Organisation
                </Link>
              </Button>

              <Button
                size="sm"
                className="bg-gradient-emerald text-white shadow-sm"
                onClick={() => setDialog({ kind: "company" })}
                data-testid="add-company"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Company
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading Indicators */}
      {companiesLoading && apiCompanies === null && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading companies
          from backend...
        </div>
      )}

      {/* 🏭 COMPANIES GRID */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {companies.map((company) => {
          const branches =
            apiBranches !== null
              ? apiBranches.filter(
                  (branch) => String(branch.companyId) === String(company.id),
                )
              : apiCompanies === null
                ? visibleBranches(company)
                : [];

          const companyAdmins = users.filter(
            (user) => user.orgId === company.id && user.role === "Admin",
          );

          if (
            apiCompanies !== null &&
            companyAdmins.length === 0 &&
            company.admin_email
          ) {
            companyAdmins.push({
              id: `${company.id}-admin`,
              name: "Company Admin",
              email: company.admin_email,
              role: "Admin",
            });
          }

          const enabledModules = Array.isArray(company.modules)
            ? company.modules
            : [];

          return (
            <Card
              key={company.id}
              className="shadow-card flex flex-col justify-between overflow-hidden border border-border/70 hover:border-primary/30 transition-all"
            >
              <CardContent className="space-y-4 p-5">
                {/* Company Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden font-bold text-primary">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="h-full w-full object-contain p-0.5"
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base truncate">
                          {company.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-mono"
                        >
                          {company.code}
                        </Badge>
                        <Badge
                          variant={
                            company.status === "Active" ? "outline" : "secondary"
                          }
                          className={cn(
                            "text-[10px]",
                            company.status === "Active"
                              ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                              : "text-muted-foreground",
                          )}
                        >
                          {company.status}
                        </Badge>
                      </div>

                      <div className="text-muted-foreground text-xs mt-0.5 truncate">
                        {company.legalName !== company.name && (
                          <span>{company.legalName} · </span>
                        )}
                        <span>{company.industry || "General Industry"}</span>
                        {company.city && <span> · {company.city}</span>}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Edit Company Details & Modules"
                        onClick={() =>
                          setDialog({ kind: "editCompany", company })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete Company"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "company",
                            id: company.id,
                            name: company.name,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Statutory Numbers Pill Row */}
                {(company.gst_no ||
                  company.pan_no ||
                  company.cin_no ||
                  company.tan_no ||
                  company.pf_code) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
                    {company.gst_no && (
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                        GST: <strong className="text-foreground">{company.gst_no}</strong>
                      </span>
                    )}
                    {company.pan_no && (
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                        PAN: <strong className="text-foreground">{company.pan_no}</strong>
                      </span>
                    )}
                    {company.cin_no && (
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                        CIN: <strong className="text-foreground">{company.cin_no}</strong>
                      </span>
                    )}
                    {company.pf_code && (
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                        PF: <strong className="text-foreground">{company.pf_code}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* 🧩 Enabled Module Badges */}
                <div className="rounded-lg bg-muted/20 border border-border/50 p-2.5">
                  <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Activated Modules ({enabledModules.length})</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          setDialog({
                            kind: "editCompany",
                            company,
                            initialTab: "modules",
                          })
                        }
                        className="text-[10px] text-primary hover:underline"
                      >
                        Configure
                      </button>
                    )}
                  </div>

                  {enabledModules.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {enabledModules.map((mKey) => {
                        const modInfo = SYSTEM_MODULES.find(
                          (m) => m.key === mKey,
                        );
                        return (
                          <Badge
                            key={mKey}
                            variant="secondary"
                            className="text-[10px] capitalize px-2 py-0 font-normal flex items-center gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {modInfo ? modInfo.label.split(" ")[0] : mKey}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">
                      No modules activated. Click Configure to enable HRMS
                      modules.
                    </div>
                  )}
                </div>

                {/* 🏢 Branches Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <GitBranch className="h-3.5 w-3.5 text-primary" />
                      Operating Branches ({branches.length})
                    </span>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:text-primary h-6 px-2 text-[11px]"
                        onClick={() =>
                          setDialog({ kind: "branch", org: company })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Branch
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {branch.name}
                            </span>
                            {branch.code && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({branch.code})
                              </span>
                            )}
                            {branch.is_headquarters && (
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0 px-1 border-primary/40 text-primary"
                              >
                                HQ
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] py-0 px-1",
                                branch.status === "Active"
                                  ? "text-emerald-600 border-emerald-500/30"
                                  : "text-muted-foreground",
                              )}
                            >
                              {branch.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {branch.city && <span>{branch.city}</span>}
                            {branch.state && <span>, {branch.state}</span>}
                            {branch.head && (
                              <span> · Head: {branch.head}</span>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Edit branch"
                              className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                              onClick={() =>
                                setDialog({
                                  kind: "editBranch",
                                  org: company,
                                  branch,
                                })
                              }
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Delete branch"
                              className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "branch",
                                  id: branch.id,
                                  name: branch.name,
                                  companyId: company.id,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {branches.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        No branches created yet. All employees operate from head
                        office.
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    {company.contact_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {company.contact_email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => {
                        setActiveCompany(company.id);
                        toast.success(`Active company set to ${company.name}`);
                        router.push("/org/dashboard");
                      }}
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                      Dashboard
                    </Button>

                    {canManage && (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-8 bg-primary text-primary-foreground"
                        onClick={() =>
                          setDialog({ kind: "branch", org: company })
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Branch
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 🚀 MODALS */}
      {dialog && (dialog.kind === "company" || dialog.kind === "editCompany") && (
        <CompanyDialog
          dialog={dialog}
          tenant={tenant}
          actor={actor}
          onClose={() => setDialog(null)}
          onSuccess={(issuedRow) => {
            setDialog(null);
            if (issuedRow) setIssued(issuedRow);
            void loadCompanies();
            void loadBranches();
          }}
        />
      )}

      {dialog && (dialog.kind === "branch" || dialog.kind === "editBranch") && (
        <BranchDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void loadBranches();
            void loadCompanies();
          }}
        />
      )}

      {issued && (
        <IssuedDialog
          row={issued}
          tenant={tenant}
          onClose={() => setIssued(null)}
        />
      )}

      {/* ⚠️ Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle>
                  Delete {deleteConfirm.type === "company" ? "Company" : "Branch"}
                </DialogTitle>
              </div>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong className="text-foreground font-semibold">
                  "{deleteConfirm.name}"
                </strong>
                ? This action cannot be undone.
                {deleteConfirm.type === "company" && (
                  <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Note: Backend will reject deletion if active employees are
                    still assigned to this company.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDeleteExecute}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// =========================================================================
// 🏢 COMPANY CREATE / EDIT DIALOG (WITH 5 TABS & MODULE SELECTION)
// =========================================================================
function CompanyDialog({ dialog, tenant, actor, onClose, onSuccess }) {
  const isEdit = dialog.kind === "editCompany";
  const existing = isEdit ? dialog.company : null;

  const [activeTab, setActiveTab] = useState(dialog.initialTab || "basic");
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);

  // File Upload refs
  const logoInputRef = useRef(null);
  const gstDocInputRef = useRef(null);
  const panDocInputRef = useRef(null);
  const cinDocInputRef = useRef(null);

  // Form State
  const [name, setName] = useState(existing?.name || "");
  const [code, setCode] = useState(existing?.code || "");
  const [legalName, setLegalName] = useState(
    existing?.legal_name || existing?.legalName || "",
  );
  const [industry, setIndustry] = useState(
    existing?.industry || "Information Technology",
  );
  const [website, setWebsite] = useState(existing?.website || "");
  const [currency, setCurrency] = useState(existing?.currency || "INR");
  const [timezone, setTimezone] = useState(
    existing?.timezone || "Asia/Kolkata",
  );
  const [fiscalYearStart, setFiscalYearStart] = useState(
    existing?.fiscal_year_start || "April",
  );

  // Statutory & Tax
  const [gstNo, setGstNo] = useState(
    existing?.gst_no || existing?.gstin || "",
  );
  const [panNo, setPanNo] = useState(
    existing?.pan_no || existing?.pan || "",
  );
  const [cinNo, setCinNo] = useState(
    existing?.cin_no || existing?.cin || "",
  );
  const [tanNo, setTanNo] = useState(existing?.tan_no || "");
  const [pfCode, setPfCode] = useState(existing?.pf_code || "");
  const [esiCode, setEsiCode] = useState(existing?.esi_code || "");

  // Documents
  const [logoUrl, setLogoUrl] = useState(existing?.logo_url || "");
  const [gstDocUrl, setGstDocUrl] = useState(existing?.gst_doc_url || "");
  const [panDocUrl, setPanDocUrl] = useState(existing?.pan_doc_url || "");
  const [cinDocUrl, setCinDocUrl] = useState(existing?.cin_doc_url || "");

  // Address & Contact
  const [contactEmail, setContactEmail] = useState(
    existing?.contact_email || existing?.email || "",
  );
  const [contactPhone, setContactPhone] = useState(
    existing?.contact_phone || existing?.phone || "",
  );
  const [address, setAddress] = useState(existing?.address || "");
  const [city, setCity] = useState(existing?.city || "");
  const [state, setState] = useState(existing?.state || "");
  const [pincode, setPincode] = useState(existing?.pincode || "");
  const [country, setCountry] = useState(existing?.country || "India");

  // Admin Account (Create only)
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Module Entitlements
  const [selectedModules, setSelectedModules] = useState(() => {
    if (isEdit && Array.isArray(existing?.modules)) {
      return existing.modules;
    }
    // Default modules for new company
    return ["employee", "attendance", "leave", "payroll"];
  });

  // Password Generation for New Company Admin
  const [passwordSuffix] = useState(() => {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return String(100 + (random[0] % 900));
  });

  const adminPassword =
    adminName.trim() && adminEmail.trim()
      ? `${adminName.slice(0, 2).padEnd(2, "a")}${adminEmail.split("@")[0].slice(0, 2).padEnd(2, "b")}@${passwordSuffix}`
      : "";

  const handleFileUpload = async (file, fieldKey) => {
    if (!file) return;
    try {
      setUploadingField(fieldKey);
      const url = await uploadApi.uploadFile(file, "companies");
      if (fieldKey === "logo") setLogoUrl(url);
      if (fieldKey === "gst") setGstDocUrl(url);
      if (fieldKey === "pan") setPanDocUrl(url);
      if (fieldKey === "cin") setCinDocUrl(url);
      toast.success("Document uploaded successfully");
    } catch (err) {
      console.error(`Upload error for ${fieldKey}:`, err);
      // Dev fallback: local preview
      const localUrl = URL.createObjectURL(file);
      if (fieldKey === "logo") setLogoUrl(localUrl);
      if (fieldKey === "gst") setGstDocUrl(localUrl);
      if (fieldKey === "pan") setPanDocUrl(localUrl);
      if (fieldKey === "cin") setCinDocUrl(localUrl);
      toast.warning("Upload API unreachable. Using local object reference.");
    } finally {
      setUploadingField(null);
    }
  };

  const toggleModule = (modKey) => {
    setSelectedModules((prev) =>
      prev.includes(modKey)
        ? prev.filter((k) => k !== modKey)
        : [...prev, modKey],
    );
  };

  const handleSelectAllModules = () => {
    if (selectedModules.length === SYSTEM_MODULES.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(SYSTEM_MODULES.map((m) => m.key));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name is required");
    if (!code.trim()) return toast.error("Company code is required");

    if (!isEdit) {
      if (!adminName.trim()) {
        setActiveTab("basic");
        return toast.error("Company Admin name is required");
      }
      if (!EMAIL_REGEX.test(adminEmail.trim())) {
        setActiveTab("basic");
        return toast.error("Enter a valid Company Admin email");
      }
    }

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      legal_name: legalName.trim() || name.trim(),
      industry: industry.trim(),
      website: website.trim(),
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim(),
      currency,
      timezone,
      fiscal_year_start: fiscalYearStart,
      is_active: true,
      gst_no: gstNo.trim(),
      pan_no: panNo.trim(),
      cin_no: cinNo.trim(),
      tan_no: tanNo.trim(),
      pf_code: pfCode.trim(),
      esi_code: esiCode.trim(),
      logo_url: logoUrl,
      gst_doc_url: gstDocUrl,
      pan_doc_url: panDocUrl,
      cin_doc_url: cinDocUrl,
      modules: selectedModules,
      ...(isEdit
        ? {}
        : {
            admin_email: adminEmail.trim().toLowerCase(),
            admin_name: adminName.trim(),
            admin_password: adminPassword,
            admin_phone: contactPhone.trim(),
          }),
    };

    try {
      setLoading(true);
      if (isEdit) {
        await Company_api.updateCompany(existing.id, payload);
        toast.success(`Company "${name}" updated successfully`);
        onSuccess(null);
      } else {
        const response = await SuperAdmin_auth.createCompany(payload);
        const data = response?.data ?? response;
        toast.success(
          data?.message || `Company "${name}" created successfully`,
        );

        onSuccess({
          user: {
            id: data?.company_admin?.id ?? "",
            name: data?.company_admin?.full_name ?? adminName,
            email: data?.company_admin?.email ?? adminEmail,
            role: "Admin",
          },
          temporaryPassword: adminPassword,
          company: data?.company,
        });
      }
    } catch (error) {
      const msg = getApiErrorMessage(
        error,
        `Failed to ${isEdit ? "update" : "create"} company`,
      );
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "basic", label: "Basic Info", icon: Building2 },
    { id: "statutory", label: "Statutory & Tax", icon: Landmark },
    { id: "docs", label: "Documents", icon: UploadCloud },
    { id: "address", label: "Address & Contact", icon: MapPin },
    { id: "modules", label: `Modules (${selectedModules.length})`, icon: Receipt },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {isEdit ? `Edit Company — ${existing?.name}` : "Add New Company"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update company profile, statutory tax identifiers, documents, and active modules."
              : "Register a legal entity with independent payroll, statutory compliance, and module licenses."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation Pill Bar */}
        <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-1 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                  isActive
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* TAB 1: BASIC INFO */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Seereon Infotech Pvt Ltd"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Company Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SRN-TECH"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Unique uppercase code used in employee codes and IDs.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Legal Registered Name</Label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Seereon Infotech Private Limited"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Industry</Label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. IT Services, Logistics, Healthcare"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Website</Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://infotech.seereon.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                      <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                      <SelectItem value="AED">AED (د.إ) - UAE Dirham</SelectItem>
                      <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fiscal Year Start</Label>
                  <Select
                    value={fiscalYearStart}
                    onValueChange={setFiscalYearStart}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="April">April (Standard India)</SelectItem>
                      <SelectItem value="January">January (Calendar Year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Admin credentials section (Only for new company) */}
              {!isEdit && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                  <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Company Super Administrator Account
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Provide the initial administrator's name and email. An auto-generated temporary password will be issued upon creation.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Admin Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Rajesh Mohapatra"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Admin Login Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@infotech.seereon.com"
                      />
                    </div>
                  </div>

                  {adminPassword && (
                    <div className="text-xs bg-background/80 rounded-lg p-2 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Auto-generated password preview:
                      </span>
                      <code className="font-mono text-primary font-bold">
                        {adminPassword}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STATUTORY & TAX IDENTIFIERS */}
          {activeTab === "statutory" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter government registrations for statutory payroll compliance (PF, ESIC, GST, TDS).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">GSTIN (GST Number)</Label>
                  <Input
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                    placeholder="21AAACS1234A1Z5"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">PAN Number</Label>
                  <Input
                    value={panNo}
                    onChange={(e) => setPanNo(e.target.value.toUpperCase())}
                    placeholder="AAACS1234A"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CIN (Corporate Identity No)</Label>
                  <Input
                    value={cinNo}
                    onChange={(e) => setCinNo(e.target.value.toUpperCase())}
                    placeholder="U72200OR2022PTC039000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">TAN (Tax Deduction Acc No)</Label>
                  <Input
                    value={tanNo}
                    onChange={(e) => setTanNo(e.target.value.toUpperCase())}
                    placeholder="BLRS12345E"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">PF Establishment Code</Label>
                  <Input
                    value={pfCode}
                    onChange={(e) => setPfCode(e.target.value.toUpperCase())}
                    placeholder="BGMUC1234567000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">ESIC Registration Code</Label>
                  <Input
                    value={esiCode}
                    onChange={(e) => setEsiCode(e.target.value.toUpperCase())}
                    placeholder="31001234560000101"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENTS & BRAND */}
          {activeTab === "docs" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Upload company documents and branding assets. Uploaded files are securely stored on S3.
              </p>

              {/* Logo Upload Card */}
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Company Logo</div>
                    <div className="text-[11px] text-muted-foreground">
                      PNG, JPG, or SVG (Used in employee portals and payslips)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], "logo")
                    }
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === "logo"}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploadingField === "logo" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5 mr-1" />
                    )}
                    {logoUrl ? "Change" : "Upload"}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 px-2"
                      onClick={() => setLogoUrl("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* GST Certificate */}
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-8 w-8 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">GST Certificate (REG-06)</div>
                    <div className="text-[11px] text-muted-foreground">
                      {gstDocUrl ? (
                        <a
                          href={gstDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          View uploaded certificate <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "Upload PDF or image scan of GST certificate"
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={gstDocInputRef}
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], "gst")
                    }
                    accept=".pdf,image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === "gst"}
                    onClick={() => gstDocInputRef.current?.click()}
                  >
                    {uploadingField === "gst" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5 mr-1" />
                    )}
                    {gstDocUrl ? "Replace" : "Upload PDF"}
                  </Button>
                  {gstDocUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 px-2"
                      onClick={() => setGstDocUrl("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* PAN Document */}
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">Company PAN Card</div>
                    <div className="text-[11px] text-muted-foreground">
                      {panDocUrl ? (
                        <a
                          href={panDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          View uploaded PAN <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "Upload PDF or image scan of company PAN card"
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={panDocInputRef}
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], "pan")
                    }
                    accept=".pdf,image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === "pan"}
                    onClick={() => panDocInputRef.current?.click()}
                  >
                    {uploadingField === "pan" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5 mr-1" />
                    )}
                    {panDocUrl ? "Replace" : "Upload PDF"}
                  </Button>
                  {panDocUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 px-2"
                      onClick={() => setPanDocUrl("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Certificate of Incorporation */}
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="flex items-center gap-3">
                  <Landmark className="h-8 w-8 text-purple-500 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">
                      Certificate of Incorporation (COI)
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {cinDocUrl ? (
                        <a
                          href={cinDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          View uploaded COI <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "Upload MCA Incorporation certificate"
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={cinDocInputRef}
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], "cin")
                    }
                    accept=".pdf,image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === "cin"}
                    onClick={() => cinDocInputRef.current?.click()}
                  >
                    {uploadingField === "cin" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5 mr-1" />
                    )}
                    {cinDocUrl ? "Replace" : "Upload PDF"}
                  </Button>
                  {cinDocUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 px-2"
                      onClick={() => setCinDocUrl("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADDRESS & CONTACT */}
          {activeTab === "address" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Official Contact Email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="ops@seereon.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Official Contact Phone</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 9988776655"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium">Street Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plot 102, Tech Park, Chandaka"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bhubaneswar"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">State</Label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Odisha"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">PIN Code</Label>
                  <Input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="751024"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Country</Label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MODULE ENTITLEMENTS */}
          {activeTab === "modules" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <div className="text-xs font-semibold">
                    Select Enabled Modules for {name || "Company"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Only checked modules will be accessible by employees of this company.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={handleSelectAllModules}
                >
                  {selectedModules.length === SYSTEM_MODULES.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {SYSTEM_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  const isChecked = selectedModules.includes(mod.key);
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className={cn(
                        "flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none",
                        isChecked
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/60 hover:border-border bg-card/60 opacity-70",
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          mod.color,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold leading-tight text-foreground truncate">
                            {mod.label}
                          </span>
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {mod.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !code.trim()}
              className="bg-gradient-emerald text-white shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              {isEdit ? "Save Company Changes" : "Create Company & Modules"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// 🏢 BRANCH CREATE / EDIT DIALOG
// =========================================================================
function BranchDialog({ dialog, onClose, onSuccess }) {
  const isEdit = dialog.kind === "editBranch";
  const org = dialog.org;
  const editing = isEdit ? dialog.branch : null;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(editing?.name || "");
  const [code, setCode] = useState(
    editing?.code ||
      `BR-${(org?.code || "HQ").slice(0, 4)}-${Date.now().toString().slice(-4)}`,
  );
  const [isHq, setIsHq] = useState(Boolean(editing?.is_headquarters));
  const [head, setHead] = useState(editing?.head || "");
  const [address, setAddress] = useState(editing?.address || "");
  const [city, setCity] = useState(editing?.city || org?.city || "");
  const [state, setState] = useState(editing?.state || org?.state || "Odisha");
  const [pincode, setPincode] = useState(editing?.pincode || "");
  const [status, setStatus] = useState(
    editing?.status?.toLowerCase() || "active",
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Branch name is required");
    if (!code.trim()) return toast.error("Branch code is required");

    const payload = {
      company_id: org?.id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      is_headquarters: isHq,
      is_head_office: isHq,
      branch_head: head.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      status: status.toLowerCase(),
    };

    try {
      setLoading(true);
      if (isEdit) {
        await Branch_api.updateBranch(editing.id, payload);
        toast.success(`Branch "${name}" updated successfully`);
      } else {
        await Branch_api.createBranch(payload);
        toast.success(`Branch "${name}" created successfully`);
      }
      onSuccess();
    } catch (error) {
      const msg = getApiErrorMessage(
        error,
        `Failed to ${isEdit ? "update" : "create"} branch`,
      );
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            {isEdit
              ? `Edit Branch — ${editing?.name}`
              : `Add Branch — ${org?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modify branch location and manager details."
              : "Register an operating branch or regional office under this company."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Branch Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bangalore Tech Hub, Bhubaneswar HQ"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Branch Code <span className="text-destructive">*</span>
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BLR-01"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Branch Head / Lead</Label>
              <Input
                value={head}
                onChange={(e) => setHead(e.target.value)}
                placeholder="Manager Name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Street Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Electronic City Phase 1"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">State</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Karnataka"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">PIN Code</Label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-2.5 bg-muted/20">
            <div>
              <div className="text-xs font-medium">Headquarters Location</div>
              <div className="text-[11px] text-muted-foreground">
                Set this branch as the primary registered office.
              </div>
            </div>
            <input
              type="checkbox"
              id="hq-checkbox"
              checked={isHq}
              onChange={(e) => setIsHq(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-gradient-emerald text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              {isEdit ? "Save Branch" : "Add Branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// 🔑 ISSUED CREDENTIALS DIALOG
// =========================================================================
function IssuedDialog({ row, tenant, onClose }) {
  const url = `${window.location.origin}/login`;
  const mail = credentialsEmail(row, tenant.name, url);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
            Company Admin Credentials Issued — {row.user.name}
          </DialogTitle>
          <DialogDescription>
            Share these temporary credentials with the company administrator. They
            must be changed on first login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm pt-1">
          {[
            ["Sign-in URL", url],
            [
              "Portal Tab",
              row.user.role === "SuperAdmin" ? "Super Admin" : "Admin",
            ],
            ["Username / Email", row.user.email],
            ["Temporary Password", row.temporaryPassword],
          ].map(([key, value]) => (
            <div
              key={key}
              className="border-border flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/20"
            >
              <span className="text-muted-foreground w-36 shrink-0 text-xs font-medium">
                {key}
              </span>
              <code className="min-w-0 font-mono text-xs text-foreground font-semibold truncate">
                {value}
              </code>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(
                `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.body}`,
              );
              toast.success("Credentials copied to clipboard");
            }}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copy Details
          </Button>

          <Button className="bg-gradient-emerald text-white" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TenantStructure;
