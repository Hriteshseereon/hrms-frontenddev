// Attendance report — filterable (period, department, office, shift, employee, attendance band) with attendance %.
import { useMemo, useState } from "react";
import { BarChart3, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SHIFTS } from "@/features/attendance/data/attendance-data";
import { OFFICES } from "@/features/employees/data/hr-data";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import {
  currentMonth,
  useLiveAttendance,
  summarise,
  pctTone,
  workingDaysOf,
  useTeamScope,
} from "@/features/attendance/data/attendance-live";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const BANDS = [
  ["all", "All bands"],
  ["95", "≥ 95 % (excellent)"],
  ["85", "85–95 % (good)"],
  ["70", "70–85 % (watch)"],
  ["0", "< 70 % (critical)"],
];
const monthLabel = (m) =>
  new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export function AttendanceReportTab() {
  // Current month by default (was frozen on the seeded month); any month can still be picked below.
  const [month, setMonth] = useState(currentMonth);
  const liveRows = useLiveAttendance(month);
  // Managers / HODs report on their own reporting line only (same scope as the Attendance register tab).
  const team = useTeamScope();
  const rows = useMemo(
    () => (team ? liveRows.filter((r) => team.has(r.empId)) : liveRows),
    [liveRows, team],
  );
  const [dept, setDept] = useState("all");
  const [office, setOffice] = useState("all");
  const [shift, setShift] = useState("all");
  const [emp, setEmp] = useState("all");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState("pct");
  const [detail, setDetail] = useState(null);

  const depts = useMemo(() => [...new Set(rows.map((r) => r.dept))].sort(), [rows]);
  const data = useMemo(
    () =>
      rows
        .map((r) => ({ r, s: summarise(r, month) }))
        .filter(
          ({ r, s }) =>
            (dept === "all" || r.dept === dept) &&
            (office === "all" || r.office === office) &&
            (shift === "all" || r.shift === shift) &&
            (emp === "all" || r.empId === emp) &&
            (band === "all" ||
              (band === "95"
                ? s.pct >= 95
                : band === "85"
                  ? s.pct >= 85 && s.pct < 95
                  : band === "70"
                    ? s.pct >= 70 && s.pct < 85
                    : s.pct < 70)),
        )
        .sort((a, b) =>
          sort === "pct"
            ? a.s.pct - b.s.pct
            : sort === "absent"
              ? b.s.absent - a.s.absent
              : a.r.name.localeCompare(b.r.name),
        ),
    [rows, dept, office, shift, emp, band, sort, month],
  );
  const totals = useMemo(() => {
    const t = data.reduce(
      (acc, { s }) => ({
        present: acc.present + s.present,
        absent: acc.absent + s.absent,
        leave: acc.leave + s.leave,
        late: acc.late + s.late,
        ot: acc.ot + s.overtime,
        working: acc.working + s.working,
      }),
      { present: 0, absent: 0, leave: 0, late: 0, ot: 0, working: 0 },
    );
    return {
      ...t,
      pct: t.working ? Math.round((t.present / t.working) * 1000) / 10 : 0,
      pctIncLeave: t.working ? Math.round(((t.present + t.leave) / t.working) * 1000) / 10 : 0,
    };
  }, [data]);
  const byDept = useMemo(
    () =>
      depts
        .map((d) => {
          const rs = data.filter((x) => x.r.dept === d);
          const w = rs.reduce((s, x) => s + x.s.working, 0);
          const p = rs.reduce((s, x) => s + x.s.present, 0);
          return { d, n: rs.length, pct: w ? Math.round((p / w) * 1000) / 10 : 0 };
        })
        .filter((x) => x.n),
    [data, depts],
  );

  const cols = [
    "Employee",
    "Emp ID",
    "Department",
    "Office",
    "Shift",
    "Working days",
    "Present",
    "Absent",
    "Leave",
    "Late marks",
    "OT hours",
    "Attendance %",
    "Incl. leave %",
  ];
  const exportRows = data.map(({ r, s }) => [
    r.name,
    r.empId,
    r.dept,
    r.office,
    r.shift,
    s.working,
    s.present,
    s.absent,
    s.leave,
    s.late,
    s.overtime,
    `${s.pct} %`,
    `${s.pctIncLeave} %`,
  ]);
  const filtersText = [
    ["Period", monthLabel(month)],
    ["Department", dept === "all" ? "All" : dept],
    ["Office", office === "all" ? "All" : office],
    ["Shift", shift === "all" ? "All" : shift],
    ["Employee", emp === "all" ? "All" : (rows.find((r) => r.empId === emp)?.name ?? emp)],
    ["Band", BANDS.find((b) => b[0] === band)?.[1] ?? "All"],
  ];
  const pdf = () => {
    const ok = exportReportPdf({
      title: "Attendance Report",
      subtitle: `${monthLabel(month)} · ${data.length} employees · ${workingDaysOf(month)} working days`,
      filters: filtersText.map(([label, value]) => ({ label, value })),
      summary: [
        { label: "Attendance %", value: `${totals.pct} %` },
        { label: "Incl. leave", value: `${totals.pctIncLeave} %` },
        { label: "Present", value: String(totals.present) },
        { label: "Absent", value: String(totals.absent) },
        { label: "Leave", value: String(totals.leave) },
        { label: "Late marks", value: String(totals.late) },
        { label: "OT hours", value: totals.ot.toFixed(1) },
      ],
      columns: cols,
      rows: exportRows,
    });
    toast[ok ? "success" : "error"](
      ok ? "Attendance report ready — save as PDF" : "Allow pop-ups to download",
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="text-primary h-4 w-4" /> Report filters
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Period</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {depts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Office / branch</Label>
              <Select value={office} onValueChange={setOffice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  {[...new Set([...OFFICES, ...rows.map((r) => r.office)])].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Shift</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All shifts</SelectItem>
                  {[...new Set([...SHIFTS.map((s) => s.name), ...rows.map((r) => r.shift)])].map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Employee</Label>
              <Select value={emp} onValueChange={setEmp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {rows.map((r) => (
                    <SelectItem key={r.empId} value={r.empId}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Attendance band</Label>
              <Select value={band} onValueChange={setBand}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANDS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Sort by</Label>
              <Select value={sort} onValueChange={(v) => setSort(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Attendance % (low → high)</SelectItem>
                  <SelectItem value="absent">Absences (high → low)</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {data.length} employees · {workingDaysOf(month)} working days in {monthLabel(month)}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!data.length}
                onClick={() => {
                  exportCsv(`attendance-report-${month}`, cols, exportRows);
                  toast.success("Attendance report exported as CSV");
                }}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                disabled={!data.length}
                onClick={pdf}
              >
                <Download className="h-4 w-4" /> Attendance report PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Attendance %", `${totals.pct} %`, pctTone(totals.pct)],
          ["Incl. approved leave", `${totals.pctIncLeave} %`, "text-foreground"],
          ["Present days", String(totals.present), "text-primary"],
          ["Absent days", String(totals.absent), "text-destructive"],
          ["Leave days", String(totals.leave), "text-gold"],
          ["Late marks · OT", `${totals.late} · ${totals.ot.toFixed(1)} h`, "text-foreground"],
        ].map(([k, v, c]) => (
          <Card key={k} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className={cn("text-2xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {byDept.length > 1 && (
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="text-primary h-4 w-4" /> Attendance % by department
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byDept.map((d) => (
                <div key={d.d} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>
                      {d.d} <span className="text-muted-foreground">· {d.n}</span>
                    </span>
                    <span className={cn("font-semibold", pctTone(d.pct))}>{d.pct} %</span>
                  </div>
                  <Progress value={d.pct} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Office · shift</th>
                <th className="p-3 text-center">Working days</th>
                <th className="p-3 text-center">Present</th>
                <th className="p-3 text-center">Absent</th>
                <th className="p-3 text-center">Leave</th>
                <th className="p-3 text-center">Late</th>
                <th className="p-3 text-center">OT (h)</th>
                <th className="w-[200px] p-3 text-left">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted-foreground p-8 text-center">
                    No employees match these filters.
                  </td>
                </tr>
              )}
              {data.map(({ r, s }) => (
                <tr key={r.empId} className={clickableRow} onClick={() => setDetail({ r, s })}>
                  <td className="p-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.empId} · {r.designation}
                    </div>
                  </td>
                  <td className="text-muted-foreground p-3">{r.dept}</td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {r.office}
                    <br />
                    {r.shift}
                  </td>
                  <td className="p-3 text-center">{s.working}</td>
                  <td className="text-primary p-3 text-center font-medium">{s.present}</td>
                  <td className="text-destructive p-3 text-center font-medium">{s.absent}</td>
                  <td className="text-gold p-3 text-center">{s.leave}</td>
                  <td className="p-3 text-center">{s.late || "—"}</td>
                  <td className="p-3 text-center">{s.overtime || "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Progress value={s.pct} className="h-2 flex-1" />
                      <span
                        className={cn("w-14 text-right font-semibold tabular-nums", pctTone(s.pct))}
                      >
                        {s.pct} %
                      </span>
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      {s.pctIncLeave} % incl. leave
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-muted-foreground flex flex-wrap gap-2 text-[11px]">
        <Badge variant="outline">Attendance % = present ÷ working days (Mon–Fri)</Badge>
        <Badge variant="outline">Incl. leave % counts approved leave as attended</Badge>
        <Badge variant="outline">Late marks & OT from the work-hours register</Badge>
      </div>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={detail.r.name}
          subtitle={`${detail.r.empId} · ${detail.r.designation} · ${monthLabel(month)}`}
          badges={
            <Badge variant="outline" className={pctTone(detail.s.pct)}>
              {detail.s.pct} % attendance
            </Badge>
          }
          record={{
            name: detail.r.name,
            empId: detail.r.empId,
            designation: detail.r.designation,
            dept: detail.r.dept,
            office: detail.r.office,
            shift: detail.r.shift,
            period: monthLabel(month),
            working: detail.s.working,
            present: detail.s.present,
            absent: detail.s.absent,
            leave: detail.s.leave,
            late: detail.s.late,
            overtime: detail.s.overtime,
            pct: `${detail.s.pct} %`,
            pctIncLeave: `${detail.s.pctIncLeave} %`,
          }}
          labels={{
            dept: "Department",
            working: "Working days",
            present: "Present days",
            absent: "Absent days",
            leave: "Leave days",
            late: "Late marks",
            overtime: "OT hours",
            pct: "Attendance %",
            pctIncLeave: "Incl. leave %",
          }}
          sections={[
            {
              title: "Employee",
              keys: ["name", "empId", "designation", "dept", "office", "shift"],
            },
            {
              title: "Attendance summary",
              keys: [
                "period",
                "working",
                "present",
                "absent",
                "leave",
                "late",
                "overtime",
                "pct",
                "pctIncLeave",
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
