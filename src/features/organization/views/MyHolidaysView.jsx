import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHolidaysLegacy } from "@/features/organization/data/hr-masters";
import { HolidayCalendar, typeTone } from "@/features/organization/components/HolidayCalendar";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";

function EmpHolidays() {
  // Single source: the three holiday calendars (National / State / Optional) maintained in Master Data.
  // Only the calendars that apply to the employee's own branch (state holidays of other branches are not days off).
  const me = useCurrentEmployee();
  const holidays = useHolidaysLegacy(getEmployeeProfile(me.id).job.location || me.branch);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="text-primary h-6 w-6" /> Holiday Calendar
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          National, state / regional and optional (restricted) holidays for the year — from the
          Master Data holiday calendars.
        </p>
      </div>

      <HolidayCalendar holidays={holidays} />

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          All holidays
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {holidays.map((h) => (
            <Card key={h.id} className="shadow-card">
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={typeTone(h.type)}>
                    {h.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      h.paid
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }
                  >
                    {h.paid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>
                <h3 className="font-semibold">{h.name}</h3>
                <div className="text-muted-foreground text-sm">
                  {h.from}
                  {h.to !== h.from ? ` → ${h.to}` : ""}
                </div>
                <p className="text-muted-foreground text-xs">{h.description}</p>
              </CardContent>
            </Card>
          ))}
          {holidays.length === 0 && (
            <Card className="shadow-card md:col-span-2 lg:col-span-3">
              <CardContent className="text-muted-foreground p-10 text-center text-sm">
                No holiday calendar has been published for your branch yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmpHolidays;
