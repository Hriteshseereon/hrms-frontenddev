import { useCallback, useEffect, useMemo, useState } from "react";
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
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  setRunEmployees,
  restartRunForNewFlow,
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
  computePayslip,
  payrollRoster,
} from "@/features/payroll/data/payroll-engine";
import { useStatutoryConfig } from "@/features/payroll/data/statutory-data";
import { PayslipBreakdown, WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  ComplianceCheckDialog,
  checkLabelTone,
  levelTone,
} from "@/features/payroll/components/ComplianceCheckDialog";
import { employeeCheckState, isOpenCheck } from "@/features/payroll/data/payroll-engine";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import { getEmployees } from "@/api/employeeApi";
import {
  formatLockTimestamp,
  verifyPayrollAttendanceLock,
} from "@/features/payroll/data/attendance-lock-verification";
import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";

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
    () =>
      allRuns
        .filter((r) => inScope(r.orgId) || r.orgId === orgId)
        .sort((a, b) => (a.period < b.period ? 1 : -1)),
    [allRuns, inScope, orgId],
  );
  const [selectedId, setSelectedId] = useState("");
  const run = runs.find((r) => r.id === selectedId) ?? runs[0];
  const cfg = useStatutoryConfig();
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [lockVerification, setLockVerification] = useState({
    loading: true,
    verified: false,
    locked: false,
    period: run?.period,
  });
  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError("");
    try {
      const all = [];
      let page = 1;
      let total = Infinity;
      while (all.length < total) {
        const response = await getEmployees({ page, limit: 100 });
        const payload = response?.data ?? response;
        const items = Array.isArray(payload)
          ? payload
          : (payload?.items ??
            payload?.results ??
            (Array.isArray(payload?.data) ? payload.data : payload?.data?.items) ??
            []);
        if (!Array.isArray(items) || !items.length) break;
        all.push(...items);
        const reportedTotal = Number(payload?.total ?? payload?.total_count);
        if (Number.isFinite(reportedTotal) && reportedTotal >= 0) total = reportedTotal;
        if (items.length < 100) break;
        page += 1;
      }
      setEmployees(all);
    } catch (error) {
      setEmployeesError(
        error?.response?.data?.detail ?? error?.message ?? "Could not load employees.",
      );
    } finally {
      setEmployeesLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const attendanceCompanyId =
    employees.find((employee) => employee.company_id)?.company_id ??
    employees.find((employee) => employee.organization_id)?.organization_id ??
    orgId;
  const verifySelectedAttendance = useCallback(async () => {
    if (!run?.period) return null;
    setLockVerification({ loading: true, verified: false, locked: false, period: run.period });
    try {
      const result = await verifyPayrollAttendanceLock({
        period: run.period,
        companyId: attendanceCompanyId,
        payrollOrgId: run.orgId,
        employees,
      });
      const state = { ...result, loading: false, period: run.period };
      setLockVerification(state);
      return state;
    } catch (error) {
      const state = {
        loading: false,
        verified: false,
        locked: false,
        period: run.period,
        error:
          error?.response?.data?.detail ??
          error?.message ??
          "Could not verify the attendance lock.",
      };
      setLockVerification(state);
      return state;
    }
  }, [run?.period, run?.orgId, attendanceCompanyId, employees]);

  useEffect(() => {
    verifySelectedAttendance();
  }, [verifySelectedAttendance]);

  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const periodRun = runs.find(
    (r) => r.orgId === orgId && r.period === period && r.status !== "Rejected",
  );
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(
    run?.employeeIds ?? run?.lines.map((line) => line.empId) ?? [],
  );

  const canRun = can(me.role, "payroll.run");
  const canApprove = can(me.role, "payroll.approve");
  const canProcess =
    can(me.role, "payroll.process") && ["Accountant", "CFO", "Admin", "SuperAdmin"].includes(me.role);

  const act = (r) => toast[r.ok ? "success" : "error"](r.message);
  const attendanceReady =
    lockVerification.period === run?.period &&
    lockVerification.verified &&
    lockVerification.locked &&
    lockVerification.summaryLoaded;

  async function requireLockedAttendance() {
    const verification = await verifySelectedAttendance();
    if (!verification?.verified) {
      toast.error(
        verification?.error ?? "Could not verify attendance lock status from the server.",
      );
      return false;
    }
    if (!verification.locked) {
      toast.error(
        `Attendance for ${periodLabel(run.period)} is not locked. Payroll cannot continue.`,
      );
      return false;
    }
    if (!verification.summaryLoaded) {
      toast.error(
        `Attendance data for ${periodLabel(run.period)} could not be loaded. Payroll cannot continue.`,
      );
      return false;
    }
    return true;
  }

  async function handleRunChecks() {
    const verification = await verifySelectedAttendance();
    if (!verification?.verified) {
      toast.error(
        verification?.error ?? "Could not verify attendance lock status from the server.",
      );
      return;
    }
    act(runChecks(run.id, me));
  }

  async function handleSubmitForApproval() {
    if (!(await requireLockedAttendance())) return;
    act(submitForApproval(run.id, me));
  }

  async function handleApproval() {
    if (!(await requireLockedAttendance())) return;
    act(decideRun(run.id, me, "Approved", remarks.trim() || "Approved"));
    setRemarks("");
  }

  async function handleProcessRun() {
    if (!(await requireLockedAttendance())) return;
    act(processRun(run.id, me));
  }

  function submit() {
    if (periodRun) {
      setOpen(false);
      openRegister(periodRun);
      return;
    }
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
    if (res.code === "DUPLICATE_PERIOD" && res.existingRun) {
      setOpen(false);
      openRegister(res.existingRun);
      toast.info(`${periodLabel(period)} payroll already exists. Opened ${res.existingRun.id}.`);
      return;
    }
    act(res);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setPayDate("");
      openRegister(res.run);
    }
  }

  const registerLines = useMemo(() => {
    if (!run) return [];
    if (["Draft", "Checks Failed", "Checks Passed"].includes(run.status)) {
      return payrollRoster(run.orgId).map((employee) => computePayslip(employee, run.period, cfg));
    }
    return run.lines;
  }, [run, cfg]);
  const [stateFilter, setStateFilter] = useState("all");
  const rows = useMemo(() => {
    const lines = run?.lines ?? [];
    const byId = new Map();
    const byName = new Map();
    lines.forEach((line) => {
      byId.set(String(line.empId).toLowerCase(), line);
      byName.set(String(line.name).trim().toLowerCase(), line);
    });
    const apiRows = employees.map((employee) => {
      const name =
        [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
        employee.name ||
        employee.work_email ||
        "Employee";
      const line =
        [employee.id, employee.employee_id, employee.employee_code]
          .filter(Boolean)
          .map((id) => byId.get(String(id).toLowerCase()))
          .find(Boolean) ?? byName.get(String(name).trim().toLowerCase());
      return {
        ...(line ?? {}),
        empId: line?.empId ?? employee.employee_code ?? employee.employee_id ?? employee.id,
        name,
        dept: employee.department || employee.department_name || line?.dept || "—",
        designation: employee.designation || line?.designation || "—",
        branch: employee.branch_name || employee.branch || line?.branch || "—",
        state: employee.state || employee.state_name || line?.state || "—",
        hasPayslip: Boolean(line),
      };
    });
    const allRows = employees.length
      ? apiRows
      : lines.map((line) => ({ ...line, hasPayslip: true }));
    return allRows.filter(
      (l) =>
        `${l.name} ${l.empId} ${l.dept} ${l.state}`.toLowerCase().includes(q.toLowerCase()) &&
        (stateFilter === "all" || l.state === stateFilter),
    );
  }, [run, q, stateFilter, employees]);
  const states = useMemo(
    () =>
      registerLines.filter(
        (l) =>
          `${l.name} ${l.empId} ${l.dept} ${l.state}`.toLowerCase().includes(q.toLowerCase()) &&
          (stateFilter === "all" || l.state === stateFilter),
      ),
    [registerLines, q, stateFilter],
  );
  const states = useMemo(() => [...new Set(registerLines.map((l) => l.state))].sort(), [registerLines]);
  const t = run?.lines.length ? run.totals : null;
  const errors = run?.checks.filter((c) => c.level === "error" && isOpenCheck(c)) ?? [];
  const warnings = run?.checks.filter((c) => c.level === "warning" && isOpenCheck(c)) ?? [];
  const infos = run?.checks.filter((c) => c.level === "info" && isOpenCheck(c)) ?? [];
  const closedChecks = run?.checks.filter((c) => !isOpenCheck(c)) ?? [];
  const isMaker = run?.preparedBy.id === me.id;
  const alreadyApproved = Boolean(
    run?.approvals.some((a) => a.decision === "Approved" && a.byId === me.id),
  );

  const selectionEditable =
    run && ["Draft", "Checks Failed", "Checks Passed"].includes(run.status);
  const savedEmployeeIds = run?.employeeIds ?? run?.lines.map((line) => line.empId) ?? [];
  const selectionMatchesRun =
    savedEmployeeIds.length === selectedEmployeeIds.length &&
    savedEmployeeIds.every((id) => selectedEmployeeIds.includes(id));
  const allEmployeesSelected = Boolean(
    registerLines.length && registerLines.every((line) => selectedEmployeeIds.includes(line.empId)),
  );

  function openRegister(targetRun) {
    setSelectedId(targetRun.id);
    setSelectedEmployeeIds(targetRun.employeeIds ?? targetRun.lines.map((line) => line.empId));
    requestAnimationFrame(() =>
      document.getElementById("salary-register")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function runSelectedPayroll() {
    if (!run) return;
    const currentIds = run.employeeIds ?? run.lines.map((line) => line.empId);
    const sameSelection =
      currentIds.length === selectedEmployeeIds.length &&
      currentIds.every((id) => selectedEmployeeIds.includes(id));
    if (!sameSelection) {
      const prepared = setRunEmployees(run.id, selectedEmployeeIds, me);
      if (!prepared.ok) return act(prepared);
      const checked = runChecks(run.id, me);
      act(checked);
      return;
    }
    if (run.status === "Checks Passed") return act(submitForApproval(run.id, me));
    const checked = runChecks(run.id, me);
    act(checked);
  }

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
      registerLines.map((l) => [
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
      {t ? <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        {[
          {
            l: "Employees",
            v: String(employees.length || t?.employees || 0),
            sub: employees.length
              ? `${t?.employees ?? 0} with payslips${run ? ` · ${periodLabel(run.period)}` : ""}`
              : run
                ? periodLabel(run.period)
                : "",
          },
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
      </div> : run ? (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">Step 1 complete · {run.title}</div>
              <p className="text-muted-foreground mt-1 text-sm">Select employees below. Review the pay preview and correct any employee details before running payroll.</p>
            </div>
            <Badge variant="outline">{selectedEmployeeIds.length} selected</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card id="payroll-runs" className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="text-primary h-4 w-4" />
              <div>
                <div className="font-semibold">Payroll Runs</div>
                <div className="text-muted-foreground text-xs">
                  1. Create payroll → 2. Select employees → 3. Check payroll → 4. Payroll Admin approval → 5. Final payroll run → 6. Record payment
                </div>
              </div>
            </div>
            {canRun && (
              <Dialog
                open={open}
                onOpenChange={(next) => {
                  setOpen(next);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                    <Play className="h-4 w-4" /> Create payroll
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Payroll Run</DialogTitle>
                    <DialogDescription>
                      Create the payroll period first. You will select employees and review their pay details in the next step.
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
                          placeholder={`${periodLabel(period)} Salary`}
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
                    <Field label="Pay from bank account" required>
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
                    <div className="border-primary/20 bg-primary/5 rounded-lg border p-3 text-xs sm:col-span-2">
                      After creating the run, select all employees or choose individuals. Review the register before running payroll.
                    </div>
                    {periodRun && (
                      <div className="border-primary/30 bg-primary/5 flex flex-col gap-2 rounded-lg border p-3 text-xs sm:col-span-2">
                        <span>
                          A {periodLabel(period)} run already exists: <b>{periodRun.id}</b> · {periodRun.status}.
                          Open it to continue this payroll instead of creating a duplicate.
                        </span>
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
                      {periodRun ? "Open existing run" : "Create payroll"}
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
                    "Frequency",
                    "Pay date",
                    "Bank account",
                    "Prepared by",
                    "Status",
                    "Action",
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
                    onClick={() => openRegister(r)}
                    className={cn(
                      "hover:bg-muted/30 cursor-pointer transition",
                      run?.id === r.id && "bg-primary/5",
                    )}
                  >
                    <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                    <td className="p-3 font-medium">{r.title}</td>
                    <td className="text-muted-foreground p-3">{periodLabel(r.period)}</td>
                    <td className="text-muted-foreground p-3">{r.frequency ?? "Monthly"}</td>
                    <td className="text-muted-foreground p-3">
                      <span className="whitespace-nowrap">{r.payDate}</span>
                    </td>
                    <td
                      className="text-muted-foreground max-w-[190px] truncate p-3 text-xs"
                      title={r.bankAccount}
                    >
                      {r.bankAccount}
                    </td>
                    <td className="text-muted-foreground p-3">{r.preparedBy.name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={runTone(r.status)}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRegister(r);
                        }}
                      >
                        {["Draft", "Checks Failed", "Checks Passed"].includes(r.status)
                          ? "View employees"
                          : "View register"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted-foreground p-8 text-center">
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
                  <ShieldCheck className="text-primary h-4 w-4" /> Payroll approval &amp; processing
                </div>
                {selectionEditable && canRun && (
                  <p className="text-muted-foreground rounded-lg border p-3 text-xs">
                    Select employees, review the payroll register, then run compliance checks. Submit it for Payroll Admin approval once all checks pass.
                  </p>
                )}
                {run.status === "Checks Passed" && canRun && (
                  warnings.some((w) => !w.acknowledged) && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        acknowledgeWarnings(run.id, me);
                        toast.success("Warnings acknowledged — submit the payroll for approval when ready.");
                      }}
                    >
                      <AlertTriangle className="h-4 w-4" /> Acknowledge{" "}
                      {warnings.filter((w) => !w.acknowledged).length} warning(s)
                    </Button>
                  )
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
                            placeholder="Approval remarks (optional for approval; required for reject or send-back)…"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              className="bg-gradient-emerald text-white"
                              data-testid="run-approve"
                              disabled={!attendanceReady}
                              onClick={handleApproval}
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
                {run.status === "Approved" && (
                  canProcess ? (
                    <div className="space-y-2">
                      <div className="border-primary/20 bg-primary/5 rounded-lg border p-3 text-xs">
                        Payroll Admin approved this run. Review the totals, then finalize payroll to lock calculations and generate payslips.
                      </div>
                      <Button className="bg-gradient-emerald w-full text-white" onClick={() => act(processRun(run.id, me))}>
                        <Play className="h-4 w-4" /> Finalize payroll &amp; generate payslips
                      </Button>
                    </div>
                  ) : (
                    <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
                      Approved by Payroll Admin. Waiting for an Accountant or authorized finance user to run final payroll.
                    </div>
                  )
                )}
                {false && run.status === "Processed" && canProcess && (
                  <div className="space-y-2">
                    <Input
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Bank transfer reference (UTR)"
                    />

                    <Button
                      className="bg-gradient-emerald w-full text-white"
                      disabled={!payRef.trim()}
                      onClick={() => {
                        act(markPaid(run.id, me, payRef.trim()));
                        setPayRef("");
                      }}
                    >
                      <Banknote className="h-4 w-4" /> Record salary payment
                    </Button>
                    <p className="text-muted-foreground text-[11px]">
                      Enter the transfer reference after salary has been credited to the selected employees.
                    </p>
                  </div>
                )}
                {false && run.status === "Paid" && (
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
                {(() => {
                  const checking =
                    lockVerification.loading || lockVerification.period !== run.period;
                  const verified = !checking && lockVerification.verified;
                  const passed = verified && lockVerification.locked;
                  const statusLabel = checking ? "CHECKING" : passed ? "PASS" : "ERROR";
                  return (
                    <div className="bg-background rounded-lg border p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">Attendance Lock Verification</div>
                        <Badge
                          variant="outline"
                          className={
                            checking
                              ? "border-border bg-muted text-muted-foreground"
                              : passed
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                          }
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                        <div>
                          <div className="text-muted-foreground">Attendance Month</div>
                          <div className="font-medium">{periodLabel(run.period)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Lock Status</div>
                          <div className="font-medium">
                            {checking
                              ? "Verifying with server…"
                              : !verified
                                ? "Not verified"
                                : passed
                                  ? "Locked"
                                  : "Not Locked"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Locked By</div>
                          <div className="font-medium">
                            {passed ? lockVerification.by || "—" : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Lock Date &amp; Time</div>
                          <div className="font-medium">
                            {passed ? formatLockTimestamp(lockVerification.on) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Employees Covered</div>
                          <div className="font-medium">
                            {lockVerification.employeesCovered ?? "—"}
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Link
                            href={buildHref({ to: "/org/attendance" })}
                            className="text-primary font-medium underline underline-offset-2"
                          >
                            View Attendance Register
                          </Link>
                        </div>
                      </div>
                      {!checking && !verified && (
                        <div className="text-destructive mt-2 text-xs">
                          {lockVerification.error ||
                            "Attendance lock could not be verified. Payroll approval and processing are blocked."}
                        </div>
                      )}
                      {verified && !lockVerification.summaryLoaded && (
                        <div className="text-destructive mt-2 text-xs">
                          Attendance summary could not be loaded. Re-run checks after the register
                          is available.
                        </div>
                      )}
                      {verified && !passed && (
                        <div className="text-destructive mt-2 text-xs">
                          HR must lock attendance for {periodLabel(run.period)} before payroll can
                          be approved or processed.
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                <div className="text-sm font-semibold">Payroll history</div>
                {false && <div className="space-y-2">
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
                </div>}
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

          <Card id="salary-register" className="shadow-card">
            <CardContent className="p-6">
              {!selectionEditable && (
                <div className="border-gold/40 bg-gold/10 text-muted-foreground mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs">
                  <Lock className="text-gold mt-0.5 h-4 w-4 shrink-0" />
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      This run is <b>{run.status}</b>, so employee selection is locked at this stage.
                    </span>
                    {canRun && ["Pending Approval", "Approved"].includes(run.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const result = restartRunForNewFlow(run.id, me);
                          act(result);
                          if (result.ok) setSelectedEmployeeIds(result.employeeIds);
                        }}
                      >
                        Move to new payroll flow
                      </Button>
                    )}
                  </span>
                </div>
              )}
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold">Salary Register · {periodLabel(run.period)}</div>
                  <div className="text-muted-foreground text-xs">
                    Attendance pattern → LOP → earned gross → state-aware statutory deductions.
                    Review each employee’s calculated salary, resolve check errors, then submit the register for Payroll Admin approval.
                    Click a row to review the payslip calculation.
                  </div>
                  {employeesError && (
                    <div className="text-destructive mt-1 text-xs">
                      Employee API: {employeesError}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectionEditable && (
                    <Badge variant="outline">
                      {selectedEmployeeIds.length} / {registerLines.length} employees selected
                    </Badge>
                  )}
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
                  {selectionEditable && canRun && (
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      disabled={!selectedEmployeeIds.length}
                      onClick={runSelectedPayroll}
                    >
                      <Play className="h-4 w-4" />
                      {run.status === "Checks Passed" && selectionMatchesRun
                        ? "Submit for Payroll Admin approval"
                        : "Run compliance checks"}
                    </Button>
                  )}
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
                      ].map((h) => (
                        <th key={h} className="p-3 text-left whitespace-nowrap">
                          {h === "Employee" && selectionEditable ? (
                            <span className="flex items-center gap-2">
                              <Checkbox
                                checked={allEmployeesSelected}
                                aria-label="Select all employees"
                                onCheckedChange={(checked) =>
                                  setSelectedEmployeeIds(
                                    checked ? registerLines.map((line) => line.empId) : [],
                                  )
                                }
                              />
                              Select all · Employee
                            </span>
                          ) : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {registerLines.length === 0 && (
                      <tr>
                        <td colSpan={14} className="text-muted-foreground p-8 text-center">
                          No active employees are available for this payroll period.
                        </td>
                      </tr>
                    )}
                    {rows.map((l) => (
                      <tr
                        key={l.empId}
                        className={cn(l.hasPayslip && "hover:bg-muted/30 cursor-pointer")}
                        onClick={() => l.hasPayslip && setSlip(l)}
                      >
                        <td className="p-3 font-medium">
                          <span className="flex items-center gap-2">
                            {selectionEditable && (
                              <Checkbox
                                checked={selectedEmployeeIds.includes(l.empId)}
                                aria-label={`Select ${l.name}`}
                                onClick={(event) => event.stopPropagation()}
                                onCheckedChange={(checked) =>
                                  setSelectedEmployeeIds((current) =>
                                    checked
                                      ? [...new Set([...current, l.empId])]
                                      : current.filter((id) => id !== l.empId),
                                  )
                                }
                              />
                            )}
                            <span>
                              {l.name}
                              <span className="text-muted-foreground block font-mono text-xs">
                                {l.empId} · {l.dept}
                                {l.wageRoll ? " · wage roll" : ""}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="text-muted-foreground p-3">{l.state}</td>
                        <td className="text-muted-foreground p-3 text-xs">
                          {l.lop?.pattern?.name ?? "—"}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip ? (
                            <>
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
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">No slip in run</span>
                          )}
                        </td>
                        <td className="text-muted-foreground p-3 tabular-nums">
                          {l.hasPayslip ? inr(l.structureGross) : "—"}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip ? inr(l.earnedGross) : "—"}
                          {l.hasPayslip && l.lop.lopAmount > 0 && (
                            <div className="text-destructive text-[11px]">
                              − {inr(l.lop.lopAmount)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip && l.pf.applicable ? (
                            inr(l.pf.employee + l.pf.vpf)
                          ) : l.hasPayslip ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            "—"
                          )}
                          {l.hasPayslip && l.pf.vpf > 0 && (
                            <div className="text-muted-foreground text-[11px]">incl. VPF</div>
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip && l.esi.applicable ? (
                            inr(l.esi.employee)
                          ) : l.hasPayslip ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip && l.pt ? inr(l.pt) : "—"}
                        </td>
                        <td className="p-3 tabular-nums">
                          {l.hasPayslip && l.tds.monthly ? (
                            inr(l.tds.monthly)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-destructive p-3 tabular-nums">
                          {l.hasPayslip ? `− ${inr(l.totalDeductions)}` : "—"}
                        </td>
                        <td
                          className={cn(
                            "p-3 font-semibold tabular-nums",
                            l.hasPayslip && l.net < 0 ? "text-destructive" : "text-primary",
                          )}
                        >
                          {l.hasPayslip ? inr(l.net) : "—"}
                        </td>
                        <td className="p-3">
                          {(() => {
                            if (!l.hasPayslip)
                              return (
                                <span className="text-muted-foreground text-xs">Not in run</span>
                              );
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
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {run.lines.length > 0 && <p className="text-muted-foreground mt-3 flex items-center gap-1 text-[11px]">
                <Info className="h-3 w-3" /> Employer legs (EPF 3.67 %, EPS 8.33 %, EDLI, admin, ESI
                3.25 %, employer NPS, LWF) are in the exported register and the payslip working —
                they are cost, not deductions.
              </p>}
            </CardContent>
          </Card>
          {run.status === "Processed" && canProcess && (
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Banknote className="text-primary h-4 w-4" /> Confirm salary payment
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Transfer salaries from <b>{run.bankAccount}</b> through your bank. After the transfer, enter its UTR here to mark this run as paid. This records the payment; it does not send money.
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:max-w-lg">
                  <Input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Bank transfer reference (UTR)"
                  />
                  <Button
                    className="bg-gradient-emerald shrink-0 text-white"
                    disabled={!payRef.trim()}
                    onClick={() => {
                      act(markPaid(run.id, me, payRef.trim()));
                      setPayRef("");
                    }}
                  >
                    Record payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {run.status === "Paid" && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-2 p-5 text-sm">
                <CheckCircle2 className="text-primary h-4 w-4" /> Salary payment recorded on {run.paidOn} · {run.paymentRef}
              </CardContent>
            </Card>
          )}
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
