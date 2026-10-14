import { useMemo, useState } from "react";
import {
  Clock,
  TrendingUp,
  AlarmClock,
  CalendarCheck2,
  LogIn,
  LogOut,
  Fingerprint,
  MapPin,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  currentMonth,
  daysInMonth,
  monthTitle,
  registerMonths,
  useLiveAttendance,
  isWeekend,
} from "@/features/attendance/data/attendance-live";
import {
  BIOMETRIC_DEVICES,
  deletePunch,
  markIn,
  markOut,
  missedPunchOuts,
  openPunch,
  punchBlockReason,
  punchHours,
  todayIso,
  punchTotals,
  punchVerdict as rawVerdict,
  punchesOf,
  usePunches,
} from "@/features/attendance/data/attendance-self";
import { isAttendanceLocked, orgOfEmployee } from "@/features/attendance/data/attendance-pattern";
import { useSharedList } from "@/lib/shared-list";
import { GEOFENCE_RULES } from "@/features/organization/data/master-data";
import { useWorkOrderOfEmployee } from "@/features/employees/data/work-order-data";
import {
  resolveShiftForEmployee,
  shiftTimingFlag,
  shiftTimingTone,
  formatDailyWage,
} from "@/features/attendance/data/shift-timing";
import { exportReportPdf, exportCsv } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const palTone = {
  P: "bg-primary/10 text-primary border-primary/30",
  A: "bg-destructive/10 text-destructive border-destructive/30",
  L: "bg-gold/15 text-gold border-gold/40",
};
const palLabel = { P: "Present", A: "Absent", L: "Leave" };

// The store's verdict union labels < 4 h as "Half Day" and 4–7.5 h as "Short Hours", which is inverted against
// HALF_DAY_POLICY (≥ 4 h is the minimum for a half day; < 4 h is not counted as present at all). Relabel for display
// without touching the public union.
const punchVerdict = (p) => {
  const v = rawVerdict(p);
  return v === "Half Day" ? "Below half day" : v === "Short Hours" ? "Half day (short hours)" : v;
};

/** Great-circle distance in metres between two lat/long points. */
const distanceM = (lat1, lon1, lat2, lon2) => {
  const R = 6371000,
    toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const currentPosition = () =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    // The API's own timeout only starts once permission is granted — an unanswered permission prompt never settles.
    const timer = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  });

const verdictTone = (v) =>
  v === "Overtime"
    ? "border-primary/30 bg-primary/10 text-primary"
    : v === "Full Day"
      ? "border-primary/30 bg-primary/10 text-primary"
      : v === "In progress" || v === "Half day (short hours)"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-destructive/30 bg-destructive/10 text-destructive";

