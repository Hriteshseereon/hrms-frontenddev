import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { CalendarDays, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHolidaysLegacy } from "@/features/organization/data/hr-masters";
import { canOpen, useCurrentUser } from "@/features/auth/data/auth-session";
import { HolidayCalendar, typeTone } from "@/features/organization/components/HolidayCalendar";

/**
 * Holiday calendars are maintained in Master Data → Attendance & time → Holiday calendars. This screen is the read
 * view for every org role (it used to redirect straight to /org/masters, which Managers, HODs, CFO and CTO cannot open
 * — they landed on Access Denied).
 */

function OrgHolidays() {
  const me = useCurrentUser();
  const holidays = useHolidaysLegacy();
  const canMaintain = canOpen(me.role, "/org/masters");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="text-primary h-6 w-6" /> Holiday Calendar
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            National, state / regional and optional (restricted) holidays for the year — from the
            Master Data holiday calendars.
          </p>
        </div>
        {canMaintain && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref({ to: "/org/masters", hash: "holidays" })}>
              <Settings2 className="h-4 w-4" /> Maintain calendars in Master Data
            </Link>
          </Button>
        )}
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
                No active holiday calendar yet
                {canMaintain
                  ? " — set one up under Master Data → Attendance & time → Holiday calendars."
                  : "."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrgHolidays;
