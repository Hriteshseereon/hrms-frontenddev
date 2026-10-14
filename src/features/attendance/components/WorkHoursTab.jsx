import { useMemo, useState } from "react";
import { Search, Clock, TrendingUp, TrendingDown, CalendarClock, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OFFICES } from "@/features/employees/data/hr-data";
import { WORK_RECORDS } from "@/features/attendance/data/attendance-data";
import { usePunches, punchHours } from "@/features/attendance/data/attendance-self";
import { useTeamScope, OT_AFTER_HOURS } from "@/features/attendance/data/attendance-live";
import { useScopedIds, useScopedEmployees } from "@/features/employees/components/CasePieces";
import { resolveShiftForEmployee, shiftTimingFlag } from "@/features/attendance/data/shift-timing";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { cn } from "@/lib/utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const OT_THRESHOLD = OT_AFTER_HOURS;
const SHORT_THRESHOLD = 7.5;

function Kpi({ label, value, sub, icon: Icon, tone }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div
          className={cn(
            "mt-1.5 text-2xl font-bold tracking-tight",
            tone === "good" && "text-primary",
            tone === "bad" && "text-destructive",
          )}
        >
          {value}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>
      </CardContent>
    </Card>
  );
}

const dayTypeClass = (t) =>
  t === "Full Day"
    ? "border-primary/30 bg-primary/10 text-primary"
    : t === "Half Day"
      ? "border-gold/40 bg-gold/15 text-gold"
      : t === "Absent"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

