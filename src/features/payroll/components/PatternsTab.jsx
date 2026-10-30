import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Lock,
  Unlock,
  Plus,
  Save,
  Check,
  X,
  PiggyBank,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { inr } from "@/lib/store";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import {
  lockAttendance,
  savePattern,
  saveWorkConfig,
  unlockAttendance,
  useAttendanceLocks,
  usePatterns,
  useWorkConfigs,
  workConfigOf,
  attendanceForPeriod,
} from "@/features/attendance/data/attendance-pattern";
import { periodLabel, usePayrollRuns } from "@/features/payroll/data/payroll-engine";
import { saveContribution, useContributions } from "@/features/payroll/data/contributions-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import {
  apiErrorMessage,
  createAttendancePatternApi,
} from "@/features/attendance/data/attendanceMasterAdapters";

// Created once (module level) so the patterns are not reloaded on every render.
const patternApi = createAttendancePatternApi();

/**
 * @typedef {Object} AssignmentDetail
 * @property {Employee} employee
 * @property {ReturnType<typeof workConfigOf>} config
 * @property {AttendancePattern} pattern
 * @property {ReturnType<typeof attendanceForPeriod>} attendance
 * @property {number} lop
 */

export function PatternsTab() {
  const me = useCurrentUser();
  const storePatterns = usePatterns();
  const configs = useWorkConfigs();
  const locks = useAttendanceLocks();
  const inScope = useScopeMatch();
  const runs = usePayrollRuns().filter((r) => inScope(r.orgId));
  const [edit, setEdit] = useState(null);
const [viewPattern, setViewPattern] = useState(null);
const [deletingPatternId, setDeletingPatternId] = useState(null);
const [period, setPeriod] = useState("2026-07");
const [detail, setDetail] = useState(null);
  const editable = can(me.role, "employee.manage");

  // Attendance patterns come from the API (GET /attendance/patterns). They are also written
  // into the local pattern store so employee assignments and payroll keep resolving them.
  const [apiIds, setApiIds] = useState(null); // ids of the patterns loaded from the server
  const [patternsStatus, setPatternsStatus] = useState("loading"); // loading | ready | failed
  const [savingPattern, setSavingPattern] = useState(false);

  useEffect(() => {
    let active = true;

    patternApi
      .list()
      .then((items) => {
        if (!active) return;
        items.forEach((item) => savePattern(item));
        setApiIds(new Set(items.map((item) => item.id)));
        setPatternsStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setPatternsStatus("failed");
        toast.error(apiErrorMessage(error, "Unable to load attendance patterns"));
      });

    return () => {
      active = false;
    };
  }, []);

  // Shown in the grid and the assignment dropdown: the server's patterns once loaded,
  // the previous local list if the server could not be reached.
  const patterns =
    patternsStatus === "ready"
      ? storePatterns.filter((p) => apiIds.has(p.id))
      : patternsStatus === "failed"
        ? storePatterns
        : [];

  // GET /attendance/patterns/{id}: open the pattern with its latest server values.
  async function openPattern(p) {
    if (!editable) return;

    if (patternsStatus !== "ready" || !apiIds.has(p.id)) {
      setEdit(p);
      return;
    }

    try {
      const fresh = await patternApi.getById(p.id);
      setEdit(fresh ?? p);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to load pattern details"));
      setEdit(p);
    }
  }
  // GET /attendance/patterns/{id}
// Opens the pattern in read-only mode.
async function viewPatternDetails(p) {
  if (patternsStatus !== "ready" || !apiIds.has(p.id)) {
    setViewPattern(p);
    return;
  }

  try {
    const fresh = await patternApi.getById(p.id);
    setViewPattern(fresh ?? p);
  } catch (error) {
    toast.error(
      apiErrorMessage(error, "Unable to load pattern details")
    );
  }
}

// DELETE /attendance/patterns/{id}
async function deletePattern(p) {
  if (patternsStatus !== "ready" || !apiIds.has(p.id)) {
    toast.error("Unable to delete: the API pattern is not available.");
    return;
  }

  // Prevent deleting a pattern currently assigned to employees.
  const assignedCount = usageOf(p.id);

  if (assignedCount > 0) {
    toast.error(
      `Cannot delete this pattern. ${assignedCount} employee(s) are assigned to it. Reassign them first.`
    );
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete "${p.name}"? This action cannot be undone.`
  );

  if (!confirmed) return;

  setDeletingPatternId(p.id);

  try {
    await patternApi.remove(p.id);

    // Remove the deleted API record from the displayed pattern list.
    setApiIds((previous) => {
      const next = new Set(previous ?? []);
      next.delete(p.id);
      return next;
    });

    if (viewPattern?.id === p.id) {
      setViewPattern(null);
    }

    if (edit?.id === p.id) {
      setEdit(null);
    }

    toast.success("Attendance pattern deleted successfully.");
  } catch (error) {
    toast.error(
      apiErrorMessage(error, "Unable to delete attendance pattern")
    );
  } finally {
    setDeletingPatternId(null);
  }
}

  // POST for a new pattern, PATCH (changed fields only) for an existing one.
  async function submitPattern() {
    if (!edit) return;

    if (patternsStatus === "loading") {
      toast.error("Patterns are still loading. Please try again in a moment.");
      return;
    }

    // Server unreachable: keep the previous local-only behaviour.
    if (patternsStatus === "failed") {
      savePattern(edit);
      setEdit(null);
      toast.success("Pattern saved");
      return;
    }

    setSavingPattern(true);

    try {
      const saved = apiIds.has(edit.id)
        ? await patternApi.patch(
            edit.id,
            edit,
            storePatterns.find((x) => x.id === edit.id),
          )
        : await patternApi.create(edit);

      savePattern(saved);
      setApiIds((previous) => new Set([...(previous ?? []), saved.id]));
      setEdit(null);
      toast.success("Pattern saved");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to save attendance pattern"));
    } finally {
      setSavingPattern(false);
    }
  }

  const canLock = can(me.role, "attendance.lock");
  // Live directory (the static EMPLOYEES seed missed new hires and transfers).
  const directory = useDirectory();
  const employees = useMemo(
    () => directory.filter((e) => inScope(e.orgId, null, e.branch)),
    [directory, inScope],
  );
  const usageOf = (id) => employees.filter((e) => workConfigOf(e.id).patternId === id).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Attendance patterns</div>
                <div className="text-muted-foreground text-xs">
                  How many days are payable, how many absences are paid, and whether extra absences
                  deduct pay.
                </div>
              </div>
              {editable && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() =>
                    setEdit({
                      id: `PAT-${String(patterns.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,
                      name: "",
                      workingDays: 26,
                      paidLeaveDays: 2,
                      lopEnabled: true,
                      weeklyOffs: 4,
                      description: "",
                      status: "Active",
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> New pattern
                </Button>
              )}
            </div>

<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
  {patterns.map((p) => (
    <div
      key={p.id}
      className="border-border hover:bg-muted/20 cursor-pointer rounded-xl border p-4"
      onClick={() => viewPatternDetails(p)}
    >
      {/* Keep the existing card dimensions and compact header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {p.name}
          </div>
          <Badge
            variant="outline"
            className={
              p.lopEnabled
                ? "mt-1 border-destructive/30 bg-destructive/10 text-destructive"
                : "mt-1 border-primary/30 bg-primary/10 text-primary"
            }
          >
            {p.lopEnabled ? "LOP applies" : "No LOP"}
          </Badge>
        </div>

        {/* View, Edit and Delete icons on the right */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View attendance pattern"
            aria-label={`View ${p.name}`}
            onClick={() => viewPatternDetails(p)}
          >
            <Eye className="h-4 w-4" />
          </Button>

          {editable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Edit attendance pattern"
              aria-label={`Edit ${p.name}`}
              onClick={() => openPattern(p)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {editable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              // className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
              className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-500"
              title="Delete attendance pattern"
              aria-label={`Delete ${p.name}`}
              disabled={deletingPatternId === p.id}
              onClick={() => deletePattern(p)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Existing metrics: unchanged */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Working days</div>
          <div className="font-semibold">{p.workingDays}</div>
        </div>

        <div>
          <div className="text-muted-foreground">Paid absences</div>
          <div className="font-semibold">{p.paidLeaveDays}</div>
        </div>

        <div>
          <div className="text-muted-foreground">Assigned</div>
          <div className="font-semibold">{usageOf(p.id)} emp.</div>
        </div>
      </div>

      {/* Existing description: unchanged */}
      <div className="text-muted-foreground mt-2 text-xs">
        {p.description}
      </div>
    </div>
  ))}
</div>

          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2 font-semibold">
              <CalendarCheck className="text-primary h-4 w-4" /> Attendance → payroll lock
            </div>
            <div className="text-muted-foreground text-xs">
              Payroll checks read attendance as final only once HR locks the month. Unlocking
              re-opens corrections; re-run checks afterwards.
            </div>
            <div className="space-y-2">
              {["2026-08", "2026-07", "2026-06", "2026-05", "2026-04"].map((p) => {
                const l = locks[p];
                const run = runs.find((r) => r.period === p);
                const frozen =
                  run && ["Pending Approval", "Approved", "Processed", "Paid"].includes(run.status);
                return (
                  <div
                    key={p}
                    className="border-border flex items-center justify-between rounded-lg border p-2.5 text-xs"
                  >
                    <div>
                      {l ? (
                        <Lock className="text-primary mr-1 inline h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="text-destructive mr-1 inline h-3.5 w-3.5" />
                      )}
                      <b>{periodLabel(p)}</b>
                      <div className="text-muted-foreground">
                        {l ? `locked by ${l.by} on ${l.on}` : "open"}
                        {run ? ` · payroll ${run.status}` : ""}
                      </div>
                    </div>
                    {canLock && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={Boolean(frozen)}
                        title={frozen ? "Payroll already in approval — cannot unlock" : ""}
                        onClick={() => {
                          if (l) unlockAttendance(p);
                          else lockAttendance(p, me.name);
                          toast.success(
                            l
                              ? `${periodLabel(p)} unlocked`
                              : `${periodLabel(p)} locked for payroll`,
                          );
                        }}
                      >
                        {l ? "Unlock" : "Lock"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Employee assignments & workday overrides</div>
              <div className="text-muted-foreground text-xs">
                Pattern per employee plus an optional per-employee workday configuration layered on
                the branch default (5 days · 8 h · timesheet required).
              </div>
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Preview month</Label>
              <Input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 w-full sm:w-[150px]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Employee",
                    "Department",
                    "Pattern",
                    "Workday",
                    "Attendance (P / L / A)",
                    "Projected LOP days",
                    "Updated",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {employees.map((e) => {
                  const c = configs.find((x) => x.empId === e.id) ?? workConfigOf(e.id);
                  const p = storePatterns.find((x) => x.id === c.patternId) ?? storePatterns[0];
                  const a = attendanceForPeriod(e.id, period);
                  const lop = p.lopEnabled
                    ? Math.max(a.absent + a.paidLeave - p.paidLeaveDays, 0)
                    : 0;
                  return (
                    <tr
                      key={e.id}
                      className={clickableRow}
                      onClick={() =>
                        setDetail({ employee: e, config: c, pattern: p, attendance: a, lop })
                      }
                    >
                      <td className="p-3 font-medium">
                        {e.name}
                        <div className="text-muted-foreground font-mono text-xs">{e.id}</div>
                      </td>
                      <td className="text-muted-foreground p-3">{e.dept}</td>
                      <td className="p-3" onClick={(ev) => ev.stopPropagation()}>
                        <Select
                          value={c.patternId}
                          disabled={!editable}
                          onValueChange={(v) => {
                            saveWorkConfig({
                              empId: e.id,
                              patternId: v,
                              workday: c.workday,
                              updatedBy: me.name,
                            });
                            toast.success(`${e.name} → ${storePatterns.find((x) => x.id === v)?.name}`);
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-[240px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(patterns.some((x) => x.id === c.patternId)
                              ? patterns
                              : [...patterns, ...storePatterns.filter((x) => x.id === c.patternId)]
                            ).map((x) => (
                              <SelectItem key={x.id} value={x.id}>
                                {x.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-xs">
                        {c.workday ? (
                          <span className="text-primary font-medium">
                            {c.workday.daysPerWeek}d · {c.workday.hoursPerDay}h ·{" "}
                            {c.workday.timesheetRequired ? "timesheet" : "no timesheet"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Branch default</span>
                        )}
                      </td>
                      <td className="p-3 text-xs tabular-nums">
                        {a.present} / {a.paidLeave} / {a.absent}{" "}
                        <span className="text-muted-foreground">
                          ({a.source === "Attendance register" ? "register" : "summary"})
                        </span>
                      </td>
                      <td
                        className={cn(
                          "p-3 font-semibold tabular-nums",
                          lop > 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        {lop}
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        <span className="whitespace-nowrap">{c.updatedOn}</span>
                        <br />
                        {c.updatedBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        
<Dialog
  open={!!viewPattern}
  onOpenChange={(open) => !open && setViewPattern(null)}
>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>View attendance pattern</DialogTitle>
      <DialogDescription>
        Attendance pattern details. Use Edit to make changes.
      </DialogDescription>
    </DialogHeader>

    {viewPattern && (
      <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-muted-foreground text-xs">Name</Label>
          <Input value={viewPattern.name ?? ""} readOnly />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">
            Working days / month
          </Label>
          <Input
            type="number"
            value={viewPattern.workingDays ?? 0}
            readOnly
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">
            Paid absences / month
          </Label>
          <Input
            type="number"
            value={viewPattern.paidLeaveDays ?? 0}
            readOnly
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">
            Weekly offs / month
          </Label>
          <Input
            type="number"
            value={viewPattern.weeklyOffs ?? 0}
            readOnly
          />
        </div>

        <div className="border-border flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">
              Deduct beyond paid days
            </div>
            <div className="text-muted-foreground text-xs">
              Loss of Pay
            </div>
          </div>

          <Switch checked={!!viewPattern.lopEnabled} disabled />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-muted-foreground text-xs">
            Description
          </Label>
          <Input value={viewPattern.description ?? ""} readOnly />
        </div>
      </div>
    )}

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setViewPattern(null)}
      >
        Close
      </Button>

      {editable && viewPattern && (
        <Button
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const selected = viewPattern;
            setViewPattern(null);
            openPattern(selected);
          }}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {patterns.some((p) => p.id === edit?.id) ? "Edit" : "New"} attendance pattern
            </DialogTitle>
            <DialogDescription>
              Changing a pattern affects every employee assigned to it from the next payroll check.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Name</Label>
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  placeholder="e.g. Onsite support — 26 days, no paid leave"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Working days / month</Label>
                <Input
                  type="number"
                  value={edit.workingDays}
                  onChange={(e) => setEdit({ ...edit, workingDays: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Paid absences / month</Label>
                <Input
                  type="number"
                  value={edit.paidLeaveDays}
                  onChange={(e) => setEdit({ ...edit, paidLeaveDays: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Weekly offs / month</Label>
                <Input
                  type="number"
                  value={edit.weeklyOffs}
                  onChange={(e) => setEdit({ ...edit, weeklyOffs: Number(e.target.value) })}
                />
              </div>
              <div className="border-border flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Deduct beyond paid days</div>
                  <div className="text-muted-foreground text-xs">Loss of Pay</div>
                </div>
                <Switch
                  checked={edit.lopEnabled}
                  onCheckedChange={(v) => setEdit({ ...edit, lopEnabled: v })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Description</Label>
                <Input
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={
                !edit?.name.trim() ||
                !edit ||
                edit.workingDays < 1 ||
                edit.workingDays > 31 ||
                edit.paidLeaveDays < 0 ||
                edit.weeklyOffs < 0 ||
                edit.paidLeaveDays > edit.workingDays ||
                edit.workingDays + edit.weeklyOffs > 31 ||
                savingPattern
              }
              onClick={submitPattern}
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={detail.employee.name}
          subtitle={`${detail.employee.id} · ${detail.employee.dept} · ${periodLabel(period)}`}
          badges={
            <>
              <Badge variant="outline">{detail.pattern.name}</Badge>
              <Badge
                variant="outline"
                className={
                  detail.lop > 0
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-primary"
                }
              >
                {detail.lop} projected LOP day(s)
              </Badge>
            </>
          }
          record={{
            name: detail.employee.name,
            empId: detail.employee.id,
            dept: detail.employee.dept,
            pattern: detail.pattern.name,
            workingDays: detail.pattern.workingDays,
            paidLeaveDays: detail.pattern.paidLeaveDays,
            lopEnabled: detail.pattern.lopEnabled,
            weeklyOffsInPattern: detail.pattern.weeklyOffs,
            patternDescription: detail.pattern.description,
            workday: detail.config.workday
              ? `${detail.config.workday.daysPerWeek} days · ${detail.config.workday.hoursPerDay} h · ${detail.config.workday.timesheetRequired ? "timesheet required" : "no timesheet"}`
              : "Branch default",
            weekOffs: detail.config.workday?.weekOffs ?? [],
            workdayNote: detail.config.workday?.note ?? "",
            period: periodLabel(period),
            daysInMonth: detail.attendance.daysInMonth,
            present: detail.attendance.present,
            paidLeave: detail.attendance.paidLeave,
            absent: detail.attendance.absent,
            weeklyOffs: detail.attendance.weeklyOffs,
            holidays: detail.attendance.holidays,
            source: detail.attendance.source,
            locked: detail.attendance.locked,
            projectedLop: detail.lop,
            updatedOn: detail.config.updatedOn,
            updatedBy: detail.config.updatedBy,
          }}
          labels={{
            dept: "Department",
            empId: "Employee ID",
            lopEnabled: "LOP applies",
            weeklyOffsInPattern: "Weekly offs (pattern)",
            projectedLop: "Projected LOP days",
            paidLeave: "Paid leave",
            locked: "Attendance locked",
          }}
          sections={[
            { title: "Employee", keys: ["name", "empId", "dept"] },
            {
              title: "Attendance pattern",
              keys: [
                "pattern",
                "workingDays",
                "paidLeaveDays",
                "lopEnabled",
                "weeklyOffsInPattern",
                "patternDescription",
              ],
            },
            {
              title: "Workday configuration",
              keys: ["workday", "weekOffs", "workdayNote", "updatedOn", "updatedBy"],
            },
            {
              title: "Attendance for period",
              keys: [
                "period",
                "daysInMonth",
                "present",
                "paidLeave",
                "absent",
                "weeklyOffs",
                "holidays",
                "source",
                "locked",
                "projectedLop",
              ],
            },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VPF / NPS approvals                                                 */
/* ------------------------------------------------------------------ */

export function ContributionsQueue() {
  const me = useCurrentUser();
  const all = useContributions();
  const directory = useDirectory();
  const inScopeRows = useScopeMatch();
  const rows = all.filter((c) => inScopeRows(undefined, c.empId));
  const canApprove = can(me.role, "contribution.approve");
  const [detail, setDetail] = useState(null);
  const name = (id) => directory.find((e) => e.id === id)?.name ?? id;
  const decide = (c, status, note) => {
    saveContribution({ ...c, status }, me.name, note);
    toast.success(
      status === "Approved"
        ? `${name(c.empId)}'s contribution approved — effective next payroll`
        : "Returned to employee",
    );
  };
  const tone = (s) =>
    s === "Approved" || s === "Locked"
      ? "border-primary/30 bg-primary/10 text-primary"
      : s === "Submitted"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <PiggyBank className="text-primary h-4 w-4" />
          <div className="font-semibold">VPF & NPS declarations</div>
        </div>
        <div className="text-muted-foreground mb-4 text-xs">
          Employees declare on their Tax Declaration screen; HR approves. Only approved declarations
          flow into PF (A/C 1 + ECR) and payslips.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Employee", "FY", "VPF", "NPS (EE / ER)", "PRAN", "Status", "Updated", ""].map(
                  (h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((c) => (
                <tr
                  key={`${c.empId}-${c.fy}`}
                  className={clickableRow}
                  onClick={() => setDetail(c)}
                >
                  <td className="p-3 font-medium">
                    {name(c.empId)}
                    <div className="text-muted-foreground font-mono text-xs">{c.empId}</div>
                  </td>
                  <td className="text-muted-foreground p-3">{c.fy}</td>
                  <td className="p-3">
                    {c.vpf.enabled ? (
                      c.vpf.mode === "Fixed amount" ? (
                        `${inr(c.vpf.value)} / mo`
                      ) : (
                        `${c.vpf.value} % of Basic`
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {c.nps.enabled ? (
                      `${c.nps.employeePct} % / ${c.nps.employerPct} %`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">{c.nps.pran || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={tone(c.status)}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">{c.updatedOn}</span>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    {canApprove && c.status === "Submitted" && c.empId !== me.id && (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          className="bg-gradient-emerald h-7 text-white"
                          onClick={() => decide(c, "Approved", `Approved by ${me.name}`)}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() =>
                            decide(c, "Draft", `Returned by ${me.name} for correction`)
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-6 text-center">
                    No declarations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${name(detail.empId)} · ${detail.fy}`}
          subtitle={`${detail.empId} · VPF & NPS declaration`}
          badges={
            <Badge variant="outline" className={tone(detail.status)}>
              {detail.status}
            </Badge>
          }
          record={{
            employee: name(detail.empId),
            empId: detail.empId,
            fy: detail.fy,
            status: detail.status,
            updatedOn: detail.updatedOn,
            vpfEnabled: detail.vpf.enabled,
            vpfMode: detail.vpf.enabled ? detail.vpf.mode : "—",
            vpfValue: detail.vpf.enabled
              ? detail.vpf.mode === "Fixed amount"
                ? `${inr(detail.vpf.value)} / month`
                : `${detail.vpf.value} % of Basic`
              : "—",
            npsEnabled: detail.nps.enabled,
            pran: detail.nps.pran || "—",
            npsEmployeePct: detail.nps.enabled ? `${detail.nps.employeePct} %` : "—",
            npsEmployerPct: detail.nps.enabled ? `${detail.nps.employerPct} %` : "—",
            history: detail.history,
          }}
          labels={{
            empId: "Employee ID",
            fy: "Financial year",
            vpfEnabled: "VPF opted",
            vpfMode: "VPF mode",
            vpfValue: "VPF contribution",
            npsEnabled: "NPS opted",
            pran: "PRAN",
            npsEmployeePct: "NPS employee",
            npsEmployerPct: "NPS employer",
          }}
          sections={[
            { title: "Declaration", keys: ["employee", "empId", "fy", "status", "updatedOn"] },
            { title: "Voluntary PF", keys: ["vpfEnabled", "vpfMode", "vpfValue"] },
            {
              title: "National Pension System",
              keys: ["npsEnabled", "pran", "npsEmployeePct", "npsEmployerPct"],
            },
            { title: "History", keys: ["history"] },
          ]}
        />
      )}
    </Card>
  );
}