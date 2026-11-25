import { DollarSign, FileText, SlidersHorizontal, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { PayrollTab } from "@/features/payroll/components/PayrollTab";
import { PayrollRunsTab } from "@/features/payroll/components/PayrollRunsTab";
import { PayrollPolicyTab } from "@/features/payroll/components/PayrollPolicyTab";
import { PayslipsTab } from "@/features/payroll/components/PayslipsTab";
import { LoansTab } from "@/features/payroll/components/LoansTab";
import { useSessionStore } from "@/features/auth/data/session-store";
import { canDo } from "@/features/auth/data/module-access";

function FinancePage() {
  // Signed in through the API: payroll runs come from the server and need a payroll.* permission.
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const permissions = useSessionStore((s) => s.permissions);
  const role = useSessionStore((s) => s.role);
  const roles = useSessionStore((s) => s.roles);
  
  const canPreparePayroll = canDo("payroll.run", { isAuthenticated: apiSession, role, roles, permissions });
  const canSeePayroll =
    !apiSession ||
    canDo("payroll.view", { isAuthenticated: apiSession, role, permissions }) ||
    canPreparePayroll ||
    (permissions ?? []).some((p) => String(p).startsWith("payroll."));
  const assignedModules = useSessionStore((s) => s.assignedModules);
  const isPrivilegedFinanceRole = ["COMPANY_ADMIN", "SUPER_ADMIN"].includes(
    String(role ?? "").toUpperCase(),
  );
  const canViewFinanceScreen = (screenKey) =>
    !apiSession ||
    isPrivilegedFinanceRole ||
    (assignedModules?.some(
      (module) =>
        module.key === "payroll" &&
        module.submodules?.some((submodule) =>
          submodule.screens?.some(
            (screen) => screen.key === screenKey && screen.view,
          ),
        ),
    ) ?? false);
  const canViewPayroll = canViewFinanceScreen("payroll-run");
  const canViewPayslips = canViewFinanceScreen("payslips");
  const canViewLoans = canViewFinanceScreen("loan-requests");
  const canViewPolicy = canViewFinanceScreen("wage-statutory-policy");
  const defaultTab = canViewPayroll
    ? "payroll"
    : canViewPayslips
      ? "payslips"
      : canViewLoans
        ? "loans"
        : "policy";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <DollarSign className="text-primary h-6 w-6" /> Finance &amp; Accounts
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a payroll run, select employees, run payroll and record salary payments.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <ScrollTabsList>
          {canViewPayroll && (
            <TabsTrigger value="payroll">
              <DollarSign className="h-4 w-4" /> Payroll
            </TabsTrigger>
          )}
          {canViewPayslips && (
            <TabsTrigger value="payslips">
              <FileText className="h-4 w-4" /> Payslips
            </TabsTrigger>
          )}
          {canViewLoans && (
            <TabsTrigger value="loans">
              <Wallet className="h-4 w-4" /> Employee Loans
            </TabsTrigger>
          )}
          {canViewPolicy && (
            <TabsTrigger value="policy">
              <SlidersHorizontal className="h-4 w-4" /> Wage &amp; Statutory Policy
            </TabsTrigger>
          )}
        </ScrollTabsList>
        {canViewPayroll && <TabsContent value="payroll" className="pt-4">
          {!apiSession ? (
            <PayrollTab />
          ) : canSeePayroll ? (
            <PayrollRunsTab />
          ) : (
            <div className="text-muted-foreground rounded-md border p-10 text-center text-sm">
              <div className="text-foreground text-base font-semibold">No access</div>
              You do not have permission to open payroll. Ask your administrator if you need it.
            </div>
          )}
        </TabsContent>}
        {canViewPayslips && <TabsContent value="payslips" className="pt-4">
          <PayslipsTab />
        </TabsContent>}
        {canViewLoans && <TabsContent value="loans" className="pt-4">
          <LoansTab />
        </TabsContent>}
        {canViewPolicy && (
          <TabsContent value="policy" className="pt-4">
            <PayrollPolicyTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default FinancePage;
