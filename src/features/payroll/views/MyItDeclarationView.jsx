import { ClipboardSignature } from "lucide-react";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { ItDeclaration } from "@/features/payroll/components/ItReports";
import { ContributionsCard } from "@/features/payroll/components/ContributionsCard";

function EmpItDeclaration() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardSignature className="text-primary h-6 w-6" /> IT Declaration
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Declare your income and exemptions for the year under the New Tax Regime. Payroll locks
          declarations once the window closes.
        </p>
      </div>
      <ContributionsCard empId={me.id} empName={me.name} />
      <ItDeclaration emp={me} />
    </div>
  );
}

export default EmpItDeclaration;
