
import { useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useState } from "react";
import {
  Sparkles,
  Brain,
  Users2,
  Wallet,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  UserCircle,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ORGANIZATION, signIn, userByLogin } from "@/features/auth/data/auth-session";
import { signInEmployee } from "@/features/auth/data/emp-session";
import { orgsStore, groupsStore } from "@/features/organization/data/group-data";
import {
  loginOf,
  recordFailedSignIn,
  recordSignIn,
  signInPolicy,
} from "@/features/auth/data/rbac-store";
import { mustChangeTemporaryPassword } from "@/features/auth/data/tenant-users";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { terminationStore } from "@/features/employees/data/people-cases";
import { useOrganisation } from "@/features/organization/data/tenancy";
import { env } from "@/config/env";
import { DEMO_LOGINS } from "@/features/auth/views/demo-logins";

// Separate Super Admin authentication service
import SuperAdmin_auth from "@/api/SuperAdmin_auth";

const tabsFor = (ws) => [
  {
    key: "super",
    icon: Crown,
    title: "Super Admin",
    text:
      ws?.kind === "group"
        ? "Head of the group — collective dashboards across every company, switch into any company or branch, run the organisation setup, create companies, branches and their admins."
        : "Head of the organisation — dashboards, organisation setup, branches, admins and configuration for the whole company.",
  },
  {
    key: "admin",
    icon: Building2,
    title: "Admin",
    text: "Company Admin (one company, all its branches) or Branch Admin (one branch) — sees only the data of their company or branch.",
  },
  {
    key: "employee",
    icon: UserCircle,
    title: "Employee",
    text: "Every other role — CEO, CFO, HR, HOD, Manager, Employee. Screens open by role and only for your own company.",
  },
];

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Seereon HRMS processes employee data solely to run your organisation's HR, payroll, attendance, performance and compliance operations.",
      "Personal data (identity, contact, KYC, bank, salary and statutory identifiers) is visible only to the roles your administrators authorise, and every sensitive screen is permission-gated.",
      "Data is retained for the period required by Indian employment, tax and statutory law (PF, ESI, PT, TDS registers) and is removed or anonymised after the retention period.",
      "Seereon Consulting & IT Services Pvt. Ltd. does not sell or share your data with third parties. Questions: support@seereon.co.in.",
    ],
  },
  terms: {
    title: "Terms of Use",
    body: [
      "Access is restricted to accounts issued by your organisation's administrators. Credentials are personal and must not be shared.",
      "All actions are recorded against the signed-in account; administrators can review sign-ins, approvals and changes in the audit trail.",
      "The organisation remains the owner of its data. Seereon Consulting & IT Services Pvt. Ltd. provides the software and support under the service agreement signed with your organisation.",
      "Misuse — attempting to access another person's data, circumventing permissions, or bulk-extracting records without authorisation — may lead to account suspension and disciplinary action.",
    ],
  },
};

