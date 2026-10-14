import { useMemo, useState } from "react";
import { FileText, Download, Calendar, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { inr } from "@/lib/store";
import {
  computePayslipFor,
  payslipsFor,
  useHydrated,
  usePayrollRuns,
} from "@/features/payroll/data/payroll-engine";
import {
  workConfigOf,
  usePatterns,
  effectiveWorkday,
} from "@/features/attendance/data/attendance-pattern";
import { PayslipBreakdown } from "@/features/payroll/components/PayslipBreakdown";
import { downloadPayslip } from "@/features/payroll/components/PayslipsTab";

/** Payslips are computed from persisted stores — render them after hydration so the server HTML matches. */
function EmpPayslipsPage() {
  return useHydrated() ? (
    <EmpPayslips />
  ) : (
    <div className="text-muted-foreground p-10 text-center text-sm">Loading payslips…</div>
  );
}

function EmpPayslips() {
  const me = useCurrentEmployee();
  const p = getEmployeeProfile(me.id);
  const runs = usePayrollRuns();
  const patterns = usePatterns();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState(null);

  /** Current structure, shown as it would compute this month before attendance closes. */
  const current = useMemo(() => {
    const d = new Date();
    return computePayslipFor(
      me.id,
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
    // `runs` is the trigger: payslips are read from the payroll store, so a new or approved run must recompute them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, runs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => payslipsFor(me.id), [me.id, runs]);
  const slips = history.filter(
    ({ run }) => (!from || run.period >= from.slice(0, 7)) && (!to || run.period <= to.slice(0, 7)),
  );
  const paidTotal = slips.reduce((s, x) => s + x.slip.net, 0);
  const pattern = patterns.find((x) => x.id === workConfigOf(me.id).patternId);
  const wd = effectiveWorkday(me.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="text-primary h-6 w-6" /> Payslips
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your salary structure, how attendance maps to pay, and every payslip issued since{" "}
          {p.job.dateOfJoining}.
        </p>
      </div>

      {current && (
        <Card className="shadow-card overflow-hidden">
          <div className="bg-gradient-emerald px-5 py-4 text-white">
            <div className="text-gold text-[11px] font-semibold tracking-widest uppercase">
              Salary Structure
            </div>
            <div className="mt-1 text-lg font-bold">
              {me.name} · {me.role}
            </div>
            <div className="text-xs text-white/70">
              {me.id} · {me.dept} · {me.branch} ({current.state}) · {pattern?.name} ·{" "}
              {wd.daysPerWeek} days / {wd.hoursPerDay} h
            </div>
          </div>
          <CardContent className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Annual CTC", inr(p.payroll.ctc)],
                ["Monthly gross", inr(current.structureGross)],
                ["Statutory + tax (this month)", inr(current.totalDeductions)],
                ["Net (projected)", inr(current.net)],
              ].map(([k, v]) => (
                <div key={k} className="border-border bg-muted/30 rounded-xl border p-4">
                  <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    {k}
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight">{v}</div>
                </div>
              ))}
            </div>
            <PayslipBreakdown slip={current} />
            <div className="border-border rounded-xl border p-4">
              <h2 className="mb-3 text-sm font-semibold">Bank &amp; statutory</h2>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {[
                  ["Bank", `${current.bank.bankName} · ${current.bank.accountNo}`],
                  ["IFSC", current.bank.ifsc],
                  ["Payment mode", current.bank.mode],
                  ["PAN", current.statutory.pan],
                  ["UAN", current.statutory.uan],
                  ["PF number", current.statutory.pfNo],
                  ["ESI number", current.statutory.esiNo || "Not applicable"],
                  ["Tax regime", current.tds.regime],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="border-border/60 flex justify-between border-b py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-right font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Calendar className="text-primary h-4 w-4" /> Payslip history
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {slips.length} payslips · net paid {inr(paidTotal)} · issued only for processed
                payroll runs
              </p>
            </div>
            <div className="ml-auto flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
              <div className="w-full min-w-0 space-y-1 sm:w-auto">
                <Label htmlFor="from" className="text-xs">
                  From
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 w-full sm:w-[150px]"
                />
              </div>
              <div className="w-full min-w-0 space-y-1 sm:w-auto">
                <Label htmlFor="to" className="text-xs">
                  To
                </Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 w-full sm:w-[150px]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {slips.map(({ run, slip }) => (
              <div
                key={run.id}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="text-sm font-medium">{slip.periodLabel}</div>
                  <div className="text-muted-foreground text-xs">
                    Earned {inr(slip.earnedGross)}
                    {slip.lop.lopDays
                      ? ` (${slip.lop.lopDays} LOP day${slip.lop.lopDays > 1 ? "s" : ""})`
                      : ""}{" "}
                    · Deductions {inr(slip.totalDeductions)} · paid{" "}
                    <span className="whitespace-nowrap">{run.paidOn ?? "pending"}</span>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">{inr(slip.net)}</span>
                  <Badge
                    variant="outline"
                    className={
                      run.status === "Paid"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-gold/40 bg-gold/10 text-gold"
                    }
                  >
                    {run.status === "Paid" ? "Paid" : "Processing"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setView(slip)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ok = downloadPayslip(
                        slip,
                        run.status === "Paid" ? "Paid" : "Processing",
                      );
                      toast[ok ? "success" : "error"](
                        ok
                          ? `Payslip for ${slip.periodLabel} ready — save as PDF`
                          : "Allow pop-ups to download the payslip",
                      );
                    }}
                  >
                    <Download className="h-4 w-4" /> Payslip
                  </Button>
                </div>
              </div>
            ))}
            {slips.length === 0 && (
              <p className="text-muted-foreground text-sm">No payslips in this date range.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payslip · {view?.periodLabel}</DialogTitle>
            <DialogDescription>
              {view?.name} · {view?.empId}
            </DialogDescription>
          </DialogHeader>
          {view && <PayslipBreakdown slip={view} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmpPayslipsPage;
