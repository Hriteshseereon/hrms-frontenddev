import { IndianRupee } from "lucide-react";
import { ExpenditureWorkspace } from "@/features/finance/components/ExpenditureWorkspace";

function OrgExpenditure() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <IndianRupee className="text-primary h-6 w-6" /> Expenditure Booking
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          General spend booking with category, cost centre and outcome — separate from reimbursement
          claims.
        </p>
      </div>
      <ExpenditureWorkspace />
    </div>
  );
}

export default OrgExpenditure;
