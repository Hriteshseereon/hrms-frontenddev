// Loans & Salary Advances — shared by Finance (HR/Finance view) and the employee self-service page.
// Rules (Master Data → F&F / Loan policy): loan ≤ 3 × monthly gross, tenure ≤ 12 months, salary advance ≤ 1 month gross
// recovered from next month's salary (one-time or converted to EMI). EMIs post automatically to payroll; any balance is recovered from F&F.
import { useMemo, useState } from "react";
import Link from "@/lib/router";
import { Plus, Wallet, FileText, Download, CheckCircle2, XCircle, Banknote } from "lucide-react";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { getEmployeeProfile, useDirectory } from "@/features/employees/data/employee-directory";
import { useScopedEmployees, useScopedIds } from "@/features/employees/components/CasePieces";
import {
  LOAN_RULES,
  applyLoan,
  buildSchedule,
  canDecideLoan,
  decideLoan,
  loanStageOf,
  disburseLoan,
  loanTone,
  outstandingOf,
  recordEmi,
  useLoans,
} from "@/features/payroll/data/loans-data";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { ChartCard, DonutChart } from "@/features/dashboard/components/Charts";

export function LoansTab({ mode = "finance" }) {
  const me = useCurrentUser();
  useDirectory();
  const all = useLoans();
  // Finance view is tenant-scoped to the active entity's employees (loans carry no orgId of their own).
  const scopedIds = useScopedIds();
  const rows =
    mode === "employee"
      ? all.filter((l) => l.empId === me.id)
      : all.filter((l) => scopedIds.has(l.empId));
  const canApprove =
    mode === "finance" &&
    (can(me.role, "payroll.approve") ||
      me.role === "HR" ||
      me.role === "CHRO" ||
      me.role === "CFO" ||
      me.role === "Admin");
  const [open, setOpen] = useState(false);
  // Keep only the id so the schedule dialog always shows the live record (status / recoveries update in place).
  const [viewId, setViewId] = useState(null);
  const view = all.find((l) => l.id === viewId) ?? null;
  const setView = (l) => setViewId(l?.id ?? null);
  const rejectNote = "";
  // How a manual recovery was received — only an actual payroll deduction may be recorded as "Payroll"
  // (a payroll-recorded instalment is still carried on that month's payslip).
  const [recVia, setRecVia] = useState("Cash");
  const outstanding = rows
    .filter((l) => l.status === "Disbursed")
    .reduce((t, l) => t + outstandingOf(l), 0);
  const byStatus = [
    "Applied",
    "HR approved",
    "Approved",
    "Disbursed",
    "Closed",
    "Rejected",
    "Cancelled",
  ]
    .map((s) => ({ name: s, value: rows.filter((l) => l.status === s).length }))
    .filter((d) => d.value);
  const act = (r) => toast[r.ok ? "success" : "error"](r.message);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="text-primary h-5 w-5" /> Loans &amp; Salary Advances
          </h2>
          <p className="text-muted-foreground text-sm">
            Loan ≤ {LOAN_RULES.maxGrossMultiple} × gross, tenure ≤ {LOAN_RULES.maxTenureMonths}{" "}
            months · advance ≤ 1 month gross, recovered from next month's salary · EMI posts to
            payroll automatically; balance recovered from F&amp;F.
          </p>
        </div>
        <div className="flex gap-2">
          {mode === "finance" && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/org/masters">
                <FileText className="h-4 w-4" /> Form templates
              </Link>
            </Button>
          )}
          <Button
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />{" "}
            {mode === "employee" ? "Apply for loan / advance" : "New application"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Applications", rows.length, ""],
          [
            "Awaiting approval",
            rows.filter((l) => l.status === "Applied" || l.status === "HR approved").length,
            "text-gold",
          ],
          ["Under recovery", rows.filter((l) => l.status === "Disbursed").length, "text-primary"],
          ["Outstanding principal", inr(outstanding), ""],
        ].map(([k, v, c]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className={cn("text-2xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Ref",
                    "Employee",
                    "Type",
                    "Amount",
                    "EMI × tenure",
                    "First EMI",
                    "Outstanding",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted-foreground p-8 text-center">
                      No loans or advances yet.
                    </td>
                  </tr>
                )}
                {rows.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{l.id}</td>
                    <td className="p-3 font-medium">
                      {l.employee}
                      <div className="text-muted-foreground text-xs">{l.empId}</div>
                    </td>
                    <td className="p-3">{l.kind}</td>
                    <td className="p-3">{inr(l.amount)}</td>
                    <td className="p-3">
                      {inr(l.emi)} × {l.tenureMonths}
                    </td>
                    <td className="p-3">{l.firstEmiPeriod}</td>
                    <td className="p-3">{inr(outstandingOf(l))}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={loanTone(l.status)}>
                        {l.status}
                      </Badge>
                      {(l.approvedBy || l.rejectedBy) && (
                        <div className="text-muted-foreground mt-0.5 text-[11px]">
                          {l.status === "Rejected"
                            ? `by ${l.rejectedBy ?? l.approvedBy}`
                            : `by ${l.approvedBy}`}
                          {l.approvedOn ? ` · ${l.approvedOn}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setView(l)}>
                        Schedule
                      </Button>
                      {mode === "finance" && loanStageOf(l) && !canDecideLoan(l, me) && (
                        <span className="text-muted-foreground px-2 text-[11px]">
                          Awaiting {loanStageOf(l).stage}
                        </span>
                      )}
                      {mode === "finance" && canDecideLoan(l, me) && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary h-7"
                            onClick={() => act(decideLoan(l.id, me, true))}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-7"
                            onClick={() => {
                              const n = rejectNote || "Does not meet policy";
                              act(decideLoan(l.id, me, false, n));
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {canApprove && l.status === "Approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary h-7"
                          onClick={() => act(disburseLoan(l.id, me))}
                        >
                          <Banknote className="h-3.5 w-3.5" /> Disburse
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <ChartCard
          title="Applications by status"
          subtitle={mode === "employee" ? "Your loans & advances" : "All employees"}
        >
          <DonutChart data={byStatus} height={200} />
        </ChartCard>
      </div>

      <ApplyDialog open={open} onClose={() => setOpen(false)} mode={mode} />

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {view?.id} · {view?.employee}
            </DialogTitle>
            <DialogDescription>
              {view?.kind} of {view ? inr(view.amount) : ""} · {view?.purpose} · applied{" "}
              {view?.appliedOn}
              {view?.approvedBy ? ` · approved by ${view.approvedBy}` : ""}
              {view?.disbursedOn ? ` · disbursed ${view.disbursedOn}` : ""}
            </DialogDescription>
          </DialogHeader>
          {view && (
            <>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const t = templatesOf("Loan / Advance Form")[0];
                    if (!t) {
                      toast.error("No Loan / Advance form template in Doc Master");
                      return;
                    }
                    renderTemplate(
                      t,
                      {
                        employee_name: view.employee,
                        employee_id: view.empId,
                        loan_type: view.kind,
                        amount: inr(view.amount),
                        tenure: String(view.tenureMonths),
                        emi: inr(view.emi),
                        purpose: view.purpose,
                        first_emi: view.firstEmiPeriod,
                        date: new Date().toLocaleDateString("en-IN"),
                      },
                      {
                        columns: ["Period", "EMI", "Principal", "Balance"],
                        rows: view.schedule.map((s) => [
                          s.period,
                          inr(s.emi),
                          inr(s.principal),
                          inr(s.balance),
                        ]),
                      },
                    );
                  }}
                >
                  <Download className="h-4 w-4" /> Loan form / sanction letter (Doc Master)
                </Button>
              </div>
              {canApprove && view.status === "Disbursed" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Manual recovery received via</span>
                  <Select value={recVia} onValueChange={setRecVia}>
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">
                    Payroll deductions post automatically when the run is paid.
                  </span>
                </div>
              )}
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                  <tr>
                    {["Period", "EMI", "Principal", "Interest", "Balance", "Recovered via", ""].map(
                      (h) => (
                        <th key={h} className="p-2 text-left">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {view.schedule.map((s) => (
                    <tr key={s.period}>
                      <td className="p-2 font-mono">{s.period}</td>
                      <td className="p-2">{inr(s.emi)}</td>
                      <td className="p-2">{inr(s.principal)}</td>
                      <td className="p-2">{inr(s.interest)}</td>
                      <td className="p-2">{inr(s.balance)}</td>
                      <td className="p-2">
                        {s.paid ? (
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary"
                          >
                            {s.via}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Due</span>
                        )}
                      </td>
                      <td className="p-2">
                        {canApprove && view.status === "Disbursed" && !s.paid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => {
                              recordEmi(view.id, s.period, recVia, me);
                              toast.success(`EMI ${s.period} recorded as recovered via ${recVia}`);
                            }}
                          >
                            Mark recovered
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-muted-foreground space-y-1 text-xs">
                {view.history.map((h, i) => (
                  <div key={i}>
                    {h.at} · {h.by} — {h.action}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplyDialog({ open, onClose, mode }) {
  const me = useCurrentUser();
  // Only the active entity's people (the full directory listed every entity's employees).
  const emps = useScopedEmployees();
  const [empId, setEmpId] = useState(mode === "employee" ? me.id : "");
  const [kind, setKind] = useState("Loan");
  const [amount, setAmount] = useState(100000);
  const [tenure, setTenure] = useState(6);
  const [purpose, setPurpose] = useState("");
  const [advanceMode, setAdvanceMode] = useState("One-time");
  const id = mode === "employee" ? me.id : empId;
  const gross = useMemo(() => (id ? getEmployeeProfile(id).payroll.monthlyGross : 0), [id]);
  const maxAmt = kind === "Loan" ? gross * LOAN_RULES.maxGrossMultiple : gross;
  const effTenure =
    kind === "Salary advance" ? (advanceMode === "One-time" ? 1 : Math.min(tenure, 3)) : tenure;
  const d = new Date();
  const first = `${d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()}-${String(((d.getMonth() + 1) % 12) + 1).padStart(2, "0")}`;
  const preview =
    amount > 0 && effTenure > 0
      ? buildSchedule(amount, effTenure, LOAN_RULES.interestPct, first)
      : [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Loan / salary advance application</DialogTitle>
          <DialogDescription>
            Form fields come from the Doc Master "Loan / Advance Form" template. Policy limits are
            validated live.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mode === "finance" && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Employee</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee" />
                </SelectTrigger>
                <SelectContent>
                  {emps.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.id} · {e.dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Loan">
                  Loan (≤ {LOAN_RULES.maxGrossMultiple} × gross, ≤ {LOAN_RULES.maxTenureMonths}{" "}
                  months)
                </SelectItem>
                <SelectItem value="Salary advance">
                  Salary advance (≤ 1 month gross, next month)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount (₹) · max {inr(maxAmt)}</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(+e.target.value)}
              className={cn(amount > maxAmt && "border-destructive")}
            />
          </div>
          {kind === "Loan" ? (
            <div className="space-y-1">
              <Label className="text-xs">Tenure (months)</Label>
              <Input
                type="number"
                min={1}
                max={LOAN_RULES.maxTenureMonths}
                value={tenure}
                onChange={(e) => setTenure(+e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Recovery</Label>
              <Select value={advanceMode} onValueChange={(v) => setAdvanceMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="One-time">One-time from next month's salary</SelectItem>
                  <SelectItem value="EMI">EMI over up to 3 months</SelectItem>
                </SelectContent>
              </Select>
              {advanceMode === "EMI" && (
                <Input
                  type="number"
                  min={2}
                  max={3}
                  value={Math.min(tenure, 3)}
                  onChange={(e) => setTenure(+e.target.value)}
                />
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Monthly gross (from salary structure)</Label>
            <div className="border-border bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm">
              {inr(gross)}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Purpose</Label>
            <Textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Medical emergency / home renovation / education fee"
            />
          </div>
        </div>
        {preview.length > 0 && (
          <div className="border-border rounded-lg border p-3 text-xs">
            <div className="mb-1 font-medium">
              Recovery schedule preview · EMI {inr(preview[0].emi)} × {effTenure} from {first} (
              {LOAN_RULES.interestPct} % interest)
            </div>
            <div className="flex flex-wrap gap-1">
              {preview.map((s) => (
                <Badge key={s.period} variant="outline">
                  {s.period} · {inr(s.emi)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!id || !purpose.trim()}
            onClick={() => {
              const e = emps.find((x) => x.id === id);
              const r = applyLoan(
                {
                  empId: id,
                  employee: e?.name ?? me.name,
                  kind,
                  amount,
                  tenureMonths: effTenure,
                  purpose,
                  monthlyGross: gross,
                },
                me,
              );
              toast[r.ok ? "success" : "error"](r.message);
              if (r.ok) onClose();
            }}
          >
            Submit application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
