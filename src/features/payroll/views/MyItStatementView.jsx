import { ScrollText } from "lucide-react";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { ItStatement } from "@/features/payroll/components/ItReports";

function EmpItStatement() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="text-primary h-6 w-6" /> IT Statement
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Section-wise tax computation for the financial year — expand any section to see its
          components.
        </p>
      </div>
      <ItStatement emp={me} />
    </div>
  );
}

export default EmpItStatement;
