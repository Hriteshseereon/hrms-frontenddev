import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useGrievances } from "@/features/exit/data/grievance-data";
import {
  GrievanceDetail,
  GrievanceTable,
  RaiseGrievanceForm,
} from "@/features/exit/components/GrievancePieces";

function Page() {
  const me = useCurrentUser();
  const mine = useGrievances().filter((g) => g.empId === me.id);
  const [openId, setOpenId] = useState(null);
  const open = mine.find((g) => g.id === openId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessageSquareWarning className="text-primary h-6 w-6" /> Grievance Redressal
        </h1>
        <p className="text-muted-foreground text-sm">
          Every grievance is acknowledged within its SLA and handled by the designated committee.
          You can track progress, confirm the resolution or appeal to the CHRO.
        </p>
      </div>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Raise a grievance</CardTitle>
        </CardHeader>
        <CardContent>
          <RaiseGrievanceForm />
        </CardContent>
      </Card>
      <GrievanceTable rows={mine} onOpen={setOpenId} showEmployee={false} />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.subject}</SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <GrievanceDetail g={open} mode="employee" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default Page;
