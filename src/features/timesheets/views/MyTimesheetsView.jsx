import { useMemo, useState } from "react";
import {
  Clock3,
  Plus,
  Trash2,
  CalendarDays,
  Download,
  TrendingUp,
  AlarmClock,
  Zap,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  timesheetStore,
  timesheetFormatStore,
  addTimesheetEntry,
  correctTimesheetEntry,
  hoursBetween,
  setTimesheetStatus,
  TASK_STATUSES,
  PROJECTS,
} from "@/features/timesheets/data/timesheet-data";
import { exportReportPdf, exportCsv } from "@/lib/export-utils";

const badgeFor = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/30 bg-gold/10 text-gold";

/**
 * @typedef {Object} TaskRow
 * @property {string} key
 * @property {string} task
 * @property {string} description
 * @property {string} start
 * @property {string} end
 * @property {string} manualHours
 * @property {string} taskStatus
 * @property {string} project
 * @property {boolean} billable
 */

const newTask = () => ({
  key: Math.random().toString(36).slice(2),
  task: "",
  description: "",
  start: "",
  end: "",
  manualHours: "",
  taskStatus: "In Progress",
  project: PROJECTS[0],
  billable: true,
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Local YYYY-MM-DD — `toISOString()` is UTC, which in IST labelled Monday's checkbox with Sunday's date. */
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Contracted hours a day — anything above is overtime, anything below is short hours. */
const CONTRACTED_HOURS = 8;

const dayVerdict = (hours) =>
  hours >= CONTRACTED_HOURS + 0.5
    ? "Overtime"
    : hours >= CONTRACTED_HOURS - 0.5
      ? "Full day"
      : hours > 0
        ? "Short hours"
        : "Not logged";

const verdictTone = (v) =>
  v === "Overtime"
    ? "border-primary/30 bg-primary/10 text-primary"
    : v === "Full day"
      ? "border-primary/30 bg-primary/10 text-primary"
      : v === "Short hours"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

/** Monday-based week containing `iso`. */
function weekDays(iso) {
  if (!iso) return [];
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  const shift = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - shift);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return { iso: isoLocal(day), label: DAY_LABELS[i] };
  });
}