export function WorkHoursTab() {
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("all");
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  const scopedIds = useScopedIds();
  const scopedEmployees = useScopedEmployees();
  const team = useTeamScope();
  const punches = usePunches();
  // Employees' own clock-in / clock-out punches are part of the register (the tab used to show only the static seed),
  // and the register is tenant-scoped and limited to the reporting line for Managers / HODs.
  const records = useMemo(() => {
    const byId = new Map(scopedEmployees.map((e) => [e.id, e]));
    const live = punches
      .filter((p) => p.outAt && byId.has(p.empId))
      .map((p) => {
        const e = byId.get(p.empId);
        const profileShift = getEmployeeProfile(p.empId).job.shift;
        const shift = resolveShiftForEmployee(p.empId, profileShift);
        const t = shiftTimingFlag(p, shift);
        const worked = punchHours(p);
        return {
          empId: p.empId,
          name: e.name,
          designation: e.role,
          office: e.branch,
          shift: shift?.name ?? profileShift,
          date: p.date,
          checkIn: p.inAt,
          checkOut: p.outAt,
          worked,
          required: 8,
          breakMins: 0,
          lateMins: t.lateMins,
          earlyOutMins: t.earlyOutMins,
          dayType: worked >= SHORT_THRESHOLD ? "Full Day" : worked >= 4 ? "Half Day" : "Absent",
          approvedOt: false,
        };
      });
    return [...live, ...WORK_RECORDS.filter((r) => scopedIds.has(r.empId))].filter(
      (r) => !team || team.has(r.empId),
    );
  }, [punches, scopedEmployees, scopedIds, team]);

  const rows = useMemo(
    () =>
      records.filter((r) => {
        if (office !== "all" && r.office !== office) return false;
        if (query && !`${r.name} ${r.empId}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (filter === "overtime") return r.worked > OT_THRESHOLD;
        if (filter === "short")
          return r.dayType === "Full Day" && r.worked > 0 && r.worked < SHORT_THRESHOLD;
        if (filter === "half") return r.dayType === "Half Day";
        if (filter === "late") return r.lateMins > 0;
        return true;
      }),
    [records, query, office, filter],
  );

  const totals = useMemo(() => {
    let ot = 0,
      short = 0,
      half = 0,
      late = 0;
    rows.forEach((r) => {
      if (r.worked > OT_THRESHOLD) ot += r.worked - OT_THRESHOLD;
      if (r.dayType === "Full Day" && r.worked > 0 && r.worked < SHORT_THRESHOLD)
        short += SHORT_THRESHOLD - r.worked;
      if (r.dayType === "Half Day") half += 1;
      if (r.lateMins > 0) late += 1;
    });
    return { ot: ot.toFixed(1), short: short.toFixed(1), half, late };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Overtime Hours"
          value={`${totals.ot} h`}
          sub={`Beyond ${OT_THRESHOLD} h / day`}
          icon={TrendingUp}
          tone="good"
        />
        <Kpi
          label="Short Hours"
          value={`${totals.short} h`}
          sub={`Below ${SHORT_THRESHOLD} h / day`}
          icon={TrendingDown}
          tone="bad"
        />
        <Kpi
          label="Half Days"
          value={String(totals.half)}
          sub="Auto-converted from short hours"
          icon={CalendarClock}
        />
        <Kpi
          label="Late Arrivals"
          value={String(totals.late)}
          sub="After shift start + grace"
          icon={Clock}
        />
      </div>

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
          <Select value={office} onValueChange={setOffice}>
            <SelectTrigger className="w-full sm:w-[170px]">
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
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              <SelectItem value="overtime">Overtime only</SelectItem>
              <SelectItem value="short">Short hours only</SelectItem>
              <SelectItem value="half">Half days only</SelectItem>
              <SelectItem value="late">Late arrivals</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-muted-foreground ml-auto flex flex-wrap items-center gap-2 text-xs">
            {rows.length} records
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() => {
                exportCsv(
                  "work-hours-overtime",
                  [
                    "Employee",
                    "Emp ID",
                    "Office",
                    "Date",
                    "Shift",
                    "In",
                    "Out",
                    "Break (min)",
                    "Worked (h)",
                    "Required (h)",
                    "Overtime (h)",
                    "Short (h)",
                    "Late (min)",
                    "Day type",
                    "OT approval",
                  ],
                  rows.map((r) => {
                    const ot = r.worked > OT_THRESHOLD ? r.worked - OT_THRESHOLD : 0;
                    const short =
                      r.dayType === "Full Day" && r.worked > 0 && r.worked < SHORT_THRESHOLD
                        ? SHORT_THRESHOLD - r.worked
                        : 0;
                    return [
                      r.name,
                      r.empId,
                      r.office,
                      r.date,
                      r.shift,
                      r.checkIn,
                      r.checkOut,
                      r.breakMins,
                      r.worked.toFixed(2),
                      r.required,
                      ot.toFixed(2),
                      short.toFixed(2),
                      r.lateMins,
                      r.dayType,
                      ot ? (r.approvedOt ? "Approved" : "Pending") : "—",
                    ];
                  }),
                );
                toast.success("Work hours exported as CSV");
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
                  title: "Work Hours & Overtime Report",
                  subtitle: `${rows.length} records · ${office === "all" ? "all offices" : office} · ${filter === "all" ? "all records" : filter}`,
                  filters: [
                    { label: "Office", value: office === "all" ? "All" : office },
                    { label: "Filter", value: filter },
                  ],
                  summary: [
                    { label: "Overtime hours", value: `${totals.ot} h` },
                    { label: "Short hours", value: `${totals.short} h` },
                    { label: "Half days", value: String(totals.half) },
                    { label: "Late arrivals", value: String(totals.late) },
                  ],
                  columns: [
                    "Employee",
                    "Date",
                    "Shift",
                    "In",
                    "Out",
                    "Worked (h)",
                    "OT (h)",
                    "Short (h)",
                    "Late (min)",
                    "Day type",
                    "OT approval",
                  ],
                  rows: rows.map((r) => {
                    const ot = r.worked > OT_THRESHOLD ? r.worked - OT_THRESHOLD : 0;
                    const short =
                      r.dayType === "Full Day" && r.worked > 0 && r.worked < SHORT_THRESHOLD
                        ? SHORT_THRESHOLD - r.worked
                        : 0;
                    return [
                      `${r.name} (${r.empId})`,
                      r.date,
                      r.shift,
                      r.checkIn,
                      r.checkOut,
                      r.worked.toFixed(2),
                      ot ? ot.toFixed(2) : "—",
                      short ? short.toFixed(2) : "—",
                      r.lateMins || "—",
                      r.dayType,
                      ot ? (r.approvedOt ? "Approved" : "Pending") : "—",
                    ];
                  }),
                });
                toast[ok ? "success" : "error"](
                  ok ? "Work hours report ready — save as PDF" : "Allow pop-ups to download",
                );
              }}
            >
              <Download className="h-4 w-4" /> Report PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Shift</th>
                <th className="p-3 text-left">In</th>
                <th className="p-3 text-left">Out</th>
                <th className="p-3 text-left">Break</th>
                <th className="p-3 text-left">Worked</th>
                <th className="p-3 text-left">Overtime</th>
                <th className="p-3 text-left">Short</th>
                <th className="p-3 text-left">Late</th>
                <th className="p-3 text-left">Day Type</th>
                <th className="p-3 text-left">OT Approval</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r, i) => {
                const ot = r.worked > OT_THRESHOLD ? r.worked - OT_THRESHOLD : 0;
                const short =
                  r.dayType === "Full Day" && r.worked > 0 && r.worked < SHORT_THRESHOLD
                    ? SHORT_THRESHOLD - r.worked
                    : 0;
                return (
                  <tr
                    key={`${r.empId}-${r.date}-${i}`}
                    className={clickableRow}
                    onClick={() => setDetail(r)}
                  >
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.empId} · {r.office}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="whitespace-nowrap">{r.date}</span>
                    </td>
                    <td className="text-muted-foreground p-3 whitespace-nowrap">{r.shift}</td>
                    <td className="p-3">{r.checkIn}</td>
                    <td className="p-3">{r.checkOut}</td>
                    <td className="text-muted-foreground p-3">
                      {r.breakMins ? `${r.breakMins}m` : "—"}
                    </td>
                    <td className="p-3 font-semibold">
                      {r.worked ? `${r.worked.toFixed(2)} h` : "—"}
                    </td>
                    <td className="p-3">
                      {ot ? (
                        <span className="text-primary font-semibold">+{ot.toFixed(2)} h</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {short ? (
                        <span className="text-destructive font-semibold">
                          −{short.toFixed(2)} h
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.lateMins ? (
                        <span className="text-destructive">{r.lateMins}m</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={dayTypeClass(r.dayType)}>
                        {r.dayType}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground p-3 text-xs">
                      {ot ? (r.approvedOt ? "Approved" : "Pending") : "—"}
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
          const ot = detail.worked > OT_THRESHOLD ? detail.worked - OT_THRESHOLD : 0;
          const short =
            detail.dayType === "Full Day" && detail.worked > 0 && detail.worked < SHORT_THRESHOLD
              ? SHORT_THRESHOLD - detail.worked
              : 0;
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={`${detail.name} · ${detail.date}`}
              subtitle={`${detail.empId} · ${detail.designation} · ${detail.office}`}
              badges={
                <Badge variant="outline" className={dayTypeClass(detail.dayType)}>
                  {detail.dayType}
                </Badge>
              }
              record={{
                ...detail,
                worked: `${detail.worked.toFixed(2)} h`,
                required: `${detail.required} h`,
                overtime: ot ? `+${ot.toFixed(2)} h` : "—",
                shortHours: short ? `−${short.toFixed(2)} h` : "—",
                breakMins: detail.breakMins ? `${detail.breakMins} min` : "—",
                lateMins: detail.lateMins ? `${detail.lateMins} min` : "—",
                earlyOutMins: detail.earlyOutMins ? `${detail.earlyOutMins} min` : "—",
                otApproval: ot ? (detail.approvedOt ? "Approved" : "Pending") : "—",
              }}
              hide={["approvedOt"]}
              labels={{
                empId: "Employee ID",
                checkIn: "Check-in",
                checkOut: "Check-out",
                breakMins: "Break",
                lateMins: "Late by",
                earlyOutMins: "Early out by",
                otApproval: "OT approval",
              }}
              sections={[
                { title: "Employee", keys: ["name", "empId", "designation", "office", "shift"] },
                { title: "Day", keys: ["date", "dayType", "checkIn", "checkOut", "breakMins"] },
                {
                  title: "Hours",
                  keys: [
                    "worked",
                    "required",
                    "overtime",
                    "shortHours",
                    "lateMins",
                    "earlyOutMins",
                    "otApproval",
                  ],
                },
              ]}
            />
          );
        })()}
    </div>
  );
}
