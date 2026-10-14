import { Check, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";

/** Generic horizontal stage tracker — same visual as the Exit / Appraisal steppers. */
export function WorkflowStepper({ steps, active, failed, title, badge }) {
  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-4">
      {(title || badge) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {badge}
        </div>
      )}
      <div className="steps-scroll flex min-w-0 items-start">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={label} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-full flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border",
                    )}
                  />

                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? failed
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : current && failed ? "!" : i + 1}
                  </div>
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === steps.length - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-border",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    current || done ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v, strong, muted }) {
  return (
    <div
      className={cn(
        "border-border/60 flex justify-between gap-4 border-b py-1.5 text-sm",
        strong && "border-b-0 pt-2 font-semibold",
      )}
    >
      <span className={cn(muted ? "text-muted-foreground" : strong ? "" : "text-muted-foreground")}>
        {k}
      </span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}

export function LopExplainer({ slip }) {
  const { lop } = slip;
  const a = lop.attendance;
  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-sm",
        lop.lopDays > 0
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        {lop.lopDays > 0 ? (
          <AlertTriangle className="text-destructive h-4 w-4" />
        ) : (
          <Check className="text-primary h-4 w-4" />
        )}
        Attendance → Pay · {lop.pattern.name}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Days in month</span>
          <div className="font-semibold">{a.daysInMonth}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Present</span>
          <div className="font-semibold">{a.present}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Paid leave</span>
          <div className="font-semibold">{a.paidLeave}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Absent</span>
          <div className="font-semibold">{a.absent}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Weekly offs</span>
          <div className="font-semibold">{a.weeklyOffs}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Pattern paid days</span>
          <div className="font-semibold">{lop.pattern.paidLeaveDays}</div>
        </div>
        <div>
          <span className="text-muted-foreground">LOP days</span>
          <div className={cn("font-semibold", lop.lopDays > 0 && "text-destructive")}>
            {lop.lopDays}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Payable days</span>
          <div className="font-semibold">
            {lop.payableDays} / {lop.pattern.workingDays}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {lop.explanation} Source: {a.source}
        {a.locked ? " · locked" : " · not locked"}.
      </p>
    </div>
  );
}

