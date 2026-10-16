// The structure of the organisation — companies, branches and their administrators — owned by the Super Admin
// (Companies & Branches, and the Organisation Setup wizard links here).
//
//   Group › Companies › Branches › Employees      Company › Branches › Employees
//   Group › Companies › Employees                 Company › Employees
//
// Employees or branches "directly under the group" live in the group's own holding company (payroll, PF and TDS are
// always run by a legal entity). A company without branches keeps everyone at a hidden head office.
import { useState } from "react";
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
  addCompany,
  companiesOf,
  ensureHoldingCompany,
  renameBranch,
  setActiveCompany,
  structureByKeyName,
} from "@/features/organization/data/tenancy";
import { directoryEmployees } from "@/features/employees/data/employee-directory";

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * @param {{ tenant: Tenant, canManage: boolean, actor: string, limitToOrgId?: string }} props
 * `limitToOrgId` — a Company Admin: only their company, and only branch-level changes (branches, Branch Admins).
 */
export function TenantStructure({ tenant, canManage, actor, limitToOrgId }) {
  useOrgs();
  useTenantUsers();
  const companies = companiesOf(tenant).filter((o) => !limitToOrgId || o.id === limitToOrgId);
  const canManageGroup = canManage && !limitToOrgId;
  const users = allUsers();
  const people = directoryEmployees();
  const [dialog, setDialog] = useState(null);
  const [issued, setIssued] = useState(null);
  const router = useRouter();
  const isGroup = tenant.kind === "group";
  const holding = companies.find((o) => o.isHolding);
  const group = isGroup ? groupsStore.get().find((g) => g.id === tenant.groupId) : null;

  const headcount = (orgId, branchName) =>
    people.filter((e) => e.orgId === orgId && (!branchName || e.branch === branchName)).length;

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <div className="bg-primary/10 text-primary grid h-11 w-11 place-items-center rounded-xl">
            {isGroup ? <Network className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{group?.name ?? tenant.name}</div>
            <div className="text-muted-foreground text-xs">
              {structureByKeyName(tenant.structure)} · {companies.length}{" "}
              {companies.length === 1 ? "company" : "companies"} ·{" "}
              {companies.reduce((n, o) => n + visibleBranches(o).length, 0)} branches ·{" "}
              {companies.reduce((n, o) => n + headcount(o.id), 0)} employees
            </div>
          </div>
          {canManageGroup && (
            <div className="flex flex-wrap gap-2">
              {isGroup && !holding && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const h = ensureHoldingCompany(tenant.id);
                    toast.success(
                      `${h.name} created — place employees or branches that sit directly under the group here`,
                    );
                  }}
                >
                  <Landmark className="h-4 w-4" /> Group-level employees / branches
                </Button>
              )}
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => setDialog({ kind: "company" })}
                data-testid="add-company"
              >
                <Plus className="h-4 w-4" />{" "}
                {isGroup ? "Add company" : "Add a company (makes a group)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {companies.map((o) => {
          const branches = allBranches(o);
          const companyAdmins = users.filter((u) => u.orgId === o.id && u.role === "Admin");
          const superAdmins = users.filter((u) => u.orgId === o.id && u.role === "SuperAdmin");
          return (
            <Card key={o.id} className="shadow-card" data-testid={`company-${o.code}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {o.name}
                      {o.isHolding && (
                        <Badge variant="outline" className="border-gold/40 text-gold text-[10px]">
                          Group level
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {o.code}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {o.legalName} · {headcount(o.id)} employees ·{" "}
                      {branches.length
                        ? `${branches.length} branches`
                        : "no branches (head office)"}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      o.status === "Active" ? "text-[10px]" : "text-destructive text-[10px]"
                    }
                  >
                    {o.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Administrators
                  </div>
                  {[...superAdmins, ...companyAdmins].map((u) => (
                    <div key={u.id} className="flex items-center gap-2 text-xs">
                      <ShieldCheck className="text-primary h-3.5 w-3.5" />
                      <span className="truncate">{u.name}</span>
                      <span className="text-muted-foreground truncate">{u.email}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {u.role === "SuperAdmin" ? "Super Admin" : "Company Admin"}
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
                  {branches.map((b) => {
                    const admins = users.filter(
                      (u) => u.role === "BranchAdmin" && u.orgId === o.id && u.branchId === b.id,
                    );
                    const count = headcount(o.id, b.name);
                    return (
                      <div
                        key={b.id}
                        className="border-border flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        <GitBranch className="text-primary h-3.5 w-3.5" />
                        <span className="font-medium">{b.name}</span>
                        {b.city && <span className="text-muted-foreground">{b.city}</span>}
                        <span className="text-muted-foreground">· {count} staff</span>
                        {b.status === "Inactive" && (
                          <Badge variant="outline" className="text-destructive text-[10px]">
                            Inactive
                          </Badge>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          {admins.map((a) => (
                            <Badge
                              key={a.id}
                              variant="outline"
                              className="text-[10px]"
                              title={a.email}
                            >
                              {a.name}
                            </Badge>
                          ))}
                          {canManage && (
                            <>
                              <button
                                type="button"
                                aria-label={`View & edit branch ${b.name}`}
                                title="View & edit branch"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => setDialog({ kind: "editBranch", org: o, branch: b })}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`${b.status === "Inactive" ? "Activate" : "Deactivate"} branch ${b.name}`}
                                title={
                                  b.status === "Inactive" ? "Activate branch" : "Deactivate branch"
                                }
                                className={
                                  b.status === "Inactive"
                                    ? "text-muted-foreground hover:text-primary"
                                    : "text-muted-foreground hover:text-destructive"
                                }
                                onClick={() => {
                                  const toInactive = b.status !== "Inactive";
                                  updateBranch(o.id, b.id, {
                                    status: toInactive ? "Inactive" : "Active",
                                  });
                                  toast.success(
                                    toInactive
                                      ? `${b.name} deactivated — it no longer appears in pickers`
                                      : `${b.name} activated`,
                                  );
                                }}
                              >
                                <Power className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          {canManage && count === 0 && admins.length === 0 && (
                            <button
                              type="button"
                              aria-label={`Remove branch ${b.name}`}
                              title="Remove branch"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (!window.confirm(`Remove branch ${b.name}?`)) return;
                                removeBranch(o.id, b.id);
                                toast.success("Branch removed");
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
                      Everyone works from the head office.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`view-dashboard-${o.code}`}
                    onClick={() => {
                      setActiveCompany(o.id);
                      toast.success(`Working in ${o.name}`);
                      router.push("/org/dashboard");
                    }}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" /> View dashboard
                  </Button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog({ kind: "branch", org: o })}
                    >
                      <Plus className="h-3.5 w-3.5" /> Branch
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
            setIssued(row);
          }}
        />
      )}
      {issued && <IssuedDialog row={issued} tenant={tenant} onClose={() => setIssued(null)} />}
    </div>
  );
}

function StructureDialog({ dialog, tenant, actor, onClose, onIssued }) {
  const org = dialog.org;
  const editing = dialog.kind === "editBranch" ? dialog.branch : null;
  const [f, setF] = useState({
    name: editing?.name ?? "",
    legalName: "",
    adminName: "",
    code: "",
    branchMode: "branches",
    firstBranch: "",
    // A branch inside a company defaults to the company's own location.
    city: editing?.city ?? (dialog.kind === "branch" ? (org?.city ?? "") : ""),
    state: editing?.state ?? (dialog.kind === "branch" ? org?.state || "Odisha" : "Odisha"),
    address: editing?.address ?? "",
    head: editing?.head ?? "",
    gstin: "",
    email: "",
    branchId: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
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
    company: tenant.kind === "group" ? "Add company to the group" : "Add a company",
    branch: `Add branch — ${org?.name ?? ""}`,
    editBranch: `Branch — ${editing?.name ?? ""} · ${org?.name ?? ""}`,
    admin: `Company Admin — ${org?.name ?? ""}`,
    branchAdmin: `Branch Admin — ${org?.name ?? ""}`,
  };
  const codeTaken = (code) =>
    orgsStore
      .get()
      .some(
        (o) =>
          o.code.toLowerCase() === code.toLowerCase() || o.id.toLowerCase() === code.toLowerCase(),
      ) || groupsStore.get().some((g) => g.code.toLowerCase() === code.toLowerCase());

  const submit = () => {
    if (dialog.kind === "company") {
      if (!f.name.trim() || !f.code.trim())
        return toast.error("Company name and code are required");
      if (codeTaken(f.code.trim())) return toast.error(`Code ${f.code.trim()} is already in use`);
      if (!f.adminName.trim()) return toast.error("Company Admin name is required");
      const email = f.email.trim().toLowerCase();
      if (!EMAIL.test(email)) return toast.error("Enter a valid Company Admin login e-mail");
      if (userByLogin(email)) return toast.error(`${email} already has a Seereon HRMS login`);
      const row = addCompany(tenant.id, {
        name: f.name.trim(),
        legalName: f.legalName.trim(),
        code: f.code.trim(),
        branchMode: f.branchMode,
        firstBranch: f.firstBranch,
        city: f.city,
        state: f.state,
        address: f.address,
        gstin: f.gstin.trim(),
      });
      toast.success(`${row.name} added (${row.id})`);
      return onIssued(
        provisionEntityAdmin({
          orgId: row.id,
          groupId: row.groupId,
          orgName: row.name,
          email,
          name: f.adminName.trim(),
          password: adminPassword,
          by: actor,
        }),
      );
    }
    if (dialog.kind === "editBranch") {
      const name = f.name.trim();
      if (!name) return toast.error("Branch name is required");
      // A rename carries the branch's employees, logins and departments with it (they reference it by name).
      const ok = renameBranch(org.id, editing.id, {
        name,
        city: f.city.trim(),
        state: f.state.trim(),
        address: f.address.trim(),
        head: f.head.trim(),
      });
      if (!ok) return toast.error(`${name} already exists in ${org.name}`);
      toast.success(`${name} updated`);
      return onClose();
    }
    if (dialog.kind === "branch") {
      const name = f.name.trim();
      if (!name) return toast.error("Branch name is required");
      if (!f.adminName.trim()) return toast.error("Branch Admin name is required");
      const email = f.email.trim().toLowerCase();
      if (!EMAIL.test(email)) return toast.error("Enter a valid Branch Admin login e-mail");
      if (userByLogin(email)) return toast.error(`${email} already has a Seereon HRMS login`);
      if (
        (org.branches ?? []).some((b) => !b.hidden && b.name.toLowerCase() === name.toLowerCase())
      )
        return toast.error(`${name} already exists in ${org.name}`);
      // A company that had no branches: its head office becomes a visible branch so its people stay placed.
      if (org.branchMode === "none")
        updateOrg(org.id, {
          branchMode: "branches",
          branches: (org.branches ?? []).map((b) => (b.hidden ? { ...b, hidden: false } : b)),
        });
      addBranch(org.id, {
        name,
        city: f.city.trim(),
        state: f.state.trim(),
        address: f.address.trim(),
        head: f.head.trim(),
      });
      toast.success(`${name} added to ${org.name}`);
      const branch = orgsStore
        .get()
        .find((o) => o.id === org.id)
        .branches.find((b) => b.name === name);
      return onIssued(
        provisionBranchAdmin({
          orgId: org.id,
          groupId: org.groupId,
          orgName: org.name,
          branchId: branch.id,
          branchName: branch.name,
          email,
          name: f.adminName.trim(),
          password: adminPassword,
          by: actor,
        }),
      );
    }
    const email = f.email.trim().toLowerCase();
    if (!EMAIL.test(email)) return toast.error("Enter a valid e-mail");
    if (userByLogin(email)) return toast.error(`${email} already has a Seereon HRMS login`);
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
    const branch = (org.branches ?? []).find((b) => b.id === f.branchId);
    if (!branch) return toast.error("Choose the branch");
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[dialog.kind]}</DialogTitle>
          <DialogDescription>
            {dialog.kind === "company"
              ? tenant.kind === "group"
                ? "A legal entity of the group with its own payroll and statutory registrations. Provide the company administrator's name and login e-mail to issue a temporary password."
                : "Adding a second company turns this organisation into a group; the existing company joins it. A temporary password is issued for the new company administrator."
              : dialog.kind === "branch"
                ? "A location of the company — its location starts from the company's own. Employees, attendance and branch reporting hang off it."
                : dialog.kind === "editBranch"
                  ? "View and change this branch's details."
                  : dialog.kind === "admin"
                    ? "Full administration of this company and all its branches. A temporary password is issued."
                    : "People operations of one branch only. A temporary password is issued."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(dialog.kind === "company" ||
            dialog.kind === "branch" ||
            dialog.kind === "editBranch") && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">
                {dialog.kind === "company" ? "Company name" : "Branch name"} *
              </Label>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          )}
          {dialog.kind === "company" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="company-admin-name" className="text-xs">
                  Company Admin name *
                </Label>
                <Input
                  id="company-admin-name"
                  value={f.adminName}
                  onChange={(e) => set("adminName", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="company-admin-email" className="text-xs">
                  Company Admin Login e-mail *
                </Label>
                <Input
                  id="company-admin-email"
                  type="email"
                  value={f.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="company-admin-password" className="text-xs">
                  Password (auto generated)
                </Label>
                <Input
                  id="company-admin-password"
                  value={adminPassword}
                  readOnly
                  placeholder="Enter the admin name and e-mail"
                />
                <p className="text-muted-foreground text-xs">
                  8 characters, generated from the admin name and e-mail. Must be changed on first
                  sign-in.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Legal name</Label>
                <Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company code *</Label>
                <Input
                  value={f.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder="ABC-001"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Structure</Label>
                <Select value={f.branchMode} onValueChange={(v) => set("branchMode", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branches">Company › Branches › Employees</SelectItem>
                    <SelectItem value="none">Company › Employees (no branches)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {f.branchMode === "branches" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">First branch</Label>
                  <Input
                    value={f.firstBranch}
                    onChange={(e) => set("firstBranch", e.target.value)}
                    placeholder="Head office"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">GST No.</Label>
                <Input
                  value={f.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  placeholder="21AAAAA0000A1Z5"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
              </div>
            </>
          )}
          {(dialog.kind === "company" ||
            dialog.kind === "branch" ||
            dialog.kind === "editBranch") && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input value={f.state} onChange={(e) => set("state", e.target.value)} />
              </div>
            </>
          )}
          {(dialog.kind === "branch" || dialog.kind === "editBranch") && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch head</Label>
                <Input value={f.head} onChange={(e) => set("head", e.target.value)} />
              </div>
            </>
          )}
          {dialog.kind === "branch" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="branch-admin-name" className="text-xs">
                  Branch Admin name *
                </Label>
                <Input
                  id="branch-admin-name"
                  value={f.adminName}
                  onChange={(e) => set("adminName", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="branch-admin-email" className="text-xs">
                  Branch Admin Login e-mail *
                </Label>
                <Input
                  id="branch-admin-email"
                  type="email"
                  value={f.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="branch-admin-password" className="text-xs">
                  Password (auto generated)
                </Label>
                <Input
                  id="branch-admin-password"
                  value={adminPassword}
                  readOnly
                  placeholder="Enter the admin name and e-mail"
                />
                <p className="text-muted-foreground text-xs">
                  8 characters, generated from the admin name and e-mail. Must be changed on first
                  sign-in.
                </p>
              </div>
            </>
          )}
          {(dialog.kind === "admin" || dialog.kind === "branchAdmin") && (
            <>
              {dialog.kind === "branchAdmin" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Branch *</Label>
                  <Select value={f.branchId} onValueChange={(v) => set("branchId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleBranches(org).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Login e-mail *</Label>
                <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={submit}>
            {dialog.kind === "editBranch"
              ? "Save changes"
              : dialog.kind === "company" || dialog.kind === "branch"
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Login issued — {row.user.name}</DialogTitle>
          <DialogDescription>
            Share these once. The temporary password must be changed on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            ["Sign-in URL", url],
            ["Tab", row.user.role === "SuperAdmin" ? "Super Admin" : "Admin"],
            ["Username", row.user.email],
            ["Temporary password", row.temporaryPassword],
          ].map(([k, v]) => (
            <div
              key={k}
              className="border-border flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              <span className="text-muted-foreground w-36 shrink-0 text-xs">{k}</span>
              <code className="min-w-0 flex-1 truncate">{v}</code>
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
            <Copy className="h-4 w-4" /> Copy e-mail
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
