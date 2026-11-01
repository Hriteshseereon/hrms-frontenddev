import { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { attendanceApi } from "@/api/attendanceApi";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  currentMonth,
  daysInMonth,
  monthTitle,
  registerMonths,
  useLiveAttendance,
  isWeekend,
} from "@/features/attendance/data/attendance-live";
import {
  MissedPunchBanner,
  MyRegularisationRequests,
  RegularisationApprovals,
  RegularisationDialog,
  apiError,
} from "@/features/attendance/components/RegularisationPieces";
import { exportReportPdf, exportCsv } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const palTone = {
  P: "bg-primary/10 text-primary border-primary/30",
  A: "bg-destructive/10 text-destructive border-destructive/30",
  L: "bg-gold/15 text-gold border-gold/40",
  MP: "bg-destructive/10 text-destructive border-destructive/30 border-dashed",
};
const palLabel = { P: "Present", A: "Absent", L: "Leave", MP: "Missed punch-out" };

const verdictTone = (v) =>
  v === "Overtime"
    ? "border-primary/30 bg-primary/10 text-primary"
    : v === "Full Day"
      ? "border-primary/30 bg-primary/10 text-primary"
      : v === "In progress" || v === "Half day"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-destructive/30 bg-destructive/10 text-destructive";

const timingTone = {
  "On time": "border-primary/30 bg-primary/10 text-primary",
  Late: "border-gold/40 bg-gold/15 text-gold",
  "Early out": "border-gold/40 bg-gold/15 text-gold",
};
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

