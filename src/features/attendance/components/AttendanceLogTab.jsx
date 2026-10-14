import { useMemo, useState } from "react";
import { Search, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { OFFICES } from "@/features/employees/data/hr-data";
import {
  currentMonth,
  monthTitle,
  registerMonths,
  todayLocalIso,
  useLiveAttendance,
  summarise,
  pctTone,
  isWeekend,
  daysInMonth,
  useTeamScope,
} from "@/features/attendance/data/attendance-live";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { PunchCorrectionsCard } from "@/features/attendance/components/PunchCorrectionsCard";

/**
 * @typedef {"day" | "week" | "month"} Range
 */

const PAL_STYLES = {
  P: "bg-primary/10 text-primary border-primary/30",
  A: "bg-destructive/10 text-destructive border-destructive/30",
  L: "bg-gold/15 text-gold border-gold/40",
};

const LABELS = { P: "Present", A: "Absent", L: "Leave" };

const HR_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin"];

export function AttendanceLogTab() {
  const user = useCurrentUser();
  // The register used to be frozen on the seeded month (2026-07); it now opens on the current month and any month from
  // the seed onwards can be picked (the seeded July data is still shown when July is selected).
  const [month, setMonth] = useState(currentMonth);
  const isoFor = (day) => `${month}-${String(day).padStart(2, "0")}`;
  const MONTH_DAYS = daysInMonth(month);
  /** Weekly offs are not working days: they are shown as "WO" and never counted as present / absent / leave. */
  const isOff = (day) => isWeekend(isoFor(day));
  const [range, setRange] = useState("week");
  const [anchor, setAnchor] = useState(() => Number(todayLocalIso().slice(8, 10)));
  const [office, setOffice] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);

  const days = useMemo(() => {
    if (range === "day") return [anchor];
    if (range === "week") {
      const start = Math.max(1, anchor - 3);
      return Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= MONTH_DAYS);
    }
    return Array.from({ length: MONTH_DAYS }, (_, i) => i + 1);
  }, [range, anchor, MONTH_DAYS]);

  /**
   * A Manager only ever sees their own reporting line (everyone under them, plus themselves) and an HOD their
   * department. HR, Admin and the CXOs see the company.
   */
  const teamScope = useTeamScope();

  const liveRows = useLiveAttendance(month);

  const rows = useMemo(
    () =>
      liveRows.filter(
        (r) =>
          (!teamScope || teamScope.has(r.empId)) &&
          (office === "all" || r.office === office) &&
          (r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.empId.toLowerCase().includes(query.toLowerCase())),
      ),
    [liveRows, office, query, teamScope],
  );

  const exportCols = [
    "Employee",
    "Emp ID",
    "Office",
    "Shift",
    ...days.map((d) => String(d).padStart(2, "0")),
    "P",
    "A",
    "L",
  ];
  const exportRows = rows.map((r) => {
    const c = { P: 0, A: 0, L: 0 };
    days.forEach((d) => {
      const m = r.days[isoFor(d)];
      if (!isOff(d) && m) c[m] += 1;
    });
    return [
      r.name,
      r.empId,
      r.office,
      r.shift,
      ...days.map((d) => (isOff(d) ? "WO" : (r.days[isoFor(d)] ?? "—"))),
      String(c.P),
      String(c.A),
      String(c.L),
    ];
  });

  const totals = useMemo(() => {
    const t = { P: 0, A: 0, L: 0 };
    rows.forEach((r) =>
      days.forEach((d) => {
        const m = r.days[isoFor(d)];
        if (!isOff(d) && m) t[m] += 1;
      }),
    );
    return t;
    // isoFor / isOff derive from `month`, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, days, month]);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-sm min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <Select
            value={month}
            onValueChange={(m) => {
              setMonth(m);
              setAnchor((a) => Math.min(a, daysInMonth(m)));
            }}
          >
            <SelectTrigger className="w-full sm:w-[140px]" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {registerMonths().map((m) => (
                <SelectItem key={m} value={m}>
                  {monthTitle(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={range} onValueChange={(v) => setRange(v)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {range !== "month" && (
            <div className="flex items-center gap-2">
              <CalendarRange className="text-muted-foreground h-4 w-4" />
              <Input
                type="date"
                className="h-9 w-full sm:w-[160px]"
                value={isoFor(anchor)}
                min={isoFor(1)}
                max={isoFor(MONTH_DAYS)}
                onChange={(e) => {
                  // The register covers one month — ignore dates outside it instead of silently reading only the day.
                  if (!e.target.value.startsWith(month)) return;
                  const d = Number(e.target.value.slice(-2));
                  if (d >= 1 && d <= MONTH_DAYS) setAnchor(d);
                }}
                aria-label="Reference date"
              />
            </div>
          )}

          <Select value={office} onValueChange={setOffice}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offices</SelectItem>
              {OFFICES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            {["P", "A", "L"].map((k) => (
              <Badge key={k} variant="outline" className={cn("font-medium", PAL_STYLES[k])}>
                {LABELS[k]} · {totals[k]}
              </Badge>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() => {
                exportCsv("attendance-register", exportCols, exportRows);
                toast.success("Attendance register exported as CSV");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() => {
                const ok = exportReportPdf({
                  title: "Attendance Register",
                  subtitle: teamScope
                    ? `${user.name}'s team · ${month}`
                    : `All employees · ${month}`,
                  summary: [
                    { label: "Employees", value: String(rows.length) },
                    { label: "Present", value: String(totals.P) },
                    { label: "Absent", value: String(totals.A) },
                    { label: "Leave", value: String(totals.L) },
                  ],
                  columns: exportCols,
                  rows: exportRows,
                });
                toast[ok ? "success" : "error"](
                  ok ? "Attendance register ready — save as PDF" : "Allow pop-ups to download",
                );
              }}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {HR_ROLES.includes(user.role) && <PunchCorrectionsCard />}

      <Card className="shadow-card overflow-hidden">
        {teamScope && (
          <div className="border-border bg-muted/30 text-muted-foreground border-b px-4 py-2 text-xs">
            Showing attendance for your reporting line only ({rows.length} team member
            {rows.length === 1 ? "" : "s"}).
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="bg-muted/40 sticky left-0 p-3 text-left">Employee</th>
                <th className="p-3 text-left">Office</th>
                <th className="p-3 text-left">Shift</th>
                {days.map((d) => (
                  <th key={d} className="p-2 text-center font-semibold">
                    {String(d).padStart(2, "0")}
                  </th>
                ))}
                <th className="p-3 text-center">P / A / L</th>
                <th className="p-3 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => {
                const counts = { P: 0, A: 0, L: 0 };
                days.forEach((d) => {
                  const m = r.days[isoFor(d)];
                  if (!isOff(d) && m) counts[m] += 1;
                });
                return (
                  <tr key={r.empId} className={clickableRow} onClick={() => setDetail(r)}>
                    <td className="bg-card sticky left-0 p-3">
                      <div className="font-semibold whitespace-nowrap">{r.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.empId} · {r.designation}
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3 whitespace-nowrap">{r.office}</td>
                    <td className="text-muted-foreground p-3 whitespace-nowrap">{r.shift}</td>
                    {days.map((d) => {
                      const s = r.days[isoFor(d)];
                      if (isOff(d) || !s)
                        return (
                          <td key={d} className="p-1.5 text-center">
                            <span
                              title={`${isOff(d) ? "Weekly off" : "Not marked"} · ${isoFor(d)}`}
                              className="border-border bg-muted text-muted-foreground inline-grid h-7 w-7 place-items-center rounded-md border text-[10px] font-semibold"
                            >
                              {isOff(d) ? "WO" : "—"}
                            </span>
                          </td>
                        );
                      return (
                        <td key={d} className="p-1.5 text-center">
                          <span
                            title={`${LABELS[s]} · ${isoFor(d)}`}
                            className={cn(
                              "inline-grid h-7 w-7 place-items-center rounded-md border text-xs font-bold",
                              PAL_STYLES[s],
                            )}
                          >
                            {s}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center text-xs font-medium whitespace-nowrap">
                      <span className="text-primary">{counts.P}</span> /{" "}
                      <span className="text-destructive">{counts.A}</span> /{" "}
                      <span className="text-gold">{counts.L}</span>
                    </td>
                    <td
                      className={cn(
                        "p-3 text-center text-xs font-semibold tabular-nums",
                        pctTone(summarise(r, month).pct),
                      )}
                    >
                      {summarise(r, month).pct} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {detail &&
        (() => {
          const s = summarise(detail, month);
          const dayRows = Object.entries(detail.days)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, mark]) => ({
              date,
              mark: isWeekend(date) ? "WO · Weekly off" : `${mark} · ${LABELS[mark]}`,
            }));
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.name}
              subtitle={`${detail.empId} · ${detail.designation} · ${month}`}
              badges={
                <Badge variant="outline" className={pctTone(s.pct)}>
                  {s.pct} % attendance
                </Badge>
              }
              record={{
                name: detail.name,
                empId: detail.empId,
                designation: detail.designation,
                dept: detail.dept,
                office: detail.office,
                shift: detail.shift,
                present: s.present,
                absent: s.absent,
                leave: s.leave,
                working: s.working,
                dailyMarks: dayRows,
              }}
              labels={{
                dept: "Department",
                working: "Working days",
                present: "Present days",
                absent: "Absent days",
                leave: "Leave days",
                dailyMarks: "Daily marks",
              }}
              sections={[
                {
                  title: "Employee",
                  keys: ["name", "empId", "designation", "dept", "office", "shift"],
                },
                { title: "Month summary", keys: ["working", "present", "absent", "leave"] },
                { title: "Daily marks", keys: ["dailyMarks"] },
              ]}
            />
          );
        })()}
    </div>
  );
}
