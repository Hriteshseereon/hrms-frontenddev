// Probation completions coming up — a real action item for HOD/Org Admin,
// surfaced on the dashboard, per the client's "trigger to HOD before
// probation completion" requirement.
import { AlarmClock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useUpcomingProbations } from "@/features/employees/data/probation-data";

export function ProbationWidget() {
  const activeOrgId = useActiveOrgId();
  const upcoming = useUpcomingProbations(activeOrgId, 30);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlarmClock className="text-primary h-4 w-4" /> Probation Completions Due
        </CardTitle>
        {upcoming.length > 0 && (
          <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
            {upcoming.length} due
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <CheckCircle2 className="text-primary h-4 w-4" /> No probations due for review in the
            next 30 days.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p) => (
              <div
                key={p.employeeId}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {p.dept} · HOD: {p.hodName}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    p.daysRemaining < 0
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-gold/40 bg-gold/15 text-gold"
                  }
                >
                  {p.daysRemaining < 0
                    ? `${Math.abs(p.daysRemaining)}d overdue`
                    : `${p.daysRemaining}d left`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
