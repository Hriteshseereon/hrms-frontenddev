import { useMemo, useState } from "react";
import {
  Play,
  Wallet,
  ShieldCheck,
  Send,
  CheckCircle2,
  XCircle,
  Banknote,
  RotateCcw,
  Search,
  Download,
  AlertTriangle,
  Info,
  Lock,
  Unlock,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { BANK_ACCOUNTS, PAY_FREQUENCIES } from "@/features/finance/data/finance-data";
import { inr } from "@/lib/store";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { exportCsv } from "@/lib/export-utils";
import {
  RUN_STEPS,
  acknowledgeWarnings,
  createRun,
  decideRun,
  sendBackRun,
  markPaid,
  nextApprovalLevel,
  LEVEL_ROLES,
  roleMayApproveLevel,
  periodLabel,
  processRun,
  reopenRun,
  runChecks,
  runStepIndex,
  runTone,
  submitForApproval,
  usePayrollRuns,
  dueDate,
} from "@/features/payroll/data/payroll-engine";
import {
  attendanceLockStore,
  lockAttendance,
  unlockAttendance,
  useAttendanceLocks,
} from "@/features/attendance/data/attendance-pattern";
import { useStatutoryConfig } from "@/features/payroll/data/statutory-data";
import { PayslipBreakdown, WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  ComplianceCheckDialog,
  checkLabelTone,
  levelTone,
} from "@/features/payroll/components/ComplianceCheckDialog";
import { employeeCheckState, isOpenCheck } from "@/features/payroll/data/payroll-engine";
import { useScopeMatch } from "@/features/organization/data/tenancy";

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function PayrollTab() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const inScope = useScopeMatch();
  const allRuns = usePayrollRuns();
  const runs = useMemo(
    () => allRuns.filter((r) => inScope(r.orgId)).sort((a, b) => (a.period < b.period ? 1 : -1)),
    [allRuns, inScope],
  );
  const [selectedId, setSelectedId] = useState("");
  const run = runs.find((r) => r.id === selectedId) ?? runs[0];
  const locks = useAttendanceLocks();
  // The selected run's own entity — in the group view the active entity can differ from the run's company.
  const allLocks = attendanceLockStore.use();
  const cfg = useStatutoryConfig();

  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("2026-08");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [payDate, setPayDate] = useState("");
  const [bank, setBank] = useState(BANK_ACCOUNTS[0]);
  const [q, setQ] = useState("");
  const [slip, setSlip] = useState(null);
  const [checkView, setCheckView] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [checkFilter, setCheckFilter] = useState("all");
  const [payRef, setPayRef] = useState("");

  const canRun = can(me.role, "payroll.run");
  const canApprove = can(me.role, "payroll.approve");
  const canProcess = can(me.role, "payroll.process");
  const canLock = can(me.role, "attendance.lock");

  const act = (r) => toast[r.ok ? "success" : "error"](r.message);

  function submit() {
    const res = createRun(
      {
        orgId,
        title: title.trim() || `${periodLabel(period)} Salary`,
        period,
        payDate: payDate || dueDate(period, cfg.payroll.payDay),
        bankAccount: bank,
        frequency,
      },
      me,
    );
    act(res);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setPayDate("");
    }
  }

  const [stateFilter, setStateFilter] = useState("all");
  const rows = useMemo(
    () =>
      (run?.lines ?? []).filter(
        (l) =>
          `${l.name} ${l.empId} ${l.dept} ${l.state}`.toLowerCase().includes(q.toLowerCase()) &&
          (stateFilter === "all" || l.state === stateFilter),
      ),
    [run, q, stateFilter],
  );
  const states = useMemo(() => [...new Set((run?.lines ?? []).map((l) => l.state))].sort(), [run]);
  const t = run?.totals;
  const errors = run?.checks.filter((c) => c.level === "error" && isOpenCheck(c)) ?? [];
  const warnings = run?.checks.filter((c) => c.level === "warning" && isOpenCheck(c)) ?? [];
  const infos = run?.checks.filter((c) => c.level === "info" && isOpenCheck(c)) ?? [];
  const closedChecks = run?.checks.filter((c) => !isOpenCheck(c)) ?? [];
  const runLock = run ? (allLocks[`${run.orgId}:${run.period}`] ?? allLocks[run.period]) : null;
  const locked = Boolean(runLock);
  const isMaker = run?.preparedBy.id === me.id;
  const alreadyApproved = Boolean(
    run?.approvals.some((a) => a.decision === "Approved" && a.byId === me.id),
  );

  const exportRegister = () => {
    if (!run) return;
    exportCsv(
      `salary-register-${run.period}.csv`,
      [
        "Emp ID",
        "Employee",
        "Department",
        "State",
        "Pattern",
        "Payable days",
        "LOP days",
        "Structure gross",
        "LOP",
        "Earned gross",
        "PF (EE)",
        "VPF",
        "ESI (EE)",
        "PT",
        "LWF",
        "NPS (EE)",
        "TDS",
        "Loan EMI",
        "Deductions",
        "Net",
        "PF (ER)",
        "ESI (ER)",
        "CTC cost",
      ],
      run.lines.map((l) => [
        l.empId,
        l.name,
        l.dept,
        l.state,
        l.lop.pattern.name,
        l.lop.payableDays,
        l.lop.lopDays,
        l.structureGross,
        l.lop.lopAmount,
        l.earnedGross,
        l.pf.employee,
        l.pf.vpf,
        l.esi.employee,
        l.pt,
        l.lwf.employee,
        l.nps.employee,
        l.tds.monthly,
        l.loanEmi,
        l.totalDeductions,
        l.net,
        l.pf.employerEpf + l.pf.employerEps + l.pf.edli + l.pf.admin,
        l.esi.employer,
        l.employerCost,
      ]),
    );
    toast.success("Salary register exported");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        {[
          { l: "Employees", v: String(t?.employees ?? 0), sub: run ? periodLabel(run.period) : "" },
          {
            l: "Gross earned",
            v: inr(t?.earnedGross ?? 0),
            sub: t?.lop ? `after ${inr(t.lop)} LOP (${t.lopDays} days)` : "no LOP this period",
          },
          {
            l: "Statutory (EE)",
            v: inr(
              (t?.pfEmployee ?? 0) +
                (t?.vpf ?? 0) +
                (t?.esiEmployee ?? 0) +
                (t?.pt ?? 0) +
                (t?.lwfEmployee ?? 0),
            ),
            sub: "PF · VPF · ESI · PT · LWF",
          },
          {
            l: "TDS",
            v: inr(t?.tds ?? 0),
            sub: `${run?.lines.filter((l) => l.tds.monthly > 0).length ?? 0} deductees`,
          },
          {
            l: "Net payable",
            v: inr(t?.net ?? 0),
            sub: `employer cost ${inr(t?.employerCost ?? 0)}`,
          },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">{s.l}</div>
              <div className="mt-1 text-xl font-bold whitespace-nowrap tabular-nums">{s.v}</div>
              {s.sub && <div className="text-muted-foreground mt-0.5 text-[11px]">{s.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="text-primary h-4 w-4" />
              <div>
                <div className="font-semibold">Payroll Runs</div>
                <div className="text-muted-foreground text-xs">
                  Draft → Compliance checks → {cfg.payroll.approvalLevels.join(" → ")} approval →
                  Process → Pay
                </div>
              </div>
            </div>
            {canRun && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                    <Play className="h-4 w-4" /> New Payroll Run
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Payroll Run</DialogTitle>
                    <DialogDescription>
                      The register is computed from attendance, patterns and statutory policy.
                      Nothing is paid until the run clears checks and approval.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                    <Field label="Pay period (month)" required>
                      <Input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                      />
                    </Field>
                    <Field label="Frequency">
                      <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAY_FREQUENCIES.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Title">
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={`${periodLabel(period || "2026-08")} Salary`}
                        />
                      </Field>
                    </div>
                    <Field label="Pay date">
                      <Input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Bank account" required>
                      <Select value={bank} onValueChange={setBank}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BANK_ACCOUNTS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {period && !locks[period] && cfg.payroll.requireAttendanceLock && (
                      <div className="border-gold/40 bg-gold/10 flex gap-2 rounded-lg border p-3 text-xs sm:col-span-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Attendance for {periodLabel(period)} is not locked yet — the draft can be
                        created but compliance checks will block until HR locks the month.
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!/^\d{4}-\d{2}$/.test(period)}
                      className="bg-gradient-emerald text-white"
                      onClick={submit}
                    >
                      Create Draft
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Run",
                    "Title",
                    "Period",
                    "Pay date",
                    "Employees",
                    "Earned gross",
                    "LOP",
                    "Net",
                    "Prepared by",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "hover:bg-muted/30 cursor-pointer transition",
                      run?.id === r.id && "bg-primary/5",
                    )}
                  >
                    <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                    <td className="p-3 font-medium">{r.title}</td>
                    <td className="text-muted-foreground p-3">{periodLabel(r.period)}</td>
                    <td className="text-muted-foreground p-3">
                      <span className="whitespace-nowrap">{r.payDate}</span>
                    </td>
                    <td className="p-3">{r.totals.employees}</td>
                    <td className="p-3 tabular-nums">{inr(r.totals.earnedGross)}</td>
                    <td className={cn("p-3 tabular-nums", r.totals.lop > 0 && "text-destructive")}>
                      {r.totals.lop ? `− ${inr(r.totals.lop)}` : "—"}
                    </td>
                    <td className="text-primary p-3 font-semibold tabular-nums">
                      {inr(r.totals.net)}
                    </td>
                    <td className="text-muted-foreground p-3">{r.preparedBy.name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={runTone(r.status)}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-muted-foreground p-8 text-center">
                      No payroll runs for this organisation yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {run && (
        <>
          <WorkflowStepper
            steps={RUN_STEPS}
            active={runStepIndex(run.status)}
            failed={run.status === "Checks Failed" || run.status === "Rejected"}
            title={`${run.id} · ${run.title}`}
            badge={
              <Badge variant="outline" className={runTone(run.status)}>
                {run.status}
              </Badge>
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="text-primary h-4 w-4" /> Workflow actions
                </div>
                <div className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    {locked ? (
                      <Lock className="text-primary h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="text-destructive h-3.5 w-3.5" />
                    )}{" "}
                    Attendance {periodLabel(run.period)}:{" "}
                    <b>{locked ? `locked by ${runLock.by}` : "not locked"}</b>
                  </span>
                  {canLock && ["Draft", "Checks Failed", "Checks Passed"].includes(run.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (locked) unlockAttendance(run.period, run.orgId);
                        else lockAttendance(run.period, me.name, run.orgId);
                        toast.success(
                          locked ? "Attendance unlocked" : "Attendance locked for payroll",
                        );
                      }}
                    >
                      {locked ? "Unlock" : "Lock month"}
                    </Button>
                  )}
                </div>
                {(run.status === "Draft" ||
                  run.status === "Checks Failed" ||
                  run.status === "Checks Passed") &&
                  canRun && (
                    <Button
                      className="bg-gradient-emerald w-full text-white"
                      onClick={() => act(runChecks(run.id, me))}
                    >
                      <ShieldCheck className="h-4 w-4" />{" "}
                      {run.checks.length ? "Re-run compliance checks" : "Run compliance checks"}
                    </Button>
                  )}
                {run.status === "Checks Passed" && canRun && (
                  <>
                    {warnings.some((w) => !w.acknowledged) && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          acknowledgeWarnings(run.id, me);
                          toast.success("Warnings acknowledged");
                        }}
                      >
                        <AlertTriangle className="h-4 w-4" /> Acknowledge{" "}
                        {warnings.filter((w) => !w.acknowledged).length} warning(s)
                      </Button>
                    )}
                    <Button
                      className="bg-gradient-emerald w-full text-white"
                      disabled={warnings.some((w) => !w.acknowledged)}
                      onClick={() => act(submitForApproval(run.id, me))}
                    >
                      <Send className="h-4 w-4" /> Submit for {run.approvalLevels[0]} approval
                    </Button>
                  </>
                )}
                {run.status === "Pending Approval" && (
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-xs">
                      Awaiting <b>{nextApprovalLevel(run)}</b> ·{" "}
                      {run.approvals.filter((a) => a.decision === "Approved").length}/
                      {run.approvalLevels.length} levels cleared
                    </div>
                    {canApprove ? (
                      !roleMayApproveLevel(me.role, nextApprovalLevel(run)) ? (
                        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
                          The <b>{nextApprovalLevel(run)}</b> level is signed by{" "}
                          {(LEVEL_ROLES[nextApprovalLevel(run)] ?? []).join(" / ")} — your role (
                          {me.role}) cannot approve it.
                        </div>
                      ) : (isMaker && cfg.payroll.enforceMakerChecker) || alreadyApproved ? (
                        <div className="border-gold/40 bg-gold/10 rounded-lg border p-3 text-xs">
                          {alreadyApproved
                            ? "You already approved an earlier level — the next level needs a different approver."
                            : "You prepared this run — maker–checker policy requires a different approver."}
                        </div>
                      ) : (
                        <>
                          <Textarea
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Approval remarks (bank file reference, reconciliation note)…"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              className="bg-gradient-emerald text-white"
                              data-testid="run-approve"
                              onClick={() => {
                                act(
                                  decideRun(run.id, me, "Approved", remarks.trim() || "Approved"),
                                );
                                setRemarks("");
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              className="border-destructive/40 text-destructive"
                              disabled={!remarks.trim()}
                              onClick={() => {
                                act(decideRun(run.id, me, "Rejected", remarks.trim()));
                                setRemarks("");
                              }}
                            >
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={!remarks.trim()}
                            title="Return the run to HR for correction without rejecting it"
                            onClick={() => {
                              act(sendBackRun(run.id, me, remarks.trim()));
                              setRemarks("");
                            }}
                          >
                            <RotateCcw className="h-4 w-4" /> Send back to HR for correction
                          </Button>
                          <p className="text-muted-foreground text-[11px]">
                            Rejection and send-back require remarks.
                          </p>
                        </>
                      )
                    ) : (
                      <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
                        Your role can view but not approve payroll.
                      </div>
                    )}
                  </div>
                )}
                {run.status === "Approved" && canProcess && (
                  <Button
                    className="bg-gradient-emerald w-full text-white"
                    onClick={() => act(processRun(run.id, me))}
                  >
                    <Play className="h-4 w-4" /> Process — generate payslips
                  </Button>
                )}
                {run.status === "Processed" && canProcess && (
                  <div className="space-y-2">
                    <Input
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Bank bulk-transfer reference (e.g. NEFT-BULK-202608)"
                    />

                    <Button
                      className="bg-gradient-emerald w-full text-white"
                      disabled={!payRef.trim()}
                      onClick={() => {
                        act(markPaid(run.id, me, payRef.trim()));
                        setPayRef("");
                      }}
                    >
                      <Banknote className="h-4 w-4" /> Confirm bank transfer
                    </Button>
                    <p className="text-muted-foreground text-[11px]">
                      ECR, ESI and TDS filings for {periodLabel(run.period)} can now be generated on
                      the Statutory Compliance screen.
                    </p>
                  </div>
                )}
                {run.status === "Paid" && (
                  <div className="border-primary/30 bg-primary/5 rounded-lg border p-3 text-xs">
                    <CheckCircle2 className="text-primary mr-1 inline h-4 w-4" />
                    Paid on <span className="whitespace-nowrap">{run.paidOn}</span> ·{" "}
                    {run.paymentRef}
                  </div>
                )}
                {(run.status === "Rejected" || run.status === "Checks Failed") && canRun && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => act(reopenRun(run.id, me))}
                  >
                    <RotateCcw className="h-4 w-4" /> Reopen as draft
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Compliance checks</div>
                  {/* Click a level to filter the list (asked by Finance: errors first, then warnings, then info). */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      ["error", `${errors.length} errors`],
                      ["warning", `${warnings.length} warnings`],
                      ["info", `${infos.length} info`],
                    ].map(([lvl, label]) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setCheckFilter((f) => (f === lvl ? "all" : lvl))}
                        title={checkFilter === lvl ? "Show all levels" : `Show only ${lvl}s`}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            levelTone[lvl],
                            checkFilter === lvl && "ring-primary/50 ring-2",
                            checkFilter !== "all" && checkFilter !== lvl && "opacity-40",
                          )}
                        >
                          {label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {run.checks.length === 0 && (
                    <div className="text-muted-foreground py-6 text-center text-xs">
                      Checks have not been run yet.
                    </div>
                  )}
                  {[...errors, ...warnings, ...infos, ...closedChecks]
                    .filter((c) => checkFilter === "all" || c.level === checkFilter)
                    .map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() =>
                          setCheckView(c.empId ? { empId: c.empId } : { checkId: c.id })
                        }
                        className={cn(
                          "hover:ring-primary/30 w-full rounded-lg border p-2.5 text-left text-xs transition hover:ring-2",
                          levelTone[c.level],
                          !isOpenCheck(c) && "opacity-70",
                        )}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="font-mono">{c.code}</span>
                          {c.employee && <span>· {c.employee}</span>}
                          <span className="ml-auto text-[10px] font-medium">
                            {c.status && c.status !== "Open"
                              ? c.status
                              : c.acknowledged
                                ? "acknowledged"
                                : c.level === "error"
                                  ? "Check failed · click to resolve"
                                  : ""}
                          </span>
                        </div>
                        <div className="text-foreground/80 mt-0.5">{c.message}</div>
                      </button>
                    ))}
                </div>
                {run.checkedOn && (
                  <div className="text-muted-foreground text-[11px]">
                    Last checked <span className="whitespace-nowrap">{run.checkedOn}</span> · click
                    any check to see the issue, fix it here or send it to the concerned person
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <div className="text-sm font-semibold">Approval trail</div>
                <div className="space-y-2">
                  {run.approvalLevels.map((lvl, i) => {
                    const a = run.approvals[i];
                    return (
                      <div key={lvl} className="flex items-start gap-2 text-xs">
                        <div
                          className={cn(
                            "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                            a?.decision === "Approved"
                              ? "bg-primary"
                              : a?.decision === "Rejected"
                                ? "bg-destructive"
                                : "bg-border",
                          )}
                        />

                        <div className="min-w-0">
                          <div className="font-semibold">{lvl}</div>
                          {a ? (
                            <div className="text-muted-foreground">
                              {a.decision} by {a.by} · {a.on}
                              {a.remarks ? ` — ${a.remarks}` : ""}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">Pending</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 text-sm font-semibold">History</div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
                  {[...run.history].reverse().map((h, i) => (
                    <div key={i} className="border-border border-l-2 pl-2">
                      <div>{h.action}</div>
                      <div className="text-muted-foreground">
                        {h.by} · {h.at}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold">Salary Register · {periodLabel(run.period)}</div>
                  <div className="text-muted-foreground text-xs">
                    Attendance pattern → LOP → earned gross → state-aware statutory deductions.
                    Click a row for the full payslip working.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="border-border bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex-none">
                    <Search className="text-muted-foreground h-4 w-4" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search employee, dept, state…"
                      className="h-6 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:w-48"
                    />
                  </div>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="State filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      {states.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={exportRegister}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                    <tr>
                      {[
                        "Employee",
                        "State",
                        "Pattern",
                        "Days (paid / LOP)",
                        "Structure",
                        "Earned gross",
                        "PF",
                        "ESI",
                        "PT",
                        "TDS",
                        "Deductions",
                        "Net",
                        "Checks",
                        "",
                      ].map((h) => (
                        <th key={h} className="p-3 text-left whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {rows.map((l) => (
                      <tr
                        key={l.empId}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSlip(l)}
                      >
                        <td className="p-3 font-medium">
                          {l.name}
                          <div className="text-muted-foreground font-mono text-xs">
                            {l.empId} · {l.dept}
                            {l.wageRoll ? " · wage roll" : ""}
                          </div>
                        </td>
                        <td className="text-muted-foreground p-3">{l.state}</td>
                        <td className="text-muted-foreground p-3 text-xs">{l.lop.pattern.name}</td>
                        <td className="p-3 tabular-nums">
                          {l.lop.payableDays}{" "}
                          <span
                            className={cn(
                              "text-xs",
                              l.lop.lopDays
                                ? "text-destructive font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            / {l.lop.lopDays} LOP
                          </span>
                        </td>
                        <td className="text-muted-foreground p-3 tabular-nums">
                          {inr(l.structureGross)}
                        </td>
                        <td className="p-3 tabular-nums">
                          {inr(l.earnedGross)}
                          {l.lop.lopAmount > 0 && (
                            <div className="text-destructive text-[11px]">
                              − {inr(l.lop.lopAmount)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.pf.applicable ? (
                            inr(l.pf.employee + l.pf.vpf)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {l.pf.vpf > 0 && (
                            <div className="text-muted-foreground text-[11px]">incl. VPF</div>
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.esi.applicable ? (
                            inr(l.esi.employee)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.pt ? inr(l.pt) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.tds.monthly ? (
                            inr(l.tds.monthly)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-destructive p-3 tabular-nums">
                          − {inr(l.totalDeductions)}
                        </td>
                        <td
                          className={cn(
                            "p-3 font-semibold tabular-nums",
                            l.net < 0 ? "text-destructive" : "text-primary",
                          )}
                        >
                          {inr(l.net)}
                        </td>
                        <td className="p-3">
                          {(() => {
                            if (!run.checks.length)
                              return <span className="text-muted-foreground text-xs">—</span>;
                            const st = employeeCheckState(run, l.empId);
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (st.checks.length) setCheckView({ empId: l.empId });
                                }}
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                                  checkLabelTone[st.label],
                                  st.checks.length && "hover:ring-primary/30 hover:ring-2",
                                )}
                                title={
                                  st.checks.length
                                    ? `${st.checks.length} check(s) — click for details`
                                    : "No checks raised"
                                }
                              >
                                {st.label}
                                {st.checks.length > 1 && (
                                  <span className="ml-1 opacity-70">· {st.checks.length}</span>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <Eye className="text-muted-foreground h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {t && (
                    <tfoot className="bg-muted/30 text-xs font-semibold">
                      <tr>
                        <td className="p-3" colSpan={3}>
                          Totals · {t.employees} employees
                        </td>
                        <td className="p-3">{t.lopDays} LOP days</td>
                        <td className="p-3 tabular-nums">{inr(t.structureGross)}</td>
                        <td className="p-3 tabular-nums">{inr(t.earnedGross)}</td>
                        <td className="p-3 tabular-nums">{inr(t.pfEmployee + t.vpf)}</td>
                        <td className="p-3 tabular-nums">{inr(t.esiEmployee)}</td>
                        <td className="p-3 tabular-nums">{inr(t.pt)}</td>
                        <td className="p-3 tabular-nums">{inr(t.tds)}</td>
                        <td className="text-destructive p-3 tabular-nums">− {inr(t.deductions)}</td>
                        <td className="text-primary p-3 tabular-nums">{inr(t.net)}</td>
                        <td className="text-muted-foreground p-3 text-[11px] font-normal">
                          {errors.length
                            ? `${errors.length} failed`
                            : run.checks.length
                              ? "all clear"
                              : ""}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className="text-muted-foreground mt-3 flex items-center gap-1 text-[11px]">
                <Info className="h-3 w-3" /> Employer legs (EPF 3.67 %, EPS 8.33 %, EDLI, admin, ESI
                3.25 %, employer NPS, LWF) are in the exported register and the payslip working —
                they are cost, not deductions.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {slip?.name} · {slip?.periodLabel}
            </DialogTitle>
            <DialogDescription>
              {slip?.empId} · {slip?.designation} · {slip?.branch} ({slip?.state})
            </DialogDescription>
          </DialogHeader>
          {slip && <PayslipBreakdown slip={slip} />}
        </DialogContent>
      </Dialog>
      {run && checkView && (
        <ComplianceCheckDialog
          run={run}
          empId={checkView.empId}
          checkId={checkView.checkId}
          canAct={canRun}
          onClose={() => setCheckView(null)}
        />
      )}
    </div>
  );
}
