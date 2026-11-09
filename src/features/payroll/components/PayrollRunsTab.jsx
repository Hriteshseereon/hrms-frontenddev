// Payroll runs on the real API: the server calculates, checks and approves; this screen only shows its numbers
// and offers the actions the permissions / next_action allow.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { payrollRunApi, detailText } from "@/api/payrollRunApi";
import { useCan } from "@/features/auth/data/module-access";
import { useCompanyScope, CompanyScopeSelect } from "@/features/organization/components/CompanyScopeSelect";

const STATUS_TONE = {
  Draft: "bg-muted text-muted-foreground border-border",
  "Checks Failed": "bg-red-100 text-red-700 border-red-300",
  "Checks Passed": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Pending Approval": "bg-amber-100 text-amber-700 border-amber-300",
  Approved: "bg-blue-100 text-blue-700 border-blue-300",
  Processed: "bg-indigo-100 text-indigo-700 border-indigo-300",
  Paid: "bg-emerald-100 text-emerald-800 border-emerald-400",
  Rejected: "bg-red-100 text-red-700 border-red-300",
};
const SEVERITY_TONE = {
  error: "bg-red-100 text-red-700 border-red-300",
  warning: "bg-amber-100 text-amber-700 border-amber-300",
  info: "bg-blue-100 text-blue-700 border-blue-300",
};
const EDITABLE = ["Draft", "Checks Failed", "Checks Passed"];

