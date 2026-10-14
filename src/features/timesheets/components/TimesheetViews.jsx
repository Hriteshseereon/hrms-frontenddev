// HR / manager / admin views of an employee's timesheets by day, week or month, and the FY year-to-date report.
import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Download, BarChart3, User2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import {
  timesheetStore,
  weekOf,
  ytdSummary,
  FY_START,
} from "@/features/timesheets/data/timesheet-data";
import { useTeamScope } from "@/features/attendance/data/attendance-live";

/** Entity employees, narrowed to the reporting line for Managers / HODs. */
function useReviewableEmployees() {
  const all = useScopedEmployees();
  const team = useTeamScope();
  return useMemo(() => (team ? all.filter((e) => team.has(e.id)) : all), [all, team]);
}

const badgeFor = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Draft"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/30 bg-gold/10 text-gold";
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
const addMonths = (iso, n) => {
  const d = new Date(iso.slice(0, 7) + "-01T00:00:00");
  d.setMonth(d.getMonth() + n);
  return isoLocal(d);
};
const fmt = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
const TARGET = 8;

export function EmployeeTimesheetView() {
  const entries = timesheetStore.use();
  const employees = useReviewableEmployees();
  const withData = useMemo(() => new Set(entries.map((e) => e.empId)), [entries]);
  const [empId, setEmpId] = useState(
    () => employees.find((e) => withData.has(e.id))?.id ?? employees[0]?.id ?? "",
  );
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState("2026-09-16");
  const [dayDetail, setDayDetail] = useState(null);
  const [entryDetail, setEntryDetail] = useState(null);
  const emp = employees.find((e) => e.id === empId);
  const mine = useMemo(
    () =>
      entries
        .filter((e) => e.empId === empId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    [entries, empId],
  );
  const range = useMemo(
    () =>
      mode === "day"
        ? [anchor]
        : mode === "week"
          ? weekOf(anchor)
          : Array.from(
              {
                length: new Date(
                  Number(anchor.slice(0, 4)),
                  Number(anchor.slice(5, 7)),
                  0,
                ).getDate(),
              },
              (_, i) => `${anchor.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`,
            ),
    [mode, anchor],
  );
  const inRange = mine.filter((e) => range.includes(e.date));
  const byDay = useMemo(
    () => Object.fromEntries(range.map((d) => [d, inRange.filter((e) => e.date === d)])),
    [range, inRange],
  );
  const total = inRange.reduce((s, e) => s + e.hours, 0);
  const billable = inRange.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
  const workdays = range.filter((d) => {
    const dow = new Date(d + "T00:00:00").getDay();
    return dow !== 0 && dow !== 6;
  }).length;
  const step = (n) =>
    setAnchor(
      mode === "day"
        ? addDays(anchor, n)
        : mode === "week"
          ? addDays(anchor, 7 * n)
          : addMonths(anchor, n),
    );
  const title =
    mode === "day"
      ? fmt(anchor)
      : mode === "week"
        ? `${fmt(range[0])} → ${fmt(range[range.length - 1])}`
        : new Date(anchor + "T00:00:00").toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          });
  const exportPdf = () => {
    const ok = exportReportPdf({
      title: `Timesheet — ${emp?.name ?? empId}`,
      subtitle: `${mode[0].toUpperCase() + mode.slice(1)} view · ${title}`,
      summary: [
        { label: "Hours", value: total.toFixed(1) },
        { label: "Billable", value: billable.toFixed(1) },
        { label: "Working days", value: String(workdays) },
        { label: "Avg / day", value: workdays ? (total / workdays).toFixed(2) : "0" },
      ],
      columns: [
        "Date",
        "Project",
        "Task",
        "Description",
        "Time",
        "Hours",
        "Billable",
        "Task status",
        "Status",
      ],
      rows: inRange.map((e) => [
        e.date,
        e.project ?? "—",
        e.task,
        e.description,
        e.start && e.end ? `${e.start}–${e.end}` : "—",
        e.hours,
        e.billable ? "Yes" : "No",
        e.taskStatus,
        e.status,
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "Timesheet ready — save as PDF" : "Allow pop-ups to download",
    );
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.dept}
                    {withData.has(e.id) ? "" : " · no entries"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">View</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v)}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              {mode === "month" ? "Month" : "Date"}
            </Label>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {mode === "month" ? (
                <Input
                  type="month"
                  className="h-9 w-full sm:w-40"
                  value={anchor.slice(0, 7)}
                  onChange={(e) => e.target.value && setAnchor(e.target.value + "-01")}
                />
              ) : (
                <Input
                  type="date"
                  className="h-9 w-full sm:w-40"
                  value={anchor}
                  onChange={(e) => e.target.value && setAnchor(e.target.value)}
                />
              )}
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-xs">
              <div className="text-muted-foreground">{title}</div>
              <div className="text-sm">
                <b>{total.toFixed(1)} h</b> · billable {billable.toFixed(1)} h · {workdays} working
                days · avg {workdays ? (total / workdays).toFixed(2) : "0"} h/day
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!inRange.length}
              onClick={() => {
                exportCsv(
                  `timesheet-${empId}-${mode}-${anchor}`,
                  [
                    "Date",
                    "Project",
                    "Task",
                    "Description",
                    "Start",
                    "End",
                    "Hours",
                    "Billable",
                    "Task status",
                    "Status",
                  ],
                  inRange.map((e) => [
                    e.date,
                    e.project ?? "",
                    e.task,
                    e.description,
                    e.start,
                    e.end,
                    e.hours,
                    e.billable ? "Yes" : "No",
                    e.taskStatus,
                    e.status,
                  ]),
                );
                toast.success("Exported CSV");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!inRange.length}
              onClick={exportPdf}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "week" && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {range.map((d) => {
            const rows = byDay[d];
            const h = rows.reduce((s, e) => s + e.hours, 0);
            const dow = new Date(d + "T00:00:00").getDay();
            return (
              <Card
                key={d}
                className={cn("shadow-card", (dow === 0 || dow === 6) && "bg-muted/30")}
              >
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{fmt(d)}</span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        h >= TARGET
                          ? "text-primary"
                          : h > 0
                            ? "text-gold"
                            : "text-muted-foreground",
                      )}
                    >
                      {h ? `${h.toFixed(1)} h` : "—"}
                    </span>
                  </div>
                  <Progress value={Math.min(100, (h / TARGET) * 100)} className="h-1.5" />
                  {rows.map((e) => (
                    <div key={e.id} className="border-border rounded-md border p-1.5 text-[11px]">
                      <div className="truncate font-medium" title={e.task}>
                        {e.task}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {e.project?.split(" — ")[0]} · {e.hours} h
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("mt-1 text-[10px]", badgeFor(e.status))}
                      >
                        {e.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {mode === "month" && (
        <Card className="shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Projects / tasks</th>
                  <th className="p-3 text-right">Hours</th>
                  <th className="p-3 text-right">Billable</th>
                  <th className="w-40 p-3 text-left">vs {TARGET} h</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {range.map((d) => {
                  const rows = byDay[d];
                  const h = rows.reduce((s, e) => s + e.hours, 0);
                  const b = rows.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
                  const dow = new Date(d + "T00:00:00").getDay();
                  const off = dow === 0 || dow === 6;
                  return (
                    <tr
                      key={d}
                      className={cn(clickableRow, off && "bg-muted/20 text-muted-foreground")}
                      onClick={() => setDayDetail(d)}
                    >
                      <td className="p-3 whitespace-nowrap">
                        {fmt(d)}
                        {off && <span className="ml-1 text-[10px]">(off)</span>}
                      </td>
                      <td className="p-3 text-xs">
                        {rows.length ? (
                          rows.map((e) => (
                            <div key={e.id}>
                              {e.project?.split(" — ")[0]} · {e.task}{" "}
                              <span className="text-muted-foreground">({e.hours} h)</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">{off ? "" : "No entry"}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold">{h ? h.toFixed(1) : "—"}</td>
                      <td className="p-3 text-right">{b ? b.toFixed(1) : "—"}</td>
                      <td className="p-3">
                        <Progress value={Math.min(100, (h / TARGET) * 100)} className="h-1.5" />
                      </td>
                      <td className="p-3">
                        {rows.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(rows.map((e) => e.status))].map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className={cn("text-[10px]", badgeFor(s))}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-border border-t font-semibold">
                  <td className="p-3" colSpan={2}>
                    Month total
                  </td>
                  <td className="p-3 text-right">{total.toFixed(1)}</td>
                  <td className="p-3 text-right">{billable.toFixed(1)}</td>
                  <td className="p-3" colSpan={2}>
                    {workdays} working days · avg {workdays ? (total / workdays).toFixed(2) : "0"}{" "}
                    h/day
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {mode === "day" && (
        <Card className="shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-left">Project</th>
                  <th className="p-3 text-left">Task</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-right">Hours</th>
                  <th className="p-3 text-left">Billable</th>
                  <th className="p-3 text-left">Task status</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {inRange.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-muted-foreground p-8 text-center">
                      No entries on {fmt(anchor)}.
                    </td>
                  </tr>
                )}
                {inRange.map((e) => (
                  <tr key={e.id} className={clickableRow} onClick={() => setEntryDetail(e)}>
                    <td className="p-3 whitespace-nowrap">
                      {e.start && e.end ? `${e.start} – ${e.end}` : "—"}
                    </td>
                    <td className="p-3 text-xs">{e.project ?? "—"}</td>
                    <td className="p-3">{e.task}</td>
                    <td className="text-muted-foreground p-3 text-xs">{e.description}</td>
                    <td className="p-3 text-right font-semibold">{e.hours}</td>
                    <td className="p-3 text-xs">{e.billable ? "Yes" : "No"}</td>
                    <td className="p-3 text-xs">{e.taskStatus}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={badgeFor(e.status)}>
                        {e.status}
                      </Badge>
                      {e.remarks && (
                        <div className="text-muted-foreground text-[11px]">{e.remarks}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {dayDetail &&
        (() => {
          const rows = byDay[dayDetail] ?? [];
          const h = rows.reduce((s, e) => s + e.hours, 0);
          const b = rows.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
          return (
            <RecordDetailDialog
              onClose={() => setDayDetail(null)}
              title={`${emp?.name ?? empId} · ${fmt(dayDetail)}`}
              subtitle={`${dayDetail} · ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}
              badges={<Badge variant="outline">{h ? `${h.toFixed(1)} h` : "No hours"}</Badge>}
              record={{
                employee: emp?.name ?? empId,
                date: dayDetail,
                hours: h ? `${h.toFixed(1)} h` : "—",
                billable: b ? `${b.toFixed(1)} h` : "—",
                target: `${TARGET} h`,
                entries: rows.map((e) => ({
                  time: e.start && e.end ? `${e.start} – ${e.end}` : "—",
                  project: e.project ?? "—",
                  task: e.task,
                  description: e.description,
                  hours: e.hours,
                  billable: e.billable ? "Yes" : "No",
                  taskStatus: e.taskStatus,
                  status: e.status,
                  remarks: e.remarks,
                })),
              }}
              labels={{ target: "Daily target", entries: "Entries" }}
              sections={[
                { title: "Day", keys: ["employee", "date", "hours", "billable", "target"] },
                { title: "Entries", keys: ["entries"] },
              ]}
            />
          );
        })()}
      {entryDetail && (
        <RecordDetailDialog
          onClose={() => setEntryDetail(null)}
          title={`${entryDetail.employee} · ${entryDetail.date}`}
          subtitle={`${entryDetail.format} · ${entryDetail.task}`}
          badges={
            <Badge variant="outline" className={badgeFor(entryDetail.status)}>
              {entryDetail.status}
            </Badge>
          }
          record={{
            ...entryDetail,
            time:
              entryDetail.start && entryDetail.end
                ? `${entryDetail.start} – ${entryDetail.end}`
                : "—",
          }}
          hide={["start", "end"]}
          labels={{ empId: "Employee ID", taskStatus: "Task status", remarks: "Approver remarks" }}
          sections={[
            {
              title: "Entry",
              keys: ["id", "employee", "empId", "format", "date", "project", "billable"],
            },
            { title: "Work", keys: ["task", "description", "time", "hours", "taskStatus"] },
            { title: "Approval", keys: ["status", "remarks"] },
          ]}
        />
      )}
    </div>
  );
}

export function YtdReport() {
  const entries = timesheetStore.use();
  const employees = useReviewableEmployees();
  const withData = useMemo(() => new Set(entries.map((e) => e.empId)), [entries]);
  const [empId, setEmpId] = useState(() => employees.find((e) => withData.has(e.id))?.id ?? "");
  const [upto, setUpto] = useState(isoLocal(new Date()));
  const emp = employees.find((e) => e.id === empId);
  const y = useMemo(() => ytdSummary(entries, empId, upto), [entries, empId, upto]);
  const max = Math.max(1, ...y.months.map((m) => m.hours));
  const pdf = () => {
    const ok = exportReportPdf({
      title: `Timesheet YTD report — ${emp?.name ?? empId}`,
      subtitle: `FY 2026-27 · ${FY_START} → ${upto} · ${emp?.dept ?? ""} · ${emp?.role ?? ""}`,
      summary: [
        { label: "Total hours", value: y.total.toFixed(1) },
        {
          label: "Billable",
          value: `${y.billable.toFixed(1)} (${y.total ? Math.round((y.billable / y.total) * 100) : 0} %)`,
        },
        { label: "Days logged", value: String(y.days) },
        { label: "Avg / day", value: y.avgPerDay.toFixed(2) },
        { label: "Approved", value: `${y.approvedPct} %` },
        { label: "Entries", value: String(y.entries) },
      ],
      columns: [
        "Month",
        "Days",
        "Entries",
        "Hours",
        "Billable",
        "Approved hours",
        "Pending",
        "Rejected",
      ],
      rows: [
        ...y.months.map((m) => [
          m.label,
          m.days,
          m.entries,
          m.hours,
          m.billable,
          m.approved,
          m.submitted,
          m.rejected,
        ]),
        ["— By project —", "", "", "", "", "", "", ""],
        ...y.byProject.map((p) => [p.project, "", "", p.hours, "", "", "", ""]),
      ],
    });
    toast[ok ? "success" : "error"](
      ok ? "YTD report ready — save as PDF" : "Allow pop-ups to download",
    );
  };
  const all = () => {
    const ok = exportReportPdf({
      title: "Timesheet YTD — all employees",
      subtitle: `FY 2026-27 · ${FY_START} → ${upto}`,
      columns: [
        "Employee",
        "Department",
        "Days",
        "Entries",
        "Hours",
        "Billable",
        "Billable %",
        "Avg / day",
        "Approved %",
      ],
      rows: employees
        .filter((e) => withData.has(e.id))
        .map((e) => {
          const s = ytdSummary(entries, e.id, upto);
          return [
            e.name,
            e.dept,
            s.days,
            s.entries,
            s.total,
            s.billable,
            s.total ? `${Math.round((s.billable / s.total) * 100)} %` : "0 %",
            s.avgPerDay,
            `${s.approvedPct} %`,
          ];
        }),
    });
    toast[ok ? "success" : "error"](
      ok ? "Organisation YTD report ready" : "Allow pop-ups to download",
    );
  };
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.dept}
                    {withData.has(e.id) ? "" : " · no entries"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Year to date up to</Label>
            <Input
              type="date"
              className="w-full sm:w-44"
              value={upto}
              min={FY_START}
              max={isoLocal(new Date())}
              onChange={(e) => e.target.value && setUpto(e.target.value)}
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={all}>
              <Download className="h-4 w-4" /> All employees YTD
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!empId}
              onClick={pdf}
            >
              <Download className="h-4 w-4" /> YTD report PDF
            </Button>
          </div>
        </CardContent>
      </Card>
      {emp && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Total hours", y.total.toFixed(1)],
              [
                "Billable hours",
                `${y.billable.toFixed(1)} · ${y.total ? Math.round((y.billable / y.total) * 100) : 0} %`,
              ],
              ["Days logged", String(y.days)],
              ["Avg hours / day", y.avgPerDay.toFixed(2)],
              ["Approved", `${y.approvedPct} %`],
              ["Entries", String(y.entries)],
            ].map(([k, v]) => (
              <Card key={k} className="shadow-card">
                <CardContent className="p-4">
                  <div className="text-muted-foreground text-xs">{k}</div>
                  <div className="text-2xl font-bold">{v}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="text-primary h-4 w-4" /> Hours by month — {emp.name}
                </div>
                <div className="flex h-40 items-end gap-2">
                  {y.months.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold">{m.hours || ""}</span>
                      <div
                        className="bg-primary/20 relative w-full rounded-t"
                        style={{ height: `${(m.hours / max) * 120}px` }}
                      >
                        <div
                          className="bg-primary absolute right-0 bottom-0 left-0 rounded-t"
                          style={{ height: `${m.hours ? (m.billable / m.hours) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-[10px]">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Dark = billable · light = internal
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                    <tr>
                      <th className="p-2 text-left">Month</th>
                      <th className="p-2 text-right">Days</th>
                      <th className="p-2 text-right">Entries</th>
                      <th className="p-2 text-right">Hours</th>
                      <th className="p-2 text-right">Billable</th>
                      <th className="p-2 text-right">Approved h</th>
                      <th className="p-2 text-right">Pending</th>
                      <th className="p-2 text-right">Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {y.months.map((m) => (
                      <tr key={m.month}>
                        <td className="p-2">{m.label}</td>
                        <td className="p-2 text-right">{m.days}</td>
                        <td className="p-2 text-right">{m.entries}</td>
                        <td className="p-2 text-right font-semibold">{m.hours}</td>
                        <td className="p-2 text-right">{m.billable}</td>
                        <td className="p-2 text-right">{m.approved}</td>
                        <td className="p-2 text-right">{m.submitted}</td>
                        <td className="p-2 text-right">{m.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <User2 className="text-primary h-4 w-4" /> Hours by project
                </div>
                {y.byProject.map((p) => (
                  <div key={p.project} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate pr-2">{p.project}</span>
                      <span className="font-semibold">
                        {p.hours} h · {y.total ? Math.round((p.hours / y.total) * 100) : 0} %
                      </span>
                    </div>
                    <Progress value={y.total ? (p.hours / y.total) * 100 : 0} className="h-1.5" />
                  </div>
                ))}
                {y.byProject.length === 0 && (
                  <p className="text-muted-foreground text-xs">No entries in this period.</p>
                )}
                <div className="text-muted-foreground flex items-center gap-1 pt-2 text-[11px]">
                  <CalendarRange className="h-3 w-3" /> FY 2026-27 from {FY_START}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
