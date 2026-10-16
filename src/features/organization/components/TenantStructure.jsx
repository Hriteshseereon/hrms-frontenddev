
import Branch_api from "@/api/branch";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Copy,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Network,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Trash2,
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
import { useRouter } from "@/lib/router";
import {
  addBranch,
  allBranches,
  groupsStore,
  orgsStore,
  removeBranch,
  updateBranch,
  updateOrg,
  useOrgs,
  visibleBranches,
} from "@/features/organization/data/group-data";
import {
  companiesOf,
  ensureHoldingCompany,
  renameBranch,
  setActiveCompany,
  structureByKeyName,
} from "@/features/organization/data/tenancy";
import { directoryEmployees } from "@/features/employees/data/employee-directory";

const EMAIL = /^\S+@\S+\.\S+$/;

function normalizeBranch(branch) {
  return {
    ...branch,
    companyId: branch.company_id ?? branch.companyId,
    name: branch.name,
    code: branch.code ?? "",
    city: branch.city ?? "",
    state: branch.state ?? "",
    address: branch.address ?? "",
    head: branch.branch_head ?? branch.head ?? "",
    status:
      String(branch.status ?? "ACTIVE").toUpperCase() === "ACTIVE"
        ? "Active"
        : "Inactive",
  };
}

function getApiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || JSON.stringify(item))
      .join(", ");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

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

  const [apiCompanies, setApiCompanies] = useState(null);
  const [apiBranches, setApiBranches] = useState(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [issued, setIssued] = useState(null);

  const router = useRouter();
  const users = allUsers();
  const people = directoryEmployees();
  const isGroup = tenant.kind === "group";

  // GET /api/v1/super-admin/companies
  const loadCompanies = useCallback(async () => {
    try {
      const response = await SuperAdmin_auth.getCompanies();
      const result = response?.data ?? response;
      const data = Array.isArray(result)
        ? result
        : result?.items ?? result?.companies;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response from GET Companies API");
      }

      setApiCompanies(data);
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
  // The company ID is optional. Without it, load all branches.
  const loadBranches = useCallback(async (companyId = null) => {
    try {
      setBranchesLoading(true);

      const response = await Branch_api.getBranches(companyId);
      const result = response?.data ?? response;
      const data = Array.isArray(result)
        ? result
        : result?.items ?? result?.branches;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response from GET Branches API");
      }

      setApiBranches(data.map(normalizeBranch));
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
    void loadCompanies();
    void loadBranches();
  }, [loadCompanies, loadBranches]);

  // Prefer backend company records; preserve the local fallback.
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
        }))
  ).filter(
    (company) =>
      !limitToOrgId || company.id === limitToOrgId,
  );

  const canManageGroup = canManage && !limitToOrgId;
  const holding = companies.find((company) => company.isHolding);

  const group = isGroup
    ? groupsStore.get().find((item) => item.id === tenant.groupId)
    : null;

  const headcount = (orgId, branchName) =>
    people.filter(
      (employee) =>
        employee.orgId === orgId &&
        (!branchName || employee.branch === branchName),
    ).length;

  const totalBranches = companies.reduce((total, company) => {
    if (apiBranches !== null) {
      return (
        total +
        apiBranches.filter(
          (branch) =>
            String(branch.companyId) === String(company.id),
        ).length
      );
    }

    return (
      total +
      (apiCompanies === null
        ? visibleBranches(company).length
        : Number(company.branch_count ?? 0))
    );
  }, 0);

  const totalEmployees = companies.reduce(
    (total, company) =>
      total +
      (apiCompanies === null
        ? headcount(company.id)
        : Number(company.employee_count ?? 0)),
    0,
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <div className="bg-primary/10 text-primary grid h-11 w-11 place-items-center rounded-xl">
            {isGroup ? (
              <Network className="h-5 w-5" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {group?.name ?? tenant.name}
            </div>

            <div className="text-muted-foreground text-xs">
              {structureByKeyName(tenant.structure)} ·{" "}
              {companies.length}{" "}
              {companies.length === 1 ? "company" : "companies"} ·{" "}
              {totalBranches} branches · {totalEmployees} employees
            </div>
          </div>

          {canManageGroup && (
            <div className="flex flex-wrap gap-2">
              {isGroup && !holding && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const company = ensureHoldingCompany(tenant.id);
                    toast.success(
                      `${company.name} created — place employees or branches that sit directly under the group here`,
                    );
                  }}
                >
                  <Landmark className="h-4 w-4" />
                  Group-level employees / branches
                </Button>
              )}

              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => setDialog({ kind: "company" })}
                data-testid="add-company"
              >
                <Plus className="h-4 w-4" />
                {isGroup
                  ? "Add company"
                  : "Add a company (makes a group)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {companiesLoading && apiCompanies === null && (
        <p className="text-muted-foreground text-xs">
          Loading companies...
        </p>
      )}

      {branchesLoading && (
        <p className="text-muted-foreground text-xs">
          Loading branches...
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {companies.map((company) => {
          const branches =
            apiBranches !== null
              ? apiBranches.filter(
                  (branch) =>
                    String(branch.companyId) === String(company.id),
                )
              : apiCompanies === null
                ? allBranches(company)
                : [];

          const companyAdmins = users.filter(
            (user) =>
              user.orgId === company.id &&
              user.role === "Admin",
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

          const superAdmins = users.filter(
            (user) =>
              user.orgId === company.id &&
              user.role === "SuperAdmin",
          );

          const branchCount =
            apiBranches !== null
              ? branches.length
              : apiCompanies === null
                ? branches.length
                : Number(company.branch_count ?? 0);

          const employeeCount =
            apiCompanies === null
              ? headcount(company.id)
              : Number(company.employee_count ?? 0);

          return (
            <Card
              key={company.id}
              className="shadow-card"
              data-testid={`company-${company.code}`}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {company.name}

                      {company.isHolding && (
                        <Badge
                          variant="outline"
                          className="border-gold/40 text-gold text-[10px]"
                        >
                          Group level
                        </Badge>
                      )}

                      <Badge variant="outline" className="text-[10px]">
                        {company.code}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground text-xs">
                      {company.legalName} · {employeeCount} employees ·{" "}
                      {branchCount
                        ? `${branchCount} branches`
                        : "no branches (head office)"}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      company.status === "Active"
                        ? "text-[10px]"
                        : "text-destructive text-[10px]"
                    }
                  >
                    {company.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Administrators
                  </div>

                  {[...superAdmins, ...companyAdmins].map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <ShieldCheck className="text-primary h-3.5 w-3.5" />
                      <span className="truncate">{user.name}</span>
                      <span className="text-muted-foreground truncate">
                        {user.email}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-auto text-[10px]"
                      >
                        {user.role === "SuperAdmin"
                          ? "Super Admin"
                          : "Company Admin"}
                      </Badge>
                    </div>
                  ))}

                  {!superAdmins.length && !companyAdmins.length && (
                    <div className="text-muted-foreground text-xs">
                      No company administrator yet.
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Branches
                  </div>

                  {branches.map((branch) => {
                    const admins = users.filter(
                      (user) =>
                        user.role === "BranchAdmin" &&
                        user.orgId === company.id &&
                        user.branchId === branch.id,
                    );

                    const count = headcount(
                      company.id,
                      branch.name,
                    );

                    return (
                      <div
                        key={branch.id}
                        className="border-border flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        <GitBranch className="text-primary h-3.5 w-3.5" />
                        <span className="font-medium">
                          {branch.name}
                        </span>

                        {branch.city && (
                          <span className="text-muted-foreground">
                            {branch.city}
                          </span>
                        )}

                        <span className="text-muted-foreground">
                          · {count} staff
                        </span>

                        {branch.status === "Inactive" && (
                          <Badge
                            variant="outline"
                            className="text-destructive text-[10px]"
                          >
                            Inactive
                          </Badge>
                        )}

                        <span className="ml-auto flex items-center gap-1">
                          {admins.map((admin) => (
                            <Badge
                              key={admin.id}
                              variant="outline"
                              className="text-[10px]"
                              title={admin.email}
                            >
                              {admin.name}
                            </Badge>
                          ))}

                          {canManage && (
                            <>
                              <button
                                type="button"
                                aria-label={`View & edit branch ${branch.name}`}
                                title="View & edit branch"
                                className="text-muted-foreground hover:text-primary"
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
                                aria-label={`${branch.status === "Inactive" ? "Activate" : "Deactivate"} branch ${branch.name}`}
                                title={
                                  branch.status === "Inactive"
                                    ? "Activate branch"
                                    : "Deactivate branch"
                                }
                                className={
                                  branch.status === "Inactive"
                                    ? "text-muted-foreground hover:text-primary"
                                    : "text-muted-foreground hover:text-destructive"
                                }
                                onClick={() => {
                                  const toInactive =
                                    branch.status !== "Inactive";

                                  // This action remains local until the
                                  // backend update API is integrated.
                                  updateBranch(company.id, branch.id, {
                                    status: toInactive
                                      ? "Inactive"
                                      : "Active",
                                  });

                                  toast.success(
                                    toInactive
                                      ? `${branch.name} deactivated locally`
                                      : `${branch.name} activated locally`,
                                  );
                                }}
                              >
                                <Power className="h-3 w-3" />
                              </button>
                            </>
                          )}

                          {canManage &&
                            count === 0 &&
                            admins.length === 0 && (
                              <button
                                type="button"
                                aria-label={`Remove branch ${branch.name}`}
                                title="Remove branch"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Remove branch ${branch.name}?`,
                                    )
                                  ) {
                                    return;
                                  }

                                  // This action remains local until the
                                  // backend delete API is integrated.
                                  removeBranch(company.id, branch.id);
                                  toast.success("Branch removed locally");
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                        </span>
                      </div>
                    );
                  })}

                  {!branches.length && (
                    <div className="text-muted-foreground text-xs">
                      {apiBranches !== null
                        ? "No branches found for this company."
                        : apiCompanies !== null && branchCount > 0
                          ? `${branchCount} branches exist, but branch details could not be loaded.`
                          : "Everyone works from the head office."}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`view-dashboard-${company.code}`}
                    onClick={() => {
                      setActiveCompany(company.id);
                      toast.success(`Working in ${company.name}`);
                      router.push("/org/dashboard");
                    }}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    View dashboard
                  </Button>

                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDialog({
                          kind: "branch",
                          org: company,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Branch
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dialog && (
        <StructureDialog
          dialog={dialog}
          tenant={tenant}
          actor={actor}
          onClose={() => setDialog(null)}
          onIssued={(row) => {
            setDialog(null);

            if (row) {
              setIssued(row);
            }

            void loadCompanies();
            void loadBranches();
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
    </div>
  );
}

function StructureDialog({
  dialog,
  tenant,
  actor,
  onClose,
  onIssued,
}) {
  const org = dialog.org;
  const editing =
    dialog.kind === "editBranch" ? dialog.branch : null;

  const [f, setF] = useState({
    name: editing?.name ?? "",
    legalName: "",
    adminName: "",
    code: editing?.code ?? "",
    branchMode: "branches",
    firstBranch: "",
    city:
      editing?.city ??
      (dialog.kind === "branch" ? org?.city ?? "" : ""),
    state:
      editing?.state ??
      (dialog.kind === "branch"
        ? org?.state || "Odisha"
        : "Odisha"),
    address: editing?.address ?? "",
    head: editing?.head ?? "",
    gstin: "",
    email: "",
    branchId: "",
  });

  const [loading, setLoading] = useState(false);

  const set = (key, value) =>
    setF((previous) => ({
      ...previous,
      [key]: value,
    }));

  const [passwordSuffix] = useState(() => {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return String(100 + (random[0] % 900));
  });

  const adminNamePart = f.adminName
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .padEnd(2, "a");

  const adminEmailPart = f.email
    .split("@")[0]
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .padEnd(2, "b");

  const adminPassword =
    f.adminName.trim() && f.email.trim()
      ? `${adminNamePart[0].toUpperCase()}${adminNamePart[1].toLowerCase()}${adminEmailPart.toLowerCase()}@${passwordSuffix}`
      : "";

  const titles = {
    company:
      tenant.kind === "group"
        ? "Add company to the group"
        : "Add a company",
    branch: `Add branch — ${org?.name ?? ""}`,
    editBranch: `Branch — ${editing?.name ?? ""} · ${org?.name ?? ""}`,
    admin: `Company Admin — ${org?.name ?? ""}`,
    branchAdmin: `Branch Admin — ${org?.name ?? ""}`,
  };

  const submit = async () => {
    if (loading) return;

    // ---------------------------------------------------------
    // CREATE COMPANY
    // Existing company API integration is retained.
    // ---------------------------------------------------------
    if (dialog.kind === "company") {
      const name = f.name.trim();
      const code = f.code.trim();
      const email = f.email.trim().toLowerCase();
      const adminName = f.adminName.trim();

      if (!name || !code) {
        return toast.error("Company name and code are required");
      }

      if (!adminName) {
        return toast.error("Company Admin name is required");
      }

      if (!EMAIL.test(email)) {
        return toast.error(
          "Enter a valid Company Admin login e-mail",
        );
      }

      if (!adminPassword) {
        return toast.error(
          "Unable to generate the temporary password",
        );
      }

      const payload = {
        name,
        code,
        legal_name: f.legalName.trim() || name,
        industry: "IT Services & Consulting",
        contact_email: email,
        contact_phone: "",
        address: f.address.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        gst_no: f.gstin.trim(),
        structure:
          f.branchMode === "branches"
            ? "company_branches_employees"
            : "company_employees",
        admin_email: email,
        admin_password: adminPassword,
        admin_name: adminName,
        admin_phone: "",
        module_ids: [],
        submodule_ids: [],
      };

      try {
        setLoading(true);

        const response =
          await SuperAdmin_auth.createCompany(payload);

        const data = response?.data ?? response;

        toast.success(
          data?.message || `${name} created successfully`,
        );

        return onIssued({
          user: {
            id: data?.company_admin?.id ?? "",
            name:
              data?.company_admin?.full_name ?? adminName,
            email: data?.company_admin?.email ?? email,
            role: "Admin",
          },
          temporaryPassword: adminPassword,
          company: data?.company,
        });
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Failed to create company. Please try again.",
        );

        toast.error(message);
        console.error("Create company API error:", error);
      } finally {
        setLoading(false);
      }

      return;
    }

    // ---------------------------------------------------------
    // EDIT BRANCH
    // Still uses the existing local-store function.
    // Backend update API has not been integrated yet.
    // ---------------------------------------------------------
    if (dialog.kind === "editBranch") {
      const name = f.name.trim();

      if (!name) {
        return toast.error("Branch name is required");
      }

      const ok = renameBranch(org.id, editing.id, {
        name,
        city: f.city.trim(),
        state: f.state.trim(),
        address: f.address.trim(),
        head: f.head.trim(),
      });

      if (!ok) {
        return toast.error(
          `${name} already exists in ${org.name}`,
        );
      }

      toast.success(`${name} updated locally`);
      return onClose();
    }

    // ---------------------------------------------------------
    // CREATE BRANCH
    // POST /api/v1/super-admin/branches
    // ---------------------------------------------------------
    if (dialog.kind === "branch") {
      const name = f.name.trim();

      if (!org?.id) {
        return toast.error("Please select a valid company");
      }

      if (!name) {
        return toast.error("Branch name is required");
      }

      // The current branch form has no code input, so generate one.
      const branchCode =
        `BR-${name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6) || "NEW"}-${Date.now()
          .toString()
          .slice(-5)}`;

      const payload = {
        company_id: org.id,
        name,
        code: branchCode,
        city: f.city.trim(),
        state: f.state.trim(),
        address: f.address.trim(),
        is_head_office: false,
        branch_head: f.head.trim(),
        module_ids: [],
      };

      try {
        setLoading(true);

        const response =
          await Branch_api.createBranch(payload);

        const data = response?.data ?? response;

        toast.success(
          data?.message || `Branch "${name}" created successfully`,
        );

        // This refreshes companies and branches in the parent.
        // No admin account is created by the branch endpoint.
        return onIssued(null);
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Failed to create branch. Please try again.",
        );

        toast.error(message);
        console.error("Create branch API error:", error);
      } finally {
        setLoading(false);
      }

      return;
    }

    // ---------------------------------------------------------
    // EXISTING ADMINISTRATOR FLOWS
    // These still use your local tenant-user implementation.
    // ---------------------------------------------------------
    const email = f.email.trim().toLowerCase();

    if (!EMAIL.test(email)) {
      return toast.error("Enter a valid e-mail");
    }

    if (userByLogin(email)) {
      return toast.error(
        `${email} already has a Seereon HRMS login`,
      );
    }

    if (dialog.kind === "admin") {
      const row = provisionEntityAdmin({
        orgId: org.id,
        groupId: org.groupId,
        orgName: org.name,
        email,
        name: f.name,
        by: actor,
      });

      return onIssued(row);
    }

    const branch = (org.branches ?? []).find(
      (item) => item.id === f.branchId,
    );

    if (!branch) {
      return toast.error("Choose the branch");
    }

    const row = provisionBranchAdmin({
      orgId: org.id,
      groupId: org.groupId,
      orgName: org.name,
      branchId: branch.id,
      branchName: branch.name,
      email,
      name: f.name,
      by: actor,
    });

    return onIssued(row);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) =>
        !open && !loading && onClose()
      }
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[dialog.kind]}</DialogTitle>

          <DialogDescription>
            {dialog.kind === "company"
              ? tenant.kind === "group"
                ? "A legal entity of the group with its own payroll and statutory registrations. Provide the company administrator's name and login e-mail to issue a temporary password."
                : "Adding a second company turns this organisation into a group; the existing company joins it. A temporary password is issued for the new company administrator."
              : dialog.kind === "branch"
                ? "A location of the company. Employees, attendance and branch reporting hang off it."
                : dialog.kind === "editBranch"
                  ? "View and change this branch's details."
                  : dialog.kind === "admin"
                    ? "Full administration of this company and all its branches."
                    : "People operations of one branch only."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(dialog.kind === "company" ||
            dialog.kind === "branch" ||
            dialog.kind === "editBranch") && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">
                {dialog.kind === "company"
                  ? "Company name"
                  : "Branch name"}{" "}
                *
              </Label>
              <Input
                value={f.name}
                onChange={(event) =>
                  set("name", event.target.value)
                }
              />
            </div>
          )}

          {dialog.kind === "company" && (
            <>
              <div className="space-y-1">
                <Label
                  htmlFor="company-admin-name"
                  className="text-xs"
                >
                  Company Admin name *
                </Label>
                <Input
                  id="company-admin-name"
                  value={f.adminName}
                  onChange={(event) =>
                    set("adminName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="company-admin-email"
                  className="text-xs"
                >
                  Company Admin Login e-mail *
                </Label>
                <Input
                  id="company-admin-email"
                  type="email"
                  value={f.email}
                  onChange={(event) =>
                    set("email", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label
                  htmlFor="company-admin-password"
                  className="text-xs"
                >
                  Password (auto generated)
                </Label>
                <Input
                  id="company-admin-password"
                  value={adminPassword}
                  readOnly
                  placeholder="Enter the admin name and e-mail"
                />
                <p className="text-muted-foreground text-xs">
                  Generated from the admin name and e-mail. Must be
                  changed on first sign-in.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Legal name</Label>
                <Input
                  value={f.legalName}
                  onChange={(event) =>
                    set("legalName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Company code *</Label>
                <Input
                  value={f.code}
                  onChange={(event) =>
                    set("code", event.target.value)
                  }
                  placeholder="ABC-001"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Structure</Label>
                <Select
                  value={f.branchMode}
                  onValueChange={(value) =>
                    set("branchMode", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branches">
                      Company › Branches › Employees
                    </SelectItem>
                    <SelectItem value="none">
                      Company › Employees (no branches)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {f.branchMode === "branches" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">First branch</Label>
                  <Input
                    value={f.firstBranch}
                    onChange={(event) =>
                      set("firstBranch", event.target.value)
                    }
                    placeholder="Head office"
                  />
                  <p className="text-muted-foreground text-xs">
                    The current Create Company API does not accept
                    a first-branch field. This value is not sent.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">GST No.</Label>
                <Input
                  value={f.gstin}
                  onChange={(event) =>
                    set("gstin", event.target.value.toUpperCase())
                  }
                  placeholder="21AAAAA0000A1Z5"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input
                  value={f.address}
                  onChange={(event) =>
                    set("address", event.target.value)
                  }
                />
              </div>
            </>
          )}

          {(dialog.kind === "company" ||
            dialog.kind === "branch" ||
            dialog.kind === "editBranch") && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  value={f.city}
                  onChange={(event) =>
                    set("city", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input
                  value={f.state}
                  onChange={(event) =>
                    set("state", event.target.value)
                  }
                />
              </div>
            </>
          )}

          {(dialog.kind === "branch" ||
            dialog.kind === "editBranch") && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input
                  value={f.address}
                  onChange={(event) =>
                    set("address", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Branch head</Label>
                <Input
                  value={f.head}
                  onChange={(event) =>
                    set("head", event.target.value)
                  }
                />
              </div>
            </>
          )}

          {dialog.kind === "branch" && (
            <>
              <div className="space-y-1">
                <Label
                  htmlFor="branch-admin-name"
                  className="text-xs"
                >
                  Branch Admin name
                </Label>
                <Input
                  id="branch-admin-name"
                  value={f.adminName}
                  onChange={(event) =>
                    set("adminName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="branch-admin-email"
                  className="text-xs"
                >
                  Branch Admin Login e-mail
                </Label>
                <Input
                  id="branch-admin-email"
                  type="email"
                  value={f.email}
                  onChange={(event) =>
                    set("email", event.target.value)
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Branch creation does not create an admin account yet.
                </p>
              </div>
            </>
          )}

          {(dialog.kind === "admin" ||
            dialog.kind === "branchAdmin") && (
            <>
              {dialog.kind === "branchAdmin" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Branch *</Label>
                  <Select
                    value={f.branchId}
                    onValueChange={(value) =>
                      set("branchId", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleBranches(org).map((branch) => (
                        <SelectItem
                          key={branch.id}
                          value={branch.id}
                        >
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={f.name}
                  onChange={(event) =>
                    set("name", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Login e-mail *</Label>
                <Input
                  value={f.email}
                  onChange={(event) =>
                    set("email", event.target.value)
                  }
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            className="bg-gradient-emerald text-white"
            onClick={submit}
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : dialog.kind === "editBranch"
                ? "Save changes"
                : dialog.kind === "company" ||
                    dialog.kind === "branch"
                  ? "Add"
                  : "Create & issue password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssuedDialog({ row, tenant, onClose }) {
  const url = `${window.location.origin}/login`;
  const mail = credentialsEmail(row, tenant.name, url);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Login issued — {row.user.name}
          </DialogTitle>
          <DialogDescription>
            Share these once. The temporary password must be changed
            on first sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {[
            ["Sign-in URL", url],
            [
              "Tab",
              row.user.role === "SuperAdmin"
                ? "Super Admin"
                : "Admin",
            ],
            ["Username", row.user.email],
            ["Temporary password", row.temporaryPassword],
          ].map(([key, value]) => (
            <div
              key={key}
              className="border-border flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              <span className="text-muted-foreground w-36 shrink-0 text-xs">
                {key}
              </span>
              <code className="min-w-0 flex-1 truncate">
                {value}
              </code>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(
                `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.body}`,
              );
              toast.success("Credentials e-mail copied");
            }}
          >
            <Copy className="h-4 w-4" />
            Copy e-mail
          </Button>

          <Button
            className="bg-gradient-emerald text-white"
            onClick={onClose}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