/** Correct a rejected entry before resubmitting it (Resubmit used to send the rejected content back unchanged). */
function CorrectEntryDialog({ entry, entries, onClose }) {
  const timed = !!(entry.start && entry.end);
  const [task, setTask] = useState(entry.task);
  const [description, setDescription] = useState(entry.description ?? "");
  const [start, setStart] = useState(entry.start ?? "");
  const [end, setEnd] = useState(entry.end ?? "");
  const [hours, setHours] = useState(String(entry.hours ?? ""));
  const [project, setProject] = useState(entry.project ?? PROJECTS[0]);
  const h = timed ? hoursBetween(start, end) : Number(hours || 0);
  const others = entries
    .filter((e) => e.date === entry.date && e.id !== entry.id && e.status !== "Rejected")
    .reduce((s, e) => s + e.hours, 0);
  const problem = !task.trim()
    ? "Task name is required."
    : !(h > 0 && h <= 24)
      ? timed
        ? "End time must be after the start time."
        : "Hours must be between 0 and 24."
      : others + h > 24
        ? `A day cannot exceed 24 h (already ${others.toFixed(2)} h logged on ${entry.date}).`
        : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Correct &amp; resubmit · {entry.date}</DialogTitle>
          <DialogDescription>Approver remarks: {entry.remarks || "—"}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Project / client</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Task name *</Label>
            <Input value={task} onChange={(e) => setTask(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {timed ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Start time</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">End time</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Hours</Label>
              <Input
                type="number"
                step="0.25"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          )}
        </div>
        {problem && <div className="text-destructive text-xs">{problem}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!problem}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              const ok = correctTimesheetEntry(entry.id, {
                task: task.trim(),
                description: description.trim(),
                start: timed ? start : "",
                end: timed ? end : "",
                hours: h,
                project,
                billable: !project.startsWith("Internal"),
              });
              toast[ok ? "success" : "error"](
                ok
                  ? "Timesheet corrected and resubmitted for approval"
                  : "This entry can no longer be edited",
              );
              onClose();
            }}
          >
            Resubmit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpTimesheets() {
  const me = useCurrentEmployee();
  const all = timesheetStore.use();
  const formats = timesheetFormatStore.use().filter((f) => f.active);
  const mine = useMemo(() => all.filter((t) => t.empId === me.id), [all, me.id]);
  // Rejected entries are not worked hours until corrected — they inflated totals / overtime / short hours.
  const counted = useMemo(() => mine.filter((t) => t.status !== "Rejected"), [mine]);
  const [correcting, setCorrecting] = useState(null);

  const [open, setOpen] = useState(false);
  const [formatName, setFormatName] = useState(formats[0]?.name ?? "");
  const format = formats.find((f) => f.name === formatName) ?? formats[0];
  const isWeekly = format?.frequency !== "Daily";

  const today = isoLocal(new Date());
  const [date, setDate] = useState(today);
  const [weekOf, setWeekOf] = useState(today);
  const [selectedDays, setSelectedDays] = useState([]);
  const [tasksByDay, setTasksByDay] = useState({ [today]: [newTask()] });

  const days = weekDays(weekOf);
  const activeDays = isWeekly ? selectedDays : date ? [date] : [];

  const shows = (f) => !format || format.fields.includes(f);
  const hoursOf = (t) =>
    shows("Start Time") && shows("End Time")
      ? hoursBetween(t.start, t.end)
      : Number(t.manualHours || 0);

  const rowsFor = (day) => tasksByDay[day] ?? [];
  const setRows = (day, fn) => setTasksByDay((p) => ({ ...p, [day]: fn(p[day] ?? [newTask()]) }));
  const patchRow = (day, key, patch) =>
    setRows(day, (rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const toggleDay = (iso, on) => {
    setSelectedDays((p) => (on ? [...p, iso].sort() : p.filter((d) => d !== iso)));
    if (on) setTasksByDay((p) => (p[iso]?.length ? p : { ...p, [iso]: [newTask()] }));
  };

  const filledTasks = activeDays.flatMap((day) =>
    rowsFor(day)
      .filter((t) => t.task.trim() && hoursOf(t) > 0)
      .map((t) => ({ day, t })),
  );

  /* ---------------- Quick fill & copy helpers ---------------- */

  /** Fills every selected day with a standard 09:30 – 18:30 working day. */
  function quickFill() {
    if (!activeDays.length) return;
    setTasksByDay((p) => {
      const next = { ...p };
      activeDays.forEach((day) => {
        next[day] = [
          {
            ...newTask(),
            task: "General delivery work",
            description: "Standard working day — project delivery and reviews.",
            start: "09:30",
            end: "18:30",
            manualHours: "8",
            taskStatus: "In Progress",
          },
        ];
      });
      return next;
    });
    toast.success(
      `Quick filled ${activeDays.length} day(s) with a standard ${CONTRACTED_HOURS} h day`,
    );
  }

  /** Copies the tasks from the most recent submitted timesheet into every selected day. */
  function copyLast() {
    const latestDate = mine
      .map((t) => t.date)
      .sort()
      .at(-1);
    const source = mine.filter((t) => t.date === latestDate);
    if (!source.length || !activeDays.length) {
      toast.error("No previous timesheet to copy from");
      return;
    }
    setTasksByDay((p) => {
      const next = { ...p };
      activeDays.forEach((day) => {
        next[day] = source.map((s) => ({
          ...newTask(),
          task: s.task,
          description: s.description,
          start: s.start,
          end: s.end,
          manualHours: String(s.hours),
          taskStatus: s.taskStatus,
          project: s.project ?? PROJECTS[0],
          billable: s.billable ?? !(s.project ?? "").startsWith("Internal"),
        }));
      });
      return next;
    });
    toast.success(
      `Copied ${source.length} task(s) from ${latestDate} into ${activeDays.length} day(s)`,
    );
  }

  const totalNewHours = filledTasks.reduce((s, x) => s + hoursOf(x.t), 0);
  // Validation: no future dates, end after start, sane manual hours and ≤ 24 h per day including what is already logged.
  const problems = activeDays.flatMap((day) => {
    const out = [];
    const rows = rowsFor(day);
    if (day > today) out.push(`${day}: timesheets cannot be filled for a future date.`);
    rows.forEach((t, i) => {
      if (
        shows("Start Time") &&
        shows("End Time") &&
        t.start &&
        t.end &&
        hoursBetween(t.start, t.end) === 0
      )
        out.push(`${day} · task ${i + 1}: end time must be after the start time.`);
      if (
        !(shows("Start Time") && shows("End Time")) &&
        t.manualHours &&
        !(Number(t.manualHours) > 0 && Number(t.manualHours) <= 24)
      )
        out.push(`${day} · task ${i + 1}: hours must be between 0 and 24.`);
      if (!t.task.trim() && hoursOf(t) > 0)
        out.push(`${day} · task ${i + 1}: task name is required.`);
    });
    const logged = mine
      .filter((e) => e.date === day && e.status !== "Rejected")
      .reduce((s, e) => s + e.hours, 0);
    const adding = rows.filter((t) => t.task.trim()).reduce((s, t) => s + hoursOf(t), 0);
    if (logged + adding > 24)
      out.push(
        `${day}: ${(logged + adding).toFixed(2)} h in one day (already logged ${logged.toFixed(2)} h) — a day cannot exceed 24 h.`,
      );
    return out;
  });
  const valid = activeDays.length > 0 && filledTasks.length > 0 && problems.length === 0;

  function submit() {
    if (problems.length) return toast.error(problems[0]);
    filledTasks.forEach(({ day, t }) => {
      addTimesheetEntry({
        empId: me.id,
        employee: me.name,
        format: format?.name ?? "Default",
        date: day,
        task: t.task.trim(),
        description: t.description.trim(),
        start: shows("Start Time") ? t.start : "",
        end: shows("End Time") ? t.end : "",
        hours: hoursOf(t),
        taskStatus: t.taskStatus,
        status: "Submitted",
        remarks: "",
        project: t.project,
        billable: t.billable,
      });
    });
    toast.success(
      `${filledTasks.length} task${filledTasks.length > 1 ? "s" : ""} submitted across ${activeDays.length} day${activeDays.length > 1 ? "s" : ""}`,
    );
    setOpen(false);
    setSelectedDays([]);
    setTasksByDay({ [today]: [newTask()] });
  }

  const totalHours = counted.reduce((s, t) => s + t.hours, 0);
  const hoursByDay = useMemo(() => {
    const m = new Map();
    counted.forEach((t) => m.set(t.date, (m.get(t.date) ?? 0) + t.hours));
    return m;
  }, [counted]);
  const overtimeHours = [...hoursByDay.values()].reduce(
    (s, h) => s + Math.max(0, h - CONTRACTED_HOURS),
    0,
  );
  const shortHours = [...hoursByDay.values()].reduce(
    (s, h) => s + Math.max(0, CONTRACTED_HOURS - h),
    0,
  );

  const historyCols = [
    "Date",
    "Day hours",
    "Verdict",
    "Task",
    "Time",
    "Hours",
    "Task status",
    "Approval",
  ];
  const historyRows = mine
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      const dh = hoursByDay.get(t.date) ?? 0;
      return [
        t.date,
        dh.toFixed(2),
        dayVerdict(dh),
        t.task,
        t.start && t.end ? `${t.start} - ${t.end}` : "-",
        String(t.hours),
        t.taskStatus,
        t.status,
      ];
    });
  const grouped = useMemo(() => {
    const map = new Map();
    mine.forEach((t) => map.set(t.date, [...(map.get(t.date) ?? []), t]));
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [mine]);

  // Rendered as a plain function (not `<DayEditor />`): a component declared inside the page is a new type on every
  // render, so React remounted the editor on each keystroke and the inputs lost focus after one character.
  function renderDayEditor(day, label) {
    const rows = rowsFor(day);
    const dayHours = rows.reduce((s, t) => s + hoursOf(t), 0);
    return (
      <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="text-primary h-4 w-4" /> {label ? `${label} · ` : ""}
            {day}
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {dayHours.toFixed(2)} hrs
          </Badge>
        </div>
        {rows.map((t, i) => (
          <div key={t.key} className="border-border bg-background space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-medium">Task {i + 1}</div>
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows(day, (p) => p.filter((r) => r.key !== t.key))}
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Project / client</Label>
                <Select
                  value={t.project}
                  onValueChange={(v) =>
                    patchRow(day, t.key, { project: v, billable: !v.startsWith("Internal") })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  Task name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={t.task}
                  onChange={(e) => patchRow(day, t.key, { task: e.target.value })}
                  placeholder="e.g. Billing revamp — API layer"
                />
              </div>
              {shows("Description") && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <Textarea
                    rows={2}
                    value={t.description}
                    onChange={(e) => patchRow(day, t.key, { description: e.target.value })}
                  />
                </div>
              )}
              {shows("Start Time") && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Start time</Label>
                  <Input
                    type="time"
                    value={t.start}
                    onChange={(e) => patchRow(day, t.key, { start: e.target.value })}
                  />
                </div>
              )}
              {shows("End Time") && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">End time</Label>
                  <Input
                    type="time"
                    value={t.end}
                    onChange={(e) => patchRow(day, t.key, { end: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Hours</Label>
                {shows("Start Time") && shows("End Time") ? (
                  <div className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
                    <span className="font-semibold">{hoursOf(t)}</span> hours (auto)
                  </div>
                ) : (
                  <Input
                    type="number"
                    step="0.25"
                    min={0}
                    max={24}
                    value={t.manualHours}
                    onChange={(e) => patchRow(day, t.key, { manualHours: e.target.value })}
                    placeholder="8"
                  />
                )}
              </div>
              {shows("Status") && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Task status</Label>
                  <Select
                    value={t.taskStatus}
                    onValueChange={(v) => patchRow(day, t.key, { taskStatus: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setRows(day, (p) => [...p, newTask()])}>
          <Plus className="h-4 w-4" /> Add another task
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock3 className="text-primary h-6 w-6" /> My Timesheets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Log as many tasks as you need per day. Weekly formats let you pick the days first, then
            fill each one.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
              <Plus className="h-4 w-4" /> Fill Timesheet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Fill timesheet</DialogTitle>
              <DialogDescription>
                Fields follow the {format?.name ?? "default"} format configured by HR.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Timesheet format</Label>
                  <Select value={formatName} onValueChange={setFormatName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((f) => (
                        <SelectItem key={f.id} value={f.name}>
                          {f.name} · {f.frequency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isWeekly ? (
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Week of</Label>
                    <Input
                      type="date"
                      value={weekOf}
                      onChange={(e) => {
                        setWeekOf(e.target.value);
                        setSelectedDays([]);
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={date}
                      max={today}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setTasksByDay((p) =>
                          p[e.target.value] ? p : { ...p, [e.target.value]: [newTask()] },
                        );
                      }}
                    />
                  </div>
                )}
              </div>

              {isWeekly && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Select the days you are filling
                  </Label>
                  <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-4">
                    {days.map((d) => (
                      <label key={d.iso} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedDays.includes(d.iso)}
                          onCheckedChange={(v) => toggleDay(d.iso, !!v)}
                        />
                        <span>
                          {d.label}{" "}
                          <span className="text-muted-foreground text-xs">{d.iso.slice(5)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="border-border bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <span className="text-muted-foreground text-xs font-medium">Shortcuts</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeDays.length}
                  onClick={quickFill}
                >
                  <Zap className="h-4 w-4" /> Quick Fill ({CONTRACTED_HOURS} h/day)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeDays.length || !mine.length}
                  onClick={copyLast}
                >
                  <Copy className="h-4 w-4" /> Copy Last Timesheet
                </Button>
                <span className="text-muted-foreground text-xs">
                  Applies to every selected day — edit any row afterwards.
                </span>
              </div>

              {activeDays.length === 0 && (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                  Select at least one day of the week to start adding tasks.
                </div>
              )}

              <div className="space-y-4">
                {activeDays.map((d) => (
                  <div key={d}>
                    {renderDayEditor(
                      d,
                      isWeekly ? days.find((x) => x.iso === d)?.label : undefined,
                    )}
                  </div>
                ))}
              </div>

              {problems.length > 0 && (
                <div className="space-y-1">
                  {problems.slice(0, 5).map((p) => (
                    <div
                      key={p}
                      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-1.5 text-xs"
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}
              {filledTasks.length > 0 && (
                <div className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
                  Submitting <span className="font-semibold">{filledTasks.length}</span> task(s)
                  across <span className="font-semibold">{activeDays.length}</span> day(s) ·{" "}
                  <span className="font-semibold">{totalNewHours.toFixed(2)}</span> hours total
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
                Submit timesheet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Entries logged", value: String(mine.length) },
          { label: "Total hours", value: totalHours.toFixed(2) },
          { label: "Overtime", value: `${overtimeHours.toFixed(2)} h` },
          { label: "Short hours", value: `${shortHours.toFixed(2)} h` },
          {
            label: "Awaiting approval",
            value: String(mine.filter((t) => t.status === "Submitted").length),
          },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="text-xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="text-sm font-semibold">Timesheet history</div>
          <span className="text-muted-foreground text-xs">
            Contracted {CONTRACTED_HOURS} h/day · overtime and short hours are flagged per day
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!mine.length}
              onClick={() => {
                exportCsv(`${me.id}-timesheets`, historyCols, historyRows);
                toast.success("Timesheet history exported as CSV");
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
                  title: "My Timesheet History",
                  subtitle: `${me.name} · ${me.id}`,
                  summary: [
                    { label: "Entries", value: String(mine.length) },
                    { label: "Total hours", value: totalHours.toFixed(2) },
                    { label: "Overtime", value: `${overtimeHours.toFixed(2)} h` },
                    { label: "Short hours", value: `${shortHours.toFixed(2)} h` },
                  ],
                  columns: historyCols,
                  rows: historyRows,
                });
                toast[ok ? "success" : "error"](
                  ok ? "Timesheet history ready — save as PDF" : "Allow pop-ups to download",
                );
              }}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {grouped.map(([day, entries]) => (
          <Card key={day} className="shadow-card overflow-hidden">
            <CardContent className="border-border flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarDays className="text-primary h-4 w-4" /> {day}
              </div>
              {(() => {
                const dh = entries
                  .filter((t) => t.status !== "Rejected")
                  .reduce((s, t) => s + t.hours, 0);
                const v = dayVerdict(dh);
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {entries.length} task(s) · {dh.toFixed(2)} hrs
                    </Badge>
                    <Badge variant="outline" className={verdictTone(v)}>
                      {v === "Overtime" ? (
                        <TrendingUp className="mr-1 h-3 w-3" />
                      ) : v === "Short hours" ? (
                        <AlarmClock className="mr-1 h-3 w-3" />
                      ) : null}
                      {v}
                      {v === "Overtime" && ` +${(dh - CONTRACTED_HOURS).toFixed(2)} h`}
                      {v === "Short hours" && ` -${(CONTRACTED_HOURS - dh).toFixed(2)} h`}
                    </Badge>
                  </div>
                );
              })()}
            </CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Task</th>
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-right">Hours</th>
                    <th className="p-3 text-left">Task status</th>
                    <th className="p-3 text-left">Approval</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {entries.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 align-top">
                      <td className="p-3 font-medium">
                        {t.task}
                        <div className="text-muted-foreground text-xs font-normal">
                          {t.description}
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3">
                        {t.start && t.end ? `${t.start} – ${t.end}` : "—"}
                      </td>
                      <td className="p-3 text-right font-semibold">{t.hours}</td>
                      <td className="text-muted-foreground p-3">{t.taskStatus}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={badgeFor(t.status)}>
                          {t.status}
                        </Badge>
                        {t.remarks && (
                          <div className="text-muted-foreground mt-1 text-xs">{t.remarks}</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {/* Drafts could never be submitted and rejected entries never corrected — both now go (back) to the approver. */}
                        {t.status === "Draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTimesheetStatus(t.id, "Submitted");
                              toast.success("Timesheet submitted for approval");
                            }}
                          >
                            Submit
                          </Button>
                        )}
                        {t.status === "Rejected" && (
                          <Button size="sm" variant="outline" onClick={() => setCorrecting(t)}>
                            Correct &amp; resubmit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
        {correcting && (
          <CorrectEntryDialog
            entry={correcting}
            entries={mine}
            onClose={() => setCorrecting(null)}
          />
        )}
        {grouped.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="text-muted-foreground p-10 text-center">
              No timesheet entries yet — use “Fill Timesheet” to log your day.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default EmpTimesheets;
