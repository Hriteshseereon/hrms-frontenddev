import { DollarSign, FileText, SlidersHorizontal, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { PayrollRunsTab } from "@/features/payroll/components/PayrollRunsTab";
import { PayrollPolicyTab } from "@/features/payroll/components/PayrollPolicyTab";
import { PayslipsTab } from "@/features/payroll/components/PayslipsTab";
import { LoansTab } from "@/features/payroll/components/LoansTab";
import { useScreenActions } from "@/features/auth/data/module-access";

function FinancePage() {
  const payrollAccess = useScreenActions("payroll.finance.payroll-run");
  const payslipAccess = useScreenActions("payroll.finance.payslips");
  const loanAccess = useScreenActions("payroll.finance.loan-requests");
  const policyAccess = useScreenActions("payroll.finance.wage-statutory-policy");
  const canViewPayroll = payrollAccess.can("View");
  const canViewPayslips = payslipAccess.can("View");
  const canViewLoans = loanAccess.can("View");
  const canViewPolicy = policyAccess.can("View");
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
          <PayrollRunsTab />
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