export function PayslipBreakdown({ slip, showStatutory = true }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Structure gross", inr(slip.structureGross)],
          ["Loss of pay", slip.lop.lopAmount ? `− ${inr(slip.lop.lopAmount)}` : "—"],
          ["Total deductions", inr(slip.totalDeductions)],
          ["Net pay", inr(slip.net)],
        ].map(([k, v], i) => (
          <div
            key={k}
            className={cn(
              "border-border bg-muted/30 rounded-xl border p-3",
              i === 3 && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              {k}
            </div>
            <div
              className={cn(
                "mt-1 text-lg font-bold tracking-tight tabular-nums",
                i === 3 && "text-primary",
              )}
            >
              {v}
            </div>
          </div>
        ))}
      </div>

      <LopExplainer slip={slip} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Earnings</h3>
          {slip.earnings.map((e) => (
            <Row key={e.label} k={e.note ? `${e.label} (${e.note})` : e.label} v={inr(e.amount)} />
          ))}
          <Row k="Gross earned" v={inr(slip.earnedGross)} strong />
        </div>
        <div className="border-border rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Deductions</h3>
          {slip.deductions.map((d) => (
            <Row key={d.label} k={d.label} v={inr(d.amount)} />
          ))}
          {slip.deductions.length === 0 && (
            <div className="text-muted-foreground py-2 text-xs">No deductions this month.</div>
          )}
          <Row k="Total deductions" v={inr(slip.totalDeductions)} strong />
        </div>
      </div>

      {showStatutory && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border-border rounded-xl border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Provident Fund</h3>
              <Badge
                variant="outline"
                className={
                  slip.pf.applicable
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                }
              >
                {slip.pf.applicable ? "Member" : "Not applicable"}
              </Badge>
            </div>
            <Row k="EPF wages" v={inr(slip.pf.wages)} />
            <Row k="Employee 12%" v={inr(slip.pf.employee)} />
            {slip.pf.vpf > 0 && <Row k="VPF" v={inr(slip.pf.vpf)} />}
            <Row k="Employer EPF (3.67%)" v={inr(slip.pf.employerEpf)} muted />
            <Row k="Employer EPS (8.33%)" v={inr(slip.pf.employerEps)} muted />
            <Row k="EDLI 0.5% + Admin 0.5%" v={inr(slip.pf.edli + slip.pf.admin)} muted />
            <Row k="NCP days (ECR)" v={String(slip.pf.ncpDays)} muted />
            <p className="text-muted-foreground mt-2 flex items-start gap-1 text-[11px]">
              <Info className="mt-0.5 h-3 w-3" />
              {slip.pf.reason}
            </p>
          </div>
          <div className="border-border rounded-xl border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">ESI · State levies</h3>
              <Badge
                variant="outline"
                className={
                  slip.esi.applicable
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                }
              >
                {slip.esi.applicable ? "Covered" : "Not covered"}
              </Badge>
            </div>
            <Row k="ESI wages" v={inr(slip.esi.wages)} />
            <Row k="Employee 0.75%" v={inr(slip.esi.employee)} />
            <Row k="Employer 3.25%" v={inr(slip.esi.employer)} muted />
            <Row k={`Professional Tax · ${slip.state}`} v={inr(slip.pt)} />
            <Row
              k={`LWF · ${slip.state} (EE / ER)`}
              v={`${inr(slip.lwf.employee)} / ${inr(slip.lwf.employer)}`}
            />

            {slip.nps.employee + slip.nps.employer > 0 && (
              <Row
                k={`NPS (EE / ER) · ${slip.nps.pran}`}
                v={`${inr(slip.nps.employee)} / ${inr(slip.nps.employer)}`}
              />
            )}
            <p className="text-muted-foreground mt-2 flex items-start gap-1 text-[11px]">
              <Info className="mt-0.5 h-3 w-3" />
              {slip.esi.reason} · contribution period {slip.esi.period}.
            </p>
          </div>
          <div className="border-border rounded-xl border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">TDS working</h3>
              <Badge variant="outline">{slip.tds.regime}</Badge>
            </div>
            <Row k="Projected annual gross" v={inr(slip.tds.annualGross)} />
            <Row k="Exemptions" v={`− ${inr(slip.tds.exemptions)}`} />
            <Row k="Standard deduction" v={`− ${inr(slip.tds.standardDeduction)}`} />
            <Row k="Chapter VI-A" v={`− ${inr(slip.tds.chapterVia)}`} />
            <Row k="Taxable income" v={inr(slip.tds.taxable)} strong />
            <Row k="Slab tax" v={inr(slip.tds.slab)} />
            <Row k="Rebate 87A" v={`− ${inr(slip.tds.rebate)}`} />
            {(slip.tds.surcharge ?? 0) > 0 && <Row k="Surcharge" v={inr(slip.tds.surcharge)} />}
            <Row k="Cess 4%" v={inr(slip.tds.cess)} />
            <Row k={`Annual tax ÷ ${slip.tds.months ?? 12}`} v={inr(slip.tds.monthly)} strong />
          </div>
        </div>
      )}
      <div className="border-border bg-muted/20 text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 rounded-xl border p-3 text-xs">
        <span>
          Employer cost to company: <b className="text-foreground">{inr(slip.employerCost)}</b>
        </span>
        <span>
          Bank:{" "}
          <b className="text-foreground">
            {slip.bank.bankName} {slip.bank.accountNo}
          </b>
        </span>
        <span>
          PAN {slip.statutory.pan || "—"} · UAN {slip.statutory.uan || "—"} · ESI{" "}
          {slip.statutory.esiNo || "—"}
        </span>
      </div>
    </div>
  );
}
