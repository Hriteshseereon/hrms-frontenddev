import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, CalendarRange, Download, RefreshCw } from "lucide-react";
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
import {
  currentMonth,
  monthTitle,
  registerMonths,
  todayLocalIso,
  daysInMonth,
  useTeamScope,
} from "@/features/attendance/data/attendance-live";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  getAllEmployeeAttendanceDaily,
  getAllEmployeeAttendanceMonthly,
  getAllEmployeeAttendanceWeekly,
} from "@/api/allEmployeeAttendance";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { PunchCorrectionsCard } from "@/features/attendance/components/PunchCorrectionsCard";

/** @typedef {"day" | "week" | "month"} Range */

const PAL_STYLES = {
  P: "bg-primary/10 text-primary border-primary/30",
  A: "bg-destructive/10 text-destructive border-destructive/30",
  L: "bg-gold/15 text-gold border-gold/40",
  WO: "bg-muted text-muted-foreground border-border",
  H: "bg-blue-500/10 text-blue-700 border-blue-500/30",
};
const LABELS = { P: "Present", A: "Absent", L: "Leave", WO: "Week off", H: "Holiday" };
const HR_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin"];

const statusOf = (employee) => {
  const raw = String(employee.day_type ?? employee.attendance_status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[ -]+/g, "_");
  if (raw.includes("WEEK_OFF") || raw === "WO") return "WO";
  if (raw.includes("HOLIDAY") || raw === "H") return "H";
  if (raw.includes("LEAVE") || raw === "L") return "L";
  if (raw.includes("ABSENT") || raw === "A") return "A";
  if (raw.includes("PRESENT") || raw === "P" || raw === "HALF_DAY" || raw === "HD") return "P";
  return "";
};

const responseParts = (response) => {
  const body = response?.data ?? response;
  const payload = body?.data ?? body;
  return {
    employees: Array.isArray(payload?.employees) ? payload.employees : [],
    summary: payload,
  };
};

const reportsForDateRange = (employees, dates) => {
  const reports = Object.fromEntries(dates.map((date) => [date, { employees: [] }]));
  employees.forEach((employee) => {
    (employee.attendance ?? []).forEach((dayRecord) => {
      if (!reports[dayRecord.date]) return;
      reports[dayRecord.date].employees.push({
        ...employee,
        attendance_date: dayRecord.date,
        attendance_status: dayRecord.status,
        day_type: dayRecord.status,
        working_hours: dayRecord.working_hours,
      });
    });
  });
  return reports;
};

