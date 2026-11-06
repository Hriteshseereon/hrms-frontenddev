import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Clock3,
  LockKeyhole,
  RefreshCw,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { attendanceApi } from "@/api/attendanceApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attendanceLockStore,
  lockAttendance,
  setPayrollAttendanceSnapshot,
  unlockAttendance,
} from "@/features/attendance/data/attendance-pattern";

const listOf = (value) => {
  if (Array.isArray(value)) return value;
  for (const key of ["items", "rows", "employees", "results", "data"]) {
    if (Array.isArray(value?.[key])) return value[key];
    if (Array.isArray(value?.data?.[key])) return value.data[key];
  }
  return [];
};
const idOf = (row) =>
  String(
    row?.employee_id ??
      row?.employeeId ??
      row?.emp_id ??
      row?.empId ??
      row?.employee?.id ??
      row?.id ??
      "",
  );
const nameOf = (row) =>
  row?.employee_name ??
  row?.name ??
  row?.employee?.name ??
  ([row?.first_name, row?.last_name].filter(Boolean).join(" ") || row?.work_email || "Employee");
const valueOf = (row, ...keys) => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return null;
};
const metric = (row, ...keys) => {
  const value = valueOf(row, ...keys);
  return value === null ? "—" : value;
};
const numeric = (row, ...keys) => {
  const value = valueOf(row, ...keys);
  const n = Number(value);
  return value === null || value === "" || !Number.isFinite(n) ? null : n;
};
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? String(value)
    : date.toLocaleString("en-IN", { dateStyle: "medium" });
};
const periodName = (period) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const lockInfo = (payload, period) => {
  const source =
    payload?.locks ?? payload?.data?.locks ?? payload?.items ?? payload?.data ?? payload ?? {};
  if (Array.isArray(source)) return source.find((item) => item.period === period) ?? null;
  return source?.[period] ?? null;
};
const dayRecords = (entry, registerRows, employee, period) => {
  const sameEmployee = (row) => {
    const rowId = idOf(row).toLowerCase();
    return (
      rowId === idOf(employee).toLowerCase() ||
      nameOf(row).trim().toLowerCase() === nameOf(employee).trim().toLowerCase()
    );
  };
  const nested = entry?.days ?? entry?.records ?? entry?.attendance;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object")
    return Object.entries(nested).map(([date, status]) =>
      typeof status === "object"
        ? { date: date.length <= 2 ? `${period}-${date.padStart(2, "0")}` : date, ...status }
        : { date: date.length <= 2 ? `${period}-${date.padStart(2, "0")}` : date, status },
    );
  return registerRows.filter(sameEmployee);
};
const statusLabel = (value) =>
  ({ P: "Present", A: "Absent", L: "Leave", H: "Half day", WO: "Week off" })[
    String(value ?? "").toUpperCase()
  ] ??
  value ??
  "—";