function MarkAttendanceCard() {
  const me = useCurrentEmployee();
  const rows = usePunches();
  const mine = punchesOf(rows, me.id);
  const open = openPunch(rows, me.id);
  // Punches from earlier days never closed — they no longer block today's punch-in; HR regularises them.
  const missed = missedPunchOuts(mine);
  const totals = punchTotals(mine);
  const workOrder = useWorkOrderOfEmployee(me.id);
  // Fall back to the shift on the employee's job record when no work order applies (was "Not assigned" for everyone
  // without a work order, so every punch showed "No Shift Assigned").
  const shift = resolveShiftForEmployee(me.id, getEmployeeProfile(me.id).job.shift);
  const [fences] = useSharedList("geofence-rules", GEOFENCE_RULES);
  const activeFences = fences.filter((f) => f.active);
  const [fenceId, setFenceId] = useState("");
  const fence = activeFences.find((f) => f.id === fenceId) ?? activeFences[0];
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const orgId = orgOfEmployee(me.id);

  const [source, setSource] = useState("Manual");
  const [device, setDevice] = useState(BIOMETRIC_DEVICES[0].id);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState(null);

  const dev = BIOMETRIC_DEVICES.find((d) => d.id === device) ?? BIOMETRIC_DEVICES[0];
  const location =
    source === "Manual"
      ? "Self-marked · Web portal"
      : source === "Geofence"
        ? fence
          ? `${fence.name} (geofence)`
          : "Geofence"
        : dev.location;

  /**
   * Geofenced check-in enforces the fence configured in Master Data → Geofencing: the browser position must be within
   * the radius; outside it (or with location unavailable) the punch is blocked, or — when the fence allows an override —
   * accepted only with a reason, flagged for HR review. It used to accept any punch as "Geofence" without a check.
   */
  const punchIn = async () => {
    const blocked = punchBlockReason(me.id);
    if (blocked) return toast.error(blocked);
    let flagged = note.trim();
    if (source === "Geofence") {
      if (!fence)
        return toast.error("No active geofence is configured — use manual or biometric marking.");
      const lat = Number(fence.latitude),
        lon = Number(fence.longitude);
      if (
        fence.enforced &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        fence.latitude &&
        fence.longitude
      ) {
        setBusy(true);
        const pos = await currentPosition();
        setBusy(false);
        const dist = pos ? Math.round(distanceM(pos.lat, pos.lon, lat, lon)) : null;
        if (dist === null || dist > fence.radius) {
          const why =
            dist === null
              ? "your location is unavailable"
              : `you are ${dist} m from ${fence.name} (allowed ${fence.radius} m)`;
          if (!fence.allowOverrideWithReason) return toast.error(`Outside the geofence — ${why}.`);
          if (!flagged)
            return toast.error(
              `Outside the geofence — ${why}. Add a reason in the note to punch in for HR review.`,
            );
          flagged = `[Outside geofence: ${dist === null ? "location unavailable" : `${dist} m`}] ${flagged}`;
        }
      }
    }
    const rec = markIn({ empId: me.id, employee: me.name, source, location, note: flagged });
    toast[rec ? "success" : "error"](
      rec ? `Punched in at ${rec.inAt} · ${rec.source}` : "You already have an open punch",
    );
    setNote("");
  };

  const punchRows = mine.map((p) => [
    p.date,
    p.inAt,
    p.outAt || "—",
    `${punchHours(p)}`,
    p.source,
    p.location,
    punchVerdict(p),
    shiftTimingFlag(p, shift).flag,
    p.note || "—",
  ]);
  const punchCols = [
    "Date",
    "In",
    "Out",
    "Hours",
    "Source",
    "Location",
    "Verdict",
    "Shift Timing",
    "Note",
  ];

  return (
    <>
      <Card className="shadow-card border-primary/20">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Fingerprint className="text-primary h-4 w-4" /> Mark attendance
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Punch in manually from the portal, or record a biometric / geofenced device punch.
                Hours, overtime and short hours are computed the moment you punch out.
              </p>
            </div>
            <Badge
              variant="outline"
              className={open ? "border-primary/30 bg-primary/10 text-primary" : ""}
            >
              {open ? `Punched in at ${open.inAt}` : "Not punched in"}
            </Badge>
          </div>

          <div className="border-border bg-muted/30 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Work order: </span>
              <span className="font-medium">
                {workOrder ? `${workOrder.name} (${workOrder.clientSite})` : "Not assigned"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Shift: </span>
              <span className="font-medium">
                {shift ? `${shift.name} · ${shift.start}–${shift.end}` : "Not assigned"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Per-day wage: </span>
              <span className="font-medium">{formatDailyWage(me.id)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Marking mode</Label>
              <Select value={source} onValueChange={(v) => setSource(v)}>
                <SelectTrigger className="w-full sm:w-[210px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual — timestamp now</SelectItem>
                  <SelectItem value="Biometric">Biometric device</SelectItem>
                  <SelectItem value="Geofence">Geofenced check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {source === "Geofence" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Geofence</Label>
                <Select value={fence?.id ?? ""} onValueChange={setFenceId}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="No active geofence" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeFences.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} · {f.radius} m{f.enforced ? "" : " (not enforced)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {source === "Biometric" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Device / location</Label>
                <Select value={device} onValueChange={setDevice}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BIOMETRIC_DEVICES.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Client visit, WFH…"
                className="h-9 w-full sm:w-[220px]"
              />
            </div>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!!open || busy}
              onClick={() => void punchIn()}
            >
              <LogIn className="h-4 w-4" /> Punch in
            </Button>
            {open && open.date !== today && (
              <span className="text-gold text-xs">
                Open punch from <span className="whitespace-nowrap">{open.date}</span> (night shift)
                — punch out to close it.
              </span>
            )}
            {missed.length > 0 && (
              <span className="text-gold text-xs">
                Missed punch-out on{" "}
                <span className="whitespace-nowrap">{missed.map((m) => m.date).join(", ")}</span> —
                ask HR to regularise it.
              </span>
            )}
            <Button
              variant="outline"
              disabled={!open}
              onClick={() => {
                const rec = markOut(me.id);
                if (!rec)
                  return toast.error(
                    open
                      ? `Attendance for ${open.date.slice(0, 7)} is locked for payroll — ask HR to regularise the punch.`
                      : "Nothing to punch out of",
                  );
                toast.success(
                  `Punched out at ${rec.outAt} · ${punchHours(rec)} h · ${punchVerdict(rec)}`,
                );
              }}
            >
              <LogOut className="h-4 w-4" /> Punch out
            </Button>
            <div className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[
              ["Days marked", String(totals.days)],
              ["Hours worked", `${totals.worked} h`],
              ["Overtime", `${totals.overtime} h`],
              ["Short hours", `${totals.short} h`],
            ].map(([l, v]) => (
              <div key={l} className="border-border bg-muted/40 rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  {l}
                </div>
                <div className="text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
          <div className="text-sm font-semibold">My marked attendance</div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!mine.length}
              onClick={() => {
                exportCsv(`${me.id}-marked-attendance`, punchCols, punchRows);
                toast.success("Punch log exported as CSV");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!mine.length}
              onClick={() => {
                const ok = exportReportPdf({
                  title: "Self-marked Attendance Log",
                  subtitle: `${me.name} · ${me.id}`,
                  summary: [
                    { label: "Days marked", value: String(totals.days) },
                    { label: "Hours worked", value: `${totals.worked} h` },
                    { label: "Overtime", value: `${totals.overtime} h` },
                    { label: "Short hours", value: `${totals.short} h` },
                  ],
                  columns: punchCols,
                  rows: punchRows,
                });
                toast[ok ? "success" : "error"](
                  ok ? "Punch log ready — save as PDF" : "Allow pop-ups to download",
                );
              }}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">In</th>
                <th className="p-3 text-left">Out</th>
                <th className="p-3 text-right">Hours</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Verdict</th>
                <th className="p-3 text-left">Shift Timing</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {mine.map((p) => {
                const timing = shiftTimingFlag(p, shift);
                return (
                  <tr key={p.id} className={clickableRow} onClick={() => setDetail(p)}>
                    <td className="p-3 font-medium">
                      <span className="whitespace-nowrap">{p.date}</span>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">{p.inAt}</span>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">
                        {p.outAt || <span className="text-muted-foreground">—</span>}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {p.outAt ? punchHours(p) : "—"}
                    </td>
                    <td className="text-muted-foreground p-3">
                      {p.source}
                      <div className="text-xs">{p.location}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={verdictTone(punchVerdict(p))}>
                        {punchVerdict(p)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={shiftTimingTone[timing.flag]}>
                        {timing.flag}
                      </Badge>
                      {(timing.lateMins > 0 || timing.earlyOutMins > 0) && (
                        <div className="text-muted-foreground mt-0.5 text-[11px]">
                          {timing.lateMins > 0 && `${timing.lateMins}m late`}
                          {timing.lateMins > 0 && timing.earlyOutMins > 0 && " · "}
                          {timing.earlyOutMins > 0 && `${timing.earlyOutMins}m early`}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* Only today's punch can be removed (a wrong tap) — past punches are the attendance record payroll
                           reads, and a locked month is final. Corrections go through HR regularisation. */}
                      {p.date === today && !isAttendanceLocked(p.date.slice(0, 7), orgId) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          aria-label="Remove today's punch"
                          onClick={() => {
                            deletePunch(p.id);
                            toast.success("Punch removed");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {mine.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-10 text-center">
                    No punches yet — use "Punch in" above to mark today's attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {detail &&
        (() => {
          const timing = shiftTimingFlag(detail, shift);
          const verdict = punchVerdict(detail);
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={`${detail.date} · ${detail.inAt} → ${detail.outAt || "in progress"}`}
              subtitle={`${detail.employee} · ${detail.empId}`}
              badges={
                <>
                  <Badge variant="outline" className={verdictTone(verdict)}>
                    {verdict}
                  </Badge>
                  <Badge variant="outline" className={shiftTimingTone[timing.flag]}>
                    {timing.flag}
                  </Badge>
                </>
              }
              record={{
                id: detail.id,
                date: detail.date,
                inAt: detail.inAt,
                outAt: detail.outAt || "—",
                hours: detail.outAt ? `${punchHours(detail)} h` : "—",
                verdict,
                source: detail.source,
                location: detail.location,
                note: detail.note || "—",
                shift: shift
                  ? `${shift.name} · ${shift.start} – ${shift.end}`
                  : "No shift assigned",
                shiftTiming: timing.flag,
                lateBy: timing.lateMins > 0 ? `${timing.lateMins} min` : "—",
                earlyOutBy: timing.earlyOutMins > 0 ? `${timing.earlyOutMins} min` : "—",
              }}
              labels={{
                id: "Punch ID",
                inAt: "Punch in",
                outAt: "Punch out",
                shiftTiming: "Shift timing",
                lateBy: "Late by",
                earlyOutBy: "Early out by",
              }}
              sections={[
                { title: "Punch", keys: ["id", "date", "inAt", "outAt", "hours", "verdict"] },
                { title: "Source", keys: ["source", "location", "note"] },
                { title: "Shift timing", keys: ["shift", "shiftTiming", "lateBy", "earlyOutBy"] },
              ]}
            />
          );
        })()}
    </>
  );
}

function Kpi({ label, value, sub, icon: Icon }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function EmpAttendance() {
  const me = useCurrentEmployee();
  const p = getEmployeeProfile(me.id);
  // Own row from the live register (seed + punches + approved leave, tenant-scoped). Never fall back to another
  // employee's register — the previous `?? ATTENDANCE[0]` showed Ananya Sharma's month to everyone not in the seed.
  // Opens on the current month (the register used to be frozen on the seeded July 2026 data, which is still
  // available from the month picker).
  const [month, setMonth] = useState(currentMonth);
  const live = useLiveAttendance(month);
  const row = useMemo(
    () =>
      live.find((r) => r.empId === me.id) ?? {
        empId: me.id,
        name: me.name,
        designation: me.role,
        office: me.branch,
        shift: p.job.shift,
        days: {},
      },
    [live, me.id, me.name, me.role, me.branch, p.job.shift],
  );
  const [view, setView] = useState("month");
  const [week, setWeek] = useState("1");
  const [day, setDay] = useState(`${currentMonth()}-01`);
  const [monthDetail, setMonthDetail] = useState(null);

  const days = useMemo(() => {
    const all = Object.entries(row.days).sort(([a], [b]) => a.localeCompare(b));
    // "Day wise" always showed the 1st of the month — it now shows the chosen date.
    if (view === "day") return all.filter(([iso]) => iso === day);
    if (view === "week") {
      const i = (Number(week) - 1) * 7;
      return all.slice(i, i + 7);
    }
    return all;
  }, [row, view, week, day]);

  // Weekly offs are not working days — they are shown as "Week off" and never counted as present / absent / leave.
  const counts = days.reduce(
    (acc, [iso, s]) => (isWeekend(iso) ? acc : { ...acc, [s]: acc[s] + 1 }),
    { P: 0, A: 0, L: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clock className="text-primary h-6 w-6" /> My Attendance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Day, week and month view of your attendance along with work hours and overtime.
        </p>
      </div>

      <MarkAttendanceCard />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Present (period)"
          value={String(counts.P)}
          sub={`${counts.A} absent · ${counts.L} leave`}
          icon={CalendarCheck2}
        />
        <Kpi
          label="Avg. work hours"
          value={`${p.attendance.avgHours} h`}
          sub={`${p.attendance.halfDays} half days`}
          icon={Clock}
        />
        <Kpi
          label="Overtime"
          value={`${p.attendance.overtimeHours} h`}
          sub="Eligible for overtime reward"
          icon={TrendingUp}
        />
        <Kpi
          label="Short hours"
          value={`${p.attendance.shortHours} h`}
          sub={`${p.attendance.lateMarks} late marks`}
          icon={AlarmClock}
        />
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select
            value={month}
            onValueChange={(m) => {
              setMonth(m);
              setDay(`${m}-01`);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]" aria-label="Month">
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
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day wise</SelectItem>
              <SelectItem value="week">Week wise</SelectItem>
              <SelectItem value="month">Month wise</SelectItem>
            </SelectContent>
          </Select>
          {view === "day" && (
            <Input
              type="date"
              className="w-full sm:w-[170px]"
              value={day}
              min={`${month}-01`}
              max={`${month}-${String(daysInMonth(month)).padStart(2, "0")}`}
              onChange={(e) => e.target.value.startsWith(month) && setDay(e.target.value)}
            />
          )}
          {view === "week" && (
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5"].map((w) => (
                  <SelectItem key={w} value={w}>
                    Week {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline" className="ml-auto">
            Period: {month} · Shift {p.job.shift}
          </Badge>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {days.map(([iso, s]) => (
              <div
                key={iso}
                className={`rounded-lg border p-2.5 text-center ${isWeekend(iso) ? "border-border bg-muted text-muted-foreground" : palTone[s]}`}
              >
                <div className="text-xs opacity-70">
                  {iso.slice(8)}{" "}
                  {new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  {isWeekend(iso) ? "Week off" : palLabel[s]}
                </div>
              </div>
            ))}
            {days.length === 0 && (
              <div className="text-muted-foreground col-span-full text-sm">
                No attendance recorded for this period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="border-border border-b p-4 text-sm font-semibold">
          Monthly attendance history
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Month</th>
                <th className="p-3 text-left">Present</th>
                <th className="p-3 text-left">Absent</th>
                <th className="p-3 text-left">Leave</th>
                <th className="p-3 text-left">Overtime (h)</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {p.attendance.monthly.map((m) => (
                <tr key={m.month} className={clickableRow} onClick={() => setMonthDetail(m)}>
                  <td className="p-3 font-medium">{m.month}</td>
                  <td className="p-3">{m.present}</td>
                  <td className="p-3">{m.absent}</td>
                  <td className="p-3">{m.leave}</td>
                  <td className="p-3">{m.overtime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {monthDetail &&
        (() => {
          const working = monthDetail.present + monthDetail.absent + monthDetail.leave;
          const pct = working ? Math.round((monthDetail.present / working) * 1000) / 10 : 0;
          return (
            <RecordDetailDialog
              onClose={() => setMonthDetail(null)}
              title={`${monthDetail.month} · ${me.name}`}
              subtitle={`${me.id} · shift ${p.job.shift}`}
              badges={<Badge variant="outline">{pct} % attendance</Badge>}
              record={{ ...monthDetail, workingDays: working, attendancePct: `${pct} %` }}
              labels={{
                present: "Present days",
                absent: "Absent days",
                leave: "Leave days",
                overtime: "Overtime (h)",
                workingDays: "Working days",
                attendancePct: "Attendance %",
              }}
            />
          );
        })()}
    </div>
  );
}

export default EmpAttendance;