/** Sign-in for the organisation: Super Admin, Admin and Employee tabs. */
function Login() {
  const router = useRouter();
  const ws = useOrganisation();

  const [tab, setTab] = useState("employee");
  const [show, setShow] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [legal, setLegal] = useState(null);

  const TABS = tabsFor(ws);
  const t = TABS.find((x) => x.key === tab);

  if (!ws) return null;

  async function submit(e) {
    e.preventDefault();

    // Authenticate through the backend API for all roles
    try {
      const authData = await SuperAdmin_auth.login(login.trim(), password);
      const user = authData?.user;
      const roleUpper = String(user?.role || "").toUpperCase();

      if (tab === "super" && roleUpper !== "SUPER_ADMIN" && roleUpper !== "SUPERADMIN") {
        toast.error("This account is not a Super Admin — use the Admin or Employee tab");
        return;
      }

      if (tab === "admin" && roleUpper !== "COMPANY_ADMIN" && roleUpper !== "BRANCH_ADMIN") {
        toast.error(
          roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN"
            ? "Super Admins sign in on the Super Admin tab"
            : "Company / Branch Admin access only — other roles use the Employee tab",
        );
        return;
      }

      const roleLabel = roleUpper ? roleUpper.replace(/_/g, " ") : "User";
      toast.success(`${user?.full_name || user?.name || roleLabel} login successful`);

      const targetPath = roleUpper === "EMPLOYEE" ? "/emp/dashboard" : "/org/dashboard";
      router.push(buildHref({ to: targetPath }));
      return;
    } catch (error) {
      const detail = error.response?.data?.detail;
      const status = error.response?.status;

      // If backend returned invalid credentials or user does not exist in local mocks, show error
      if (status === 401 || status === 403 || (detail && !userByLogin(login))) {
        let message = "Login failed. Please check your credentials.";
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          message = detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join(", ");
        }
        toast.error(message);
        return;
      }
    }

    // EXISTING ADMIN AND EMPLOYEE LOGIN: unchanged logic.
    const found = userByLogin(login);

    if (!found) {
      toast.error(`No ${ws.name} account with that ID / e-mail`);
      return;
    }

    const role = found.role;

    if (tab === "super" && role !== "SuperAdmin") {
      toast.error(
        "This account is not a Super Admin — use the Admin or Employee tab",
      );
      return;
    }

    if (tab === "admin" && role !== "Admin" && role !== "BranchAdmin") {
      toast.error(
        role === "SuperAdmin"
          ? "Super Admins sign in on the Super Admin tab"
          : "Company / Branch Admin access only — other roles use the Employee tab",
      );
      return;
    }

    if (
      tab === "employee" &&
      (role === "Admin" ||
        role === "SuperAdmin" ||
        role === "BranchAdmin")
    ) {
      toast.error(
        "Administrators sign in on the Admin / Super Admin tab",
      );
      return;
    }

    const org = orgsStore.get().find((o) => o.id === found.orgId);

    const group = groupsStore
      .get()
      .find((g) => g.id === (found.groupId ?? org?.groupId));

    // A suspended / inactive company cannot sign in.
    const blocked = (s) =>
      s === "Suspended" || s === "Inactive";

    const groupOrgs = orgsStore
      .get()
      .filter((o) => o.groupId && o.groupId === group?.id);

    if (
      role === "SuperAdmin"
        ? groupOrgs.length > 0 &&
          groupOrgs.every((o) => blocked(o.status))
        : blocked(org?.status)
    ) {
      toast.error(
        `${org?.name ?? "This company"} is ${org?.status?.toLowerCase() ?? "suspended"} — contact your Super Admin`,
      );
      return;
    }

    // Check whether the local account is suspended or locked.
    const account = loginOf(found.id);

    if (account.status === "Suspended") {
      toast.error(
        "This account is suspended — contact your administrator",
      );
      return;
    }

    if (account.status === "Locked") {
      toast.error(
        "Account locked after too many failed attempts — ask your administrator to unlock it",
      );
      return;
    }

    // Block separated employees.
    const today = new Date().toISOString().slice(0, 10);

    const separated =
      findEmployee(found.id)?.status === "Exited" ||
      terminationStore
        .get()
        .some(
          (c) =>
            c.empId === found.id &&
            c.status === "Effective" &&
            c.lastWorkingDay < today,
        );

    if (separated) {
      toast.error(
        "This account belongs to a former employee and can no longer sign in",
      );
      return;
    }

    const signed = signIn(login, password);

    if (!signed) {
      const n = recordFailedSignIn(found.id);
      const limit = Math.max(3, signInPolicy().lockAfter || 5);

      toast.error(
        n >= limit
          ? `Incorrect password — account locked after ${limit} failed attempts`
          : `Incorrect password (${n} of ${limit} attempts)`,
      );

      return;
    }

    recordSignIn(signed.id);
    signInEmployee(signed.email);

    toast.success(
      `Welcome, ${signed.name} · ${
        signed.role === "SuperAdmin" && group
          ? `${group.name} · all companies`
          : org?.name ?? ORGANIZATION.name
      }`,
    );

    // Temporary / reset password handling.
    if (
      account.mustReset ||
      mustChangeTemporaryPassword(signed.id)
    ) {
      toast.info(
        "You signed in with a temporary password — please set a new one now",
      );

      router.push("/emp/profile");
      return;
    }

    router.push(
      buildHref({
        to:
          signed.portal === "org"
            ? "/org/dashboard"
            : "/emp/dashboard",
      }),
    );
  }

  return (
    <div className="bg-background grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <div className="bg-gradient-emerald relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(200,169,81,0.6), transparent 50%), radial-gradient(circle at 80% 70%, rgba(200,169,81,0.35), transparent 55%)",
          }}
        />
        <div className="bg-gold/20 absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl" />

        <div className="relative">
          <BrandLogo variant="dark" />
        </div>

        <div className="relative max-w-md space-y-6">
          <div className="border-gold/40 text-gold inline-flex items-center gap-2 rounded-full border bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wider uppercase">
            <Sparkles className="h-3 w-3" /> Seereon HRMS · multi-company HRMS
          </div>

          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight">
            Smart Workforce.
            <br />
            <span className="text-gold">
              Intelligent Growth.
            </span>
          </h1>

          <p className="text-[15px] leading-relaxed text-white/70">
            One HR platform for your whole group — group Super Admin,
            company Admins and every employee, with data scoped to the
            company each person belongs to.
          </p>

          <div className="grid gap-3 pt-4">
            {[
              {
                i: Crown,
                t: "Group › Entity › Branch",
                d: "Super Admin sees everything; Admins and employees see only their company",
              },
              {
                i: Brain,
                t: "Role-based access",
                d: "CEO, CFO, HR, HOD, Manager and Employee views",
              },
              {
                i: Users2,
                t: "Full employee lifecycle",
                d: "Hiring to exit, retention, F&F and rejoin",
              },
              {
                i: Wallet,
                t: "Payroll, statutory & tax",
                d: "Payslips, PF/ESI/TDS filings, Odisha registers",
              },
            ].map((f) => (
              <div
                key={f.t}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
              >
                <div className="bg-gold/20 text-gold border-gold/30 grid h-9 w-9 place-items-center rounded-lg border">
                  <f.i className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.t}</div>
                  <div className="text-xs text-white/60">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-between text-xs text-white/50">
          <span>
            © 2026 Seereon Consulting &amp; IT Services · Seereon HRMS
          </span>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setLegal("privacy")}
              className="hover:text-gold"
            >
              Privacy
            </button>

            <button
              type="button"
              onClick={() => setLegal("terms")}
              className="hover:text-gold"
            >
              Terms
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="lg:hidden">
              <BrandLogo />
            </div>

            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <div className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold">
            <ShieldCheck className="h-3 w-3" /> Secure Enterprise Access
          </div>

          <h1
            className="mt-3 text-3xl font-bold tracking-tight"
            data-testid="workspace-name"
          >
            {ws.name}
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to your organisation&apos;s Seereon HRMS workspace.
            Everything after sign-in is scoped to your{" "}
            {ws.kind === "group"
              ? "group, company, branch"
              : "company, branch"}{" "}
            and role.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {TABS.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setTab(x.key)}
                className={cn(
                  "min-w-0 rounded-xl border p-2.5 text-left transition sm:p-3",
                  tab === x.key
                    ? "border-primary bg-primary/5 shadow-card"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <x.icon
                  className={cn(
                    "mb-1 h-5 w-5",
                    tab === x.key
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />

                <div className="truncate text-[13px] font-semibold whitespace-nowrap sm:text-sm">
                  {x.title}
                </div>
              </button>
            ))}
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            {t.text}
          </p>

          <form
            onSubmit={submit}
            className="border-border bg-card shadow-premium mt-4 space-y-4 rounded-2xl border p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="u">
                {tab === "super" ? "Email" : "Email or user ID"}
              </Label>

              <Input
                id="u"
                type={tab === "super" ? "email" : "text"}
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="name@company.com"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>

              <div className="relative">
                <Input
                  id="p"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="bg-gradient-emerald shadow-premium h-11 w-full text-white hover:opacity-95"
            >
              Sign in as {t.title}
            </Button>

            <div className="text-muted-foreground flex items-center justify-center gap-4 text-center text-xs">
              <a
                href="/forgot-password"
                className="hover:text-primary"
              >
                Forgot password?
              </a>

              <button
                type="button"
                onClick={() => setLegal("privacy")}
                className="hover:text-primary lg:hidden"
              >
                Privacy
              </button>

              <button
                type="button"
                onClick={() => setLegal("terms")}
                className="hover:text-primary lg:hidden"
              >
                Terms
              </button>
            </div>
          </form>

          {env.dataMode === "mock" && DEMO_LOGINS[tab] && (
            <div className="border-border bg-muted/30 text-muted-foreground mt-4 rounded-xl border border-dashed p-3 text-xs">
              Demo · {DEMO_LOGINS[tab]}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!legal}
        onOpenChange={(v) => !v && setLegal(null)}
      >
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {legal ? LEGAL[legal].title : ""}
            </DialogTitle>

            <DialogDescription>
              Seereon HRMS · {ws.legalName || ws.name} · effective from{" "}
              {ws.createdOn}
            </DialogDescription>
          </DialogHeader>

          <div className="text-muted-foreground space-y-3 text-sm">
            {(legal ? LEGAL[legal].body : []).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Login;
