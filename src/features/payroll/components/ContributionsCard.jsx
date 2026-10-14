import { useState } from "react";
import { PiggyBank, Send, Save } from "lucide-react";
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
import { inr } from "@/lib/store";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import {
  CURRENT_FY,
  emptyDeclaration,
  saveContribution,
  useContributions,
} from "@/features/payroll/data/contributions-data";
import { useStatutoryConfig } from "@/features/payroll/data/statutory-data";

export function ContributionsCard({ empId, empName }) {
  const all = useContributions();
  const saved =
    all.find((c) => c.empId === empId && c.fy === CURRENT_FY) ?? emptyDeclaration(empId);
  const [d, setD] = useState(saved);
  const [editing, setEditing] = useState(saved.status === "Draft");
  const cfg = useStatutoryConfig();
  const basic =
    getEmployeeProfile(empId).payroll.earnings.find((e) => /basic/i.test(e.label))?.amount ?? 0;
  const locked = saved.status === "Locked";
  const vpfMonthly = d.vpf.enabled
    ? d.vpf.mode === "Fixed amount"
      ? d.vpf.value
      : Math.round((basic * d.vpf.value) / 100)
    : 0;
  const npsEe = d.nps.enabled ? Math.round((basic * d.nps.employeePct) / 100) : 0;
  const npsEr = d.nps.enabled ? Math.round((basic * d.nps.employerPct) / 100) : 0;
  const statutoryPf = Math.round(
    (Math.min(basic, cfg.pf.restrictToCeiling ? cfg.pf.wageCeiling : basic) * cfg.pf.employeeRate) /
      100,
  );
  const pctOk = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
  const valid =
    (!d.vpf.enabled ||
      (d.vpf.value > 0 &&
        vpfMonthly <= basic &&
        (d.vpf.mode === "Fixed amount" || pctOk(d.vpf.value)))) &&
    (!d.nps.enabled ||
      (/^\d{12}$/.test(d.nps.pran) &&
        pctOk(d.nps.employeePct) &&
        pctOk(d.nps.employerPct) &&
        d.nps.employeePct + d.nps.employerPct > 0));
  const tone =
    saved.status === "Approved" || saved.status === "Locked"
      ? "border-primary/30 bg-primary/10 text-primary"
      : saved.status === "Submitted"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

  const submit = (status) => {
    const next = saveContribution(
      { ...d, status },
      empName,
      status === "Submitted" ? "Submitted for HR approval" : "Draft saved",
    );
    setD(next);
    setEditing(status === "Draft");
    toast.success(
      status === "Submitted"
        ? "Declaration submitted — HR approval applies it from the next payroll"
        : "Draft saved",
    );
  };

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <PiggyBank className="text-primary h-4 w-4" /> Voluntary contributions — VPF & NPS ·{" "}
              {CURRENT_FY}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              VPF tops up your statutory PF ({cfg.pf.employeeRate} % = {inr(statutoryPf)}/month) in
              the same EPF account. NPS is a separate retirement contribution; the employer share is
              tax-free under 80CCD(2). Both need HR approval before they appear on your payslip.
            </p>
          </div>
          <Badge variant="outline" className={tone}>
            {saved.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Voluntary Provident Fund</div>
              <Switch
                checked={d.vpf.enabled}
                disabled={!editing || locked}
                onCheckedChange={(v) => setD({ ...d, vpf: { ...d.vpf, enabled: v } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Mode</Label>
                <Select
                  value={d.vpf.mode}
                  disabled={!editing || !d.vpf.enabled}
                  onValueChange={(v) =>
                    setD({
                      ...d,
                      vpf: { ...d.vpf, mode: v },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Percent of Basic">% of Basic</SelectItem>
                    <SelectItem value="Fixed amount">Fixed ₹&nbsp;/ month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  {d.vpf.mode === "Fixed amount" ? "Amount (₹)" : "Percent"}
                </Label>
                <Input
                  type="number"
                  disabled={!editing || !d.vpf.enabled}
                  value={d.vpf.value}
                  onChange={(e) => setD({ ...d, vpf: { ...d.vpf, value: Number(e.target.value) } })}
                />
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              Monthly VPF: <b className="text-foreground">{inr(vpfMonthly)}</b> · capped at 100 % of
              Basic ({inr(basic)}) · builds retirement corpus; not tax-deductible under the new
              regime.
            </div>
          </div>
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">National Pension System (corporate)</div>
              <Switch
                checked={d.nps.enabled}
                disabled={!editing || locked}
                onCheckedChange={(v) => setD({ ...d, nps: { ...d.nps, enabled: v } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">PRAN (12 digits)</Label>
              <Input
                disabled={!editing || !d.nps.enabled}
                value={d.nps.pran}
                onChange={(e) =>
                  setD({
                    ...d,
                    nps: { ...d.nps, pran: e.target.value.replace(/\D/g, "").slice(0, 12) },
                  })
                }
                placeholder="110012345678"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Employee % of Basic</Label>
                <Input
                  type="number"
                  disabled={!editing || !d.nps.enabled}
                  value={d.nps.employeePct}
                  onChange={(e) =>
                    setD({ ...d, nps: { ...d.nps, employeePct: Number(e.target.value) } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  Employer % of Basic (≤ {cfg.tds.npsEmployerDeductionCapNewPct}% deductible)
                </Label>
                <Input
                  type="number"
                  disabled={!editing || !d.nps.enabled}
                  value={d.nps.employerPct}
                  onChange={(e) =>
                    setD({ ...d, nps: { ...d.nps, employerPct: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              Monthly: employee <b className="text-foreground">{inr(npsEe)}</b> (deducted) ·
              employer <b className="text-foreground">{inr(npsEr)}</b> (CTC, 80CCD(2)).
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing && !locked ? (
            <>
              <Button size="sm" variant="outline" onClick={() => submit("Draft")}>
                <Save className="h-4 w-4" /> Save draft
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                disabled={!valid}
                onClick={() => submit("Submitted")}
              >
                <Send className="h-4 w-4" /> Submit for HR approval
              </Button>
            </>
          ) : !locked ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setD({ ...saved, status: "Draft" });
              }}
            >
              Revise declaration
            </Button>
          ) : null}
          {!locked && saved.approved && !(saved.status === "Approved") && (
            <span className="text-muted-foreground text-xs">
              Payroll keeps applying your last approved VPF / NPS until HR approves this revision.
            </span>
          )}
          {locked ? (
            <span className="text-muted-foreground text-xs">Locked for the financial year.</span>
          ) : null}
          {saved.history[0] && (
            <span className="text-muted-foreground ml-auto text-xs">
              {saved.history[0].action} · {saved.history[0].by} · {saved.history[0].at}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