const money = (n) =>
  n === null || n === undefined
    ? "—"
    : `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.valueOf()) ? String(v) : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const lastDayOf = (period) => {
  const [y, m] = period.split("-").map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_TONE[status])}>
      {status}
    </Badge>
  );
}

/** Asks for a (required or optional) text: remarks, a note, a payment reference. */
function PromptDialog({ title, label, required, confirmLabel = "Confirm", onConfirm, onClose }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(text.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || (required && !text.trim())}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineDrawer({ runId, employeeId, onClose }) {
  const [line, setLine] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    payrollRunApi
      .line(runId, employeeId)
      .then((l) => alive && setLine(l))
      .catch((e) => alive && setError(detailText(e)));
    return () => {
      alive = false;
    };
  }, [runId, employeeId]);

  const Rows = ({ items }) =>
    (items ?? []).length ? (
      items.map((i, idx) => (
        <div key={`${i.label}-${idx}`} className="flex justify-between py-1 text-sm">
          <span>{i.label}</span>
          <span className="tabular-nums">{money(i.amount)}</span>
        </div>
      ))
    ) : (
      <div className="text-muted-foreground py-1 text-sm">—</div>
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{line ? `${line.employee_name} · ${line.employee_code}` : "Payslip working"}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!line && !error && <Skeleton className="h-40 w-full" />}
        {line && (
          <div className="space-y-4">
            <div className="text-muted-foreground text-xs">
              {[line.department, line.branch_name].filter(Boolean).join(" · ")}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(line.attendance ?? {}).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k.replaceAll("_", " ")} · {v}
                </Badge>
              ))}
              <Badge variant="outline">
                LOP · {line.lop?.days ?? 0} d ({money(line.lop?.amount)}) · payable {line.lop?.payable_days}
              </Badge>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase">Earnings</div>
              <Rows items={line.earnings} />
              {Number(line.overtime_amount) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span>Overtime</span>
                  <span className="tabular-nums">{money(line.overtime_amount)}</span>
                </div>
              )}
              <div className="border-border flex justify-between border-t py-1 text-sm font-semibold">
                <span>Gross</span>
                <span className="tabular-nums">{money(line.earned_gross)}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase">Deductions</div>
              <Rows items={line.deductions} />
              <div className="border-border flex justify-between border-t py-1 text-sm font-semibold">
                <span>Total deductions</span>
                <span className="tabular-nums">{money(line.total_deductions)}</span>
              </div>
            </div>
            <div className="bg-muted/50 flex justify-between rounded-md p-3 text-sm font-bold">
              <span>Net pay</span>
              <span className="tabular-nums">{money(line.net)}</span>
            </div>
            <div className="text-muted-foreground text-xs">
              Employer cost {money(line.employer_cost)} · Bank {line.bank?.bank_name ?? "—"}{" "}
              {line.bank?.account_no ?? ""} {line.bank?.ifsc ?? ""}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentsDialog({ run, company, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ employee_id: "", label: "", kind: "earning", amount: "" });
  const [busy, setBusy] = useState(false);
  const base = { period: run.period, ...(company ? { company_id: company } : {}) };

  const load = useCallback(() => {
    payrollRunApi
      .listAdjustments(base)
      .then((r) => setItems(r.items ?? []))
      .catch((e) => toast.error(detailText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.period, company]);
  useEffect(load, [load]);

  const nameOf = (id) => run.lines?.find((l) => l.employee_id === id)?.employee_name ?? id;
  const add = async () => {
    setBusy(true);
    try {
      await payrollRunApi.addAdjustment({ ...base, ...form, amount: Number(form.amount) });
      setForm({ employee_id: "", label: "", kind: "earning", amount: "" });
      load();
      onChanged();
      toast.success("Adjustment added — run checks to recalculate");
    } catch (e) {
      toast.error(detailText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    try {
      await payrollRunApi.removeAdjustment(id);
      load();
      onChanged();
    } catch (e) {
      toast.error(detailText(e));
    }
  };
  const valid = form.employee_id && form.label.trim() && Number(form.amount) >= 0 && form.amount !== "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjustments · {run.period}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border-input bg-background col-span-2 h-9 rounded-md border px-2 text-sm"
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
          >
            <option value="">Select employee</option>
            {(run.lines ?? []).map((l) => (
              <option key={l.employee_id} value={l.employee_id}>
                {l.employee_name} ({l.employee_code})
              </option>
            ))}
          </select>
          <Input placeholder="Label (e.g. Bonus)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
          >
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Button onClick={add} disabled={busy || !valid}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="divide-border divide-y text-sm">
          {items.length === 0 && <div className="text-muted-foreground py-3">No adjustments for this month.</div>}
          {items.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">
                  {a.label} <span className="text-muted-foreground text-xs">· {a.kind}</span>
                </div>
                <div className="text-muted-foreground text-xs">{nameOf(a.employee_id)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{money(a.amount)}</span>
                <button type="button" aria-label="Remove" onClick={() => remove(a.id)}>
                  <Trash2 className="text-destructive h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ run }) {
  const levels = run.approval_levels ?? [];
  if (!levels.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {levels.map((lv, i) => {
        const a = (run.approvals ?? []).find((x) => x.level_no === lv.level_no);
        const current = run.status === "Pending Approval" && run.next_action?.level_no === lv.level_no;
        return (
          <div key={lv.level_no} className="flex items-center gap-2">
            {i > 0 && <span className="bg-border h-px w-6" />}
            <div
              className={cn(
                "rounded-md border px-2.5 py-1.5",
                a?.decision === "approve" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                a?.decision === "reject" && "border-red-300 bg-red-50 text-red-700",
                current && "border-amber-300 bg-amber-50 text-amber-700",
              )}
            >
              <div className="font-semibold">
                {lv.level_no}. {lv.name}
              </div>
              <div className="text-[11px]">
                {a ? `${a.decision === "approve" ? "Approved" : "Rejected"} by ${a.by}` : current ? "Waiting" : "Pending"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunDetail({ runId, company, onBack, onChanged }) {
  const can = useCan();
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("register");
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [prompt, setPrompt] = useState(null);
  const [lineId, setLineId] = useState(null);
  const [adjOpen, setAdjOpen] = useState(false);

  const load = useCallback(
    async (params) => {
      try {
        setRun(await payrollRunApi.get(runId, params));
        setError("");
      } catch (e) {
        setError(detailText(e));
      }
    },
    [runId],
  );

  // Register search / state filter only narrow `lines`; refetch (debounced) when they change.
  useEffect(() => {
    const t = setTimeout(() => load({ q, state }), 250);
    return () => clearTimeout(t);
  }, [load, q, state]);

  /** Runs an action; its response is the refreshed run. A 409 means the state moved: show it and reload. */
  const act = async (fn, okMessage) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next?.id) setRun((cur) => ({ ...cur, ...next, lines: next.lines ?? cur?.lines }));
      else await load({ q, state });
      if (okMessage) toast.success(okMessage);
      onChanged();
    } catch (e) {
      toast.error(detailText(e));
      if (e?.response?.status === 409) await load({ q, state });
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const quiet = (fn, msg) => act(fn, msg).catch(() => {});

  if (error)
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  if (!run) return <Skeleton className="h-64 w-full" />;

  const s = run.status;
  const canRun = can("payroll.run");
  const canApproveP = can("payroll.approve");
  const canProcess = can("payroll.process");
  const next = run.next_action ?? {};
  const openWarnings = (run.checks ?? []).filter((c) => c.severity === "warning" && c.status === "open").length;
  const t = run.totals ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Runs
        </Button>
        <h2 className="text-lg font-bold">Payroll {run.period}</h2>
        <StatusBadge status={s} />
        <span className="text-muted-foreground text-xs">
          Pay date {run.pay_date} · prepared by {run.prepared_by?.name ?? "—"}
        </span>
      </div>

      {!run.attendance_locked && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="h-4 w-4" /> Attendance for {run.period} is not locked. Lock it in Attendance → Payroll
          Attendance Lock before continuing.
        </div>
      )}

      <Stepper run={run} />

      <div className="flex flex-wrap gap-2">
        {canRun && EDITABLE.includes(s) && (
          <Button size="sm" disabled={busy} onClick={() => quiet(() => payrollRunApi.runChecks(run.id), "Checks completed")}>
            <ShieldAlert className="h-4 w-4" /> {s === "Draft" ? "Run checks" : "Re-run checks"}
          </Button>
        )}
        {canRun && s === "Checks Passed" && (
          <>
            {openWarnings > 0 && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => quiet(() => payrollRunApi.acknowledgeWarnings(run.id), "Warnings acknowledged")}>
                <Check className="h-4 w-4" /> Acknowledge {openWarnings} warning{openWarnings === 1 ? "" : "s"}
              </Button>
            )}
            <Button size="sm" disabled={busy || openWarnings > 0} onClick={() => quiet(() => payrollRunApi.submit(run.id), "Submitted for approval")}>
              <Send className="h-4 w-4" /> Submit for approval
            </Button>
          </>
        )}
        {canRun && EDITABLE.includes(s) && (
          <Button size="sm" variant="outline" onClick={() => setAdjOpen(true)}>
            <Plus className="h-4 w-4" /> Adjustments
          </Button>
        )}
        {s === "Pending Approval" && (
          <>
            <Button
              size="sm"
              disabled={busy || !next.can_act}
              title={!next.can_act ? (next.reason ?? "You cannot sign this level") : undefined}
              onClick={() => quiet(() => payrollRunApi.decide(run.id, "approve"), "Approved")}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !next.can_act}
              title={!next.can_act ? (next.reason ?? "You cannot sign this level") : undefined}
              onClick={() =>
                setPrompt({
                  title: "Reject payroll run",
                  label: "Reason for rejection",
                  required: true,
                  confirmLabel: "Reject",
                  run: (text) => act(() => payrollRunApi.decide(run.id, "reject", text), "Run rejected"),
                })
              }
            >
              <X className="h-4 w-4" /> Reject
            </Button>
            {canApproveP && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setPrompt({
                    title: "Send back to draft",
                    label: "Remark",
                    required: true,
                    confirmLabel: "Send back",
                    run: (text) => act(() => payrollRunApi.sendBack(run.id, text), "Sent back to draft"),
                  })
                }
              >
                <Undo2 className="h-4 w-4" /> Send back
              </Button>
            )}
            {!next.can_act && next.reason && <span className="text-muted-foreground self-center text-xs">{next.reason}</span>}
          </>
        )}
        {canProcess && s === "Approved" && (
          <Button size="sm" disabled={busy} onClick={() => quiet(() => payrollRunApi.process(run.id), "Payroll processed — payslips created")}>
            <Check className="h-4 w-4" /> Process payroll
          </Button>
        )}
        {canProcess && s === "Processed" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              setPrompt({
                title: "Mark as paid",
                label: "Payment reference",
                required: true,
                confirmLabel: "Mark paid",
                run: (text) => act(() => payrollRunApi.pay(run.id, text), "Marked as paid"),
              })
            }
          >
            <Check className="h-4 w-4" /> Mark paid
          </Button>
        )}
        {canRun && ["Rejected", "Checks Failed", "Checks Passed"].includes(s) && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => quiet(() => payrollRunApi.reopen(run.id), "Run reopened as draft")}>
            <RotateCcw className="h-4 w-4" /> Reopen
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => payrollRunApi.downloadRegister(run.id, run.period).catch((e) => toast.error(detailText(e)))}
          >
            <Download className="h-4 w-4" /> Register CSV
          </Button>
          {["Processed", "Paid"].includes(s) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => payrollRunApi.downloadPayslips(run.id, run.period).catch((e) => toast.error(detailText(e)))}
            >
              <Download className="h-4 w-4" /> Payslips CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Employees", t.employees],
          ["Gross", money(t.gross)],
          ["Deductions", money(t.deductions)],
          ["Net pay", money(t.net)],
          ["Employer cost", money(t.employer_cost)],
          ["PF", money(t.pf)],
          ["ESI", money(t.esi)],
          ["TDS", money(t.tds)],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-card">
            <CardContent className="p-3">
              <div className="text-muted-foreground text-xs">{label}</div>
              <div className="text-sm font-bold tabular-nums">{value ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="register">Register ({run.lines?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="checks">
            Checks ({(run.checks ?? []).filter((c) => c.status === "open").length} open)
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "register" && (
        <Card className="shadow-card overflow-hidden">
          <CardContent className="flex flex-wrap items-center gap-3 border-b p-3">
            <div className="border-border bg-muted/40 flex min-w-[220px] items-center gap-2 rounded-lg border px-3 py-1.5">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code…" className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" />
            </div>
            <select value={state} onChange={(e) => setState(e.target.value)} className="border-input bg-background h-9 rounded-md border px-2 text-sm">
              <option value="">All rows</option>
              <option value="error">With errors</option>
              <option value="warning">With warnings</option>
              <option value="ok">Clean</option>
            </select>
          </CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Dept</th>
                  <th className="p-3 text-right">Payable days</th>
                  <th className="p-3 text-right">LOP</th>
                  <th className="p-3 text-right">Gross</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {(run.lines ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground p-8 text-center">
                      No rows to show.
                    </td>
                  </tr>
                )}
                {(run.lines ?? []).map((l) => (
                  <tr key={l.employee_id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setLineId(l.employee_id)}>
                    <td className="p-3">
                      <div className="font-medium">{l.employee_name}</div>
                      <div className="text-muted-foreground text-xs">{l.employee_code}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{l.department ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{l.lop?.payable_days ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{l.lop?.days ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{money(l.earned_gross)}</td>
                    <td className="p-3 text-right tabular-nums">{money(l.total_deductions)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{money(l.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "checks" && (
        <Card className="shadow-card">
          <CardContent className="divide-border divide-y p-0">
            {(run.checks ?? []).length === 0 && (
              <div className="text-muted-foreground p-6 text-sm">
                {s === "Draft" ? "Run checks to validate this payroll." : "No checks raised."}
              </div>
            )}
            {(run.checks ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Badge variant="outline" className={SEVERITY_TONE[c.severity]}>
                  {c.code}
                </Badge>
                <div className="min-w-[200px] flex-1">
                  <div>{c.message}</div>
                  <div className="text-muted-foreground text-xs">
                    {c.employee_name ?? "Whole run"} · {c.status}
                    {c.resolution_note ? ` · ${c.resolution_note}` : ""}
                  </div>
                </div>
                {canRun && EDITABLE.includes(s) && ["open", "escalated"].includes(c.status) && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => quiet(() => payrollRunApi.resolveCheck(run.id, c.id, { action: "fix", note: "" }), "Marked as fixed")}>
                      Fixed
                    </Button>
                    {c.code !== "ATT-LOCK" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setPrompt({
                            title: `Override ${c.code}`,
                            label: "Note (required)",
                            required: true,
                            confirmLabel: "Override",
                            run: (text) => act(() => payrollRunApi.resolveCheck(run.id, c.id, { action: "override", note: text }), "Check overridden"),
                          })
                        }
                      >
                        Override
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setPrompt({
                          title: `Escalate ${c.code}`,
                          label: "Note",
                          confirmLabel: "Escalate",
                          run: (text) => act(() => payrollRunApi.escalateCheck(run.id, c.id, text ? { note: text } : {}), "Check escalated"),
                        })
                      }
                    >
                      Escalate
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {view === "history" && (
        <Card className="shadow-card">
          <CardContent className="divide-border divide-y p-0 text-sm">
            {(run.history ?? []).length === 0 && <div className="text-muted-foreground p-6">No activity yet.</div>}
            {(run.history ?? []).map((h, i) => (
              <div key={i} className="flex flex-wrap gap-x-4 p-3">
                <span className="text-muted-foreground w-44 text-xs">{when(h.at)}</span>
                <span className="font-medium">{h.action}</span>
                <span className="text-muted-foreground">{h.by}</span>
                {h.remark && <span>— {h.remark}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {run.processed_at && (
        <p className="text-muted-foreground text-xs">
          Processed {when(run.processed_at)} by {run.processed_by?.name ?? "—"}
          {run.paid_at ? ` · Paid ${when(run.paid_at)} · ref ${run.payment_reference ?? "—"}` : ""}
        </p>
      )}

      {prompt && (
        <PromptDialog
          title={prompt.title}
          label={prompt.label}
          required={prompt.required}
          confirmLabel={prompt.confirmLabel}
          onConfirm={(text) => prompt.run(text).catch(() => {})}
          onClose={() => setPrompt(null)}
        />
      )}
      {lineId && <LineDrawer runId={run.id} employeeId={lineId} onClose={() => setLineId(null)} />}
      {adjOpen && <AdjustmentsDialog run={run} company={company} onClose={() => setAdjOpen(false)} onChanged={() => {}} />}
    </div>
  );
}

export function PayrollRunsTab() {
  const can = useCan();
  const scope = useCompanyScope();
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(0);
  const [create, setCreate] = useState({ period: currentPeriod(), pay_date: lastDayOf(currentPeriod()) });
  const [creating, setCreating] = useState(false);

  const company = scope.isSuper ? scope.companyId : "";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    payrollRunApi
      .list({ status, period, page, limit: 20, company_id: company })
      .then((d) => alive && setData(d))
      .catch((e) => alive && (setData({ items: [], total: 0 }), toast.error(detailText(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status, period, page, company, version]);

  const createRun = async () => {
    if (scope.isSuper && !company) {
      toast.error("Select a company first.");
      return;
    }
    setCreating(true);
    try {
      const run = await payrollRunApi.create({ ...create, company_id: company });
      toast.success(`Payroll run for ${run.period} created`);
      setVersion((v) => v + 1);
      setSelected(run.id);
    } catch (e) {
      toast.error(detailText(e));
    } finally {
      setCreating(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / 20)), [data]);

  if (selected)
    return (
      <RunDetail
        runId={selected}
        company={company}
        onBack={() => {
          setSelected(null);
          setVersion((v) => v + 1);
        }}
        onChanged={() => {}}
      />
    );

  return (
    <div className="space-y-5">
      {can("payroll.run") && (
        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <CompanyScopeSelect scope={scope} allowAll={false} />
            <label className="text-xs">
              <span className="text-muted-foreground block font-medium">Period</span>
              <Input
                type="month"
                className="h-9 w-[150px]"
                value={create.period}
                onChange={(e) => e.target.value && setCreate({ period: e.target.value, pay_date: lastDayOf(e.target.value) })}
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground block font-medium">Pay date</span>
              <Input type="date" className="h-9 w-[160px]" value={create.pay_date} onChange={(e) => setCreate({ ...create, pay_date: e.target.value })} />
            </label>
            <Button onClick={createRun} disabled={creating || !create.period || !create.pay_date}>
              <Plus className="h-4 w-4" /> Create payroll run
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-3 border-b p-3">
          <select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="border-input bg-background h-9 rounded-md border px-2 text-sm">
            <option value="">All statuses</option>
            {Object.keys(STATUS_TONE).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input type="month" className="h-9 w-[150px]" value={period} onChange={(e) => (setPeriod(e.target.value), setPage(1))} aria-label="Period" />
          {(status || period) && (
            <Button variant="ghost" size="sm" onClick={() => (setStatus(""), setPeriod(""), setPage(1))}>
              Clear
            </Button>
          )}
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Pay date</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Employees</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Net</th>
                <th className="p-3 text-left">Prepared by</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="p-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && !(data?.items ?? []).length && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-8 text-center">
                    No payroll runs yet.{can("payroll.run") ? " Lock the month's attendance, then create one above." : ""}
                  </td>
                </tr>
              )}
              {!loading &&
                (data?.items ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelected(r.id)}>
                    <td className="p-3 font-medium">{r.period}</td>
                    <td className="text-muted-foreground p-3">{r.pay_date}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.employees}</td>
                    <td className="p-3 text-right tabular-nums">{money(r.gross)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{money(r.net)}</td>
                    <td className="text-muted-foreground p-3">{r.prepared_by?.name ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t p-3 text-xs">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
