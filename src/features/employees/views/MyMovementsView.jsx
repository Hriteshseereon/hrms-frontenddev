import { Repeat } from "lucide-react";
import { EmployeeCases } from "@/features/employees/components/EmployeeCases";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";

function EmpMovements() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Repeat className="text-primary h-6 w-6" /> My Movements &amp; Letters
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Promotions and appraisal outcomes, transfers, warnings (acknowledge here), resignation /
          exit, referrals and insurance recorded against {me.id}. Letters issued by HR are
          downloadable below.
        </p>
      </div>
      <EmployeeCases empId={me.id} mode="self" />
    </div>
  );
}

export default EmpMovements;