export function PayrollAttendanceLockPanel({
  period,
  companyId,
  payrollOrgId,
  canLock,
  actorName,
  employees = [],
}) {
  const [loading, setLoading] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [error, setError] = useState("");
  const [lockStatusUnavailable, setLockStatusUnavailable] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [workHourRows, setWorkHourRows] = useState([]);
  const [registerRows, setRegisterRows] = useState([]);
  const [locks, setLocks] = useState({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [punches, setPunches] = useState([]);
  const [punchesLoading, setPunchesLoading] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [edits, setEdits] = useState({});
  const [newPunch, setNewPunch] = useState({ date: "", inAt: "", outAt: "", reason: "" });
  const [savingPunch, setSavingPunch] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    setLocks({});
    try {
      const results = await Promise.allSettled([
        attendanceApi.getPayrollSummary(period),
        attendanceApi.getPayrollWorkHours(period),
        attendanceApi.getPayrollRegister(period),
        attendanceApi.getLocks(companyId),
      ]);
      const [reportResult, hoursResult, registerResult, locksResult] = results;
      const failures = results.filter((result) => result.status === "rejected");
      const nextReportRows = reportResult.status === "fulfilled" ? listOf(reportResult.value) : [];
      setReportRows(nextReportRows);
      setPayrollAttendanceSnapshot(period, nextReportRows, employees);
      if (hoursResult.status === "fulfilled") setWorkHourRows(listOf(hoursResult.value));
      else setWorkHourRows([]);
      if (registerResult.status === "fulfilled") setRegisterRows(listOf(registerResult.value));
      else setRegisterRows([]);
      if (locksResult.status === "rejected") {
        setLockStatusUnavailable(true);
        unlockAttendance(period, payrollOrgId);
        throw locksResult.reason;
      }
      setLockStatusUnavailable(false);
      const lockList = locksResult.value;
      const nextLocks = lockList?.locks ?? lockList?.data ?? lockList ?? {};
      setLocks(nextLocks);
      const currentLock = lockInfo(lockList, period);
      // Keep the payroll engine's synchronous lock check aligned with the server's persisted state.
      if (currentLock) {
        attendanceLockStore.set((current) => ({
          ...current,
          [`${payrollOrgId}:${period}`]: {
            by: currentLock.by ?? currentLock.locked_by ?? currentLock.lockedBy ?? "HR / Payroll",
            on: currentLock.on ?? currentLock.locked_at ?? currentLock.lockedAt ?? "",
          },
        }));
      } else {
        unlockAttendance(period, payrollOrgId);
      }
      if (failures.length) {
        const reasons = failures
          .map((result) => result.reason?.response?.data?.detail ?? result.reason?.message)
          .filter(Boolean);
        setError(reasons.join(" · ") || "Some attendance summaries could not be loaded.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ?? err?.message ?? "Could not load attendance from the server.",
      );
    } finally {
      setLoading(false);
    }
  }, [period, companyId, payrollOrgId, employees]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const currentLock = lockInfo(locks, period);
  const locked = loading || lockStatusUnavailable || Boolean(currentLock);
  const allRows = useMemo(() => {
    const reportById = new Map();
    reportRows.forEach((row) => reportById.set(idOf(row).toLowerCase(), row));
    const reportByName = new Map(reportRows.map((row) => [nameOf(row).trim().toLowerCase(), row]));
    const hoursGrouped = new Map();
    workHourRows.forEach((row) => {
      const key = idOf(row).toLowerCase() || nameOf(row).trim().toLowerCase();
      hoursGrouped.set(key, [...(hoursGrouped.get(key) ?? []), row]);
    });
    const hoursById = new Map();
    for (const [key, records] of hoursGrouped) {
      const total = (keys, eventFallback) => {
        const direct = records.map((record) => numeric(record, ...keys));
        if (direct.some((value) => value !== null))
          return direct.reduce((sum, value) => sum + (value ?? 0), 0);
        const isDaily = records.some(
          (record) => record.date || record.att_date || record.work_date,
        );
        return isDaily
          ? records.reduce((sum, record) => sum + (eventFallback(record) ? 1 : 0), 0)
          : null;
      };
      hoursById.set(key, {
        ...records[records.length - 1],
        days: records,
        half_days: total(["half_days", "halfDays", "half_day_count"], (record) =>
          /half/i.test(String(record.day_type ?? record.dayType ?? "")),
        ),
        late_marks: total(
          ["late_marks", "lateMarks", "late_count"],
          (record) => Number(record.late_minutes ?? record.lateMinutes ?? 0) > 0,
        ),
        overtime_hours: total(["overtime_hours", "overtime", "ot_hours"], () => false),
        short_hours: total(["short_hours", "shortHours"], () => false),
      });
    }
    const hoursByName = new Map(
      [...hoursGrouped.values()].map((records) => [
        nameOf(records[0]).trim().toLowerCase(),
        hoursById.get(idOf(records[0]).toLowerCase() || nameOf(records[0]).trim().toLowerCase()),
      ]),
    );
    const source = employees.length ? employees : reportRows;
    return source.map((employee) => {
      const report =
        reportById.get(idOf(employee).toLowerCase()) ??
        reportByName.get(nameOf(employee).trim().toLowerCase());
      const hours =
        hoursById.get(idOf(employee).toLowerCase()) ??
        hoursByName.get(nameOf(employee).trim().toLowerCase());
      const id = idOf(employee);
      const registerEntry =
        registerRows.find((row) => idOf(row).toLowerCase() === id.toLowerCase()) ??
        registerRows.find(
          (row) => nameOf(row).trim().toLowerCase() === nameOf(employee).trim().toLowerCase(),
        );
      return {
        employee,
        report: report?.attendance ?? report?.summary ?? report ?? {},
        hours: hours?.summary ?? hours?.work_hours ?? hours ?? {},
        registerEntry,
      };
    });
  }, [employees, reportRows, workHourRows, registerRows]);
  const rows = useMemo(
    () =>
      allRows.filter(({ employee, report }) =>
        `${nameOf(employee)} ${idOf(employee)} ${employee.department ?? report.department ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [allRows, query],
  );
  const readyToLock =
    allRows.length > 0 &&
    allRows.every(({ employee, report, hours, registerEntry }) => {
      const required = [
        numeric(report, "present", "present_days", "present_count"),
        numeric(report, "absent", "absent_days", "absent_count"),
        numeric(report, "leave", "paidLeave", "leave_days", "leave_count"),
        numeric(report, "working_days", "workingDays", "work_days"),
        numeric(hours, "half_days", "halfDays", "half_day_count"),
        numeric(hours, "late_marks", "lateMarks", "late_count"),
        numeric(hours, "overtime_hours", "overtime", "ot_hours"),
        numeric(hours, "short_hours", "shortHours"),
      ];
      return (
        required.every((value) => value !== null) &&
        dayRecords(registerEntry ?? report, registerRows, employee, period).length > 0
      );
    });

  const totals = useMemo(() => {
    const fields = [
      ["present", "present_days", "present_count"],
      ["absent", "absent_days", "absent_count"],
      ["leave", "leave_days", "leave_count"],
      ["half_days", "halfDays", "half_day_count"],
      ["late_marks", "lateMarks", "late_count"],
      ["overtime_hours", "overtime", "ot_hours"],
      ["short_hours", "shortHours"],
      ["working_days", "workingDays", "work_days"],
    ];
    return fields.map(([label, ...keys]) => {
      const values = allRows
        .map((row) => numeric(row.report, ...keys) ?? numeric(row.hours, ...keys))
        .filter((value) => value !== null);
      return {
        label: label.replaceAll("_", " "),
        value: values.length ? values.reduce((sum, value) => sum + value, 0) : "—",
      };
    });
  }, [allRows]);

  const openEmployee = async (row) => {
    setSelected(row);
    setPunches([]);
    setPunchError("");
    setPunchesLoading(true);
    try {
      const employeeId = idOf(row.employee);
      const result = await attendanceApi.listPunches({
        empId: employeeId,
        month: period,
        page: 1,
        pageSize: 500,
      });
      setPunches(listOf(result));
    } catch (err) {
      setPunchError(err?.response?.data?.detail ?? err?.message ?? "Could not load daily punches.");
    } finally {
      setPunchesLoading(false);
    }
  };

  const saveCorrection = async (punch) => {
    const edit = edits[punch.id] ?? {};
    if (!edit.reason?.trim() || !edit.inAt || !edit.outAt) return;
    setSavingPunch(true);
    try {
      await attendanceApi.regularisePunch(punch.id, {
        in_time: edit.inAt,
        out_time: edit.outAt,
        next_day: Boolean(edit.nextDay),
        reason: edit.reason.trim(),
      });
      toast.success("Attendance punch corrected");
      setEdits((previous) => ({ ...previous, [punch.id]: { ...previous[punch.id], reason: "" } }));
      await openEmployee(selected);
      await loadAttendance();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ?? err?.message ?? "Could not correct the attendance punch.",
      );
    } finally {
      setSavingPunch(false);
    }
  };

  const addMissingPunch = async (event) => {
    event.preventDefault();
    if (!newPunch.date || !newPunch.inAt || !newPunch.outAt || !newPunch.reason.trim()) return;
    setSavingPunch(true);
    try {
      await attendanceApi.addPunch({
        employee_id: idOf(selected.employee),
        date: newPunch.date,
        in_time: newPunch.inAt,
        out_time: newPunch.outAt,
        reason: newPunch.reason.trim(),
      });
      toast.success("Missing attendance punch added");
      setNewPunch({ date: "", inAt: "", outAt: "", reason: "" });
      await openEmployee(selected);
      await loadAttendance();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ?? err?.message ?? "Could not add the attendance punch.",
      );
    } finally {
      setSavingPunch(false);
    }
  };

  const lockMonth = async () => {
    setSavingLock(true);
    try {
      const response = await attendanceApi.lockPayrollMonth(period, companyId);
      lockAttendance(period, actorName, payrollOrgId);
      setLocks((previous) => {
        const record = response?.lock ?? response ?? { by: actorName };
        if (Array.isArray(previous))
          return [...previous.filter((item) => item.period !== period), { period, ...record }];
        return { ...previous, [period]: record };
      });
      toast.success(`${periodName(period)} attendance locked`);
      await loadAttendance();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? "Could not lock attendance.");
    } finally {
      setSavingLock(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 text-primary grid h-10 w-10 place-items-center rounded-xl">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Payroll Attendance Lock · {periodName(period)}</div>
              <div className="text-muted-foreground text-xs">
                Review monthly attendance and resolve punch issues before payroll calculation.
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                locked
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gold/40 bg-gold/15 text-gold"
              }
            >
              {loading
                ? "Checking lock status…"
                : lockStatusUnavailable
                  ? "Status unavailable · read-only"
                  : locked
                    ? "Locked"
                    : "Open for review"}
            </Badge>
            {canLock && !locked && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={loading || savingLock || !readyToLock || Boolean(error)}>
                    <LockKeyhole className="h-4 w-4" /> Lock Attendance
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lock {periodName(period)} attendance?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This records the monthly attendance for payroll and prevents further punch
                      changes for this period. Review the employee summaries and daily punches
                      before continuing.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Review again</AlertDialogCancel>
                    <AlertDialogAction disabled={savingLock} onClick={lockMonth}>
                      Confirm lock
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={loadAttendance}
              disabled={loading}
              title="Refresh attendance from server"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {!loading && currentLock && (
            <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-3 py-2 text-xs">
              <span className="text-primary flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5" /> Attendance is read-only for payroll
              </span>
              <span>
                Locked by{" "}
                <b>{currentLock?.by ?? currentLock?.locked_by ?? currentLock?.lockedBy ?? "—"}</b>
              </span>
              <span>
                Locked on{" "}
                <b>
                  {formatDate(currentLock?.on ?? currentLock?.locked_at ?? currentLock?.lockedAt)}
                </b>
              </span>
            </div>
          )}

          {!loading && !locked && allRows.length > 0 && !readyToLock && (
            <div className="border-gold/40 bg-gold/10 rounded-md border p-3 text-xs">
              Attendance cannot be locked until monthly summary fields and day-wise register records
              are available for every employee.
            </div>
          )}

          {error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            <div className="bg-muted/20 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">Employees</div>
              <div className="mt-1 text-lg font-semibold">{allRows.length}</div>
            </div>
            {totals.map((item) => (
              <div key={item.label} className="bg-muted/20 rounded-lg border p-3">
                <div className="text-muted-foreground text-xs capitalize">{item.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted/20 flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3 py-1.5">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search employee or department"
                className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="text-muted-foreground text-xs">
              {rows.length} of {allRows.length} employees · source: attendance API
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                <tr>
                  {[
                    "Employee",
                    "Present",
                    "Absent",
                    "Leave",
                    "Half days",
                    "Late marks",
                    "Overtime",
                    "Short hours",
                    "Working days",
                    "Review",
                  ].map((heading) => (
                    <th key={heading} className="p-3 text-left">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && !rows.length ? (
                  <tr>
                    <td colSpan={10} className="text-muted-foreground p-8 text-center">
                      Loading attendance from server…
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const report = row.report;
                    const hours = row.hours;
                    return (
                      <tr key={idOf(row.employee)} className="hover:bg-muted/20">
                        <td className="p-3 font-medium">
                          {nameOf(row.employee)}
                          <div className="text-muted-foreground font-mono text-xs">
                            {row.employee.employee_code ?? idOf(row.employee)} ·{" "}
                            {row.employee.department ?? report.department ?? "—"}
                          </div>
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(report, "present", "present_days", "present_count")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(report, "absent", "absent_days", "absent_count")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(report, "leave", "paidLeave", "leave_days", "leave_count")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(hours, "half_days", "halfDays", "half_day_count")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(hours, "late_marks", "lateMarks", "late_count")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(hours, "overtime_hours", "overtime", "ot_hours")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(hours, "short_hours", "shortHours")}
                        </td>
                        <td className="p-3 tabular-nums">
                          {metric(report, "working_days", "workingDays", "work_days")}
                        </td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" onClick={() => openEmployee(row)}>
                            <UserRound className="h-3.5 w-3.5" /> Daily review
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!loading && !error && !rows.length && (
                  <tr>
                    <td colSpan={10} className="text-muted-foreground p-8 text-center">
                      No employee attendance was returned for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? nameOf(selected.employee) : "Daily attendance"} · {periodName(period)}
            </DialogTitle>
            <DialogDescription>
              Monthly register and punches from the attendance database.{" "}
              {loading
                ? "Checking lock status. Corrections are temporarily disabled."
                : lockStatusUnavailable
                  ? "Lock status is unavailable. Corrections are temporarily disabled."
                  : locked
                    ? "Corrections are disabled because this period is locked."
                    : "Resolve missing punches before locking attendance."}
            </DialogDescription>
          </DialogHeader>
          {selected &&
            (() => {
              const register = dayRecords(
                selected.registerEntry ?? selected.report,
                registerRows,
                selected.employee,
                period,
              );
              register.push(...(Array.isArray(selected.hours.days) ? selected.hours.days : []));
              const byDate = new Map();
              register.forEach((item) => {
                const date = item.date ?? item.att_date ?? item.work_date;
                if (date)
                  byDate.set(String(date).slice(0, 10), {
                    ...(byDate.get(String(date).slice(0, 10)) ?? {}),
                    ...item,
                  });
              });
              punches.forEach((punch) => {
                const date = String(punch.date ?? punch.work_date ?? punch.att_date ?? "").slice(
                  0,
                  10,
                );
                if (date) {
                  const prior = byDate.get(date) ?? {};
                  byDate.set(date, { ...prior, punch: punch.id ? punch : prior.punch });
                }
              });
              const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
              return (
                <div className="space-y-4">
                  {punchError && (
                    <div className="border-destructive/30 text-destructive rounded-md border p-3 text-sm">
                      {punchError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      [
                        "Present",
                        metric(selected.report, "present", "present_days", "present_count"),
                      ],
                      ["Absent", metric(selected.report, "absent", "absent_days", "absent_count")],
                      [
                        "Leave",
                        metric(selected.report, "leave", "paidLeave", "leave_days", "leave_count"),
                      ],
                      [
                        "Working days",
                        metric(selected.report, "working_days", "workingDays", "work_days"),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border p-3">
                        <div className="text-muted-foreground text-xs">{label}</div>
                        <div className="mt-1 font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="text-primary h-4 w-4" /> Day-wise attendance and punches
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                        <tr>
                          {[
                            "Date",
                            "Register",
                            "In",
                            "Out",
                            "Work hours",
                            "Issue / discrepancy",
                            "Correction",
                          ].map((heading) => (
                            <th key={heading} className="p-3 text-left">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {punchesLoading ? (
                          <tr>
                            <td colSpan={7} className="text-muted-foreground p-6 text-center">
                              Loading daily punches…
                            </td>
                          </tr>
                        ) : (
                          days.map(([date, item]) => {
                            const punch =
                              item.punch ??
                              punches.find(
                                (p) =>
                                  String(p.date ?? p.work_date ?? p.att_date ?? "").slice(0, 10) ===
                                  date,
                              );
                            const status = item.status ?? item.attendance_status ?? item.day_status;
                            const missingOut =
                              punch && !(punch.out_time ?? punch.outAt ?? punch.out_time_local);
                            const statusCode = String(status ?? "").toUpperCase();
                            const issue = missingOut
                              ? "Missing punch-out"
                              : ["P", "PRESENT"].includes(statusCode) && !punch
                                ? "Present without a punch"
                                : ["A", "ABSENT"].includes(statusCode) && punch
                                  ? "Absent with a punch"
                                  : "—";
                            const edit = edits[punch?.id] ?? {
                              inAt: String(punch?.in_time ?? punch?.inAt ?? "").slice(0, 5),
                              outAt: String(punch?.out_time ?? punch?.outAt ?? "").slice(0, 5),
                              reason: "",
                            };
                            return (
                              <tr key={date} className={issue !== "—" ? "bg-gold/5" : ""}>
                                <td className="p-3 whitespace-nowrap">{date}</td>
                                <td className="p-3">
                                  <Badge variant="outline">{statusLabel(status)}</Badge>
                                </td>
                                <td className="p-3">{punch?.in_time ?? punch?.inAt ?? "—"}</td>
                                <td className="p-3">{punch?.out_time ?? punch?.outAt ?? "—"}</td>
                                <td className="p-3">
                                  {item.worked_hours ??
                                    item.workedHours ??
                                    punch?.worked_hours ??
                                    "—"}
                                </td>
                                <td className="p-3">{issue}</td>
                                <td className="p-3">
                                  {punch && !locked ? (
                                    <div className="min-w-[270px] space-y-1.5">
                                      <div className="flex gap-1">
                                        <Input
                                          aria-label="Correct punch in"
                                          type="time"
                                          className="h-8"
                                          value={edit.inAt}
                                          onChange={(event) =>
                                            setEdits((old) => ({
                                              ...old,
                                              [punch.id]: { ...edit, inAt: event.target.value },
                                            }))
                                          }
                                        />
                                        <Input
                                          aria-label="Correct punch out"
                                          type="time"
                                          className="h-8"
                                          value={edit.outAt}
                                          onChange={(event) =>
                                            setEdits((old) => ({
                                              ...old,
                                              [punch.id]: { ...edit, outAt: event.target.value },
                                            }))
                                          }
                                        />
                                      </div>
                                      <Input
                                        aria-label="Correction reason"
                                        placeholder="Correction reason"
                                        value={edit.reason}
                                        onChange={(event) =>
                                          setEdits((old) => ({
                                            ...old,
                                            [punch.id]: { ...edit, reason: event.target.value },
                                          }))
                                        }
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                          savingPunch ||
                                          !edit.inAt ||
                                          !edit.outAt ||
                                          !edit.reason.trim()
                                        }
                                        onClick={() => saveCorrection(punch)}
                                      >
                                        <Wrench className="h-3.5 w-3.5" /> Correct punch
                                      </Button>
                                    </div>
                                  ) : locked ? (
                                    <span className="text-muted-foreground text-xs">Read-only</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {!punchesLoading && !days.length && (
                          <tr>
                            <td colSpan={7} className="text-muted-foreground p-6 text-center">
                              No day-wise attendance records returned by the API for this employee.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!locked && (
                    <form onSubmit={addMissingPunch} className="space-y-2 rounded-lg border p-3">
                      <div className="text-sm font-semibold">Add a missing punch</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            min={`${period}-01`}
                            max={`${period}-${new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate()}`}
                            value={newPunch.date}
                            onChange={(event) =>
                              setNewPunch((old) => ({ ...old, date: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">In time</Label>
                          <Input
                            type="time"
                            value={newPunch.inAt}
                            onChange={(event) =>
                              setNewPunch((old) => ({ ...old, inAt: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Out time</Label>
                          <Input
                            type="time"
                            value={newPunch.outAt}
                            onChange={(event) =>
                              setNewPunch((old) => ({ ...old, outAt: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reason</Label>
                          <Input
                            placeholder="Required"
                            value={newPunch.reason}
                            onChange={(event) =>
                              setNewPunch((old) => ({ ...old, reason: event.target.value }))
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={
                              savingPunch ||
                              !newPunch.date ||
                              !newPunch.inAt ||
                              !newPunch.outAt ||
                              !newPunch.reason.trim()
                            }
                          >
                            <Wrench className="h-4 w-4" /> Add punch
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
