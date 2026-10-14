// Daily / monthly wage workers — attendance only (no salary figures here). Payable days flow to the wage register in payroll.
import { useMemo, useState } from "react";
import { HardHat, Search, Download, Plus, CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useShifts } from "@/features/attendance/data/attendance-data";
import { isAttendanceLocked } from "@/features/attendance/data/attendance-pattern";
import { useWorkOrders } from "@/features/employees/data/work-order-data";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { Field } from "@/features/employees/components/CasePieces";
import {
  WAGE_MARKS,
  WAGE_TRADES,
  addWageWorker,
  markWageAttendance,
  summariseWorker,
  updateWageWorker,
  useWageAttendance,
  useWageWorkers,
} from "@/features/employees/data/wage-workers";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const MARK_STYLE = {
  P: "bg-primary/10 text-primary border-primary/30",
  H: "bg-gold/15 text-gold border-gold/40",
  A: "bg-destructive/10 text-destructive border-destructive/30",
  WO: "bg-muted text-muted-foreground border-border",
  PH: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
};
const daysIn = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
const monthLabel = (m) =>
  new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export function DailyWagesTab() {
  const orgId = useActiveOrgId();
  const inScope = useScopeMatch();
  const workers = useWageWorkers().filter((w) => inScope(w.orgId, null, w.branch));
  const attendance = useWageAttendance();
  const shifts = useShifts();
  const shiftName = (id) => shifts.find((x) => x.id === id)?.name ?? id;
  // Work orders of this entity only — a worker could be deployed on another entity's work order.
  const workOrders = useWorkOrders().filter((w) => w.orgId === orgId && w.status !== "Completed");
  const [period, setPeriod] = useState("2026-07");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [siteF, setSiteF] = useState("all");
  const [mark, setMark] = useState(false);
  const [add, setAdd] = useState(false);
  const [view, setView] = useState(null);
  const days = useMemo(
    () =>
      Array.from(
        { length: daysIn(period) },
        (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`,
      ),
    [period],
  );
  const rows = useMemo(
    () =>
      workers
        .filter(
          (w) =>
            (type === "all" || w.wageType === type) &&
            (siteF === "all" || w.site === siteF) &&
            (!q ||
              [w.name, w.id, w.trade, w.contractor, w.site]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .map((w) => ({
          w,
          s: summariseWorker(w.id, period, attendance),
          byDay: Object.fromEntries(
            attendance
              .filter((a) => a.workerId === w.id && a.date.startsWith(period))
              .map((a) => [a.date, a]),
          ),
        })),
    [workers, attendance, period, q, type, siteF],
  );
  const totals = rows.reduce(
    (t, { s }) => ({
      present: t.present + s.P,
      half: t.half + s.H,
      absent: t.absent + s.A,
      ot: t.ot + s.otHours,
      payable: t.payable + s.payableDays,
    }),
    { present: 0, half: 0, absent: 0, ot: 0, payable: 0 },
  );
  const sites = [...new Set(workers.map((w) => w.site))];

  const cols = [
    "Worker",
    "ID",
    "Wage type",
    "Trade",
    "Contractor",
    "Site / work order",
    "Shift",
    "Present",
    "Half days",
    "Absent",
    "Weekly off",
    "Paid holidays",
    "Hours",
    "OT hours",
    "Payable days",
  ];
  const exportRows = rows.map(({ w, s }) => [
    w.name,
    w.id,
    w.wageType,
    w.trade,
    w.contractor,
    w.site,
    shiftName(w.shiftId),
    s.P,
    s.H,
    s.A,
    s.WO,
    s.PH,
    s.hours,
    s.otHours,
    s.payableDays,
  ]);
  const pdf = () => {
    const ok = exportReportPdf({
      title: "Wage-worker attendance register",
      subtitle: `${monthLabel(period)} · ${rows.length} workers · attendance only (wages computed in payroll)`,
      filters: [
        { label: "Wage type", value: type === "all" ? "All" : type },
        { label: "Site", value: siteF === "all" ? "All" : siteF },
      ],
      summary: [
        { label: "Present days", value: String(totals.present) },
        { label: "Half days", value: String(totals.half) },
        { label: "Absent", value: String(totals.absent) },
        { label: "OT hours", value: String(totals.ot) },
        { label: "Payable days", value: String(totals.payable) },
      ],
      columns: cols,
      rows: exportRows,
    });
    toast[ok ? "success" : "error"](
      ok ? "Wage-worker attendance register ready — save as PDF" : "Allow pop-ups to download",
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Workers", String(rows.length), ""],
          ["Present days", String(totals.present), "text-primary"],
          ["Half days", String(totals.half), "text-gold"],
          ["Absent days", String(totals.absent), "text-destructive"],
          ["Payable days · OT", `${totals.payable} · ${totals.ot} h`, ""],
        ].map(([k, v, c]) => (
          <Card key={k} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className={cn("text-2xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HardHat className="text-primary h-4 w-4" /> Daily &amp; monthly wage workers
          </div>
          <div className="border-border bg-muted/40 flex min-w-[200px] items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search worker, trade, contractor…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wage types</SelectItem>
              <SelectItem value="Daily wage">Daily wage</SelectItem>
              <SelectItem value="Monthly wage">Monthly wage</SelectItem>
            </SelectContent>
          </Select>
          <Select value={siteF} onValueChange={setSiteF}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdd(true)}>
              <Plus className="h-4 w-4" /> Add worker
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => setMark(true)}
            >
              <CalendarCheck2 className="h-4 w-4" /> Mark attendance
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() => {
                exportCsv(`wage-attendance-${period}`, cols, exportRows);
                toast.success("Exported CSV");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={pdf}>
              <Download className="h-4 w-4" /> Register PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="bg-muted/40 sticky left-0 p-3 text-left">Worker</th>
                <th className="p-3 text-left">Trade · contractor</th>
                <th className="p-3 text-left">Site · shift</th>
                {days.map((d) => (
                  <th key={d} className="p-1 text-center font-semibold">
                    {d.slice(-2)}
                  </th>
                ))}
                <th className="p-3 text-center">P / H / A</th>
                <th className="p-3 text-center">Hours · OT</th>
                <th className="p-3 text-center">Payable days</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={days.length + 6} className="text-muted-foreground p-8 text-center">
                    No wage workers in this scope.
                  </td>
                </tr>
              )}
              {rows.map(({ w, s, byDay }) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="bg-card sticky left-0 p-3">
                    <button className="text-left" onClick={() => setView(w)}>
                      <div className="font-semibold whitespace-nowrap">{w.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {w.id} ·{" "}
                        <Badge variant="outline" className="text-[10px]">
                          {w.wageType}
                        </Badge>
                        {w.status === "Inactive" && (
                          <Badge variant="outline" className="text-destructive ml-1 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs whitespace-nowrap">
                    {w.trade}
                    <br />
                    {w.contractor}
                  </td>
                  <td className="text-muted-foreground p-3 text-xs whitespace-nowrap">
                    {w.site}
                    <br />
                    {shiftName(w.shiftId)}
                  </td>
                  {days.map((d) => {
                    const a = byDay[d];
                    return (
                      <td key={d} className="p-0.5 text-center">
                        <span
                          title={
                            a
                              ? `${a.mark} · ${a.inAt || "—"}–${a.outAt || "—"}${a.otHours ? ` · OT ${a.otHours}h` : ""}`
                              : "Not marked"
                          }
                          className={cn(
                            "inline-grid h-6 w-6 place-items-center rounded border text-[10px] font-bold",
                            a
                              ? MARK_STYLE[a.mark]
                              : "border-border text-muted-foreground/50 border-dashed",
                          )}
                        >
                          {a?.mark ?? "·"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="p-3 text-center text-xs whitespace-nowrap">
                    <span className="text-primary font-medium">{s.P}</span> /{" "}
                    <span className="text-gold">{s.H}</span> /{" "}
                    <span className="text-destructive">{s.A}</span>
                  </td>
                  <td className="p-3 text-center text-xs whitespace-nowrap">
                    {s.hours} h
                    {s.otHours ? <span className="text-primary"> · +{s.otHours}</span> : ""}
                  </td>
                  <td className="p-3 text-center font-semibold">{s.payableDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-muted-foreground flex flex-wrap gap-2 text-[11px]">
        {WAGE_MARKS.map((m) => (
          <Badge key={m.key} variant="outline" className={MARK_STYLE[m.key]}>
            {m.key} · {m.label}
          </Badge>
        ))}
        <span className="rounded-md border px-2.5 py-0.5 text-xs font-semibold">
          Payable days = P + ½ × H + paid holidays · wages are computed in Payroll from these days
        </span>
      </div>

      {/* Keyed by period so the muster date follows the month being viewed; inactive workers are not on the muster. */}
      {mark && (
        <MarkAttendanceDialog
          key={period}
          open={mark}
          onClose={() => setMark(false)}
          workers={workers.filter((w) => w.status === "Active")}
          period={period}
          orgId={orgId}
        />
      )}
      <AddWorkerDialog
        open={add}
        onClose={() => setAdd(false)}
        orgId={orgId}
        shifts={shifts}
        workOrders={workOrders.map((w) => ({ id: w.id, name: w.name, site: w.clientSite }))}
      />
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {view && (
            <WorkerDetail
              w={workers.find((x) => x.id === view.id) ?? view}
              period={period}
              shifts={shifts}
              onClose={() => setView(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarkAttendanceDialog({ open, onClose, workers, period, orgId }) {
  const me = useCurrentUser();
  const attendance = useWageAttendance();
  const [date, setDate] = useState(
    `${period}-${String(Math.min(new Date().getDate(), daysIn(period))).padStart(2, "0")}`,
  );
  const [draft, setDraft] = useState({});
  const get = (id) =>
    draft[id] ??
    (() => {
      const ex = attendance.find((a) => a.workerId === id && a.date === date);
      return ex
        ? { mark: ex.mark, inAt: ex.inAt, outAt: ex.outAt, otHours: ex.otHours, note: ex.note }
        : { mark: "P", inAt: "09:00", outAt: "18:00", otHours: 0, note: "" };
    })();
  const set = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...get(id), ...patch } }));
  const markAll = (m) => {
    const next = {};
    workers.forEach((w) => {
      next[w.id] = {
        ...get(w.id),
        mark: m,
        inAt: m === "P" || m === "H" ? get(w.id).inAt || "09:00" : "",
        outAt: m === "P" ? get(w.id).outAt || "18:00" : m === "H" ? "13:00" : "",
      };
    });
    setDraft(next);
  };
  const save = () => {
    if (!date) return toast.error("Choose the muster date.");
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (date > today) return toast.error("Attendance cannot be marked for a future date.");
    if (isAttendanceLocked(date.slice(0, 7), orgId))
      return toast.error(
        `Attendance for ${date.slice(0, 7)} is locked for payroll — unlock it first.`,
      );
    const r = markWageAttendance(
      workers.map((w) => ({ workerId: w.id, date, ...get(w.id) })),
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mark wage-worker attendance</DialogTitle>
          <DialogDescription>
            Daily muster: mark present / half day / absent with in–out times and overtime hours.
            Attendance only — no wage figures here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDraft({});
              }}
            />
          </Field>
          <div className="flex gap-1">
            {WAGE_MARKS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant="outline"
                className={cn("h-8", MARK_STYLE[m.key])}
                onClick={() => markAll(m.key)}
              >
                All {m.key}
              </Button>
            ))}
          </div>
        </div>
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Worker</th>
                <th className="p-2 text-left">Mark</th>
                <th className="p-2 text-left">In</th>
                <th className="p-2 text-left">Out</th>
                <th className="p-2 text-left">OT (h)</th>
                <th className="p-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const v = get(w.id);
                return (
                  <tr key={w.id} className="border-border border-t">
                    <td className="p-2">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-muted-foreground">
                        {w.trade} · {w.site}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-0.5">
                        {WAGE_MARKS.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            title={m.label}
                            onClick={() =>
                              set(w.id, {
                                mark: m.key,
                                inAt: m.key === "P" || m.key === "H" ? v.inAt || "09:00" : "",
                                outAt:
                                  m.key === "P" ? v.outAt || "18:00" : m.key === "H" ? "13:00" : "",
                              })
                            }
                            className={cn(
                              "h-7 w-8 rounded border text-[10px] font-bold",
                              v.mark === m.key
                                ? MARK_STYLE[m.key]
                                : "border-border text-muted-foreground",
                            )}
                          >
                            {m.key}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        type="time"
                        className="h-7 w-28"
                        value={v.inAt}
                        disabled={v.mark !== "P" && v.mark !== "H"}
                        onChange={(e) => set(w.id, { inAt: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="time"
                        className="h-7 w-28"
                        value={v.outAt}
                        disabled={v.mark !== "P" && v.mark !== "H"}
                        onChange={(e) => set(w.id, { outAt: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.5"
                        className="h-7 w-20"
                        value={v.otHours}
                        disabled={v.mark !== "P"}
                        onChange={(e) => set(w.id, { otHours: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-7"
                        value={v.note}
                        onChange={(e) => set(w.id, { note: e.target.value })}
                        placeholder="Site / remark"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={save}>
            <CalendarCheck2 className="h-4 w-4" /> Save muster for {date}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkerDialog({ open, onClose, orgId, workOrders, shifts }) {
  const [name, setName] = useState("");
  const [wageType, setWageType] = useState("Daily wage");
  const [trade, setTrade] = useState(WAGE_TRADES[0]);
  const [contractor, setContractor] = useState("Direct");
  const [workOrderId, setWorkOrderId] = useState("none");
  const [site, setSite] = useState("Bhubaneswar HQ");
  const [shiftId, setShiftId] = useState("SHF-01");
  const [phone, setPhone] = useState("");
  const [idProof, setIdProof] = useState("");
  const [joinedOn, setJoinedOn] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const submit = () => {
    if (!name.trim()) return toast.error("Worker name is required.");
    if (phone.trim() && !/^\+?[\d\s-]{10,15}$/.test(phone.trim()))
      return toast.error("Enter a valid phone number.");
    if (!joinedOn) return toast.error("Joining date is required.");
    const wo = workOrders.find((w) => w.id === workOrderId);
    addWageWorker({
      name,
      wageType,
      trade,
      contractor,
      workOrderId: wo?.id ?? null,
      site: wo?.site ?? site,
      shiftId,
      phone,
      idProof,
      joinedOn,
      status: "Active",
      orgId,
    });
    toast.success(`${name} added to the wage-worker register.`);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add wage worker</DialogTitle>
          <DialogDescription>
            Contract labour, site crew or support staff paid per day / per month. Rates are
            configured in Payroll, not here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Wage type" required>
            <Select value={wageType} onValueChange={(v) => setWageType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily wage">Daily wage</SelectItem>
                <SelectItem value="Monthly wage">Monthly wage</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trade / skill">
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAGE_TRADES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contractor / agency">
            <Input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="Direct or agency name"
            />
          </Field>
          <Field label="Work order">
            <Select value={workOrderId} onValueChange={setWorkOrderId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (office site)</SelectItem>
                {workOrders.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.id} · {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Site">
            <Input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={workOrderId !== "none"}
            />
          </Field>
          <Field label="Shift">
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.start}–{s.end})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Joined on">
            <Input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="ID proof" className="sm:col-span-2">
            <Input
              value={idProof}
              onChange={(e) => setIdProof(e.target.value)}
              placeholder="Aadhaar (last 4) / DL / voter ID"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={submit}>
            <Plus className="h-4 w-4" /> Add worker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkerDetail({ w, period, shifts, onClose }) {
  const attendance = useWageAttendance()
    .filter((a) => a.workerId === w.id && a.date.startsWith(period))
    .sort((a, b) => a.date.localeCompare(b.date));
  const s = summariseWorker(w.id, period);
  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <HardHat className="text-primary h-5 w-5" /> {w.name}{" "}
          <Badge variant="outline">{w.wageType}</Badge>
        </DialogTitle>
        <DialogDescription>
          {w.id} · {w.trade} · {w.contractor} · {w.site} ·{" "}
          {shifts.find((x) => x.id === w.shiftId)?.name ?? w.shiftId} · joined{" "}
          <span className="whitespace-nowrap">{w.joinedOn}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-5">
        {[
          ["Present", s.P],
          ["Half", s.H],
          ["Absent", s.A],
          ["Hours", `${s.hours} h`],
          ["Payable days", s.payableDays],
        ].map(([k, v]) => (
          <div key={String(k)} className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground">{k}</div>
            <div className="text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="border-border max-h-80 overflow-hidden overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Mark</th>
              <th className="p-2 text-left">In</th>
              <th className="p-2 text-left">Out</th>
              <th className="p-2 text-left">OT</th>
              <th className="p-2 text-left">Marked by</th>
              <th className="p-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a) => (
              <tr key={a.date} className="border-border border-t">
                <td className="p-2">
                  <span className="whitespace-nowrap">{a.date}</span>
                </td>
                <td className="p-2">
                  <Badge variant="outline" className={cn("text-[10px]", MARK_STYLE[a.mark])}>
                    {a.mark}
                  </Badge>
                </td>
                <td className="p-2">
                  <span className="whitespace-nowrap">{a.inAt || "—"}</span>
                </td>
                <td className="p-2">
                  <span className="whitespace-nowrap">{a.outAt || "—"}</span>
                </td>
                <td className="p-2">{a.otHours || "—"}</td>
                <td className="text-muted-foreground p-2">{a.markedBy}</td>
                <td className="text-muted-foreground p-2">{a.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={() => {
            updateWageWorker(w.id, { status: w.status === "Active" ? "Inactive" : "Active" });
            toast.success(`${w.name} marked ${w.status === "Active" ? "inactive" : "active"}`);
          }}
        >
          {w.status === "Active" ? "Mark inactive" : "Mark active"}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportReportPdf({
              title: `Attendance — ${w.name}`,
              subtitle: `${w.id} · ${w.wageType} · ${w.trade} · ${monthLabel(period)}`,
              summary: [
                { label: "Present", value: String(s.P) },
                { label: "Half", value: String(s.H) },
                { label: "Absent", value: String(s.A) },
                { label: "OT hours", value: String(s.otHours) },
                { label: "Payable days", value: String(s.payableDays) },
              ],
              columns: ["Date", "Mark", "In", "Out", "OT (h)", "Marked by", "Note"],
              rows: attendance.map((a) => [
                a.date,
                a.mark,
                a.inAt || "—",
                a.outAt || "—",
                a.otHours,
                a.markedBy,
                a.note,
              ]),
            })
          }
        >
          <Download className="h-4 w-4" /> Worker attendance PDF
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}
