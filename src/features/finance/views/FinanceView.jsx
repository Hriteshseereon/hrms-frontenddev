import { DollarSign, FileText, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { PayrollTab } from "@/features/payroll/components/PayrollTab";
import { PayslipsTab } from "@/features/payroll/components/PayslipsTab";
import { LoansTab } from "@/features/payroll/components/LoansTab";

function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <DollarSign className="text-primary h-6 w-6" /> Finance &amp; Accounts
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Attendance-linked payroll runs with maker–checker approval, generated payslips and
          employee loans.
        </p>
      </div>

      <Tabs defaultValue="payroll">
        <ScrollTabsList>
          <TabsTrigger value="payroll">
            <DollarSign className="h-4 w-4" /> Payroll
          </TabsTrigger>
          <TabsTrigger value="payslips">
            <FileText className="h-4 w-4" /> Payslips
          </TabsTrigger>
          <TabsTrigger value="loans">
            <Wallet className="h-4 w-4" /> Employee Loans
          </TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="payroll" className="pt-4">
          <PayrollTab />
        </TabsContent>
        <TabsContent value="payslips" className="pt-4">
          <PayslipsTab />
        </TabsContent>
        <TabsContent value="loans" className="pt-4">
          <LoansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FinancePage;
