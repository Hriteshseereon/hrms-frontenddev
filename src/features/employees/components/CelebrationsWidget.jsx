// Upcoming birthdays, work anniversaries, and retirements — computed live
// from each employee's DOB and joining date, no manual entry needed.
import { Cake, Award, UserMinus2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import {
  useUpcomingBirthdays,
  useUpcomingAnniversaries,
  useUpcomingRetirements,
} from "@/features/communications/data/notifications-data";

function EmptyRow({ text }) {
  return <div className="text-muted-foreground py-3 text-sm">{text}</div>;
}

export function CelebrationsWidget() {
  const activeOrgId = useActiveOrgId();
  const birthdays = useUpcomingBirthdays(activeOrgId, 7);
  const anniversaries = useUpcomingAnniversaries(activeOrgId, 7);
  const retirements = useUpcomingRetirements(activeOrgId, undefined, 90);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cake className="text-primary h-4 w-4" /> Birthdays
          </CardTitle>
          {birthdays.length > 0 && <Badge variant="outline">{birthdays.length}</Badge>}
        </CardHeader>
        <CardContent>
          {birthdays.length === 0 ? (
            <EmptyRow text="No birthdays in the next 7 days." />
          ) : (
            <div className="space-y-2">
              {birthdays.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {b.dept} · turning {b.turningAge}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {b.daysAway === 0 ? "Today" : `${b.daysAway}d`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="text-primary h-4 w-4" /> Work Anniversaries
          </CardTitle>
          {anniversaries.length > 0 && <Badge variant="outline">{anniversaries.length}</Badge>}
        </CardHeader>
        <CardContent>
          {anniversaries.length === 0 ? (
            <EmptyRow text="No anniversaries in the next 7 days." />
          ) : (
            <div className="space-y-2">
              {anniversaries.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.dept} · {a.years} year{a.years === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {a.daysAway === 0 ? "Today" : `${a.daysAway}d`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserMinus2 className="text-primary h-4 w-4" /> Approaching Retirement
          </CardTitle>
          {retirements.length > 0 && <Badge variant="outline">{retirements.length}</Badge>}
        </CardHeader>
        <CardContent>
          {retirements.length === 0 ? (
            <EmptyRow text="No retirements in the next 90 days." />
          ) : (
            <div className="space-y-2">
              {retirements.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.dept} · <span className="whitespace-nowrap">{r.retirementDate}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-gold/40 bg-gold/15 text-gold text-[11px]"
                  >
                    {r.daysAway}d
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Compact version for the employee dashboard — teammates' birthdays this week. */
export function MyTeamCelebrationsCard() {
  const activeOrgId = useActiveOrgId();
  const birthdays = useUpcomingBirthdays(activeOrgId, 7);
  const anniversaries = useUpcomingAnniversaries(activeOrgId, 7);
  const combined = [
    ...birthdays.map((b) => ({
      id: b.id,
      name: b.name,
      label: `Birthday · turning ${b.turningAge}`,
      daysAway: b.daysAway,
    })),
    ...anniversaries.map((a) => ({
      id: a.id,
      name: a.name,
      label: `${a.years}-year anniversary`,
      daysAway: a.daysAway,
    })),
  ].sort((a, b) => a.daysAway - b.daysAway);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="text-primary h-4 w-4" /> This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {combined.length === 0 ? (
          <EmptyRow text="Nothing to celebrate this week." />
        ) : (
          <div className="space-y-2">
            {combined.slice(0, 5).map((c) => (
              <div key={`${c.id}-${c.label}`} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted-foreground text-xs">{c.label}</div>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {c.daysAway === 0 ? "Today" : `${c.daysAway}d`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