/** Elapsed time of the open punch (it may belong to an earlier date: night shift). Server times are IST. */
function useElapsed(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [active]);
  if (!active?.date || !active?.in_time) return "";
  const start = Date.parse(`${active.date}T${String(active.in_time).slice(0, 8)}+05:30`);
  if (!Number.isFinite(start) || now < start) return "";
  const mins = Math.floor((now - start) / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function MarkAttendanceCard({ onRefresh, liveSummary, livePunches, loadingPunches }) {
  const me = useCurrentEmployee();
  const [todayStatus, setTodayStatus] = useState(null);
  const [loadingToday, setLoadingToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("Manual");
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState("");
  const [note, setNote] = useState("");
  const [warning, setWarning] = useState("");
  const [detail, setDetail] = useState(null);
  const [regTarget, setRegTarget] = useState(null);

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      setTodayStatus(await attendanceApi.getTodayStatus());
    } catch (err) {
      console.warn("Could not fetch today's status:", err);
    } finally {
      setLoadingToday(false);
    }
  }, []);
  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  // Biometric devices come from the backend (the SDK / push is not built yet — a punch is tagged with the device).
  useEffect(() => {
    if (source !== "Biometric" || devices.length) return;
    attendanceApi
      .getDevices()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.items ?? []);
        setDevices(list);
        setDevice((d) => d || list.find((x) => x.status !== "INACTIVE")?.id || "");
      })
      .catch(() => toast.error("Could not load biometric devices"));
  }, [source, devices.length]);

  const refreshAll = async () => {
    await fetchToday();
    onRefresh?.();
  };

  const shift = todayStatus?.shift;
  const locked = Boolean(todayStatus?.locked);
  const isPunchedIn = Boolean(todayStatus?.is_punched_in);
  const active = todayStatus?.active_punch;
  const elapsed = useElapsed(isPunchedIn ? active : null);
  const missed = todayStatus?.missed_punch_outs ?? [];
  const dev = devices.find((d) => d.id === device);
  const location = source === "Manual" ? "Self-marked · Web portal" : (dev?.location ?? "Biometric device");
  const today = todayStatus?.date;

  const fail = (err, fallback) => {
    const { general, status } = apiError(err, fallback);
    toast.error(status === 423 ? "Attendance for this month is locked" : general);
  };

  const punchIn = async () => {
    if (source === "Biometric" && !device) return toast.error("Choose a biometric device");
    setBusy(true);
    try {
      // No client timestamp is sent — the server clock stamps the punch.
      const rec = await attendanceApi.punchIn({
        source: source === "Biometric" ? "BIOMETRIC" : "MANUAL",
        device_id: source === "Biometric" ? device : null,
        location_name: location,
        note: note.trim() || undefined,
      });
      setWarning(rec?.warning || "");
      toast.success(`Punched in at ${hhmm(rec?.in_time) || "now"} · ${rec?.source || source}`);
      setNote("");
      await refreshAll();
    } catch (err) {
      fail(err, "Failed to punch in");
    } finally {
      setBusy(false);
    }
  };

  const punchOut = async () => {
    setBusy(true);
    try {
      const rec = await attendanceApi.punchOut({ note: note.trim() || undefined });
      toast.success(
        `Punched out at ${hhmm(rec?.out_time) || "now"}${rec?.hours != null ? ` · ${Number(rec.hours).toFixed(2)} h` : ""}${rec?.verdict ? ` · ${rec.verdict}` : ""}`,
      );
      setNote("");
      setWarning("");
      await refreshAll();
    } catch (err) {
      fail(err, "Failed to punch out");
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePunch = async (punchId) => {
    try {
      await attendanceApi.deleteTodayPunch(punchId);
      toast.success("Punch removed successfully");
      await refreshAll();
    } catch (err) {
      fail(err, "Failed to remove punch");
    }
  };

  const displayPunches = Array.isArray(livePunches) ? livePunches : [];
  const totals = {
    days: liveSummary?.present_days ?? 0,
    worked: liveSummary?.total_work_hours ?? 0,
    overtime: liveSummary?.overtime_hours ?? 0,
    short: liveSummary?.short_hours ?? 0,
    missed: liveSummary?.missed_punches ?? 0,
  };
  const hoursOf = (p) => (p.hours != null ? Number(p.hours).toFixed(2) : "—");
  const outOf = (p) =>
    p.out_time ? `${hhmm(p.out_time)}${p.out_date && p.out_date !== p.date ? ` (${p.out_date})` : ""}` : "";

  const punchCols = ["Date", "In", "Out", "Hours", "Source", "Location", "Verdict", "Shift Timing", "Note"];
  const punchRows = displayPunches.map((p) => [
    p.date,
    hhmm(p.in_time) || "—",
    outOf(p) || "—",
    hoursOf(p),
    p.source || "Manual",
    p.location_name || "—",
    p.verdict || "—",
    p.shift_timing || "—",
    p.note || "—",
  ]);

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
                Punch in manually from the portal, or record a biometric device punch. The time is
                taken from the server when you punch.
              </p>
            </div>
            <Badge
              variant="outline"
              className={isPunchedIn ? "border-primary/30 bg-primary/10 text-primary" : ""}
            >
              {loadingToday && !todayStatus ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking status…
                </span>
              ) : isPunchedIn ? (
                `Punched in at ${hhmm(active?.in_time) || "—"}${elapsed ? ` · ${elapsed}` : ""}`
              ) : (
                "Not punched in"
              )}
            </Badge>
          </div>

          <div className="border-border bg-muted/30 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Shift: </span>
              <span className="font-medium">
                {shift ? `${shift.name} · ${hhmm(shift.start)}–${hhmm(shift.end)}` : "Not assigned"}
              </span>
            </div>
          </div>

          {locked && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs">
              Attendance for this month is locked.
            </div>
          )}
          {warning && (
            <div className="border-gold/40 bg-gold/10 rounded-lg border p-3 text-xs">{warning}</div>
          )}
          {isPunchedIn && active?.date && today && active.date !== today && (
            <div className="text-gold text-xs">
              Open punch from <span className="whitespace-nowrap">{active.date}</span> (night shift) — punch
              out to close it.
            </div>
          )}

          <MissedPunchBanner
            missed={missed}
            locked={locked}
            onRequest={setRegTarget}
            onChanged={refreshAll}
          />

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
                </SelectContent>
              </Select>
            </div>
            {source === "Biometric" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Device / location</Label>
                <Select value={device} onValueChange={setDevice}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder={devices.length ? "Select a device" : "No devices available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d.id} value={d.id} disabled={d.status === "INACTIVE"}>
                        {d.name}
                        {d.status === "INACTIVE" ? " (inactive)" : ""}
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
              disabled={isPunchedIn || busy || locked}
              onClick={() => void punchIn()}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogIn className="mr-1.5 h-4 w-4" />}{" "}
              Punch in
            </Button>
            <Button variant="outline" disabled={!isPunchedIn || busy || locked} onClick={() => void punchOut()}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}{" "}
              Punch out
            </Button>
            <div className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Days marked", String(totals.days)],
              ["Hours worked", `${Number(totals.worked).toFixed(1)} h`],
              ["Overtime", `${Number(totals.overtime).toFixed(1)} h`],
              ["Short hours", `${Number(totals.short).toFixed(1)} h`],
              ["Missed punches", String(totals.missed)],
            ].map(([l, v]) => (
              <div key={l} className="border-border bg-muted/40 rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{l}</div>
                <div className="text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            My marked attendance
            {loadingPunches && <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!displayPunches.length}
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
              disabled={!displayPunches.length}
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
                toast[ok ? "success" : "error"](ok ? "Punch log ready — save as PDF" : "Allow pop-ups to download");
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
              {loadingPunches && !displayPunches.length ? (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="text-primary h-4 w-4 animate-spin" /> Loading attendance logs…
                    </div>
                  </td>
                </tr>
              ) : (
                displayPunches.map((p) => (
                  <tr key={p.id} className={clickableRow} onClick={() => setDetail(p)}>
                    <td className="p-3 font-medium">
                      <span className="whitespace-nowrap">{p.date}</span>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">{hhmm(p.in_time) || "—"}</span>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">
                        {outOf(p) || <span className="text-muted-foreground">—</span>}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">{hoursOf(p)}</td>
                    <td className="text-muted-foreground p-3">
                      {p.source || "Manual"}
                      <div className="text-xs">{p.location_name || "Self-marked"}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={verdictTone(p.verdict)}>
                        {p.verdict || "—"}
                      </Badge>
                      {p.regularised && (
                        <Badge variant="outline" className="ml-1 border-border text-[10px]">
                          Regularised
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={timingTone[p.shift_timing] || "border-border bg-muted"}>
                        {p.shift_timing || "—"}
                      </Badge>
                      {(p.late_mins > 0 || p.early_out_mins > 0) && (
                        <div className="text-muted-foreground mt-0.5 text-[11px]">
                          {p.late_mins > 0 && `${p.late_mins}m late`}
                          {p.late_mins > 0 && p.early_out_mins > 0 && " · "}
                          {p.early_out_mins > 0 && `${p.early_out_mins}m early`}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {p.date === today && !p.is_locked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Remove today's punch"
                          onClick={() => handleDeletePunch(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {!loadingPunches && displayPunches.length === 0 && (
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

      <MyRegularisationRequests refreshKey={todayStatus} onChanged={refreshAll} />

      <RegularisationDialog target={regTarget} onClose={() => setRegTarget(null)} onDone={refreshAll} />

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.date} · ${hhmm(detail.in_time)} → ${outOf(detail) || "in progress"}`}
          subtitle={`${me.name}`}
          badges={
            <>
              <Badge variant="outline" className={verdictTone(detail.verdict)}>
                {detail.verdict || "—"}
              </Badge>
              {detail.regularised && <Badge variant="outline">Regularised</Badge>}
            </>
          }
          record={{
            id: detail.id,
            date: detail.date,
            inAt: hhmm(detail.in_time) || "—",
            outAt: outOf(detail) || "—",
            hours: detail.hours != null ? `${Number(detail.hours).toFixed(2)} h` : "—",
            verdict: detail.verdict || "—",
            source: detail.source || "Manual",
            location: detail.location_name || "Self-marked",
            note: detail.note || "—",
            shift: shift ? `${shift.name} · ${hhmm(shift.start)} – ${hhmm(shift.end)}` : "No shift assigned",
            shiftTiming: detail.shift_timing || "—",
            lateBy: detail.late_mins > 0 ? `${detail.late_mins} min` : "—",
            earlyOutBy: detail.early_out_mins > 0 ? `${detail.early_out_mins} min` : "—",
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
      )}
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
  const user = useCurrentUser();
  const p = getEmployeeProfile(me.id);
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

  // Live backend data states
  const [summary, setSummary] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [livePunches, setLivePunches] = useState(null);
  const [loadingPunches, setLoadingPunches] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Extract year and month numbers
  const [selectedYear, selectedMonth] = useMemo(() => {
    const parts = (month || currentMonth()).split("-").map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [month]);

  // Fetch live backend attendance data
  const loadBackendData = useCallback(async () => {
    setLoadingPunches(true);
    try {
      const [sumRes, calRes, punchRes, histRes] = await Promise.allSettled([
        attendanceApi.getMySummary(selectedMonth, selectedYear),
        attendanceApi.getMyCalendar(selectedMonth, selectedYear),
        attendanceApi.getMyPunches({ month: selectedMonth, year: selectedYear, page: 1, limit: 50 }),
        attendanceApi.getMyMonthlyHistory(6),
      ]);

      if (sumRes.status === "fulfilled" && sumRes.value) {
        setSummary(sumRes.value);
      }
      if (calRes.status === "fulfilled" && calRes.value?.days) {
        setCalendarData(calRes.value);
      }
      if (punchRes.status === "fulfilled" && punchRes.value) {
        const items = punchRes.value.items || (Array.isArray(punchRes.value) ? punchRes.value : []);
        setLivePunches(items);
      }
      if (histRes.status === "fulfilled" && histRes.value) {
        const items = histRes.value.items || (Array.isArray(histRes.value) ? histRes.value : []);
        setMonthlyHistory(items);
      }
    } catch (err) {
      console.warn("Error fetching backend attendance data:", err);
    } finally {
      setLoadingPunches(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData, refreshCount]);

  const days = useMemo(() => {
    if (calendarData?.days && Object.keys(calendarData.days).length > 0) {
      const all = Object.entries(calendarData.days).sort(([a], [b]) => a.localeCompare(b));
      if (view === "day") return all.filter(([iso]) => iso === day);
      if (view === "week") {
        const i = (Number(week) - 1) * 7;
        return all.slice(i, i + 7);
      }
      return all;
    }
    const all = Object.entries(row.days).sort(([a], [b]) => a.localeCompare(b));
    if (view === "day") return all.filter(([iso]) => iso === day);
    if (view === "week") {
      const i = (Number(week) - 1) * 7;
      return all.slice(i, i + 7);
    }
    return all;
  }, [calendarData, row, view, week, day]);

  // Weekly offs are not working days — they are shown as "Week off" and never counted as present / absent / leave.
  const fallbackCounts = days.reduce(
    (acc, [iso, s]) => (isWeekend(iso) || s === "WO" ? acc : { ...acc, [s]: (acc[s] || 0) + 1 }),
    { P: 0, A: 0, L: 0 },
  );

  const displayMonthlyHistory = useMemo(() => {
    if (Array.isArray(monthlyHistory) && monthlyHistory.length > 0) {
      return monthlyHistory;
    }
    return p.attendance.monthly;
  }, [monthlyHistory, p.attendance.monthly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="text-primary h-6 w-6" /> My Attendance
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Day, week and month view of your attendance along with work hours and overtime.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshCount((c) => c + 1)}
          disabled={loadingPunches}
          className="flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingPunches ? "animate-spin" : ""}`} /> Refresh Data
        </Button>
      </div>

      <MarkAttendanceCard
        onRefresh={() => setRefreshCount((c) => c + 1)}
        liveSummary={summary}
        livePunches={livePunches}
        loadingPunches={loadingPunches}
      />

      <RegularisationApprovals
        isHr={["HR", "CHRO", "Admin", "SuperAdmin", "BranchAdmin"].includes(user.role)}
        onChanged={() => setRefreshCount((c) => c + 1)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Present (period)"
          value={summary ? String(summary.present_days ?? 0) : String(fallbackCounts.P)}
          sub={
            summary
              ? `${summary.absent_days ?? 0} absent · ${summary.leave_days ?? 0} leave`
              : `${fallbackCounts.A} absent · ${fallbackCounts.L} leave`
          }
          icon={CalendarCheck2}
        />
        <Kpi
          label="Avg. work hours"
          value={summary ? `${summary.avg_work_hours ?? 0} h` : `${p.attendance.avgHours} h`}
          sub={
            summary
              ? `${summary.half_days ?? 0} half days`
              : `${p.attendance.halfDays} half days`
          }
          icon={Clock}
        />
        <Kpi
          label="Overtime"
          value={summary ? `${summary.overtime_hours ?? 0} h` : `${p.attendance.overtimeHours} h`}
          sub="Eligible for overtime reward"
          icon={TrendingUp}
        />
        <Kpi
          label="Short hours"
          value={summary ? `${summary.short_hours ?? 0} h` : `${p.attendance.shortHours} h`}
          sub={
            summary
              ? `${summary.late_marks ?? 0} late marks`
              : `${p.attendance.lateMarks} late marks`
          }
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
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setRefreshCount((c) => c + 1)}
            title="Refresh month attendance"
            disabled={loadingPunches}
          >
            <RefreshCw className={`h-4 w-4 ${loadingPunches ? "animate-spin" : ""}`} />
          </Button>
          <Badge variant="outline" className="ml-auto">
            Period: {month} · Shift {p.job.shift}
          </Badge>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {days.map(([iso, s]) => {
              const isWOff = s === "WO" || isWeekend(iso);
              const isHol = s === "H";
              const toneClass = isWOff
                ? "border-border bg-muted text-muted-foreground"
                : isHol
                  ? "bg-sky-500/15 text-sky-600 border-sky-400/30"
                  : palTone[s] || "border-border bg-muted/40";
              const labelText = isWOff ? "Week off" : isHol ? "Holiday" : palLabel[s] || s || "—";

              return (
                <div
                  key={iso}
                  className={`rounded-lg border p-2.5 text-center transition ${toneClass}`}
                >
                  <div className="text-xs opacity-70">
                    {iso.slice(8)}{" "}
                    {new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
                  </div>
                  <div className="mt-0.5 text-sm font-bold">{labelText}</div>
                </div>
              );
            })}
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
              {displayMonthlyHistory.map((m) => (
                <tr key={m.month} className={clickableRow} onClick={() => setMonthDetail(m)}>
                  <td className="p-3 font-medium">{m.month}</td>
                  <td className="p-3">{m.present}</td>
                  <td className="p-3">{m.absent}</td>
                  <td className="p-3">{m.leave}</td>
                  <td className="p-3">{m.overtime ?? m.overtime_hours ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {monthDetail &&
        (() => {
          const present = Number(monthDetail.present ?? 0);
          const absent = Number(monthDetail.absent ?? 0);
          const leave = Number(monthDetail.leave ?? 0);
          const overtime = Number(monthDetail.overtime ?? monthDetail.overtime_hours ?? 0);
          const working = present + absent + leave;
          const pct = working ? Math.round((present / working) * 1000) / 10 : 0;
          return (
            <RecordDetailDialog
              onClose={() => setMonthDetail(null)}
              title={`${monthDetail.month} · ${me.name}`}
              subtitle={`${me.id} · shift ${p.job.shift}`}
              badges={<Badge variant="outline">{pct} % attendance</Badge>}
              record={{
                month: monthDetail.month,
                present,
                absent,
                leave,
                overtime,
                workingDays: working,
                attendancePct: `${pct} %`,
              }}
              labels={{
                month: "Month",
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