export function AttendanceLogTab() {
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);
  const [range, setRange] = useState("day");
  const [anchor, setAnchor] = useState(() => Number(todayLocalIso().slice(8, 10)));
  const [office, setOffice] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [dailyReports, setDailyReports] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const monthDays = daysInMonth(month);
  const isoFor = useCallback((day) => `${month}-${String(day).padStart(2, "0")}`, [month]);
  const days = useMemo(() => {
    if (range === "day") return [anchor];
    if (range === "week") {
      const weekday = new Date(`${month}-${String(anchor).padStart(2, "0")}T00:00:00`).getDay();
      const start = Math.max(1, anchor - weekday);
      return Array.from({ length: 7 }, (_, index) => start + index).filter(
        (day) => day <= monthDays,
      );
    }
    return Array.from({ length: monthDays }, (_, index) => index + 1);
  }, [range, anchor, monthDays]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const next = {};
        const dates = days.map(isoFor);
        if (range === "week") {
          const report = responseParts(
            await getAllEmployeeAttendanceWeekly(dates[0], dates[dates.length - 1]),
          );
          Object.assign(next, reportsForDateRange(report.employees, dates));
        } else if (range === "month") {
          const [year, monthNumber] = month.split("-").map(Number);
          const report = responseParts(await getAllEmployeeAttendanceMonthly(monthNumber, year));
          Object.assign(next, reportsForDateRange(report.employees, dates));
        } else {
          for (let index = 0; index < dates.length; index += 5) {
            const batch = dates.slice(index, index + 5);
            const results = await Promise.all(
              batch.map(async (date) => [
                date,
                responseParts(await getAllEmployeeAttendanceDaily(date)),
              ]),
            );
            results.forEach(([date, report]) => {
              next[date] = report;
            });
          }
        }
        if (active) setDailyReports(next);
      } catch (error) {
        if (active) {
          setDailyReports({});
          setLoadError(
            error?.response?.data?.detail ??
              error?.response?.data?.message ??
              error?.message ??
              "Could not load attendance from the API.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [days, isoFor, month, range, reloadKey]);

  const teamScope = useTeamScope();
  const allRows = useMemo(() => {
    const byEmployee = new Map();
    days.forEach((day) => {
      const date = isoFor(day);
      const report = dailyReports[date];
      (report?.employees ?? []).forEach((employee) => {
        const id = String(employee.employee_id ?? employee.employee_code ?? "");
        if (!id) return;
        let row = byEmployee.get(id);
        if (!row) {
          row = {
            empId: id,
            employeeCode: employee.employee_code ?? id,
            name: employee.employee_name ?? employee.employee_display ?? "Employee",
            designation: employee.designation ?? "—",
            dept: employee.department_name ?? employee.department ?? "—",
            office: employee.branch_name ?? employee.company_name ?? employee.branch_id ?? "—",
            shift: employee.shift_name ?? "—",
            days: {},
            attendanceByDate: {},
          };
          byEmployee.set(id, row);
        }
        row.days[date] = statusOf(employee);
        row.attendanceByDate[date] = employee;
      });
    });
    return [...byEmployee.values()];
  }, [dailyReports, days, isoFor]);

  const rows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          (!teamScope || teamScope.has(row.empId) || teamScope.has(row.employeeCode)) &&
          (office === "all" || row.office === office) &&
          `${row.name} ${row.employeeCode} ${row.designation}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [allRows, office, query, teamScope],
  );
  const offices = useMemo(
    () =>
      [
        ...new Set(allRows.map((row) => row.office).filter((value) => value && value !== "—")),
      ].sort(),
    [allRows],
  );

  const countsFor = useCallback(
    (row) => {
      const counts = { P: 0, A: 0, L: 0 };
      days.forEach((day) => {
        const status = row.days[isoFor(day)];
        if (status in counts) counts[status] += 1;
      });
      const marked = counts.P + counts.A + counts.L;
      return { ...counts, marked, pct: marked ? Math.round((counts.P / marked) * 1000) / 10 : 0 };
    },
    [days, isoFor],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (total, row) => {
          const counts = countsFor(row);
          total.P += counts.P;
          total.A += counts.A;
          total.L += counts.L;
          return total;
        },
        { P: 0, A: 0, L: 0 },
      ),
    [rows, countsFor],
  );

  const exportCols = [
    "Employee",
    "Emp ID",
    "Office",
    "Shift",
    ...days.map((day) => isoFor(day)),
    "Present",
    "Absent",
    "Leave",
  ];
  const exportRows = rows.map((row) => {
    const counts = countsFor(row);
    return [
      row.name,
      row.employeeCode,
      row.office,
      row.shift,
      ...days.map((day) => {
        const status = row.days[isoFor(day)];
        return status ? (LABELS[status] ?? status) : "Not marked";
      }),
      String(counts.P),
      String(counts.A),
      String(counts.L),
    ];
  });

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-sm min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <Select
            value={month}
            onValueChange={(value) => {
              setMonth(value);
              setAnchor((day) => Math.min(day, daysInMonth(value)));
            }}
          >
            <SelectTrigger className="w-full sm:w-[140px]" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {registerMonths().map((value) => (
                <SelectItem key={value} value={value}>
                  {monthTitle(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={range} onValueChange={setRange}>
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
                max={isoFor(monthDays)}
                onChange={(event) => {
                  if (!event.target.value.startsWith(month)) return;
                  const day = Number(event.target.value.slice(-2));
                  if (day >= 1 && day <= monthDays) setAnchor(day);
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
              {offices.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Employees · {rows.length}</Badge>
            {["P", "A", "L"].map((key) => (
              <Badge key={key} variant="outline" className={cn("font-medium", PAL_STYLES[key])}>
                {LABELS[key]} · {totals[key]}
              </Badge>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length || loading}
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
              disabled={!rows.length || loading}
              onClick={() => {
                const ok = exportReportPdf({
                  title: "Attendance Register",
                  subtitle: `${rows.length} employees · ${days.length} day(s) · ${monthTitle(month)}`,
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

      {loadError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          Could not load attendance: {loadError}
        </div>
      )}

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
                {days.map((day) => (
                  <th key={day} className="p-2 text-center font-semibold">
                    {String(day).padStart(2, "0")}
                  </th>
                ))}
                <th className="p-3 text-center">P / A / L</th>
                <th className="p-3 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading && (
                <tr>
                  <td className="text-muted-foreground p-8 text-center" colSpan={days.length + 5}>
                    Loading attendance from the server…
                  </td>
                </tr>
              )}
              {!loading && !loadError && rows.length === 0 && (
                <tr>
                  <td className="text-muted-foreground p-8 text-center" colSpan={days.length + 5}>
                    No employee attendance was returned for this date range.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => {
                  const counts = countsFor(row);
                  return (
                    <tr key={row.empId} className={clickableRow} onClick={() => setDetail(row)}>
                      <td className="bg-card sticky left-0 p-3">
                        <div className="font-semibold whitespace-nowrap">{row.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {row.employeeCode} · {row.designation}
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3 whitespace-nowrap">{row.office}</td>
                      <td className="text-muted-foreground p-3 whitespace-nowrap">{row.shift}</td>
                      {days.map((day) => {
                        const date = isoFor(day);
                        const status = row.days[date];
                        return (
                          <td key={day} className="p-1.5 text-center">
                            <span
                              title={`${status ? (LABELS[status] ?? status) : "Not marked"} · ${date}`}
                              className={cn(
                                "inline-grid h-7 min-w-7 place-items-center rounded-md border px-1 text-[10px] font-semibold",
                                status
                                  ? (PAL_STYLES[status] ?? PAL_STYLES.P)
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {status || "—"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-3 text-center text-xs font-medium whitespace-nowrap">
                        <span className="text-primary">{counts.P}</span> /{" "}
                        <span className="text-destructive">{counts.A}</span> /{" "}
                        <span className="text-gold">{counts.L}</span>
                      </td>
                      <td className="p-3 text-center text-xs font-semibold tabular-nums">
                        <span
                          className={cn(
                            counts.pct >= 95
                              ? "text-primary"
                              : counts.pct >= 85
                                ? "text-gold"
                                : "text-destructive",
                          )}
                        >
                          {counts.pct} %
                        </span>
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
          const counts = countsFor(detail);
          const attendanceRows = Object.entries(detail.attendanceByDate).sort(([a], [b]) =>
            a.localeCompare(b),
          );
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.name}
              subtitle={`${detail.employeeCode} · ${detail.designation} · ${monthTitle(month)}`}
              badges={
                <Badge variant="outline">
                  {counts.P} present · {counts.A} absent · {counts.L} leave
                </Badge>
              }
              record={{
                employee: detail.name,
                employeeCode: detail.employeeCode,
                designation: detail.designation,
                department: detail.dept,
                office: detail.office,
                shift: detail.shift,
                dailyAttendance: attendanceRows.map(([date, employee]) => ({
                  date,
                  status:
                    LABELS[statusOf(employee)] ??
                    employee.day_type ??
                    employee.attendance_status ??
                    "Not marked",
                  punchIn: employee.punch_in ?? "—",
                  punchOut: employee.punch_out ?? "—",
                  workingHours: employee.working_hours ?? 0,
                })),
              }}
              labels={{ dailyAttendance: "Daily attendance" }}
              sections={[
                {
                  title: "Employee attendance",
                  keys: [
                    "employee",
                    "employeeCode",
                    "designation",
                    "department",
                    "office",
                    "shift",
                    "dailyAttendance",
                  ],
                },
              ]}
            />
          );
        })()}
    </div>
  );
}
