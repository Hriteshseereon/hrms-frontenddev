import { useMemo, useState } from "react";
import {
  CalendarClock,
  MapPin,
  Save,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
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
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import {
  INDIAN_STATES,
  STATE_POLICIES,
  complianceCalendar,
  saveStatutoryConfig,
  useStatutoryConfig,
  professionalTax,
} from "@/features/payroll/data/statutory-data";
import { NEW_REGIME_RULES, NEW_REGIME_SLAB_ROWS } from "@/features/payroll/data/statutory-data";
import { periodLabel, usePayrollRuns, dueDate } from "@/features/payroll/data/payroll-engine";
import { filingTone, isOverdue, useFilings } from "@/features/payroll/data/statutory-filings";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({ onGo }) {
  const inScope = useScopeMatch();
  const runs = usePayrollRuns().filter((r) => inScope(r.orgId));
  const filings = useFilings().filter((f) => inScope(f.orgId));
  const cfg = useStatutoryConfig();
  const processed = runs
    .filter((r) => r.status === "Processed" || r.status === "Paid")
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  const latest = processed[0];
  const kinds = ["ECR", "ESI", "TDS"];

  const statusFor = (kind, period) =>
    filings
      .filter((f) => f.kind === kind && f.period === period)
      .sort((a, b) => (a.generatedOn < b.generatedOn ? 1 : -1))[0];
  const overdue = filings.filter(isOverdue);
  const missing = processed.flatMap((r) =>
    kinds.filter((k) => !statusFor(k, r.period)).map((k) => ({ kind: k, period: r.period })),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          {
            l: "Processed months",
            v: String(processed.length),
            sub: latest ? `latest ${periodLabel(latest.period)}` : "—",
          },
          {
            l: "Filings closed (paid)",
            v: String(filings.filter((f) => f.status === "Paid").length),
            sub: `${filings.length} total`,
          },
          {
            l: "Overdue",
            v: String(overdue.length),
            sub: overdue.length
              ? overdue
                  .map((f) => `${f.kind} ${periodLabel(f.period)}`)
                  .slice(0, 2)
                  .join(", ")
              : "none",
            bad: overdue.length > 0,
          },
          {
            l: "Not yet generated",
            v: String(missing.length),
            sub: missing.length
              ? missing
                  .map((m) => `${m.kind} ${periodLabel(m.period)}`)
                  .slice(0, 2)
                  .join(", ")
              : "all processed months filed",
            bad: missing.length > 0,
          },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">{s.l}</div>
              <div className={cn("mt-1 text-2xl font-bold", s.bad && "text-destructive")}>
                {s.v}
              </div>
              <div className="text-muted-foreground mt-0.5 truncate text-[11px]">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="shadow-card lg:col-span-3">
          <CardContent className="p-6">
            <div className="mb-1 font-semibold">Filing status by wage month</div>
            <div className="text-muted-foreground mb-4 text-xs">
              Each processed payroll month must close PF (ECR), ESI and TDS. Click a cell to open
              that filing queue.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Wage month</th>
                    <th className="p-3 text-left">Payroll</th>
                    {kinds.map((k) => (
                      <th key={k} className="p-3 text-left">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {runs
                    .sort((a, b) => (a.period < b.period ? 1 : -1))
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{periodLabel(r.period)}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              r.status === "Paid" || r.status === "Processed"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-gold/40 bg-gold/15 text-gold"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        {kinds.map((k) => {
                          const f = statusFor(k, r.period);
                          const ready = r.status === "Processed" || r.status === "Paid";
                          return (
                            <td
                              key={k}
                              className="cursor-pointer p-3"
                              onClick={() => onGo(k.toLowerCase())}
                            >
                              {f ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    filingTone(f.status),
                                    isOverdue(f) && "border-destructive/40 text-destructive",
                                  )}
                                >
                                  {f.status}
                                  {isOverdue(f) ? " · overdue" : ""}
                                </Badge>
                              ) : ready ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/30 bg-destructive/10 text-destructive"
                                >
                                  Not generated
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  awaiting payroll
                                </span>
                              )}
                              {f && (
                                <div className="text-muted-foreground mt-0.5 text-[10px]">
                                  due <span className="whitespace-nowrap">{f.dueOn}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <CalendarClock className="text-primary h-4 w-4" /> Compliance calendar
            </div>
            <div className="text-muted-foreground mb-4 text-xs">
              Due dates for a wage month, applied to{" "}
              {latest ? periodLabel(latest.period) : "the latest month"}.
            </div>
            <div className="space-y-2">
              {complianceCalendar(cfg).map((c) => (
                <div
                  key={c.code}
                  className="border-border flex items-start gap-3 rounded-lg border p-3 text-xs"
                >
                  <div className="bg-gradient-emerald grid h-8 w-10 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white">
                    {c.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{c.title}</div>
                    <div className="text-muted-foreground">
                      {c.form} · {c.authority} · {c.frequency}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-semibold">
                      {latest ? dueDate(latest.period, c.dueDay) : `${c.dueDay}th`}
                    </div>
                    <div className="text-muted-foreground">due</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* State-aware policy matrix                                           */
/* ------------------------------------------------------------------ */

export function StatePolicyTab() {
  const [state, setState] = useState("Karnataka");
  const [gross, setGross] = useState("25000");
  const p = STATE_POLICIES.find((x) => x.state === state);
  const inScope = useScopeMatch();
  const runs = usePayrollRuns().filter((r) => inScope(r.orgId));
  const latest = runs
    .filter((r) => r.lines.length)
    .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  const usage = useMemo(() => {
    const m = new Map();
    latest?.lines.forEach((l) => {
      const cur = m.get(l.state) ?? { employees: 0, pt: 0, lwf: 0, esi: 0 };
      cur.employees++;
      cur.pt += l.pt;
      cur.lwf += l.lwf.employee + l.lwf.employer;
      cur.esi += l.esi.applicable ? 1 : 0;
      m.set(l.state, cur);
    });
    return m;
  }, [latest]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <MapPin className="text-primary h-4 w-4" /> States in the current payroll
            </div>
            <div className="text-muted-foreground mb-4 text-xs">
              Every branch resolves to a state; payroll applies that state's Professional Tax slabs,
              LWF cycle and minimum-wage floor automatically.
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "State",
                    "Employees",
                    "PT (month)",
                    "LWF (EE+ER)",
                    "ESI covered",
                    "PT regime",
                    "LWF cycle",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {[...usage.entries()].map(([s, u]) => {
                  const pol = STATE_POLICIES.find((x) => x.state === s);
                  return (
                    <tr
                      key={s}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setState(s)}
                    >
                      <td className="p-3 font-medium">{s}</td>
                      <td className="p-3">{u.employees}</td>
                      <td className="p-3 tabular-nums">{inr(u.pt)}</td>
                      <td className="p-3 tabular-nums">{inr(u.lwf)}</td>
                      <td className="p-3">{u.esi}</td>
                      <td className="p-3 text-xs">
                        {pol.ptApplicable ? `${pol.ptSlabs.length} slab(s)` : "Not levied"}
                      </td>
                      <td className="p-3 text-xs">{pol.lwf.frequency}</td>
                    </tr>
                  );
                })}
                {usage.size === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground p-6 text-center">
                      No payroll lines yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-3 p-6">
            <div className="font-semibold">PT calculator</div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">State</Label>
              <Select value={state} onValueChange={(v) => setState(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Monthly gross (₹)</Label>
              <Input type="number" value={gross} onChange={(e) => setGross(e.target.value)} />
            </div>
            <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
              <div className="text-muted-foreground text-xs">Professional tax this month</div>
              <div className="text-primary text-2xl font-bold">
                {inr(professionalTax(state, Number(gross) || 0, new Date().getMonth()))}
              </div>
              {p.ptAdjustMonth && (
                <div className="text-muted-foreground mt-1 text-[11px]">
                  Top slab pays {inr(p.ptAdjustMonth.amount)} in{" "}
                  {
                    [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ][p.ptAdjustMonth.month]
                  }{" "}
                  so the annual total is ₹2,500.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{p.state} — statutory policy</div>
              <div className="text-muted-foreground text-xs">
                Read by payroll for every employee whose branch is in {p.state}.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Min. wage {inr(p.minimumWage)}/mo</Badge>
              <Badge variant="outline">ESI {p.esiZone}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="border-border rounded-xl border p-4">
              <div className="mb-2 text-sm font-semibold">
                {p.ptHalfYearly
                  ? "Professional Tax slabs (half-yearly income → half-yearly PT, deducted Sep & Mar)"
                  : "Professional Tax slabs (monthly gross → PT)"}
              </div>
              {p.ptApplicable ? (
                <table className="w-full text-sm">
                  <tbody className="divide-border divide-y">
                    {p.ptSlabs.map((s, i) => (
                      <tr key={i}>
                        <td className="text-muted-foreground py-1.5">
                          {s.upTo === null
                            ? `Above ${inr(p.ptSlabs[i - 1]?.upTo ?? 0)}`
                            : `Up to ${inr(s.upTo)}`}
                        </td>
                        <td className="py-1.5 text-right font-medium tabular-nums">
                          {inr(s.amount)}
                        </td>
                        <td className="text-muted-foreground py-1.5 pl-3 text-xs">
                          {s.note ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-muted-foreground text-sm">
                  No Professional Tax is levied in {p.state}.
                </div>
              )}
            </div>
            <div className="border-border space-y-3 rounded-xl border p-4">
              <div>
                <div className="mb-1 text-sm font-semibold">Labour Welfare Fund</div>
                {p.lwf.frequency === "Not applicable" ? (
                  <div className="text-muted-foreground text-sm">No LWF in {p.state}.</div>
                ) : (
                  <div className="text-sm">
                    Employee {inr(p.lwf.employee)} · Employer {inr(p.lwf.employer)} ·{" "}
                    <span className="text-muted-foreground">
                      {p.lwf.frequency}, deducted in{" "}
                      {p.lwf.months
                        .map(
                          (m) =>
                            [
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "May",
                              "Jun",
                              "Jul",
                              "Aug",
                              "Sep",
                              "Oct",
                              "Nov",
                              "Dec",
                            ][m],
                        )
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">Minimum wage pre-check</div>
                <div className="text-muted-foreground text-sm">
                  Payroll raises a warning when an employee's earned gross for a full month falls
                  below {inr(p.minimumWage)}.
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">Central levies</div>
                <div className="text-muted-foreground text-sm">
                  PF, ESI and TDS are central — configured once under Statutory Configuration and
                  applied in every state.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Organisation statutory configuration                                */
/* ------------------------------------------------------------------ */

function Num({ label, value, onChange, suffix, disabled }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label}
        {suffix ? ` (${suffix})` : ""}
      </Label>
      <Input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
function Txt({ label, value, onChange, disabled }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Tog({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="border-border flex items-start justify-between gap-3 rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-muted-foreground text-xs">{hint}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function StatutoryConfigTab() {
  const me = useCurrentUser();
  const saved = useStatutoryConfig();
  const [d, setD] = useState(saved);
  const editable = can(me.role, "statutory.configure");
  const set = (k, v) => setD((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  // Guard rails — an empty approval chain left runs stuck in "Pending Approval"; negative / >100 % rates and
  // impossible due days produced wrong payroll and filing dates.
  const pctOk = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
  const dayOk = (n) => Number.isInteger(n) && n >= 1 && n <= 28;
  const errors = [
    !d.payroll.approvalLevels.length && "Choose at least one approval level.",
    ![
      d.pf.employeeRate,
      d.pf.employerRate,
      d.pf.epsRate,
      d.pf.edliRate,
      d.pf.adminRate,
      d.esi.employeeRate,
      d.esi.employerRate,
      d.tds.cessRate,
      d.tds.npsEmployerDeductionCapNewPct,
    ].every(pctOk) && "Rates must be between 0 and 100 %.",
    d.pf.epsRate > d.pf.employerRate && "EPS share cannot exceed the employer PF rate.",
    !(
      d.pf.wageCeiling > 0 &&
      d.esi.wageThreshold > 0 &&
      d.esi.disabledThreshold >= d.esi.wageThreshold
    ) && "Wage ceilings must be positive (PWD threshold ≥ ESI threshold).",
    ![
      d.pf.remittanceDueDay,
      d.esi.remittanceDueDay,
      d.tds.remittanceDueDay,
      d.payroll.payDay,
    ].every(dayOk) && "Due days / pay day must be between 1 and 28.",
    !(
      d.tds.standardDeductionNew >= 0 &&
      d.tds.rebate87aLimitNew >= 0 &&
      d.tds.rebate87aMaxNew >= 0
    ) && "Tax amounts cannot be negative.",
    !/^[A-Z]{4}\d{5}[A-Z]$/.test(d.establishment.tan) && "TAN must be 10 characters (AAAA99999A).",
    !/^[A-Z]{5}\d{4}[A-Z]$/.test(d.establishment.pan) && "PAN must be 10 characters (AAAAA9999A).",
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary h-5 w-5" />
            <div>
              <div className="font-semibold">Statutory Configuration</div>
              <div className="text-muted-foreground text-xs">
                Last updated <span className="whitespace-nowrap">{saved.updatedOn}</span> by{" "}
                {saved.updatedBy}.{" "}
                {editable
                  ? "Changes apply to the next payroll run's compliance checks."
                  : "Your role can view but not edit this policy."}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setD(saved)}>
              Discard
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!dirty || !editable}
              onClick={() => {
                if (errors.length) return void toast.error(errors[0]);
                saveStatutoryConfig(d, `${me.name} (${me.role})`);
                toast.success(
                  "Statutory policy saved — re-run compliance checks on open payroll drafts",
                );
              }}
            >
              <Save className="h-4 w-4" /> Save policy
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <div className="font-semibold">Establishment registrations</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Txt
                label="EPFO establishment code"
                value={d.establishment.pfCode}
                disabled={!editable}
                onChange={(v) => set("establishment", { pfCode: v })}
              />

              <Txt
                label="ESIC employer code"
                value={d.establishment.esiCode}
                disabled={!editable}
                onChange={(v) => set("establishment", { esiCode: v })}
              />

              <Txt
                label="TAN"
                value={d.establishment.tan}
                disabled={!editable}
                onChange={(v) => set("establishment", { tan: v })}
              />

              <Txt
                label="PAN"
                value={d.establishment.pan}
                disabled={!editable}
                onChange={(v) => set("establishment", { pan: v })}
              />

              <Txt
                label="PT registration (PTRC)"
                value={d.establishment.ptRegistration}
                disabled={!editable}
                onChange={(v) => set("establishment", { ptRegistration: v })}
              />

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  Registered state
                </Label>
                <Select
                  value={d.establishment.registeredState}
                  onValueChange={(v) => set("establishment", { registeredState: v })}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <div className="font-semibold">Payroll approval policy</div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Approval chain (in order)
              </Label>
              <div className="flex flex-wrap gap-2">
                {["Payroll Admin", "HR Manager", "Finance", "CFO"].map((lvl) => {
                  const on = d.payroll.approvalLevels.includes(lvl);
                  return (
                    <Button
                      key={lvl}
                      size="sm"
                      variant={on ? "default" : "outline"}
                      disabled={!editable}
                      className={on ? "bg-gradient-emerald text-white" : ""}
                      onClick={() =>
                        set("payroll", {
                          approvalLevels: on
                            ? d.payroll.approvalLevels.filter((x) => x !== lvl)
                            : [...d.payroll.approvalLevels, lvl],
                        })
                      }
                    >
                      {on ? `${d.payroll.approvalLevels.indexOf(lvl) + 1}. ` : ""}
                      {lvl}
                    </Button>
                  );
                })}
              </div>
              <div className="text-muted-foreground text-xs">
                Current chain: {d.payroll.approvalLevels.join(" → ") || "none (not recommended)"}
              </div>
            </div>
            <Tog
              label="Enforce maker–checker"
              hint="The user who prepared a run or filing can never approve it."
              checked={d.payroll.enforceMakerChecker}
              disabled={!editable}
              onChange={(v) => set("payroll", { enforceMakerChecker: v })}
            />

            <Tog
              label="Block processing on errors"
              hint="Runs with compliance errors cannot be submitted; warnings need acknowledgement."
              checked={d.payroll.blockOnErrors}
              disabled={!editable}
              onChange={(v) => set("payroll", { blockOnErrors: v })}
            />

            <Tog
              label="Require attendance lock"
              hint="HR must lock the month's attendance before payroll checks can pass."
              checked={d.payroll.requireAttendanceLock}
              disabled={!editable}
              onChange={(v) => set("payroll", { requireAttendanceLock: v })}
            />

            <Num
              label="Default pay day (of following month)"
              value={d.payroll.payDay}
              disabled={!editable}
              onChange={(v) => set("payroll", { payDay: v })}
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Provident Fund (EPF / EPS / EDLI)</div>
              <Switch
                checked={d.pf.enabled}
                disabled={!editable}
                onCheckedChange={(v) => set("pf", { enabled: v })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Num
                label="Employee"
                suffix="%"
                value={d.pf.employeeRate}
                disabled={!editable}
                onChange={(v) => set("pf", { employeeRate: v })}
              />

              <Num
                label="Employer"
                suffix="%"
                value={d.pf.employerRate}
                disabled={!editable}
                onChange={(v) => set("pf", { employerRate: v })}
              />

              <Num
                label="EPS share of employer"
                suffix="%"
                value={d.pf.epsRate}
                disabled={!editable}
                onChange={(v) => set("pf", { epsRate: v })}
              />

              <Num
                label="EDLI (A/C 21)"
                suffix="%"
                value={d.pf.edliRate}
                disabled={!editable}
                onChange={(v) => set("pf", { edliRate: v })}
              />

              <Num
                label="Admin charges (A/C 2)"
                suffix="%"
                value={d.pf.adminRate}
                disabled={!editable}
                onChange={(v) => set("pf", { adminRate: v })}
              />

              <Num
                label="Wage ceiling"
                suffix="₹"
                value={d.pf.wageCeiling}
                disabled={!editable}
                onChange={(v) => set("pf", { wageCeiling: v })}
              />

              <Num
                label="ECR remittance due day"
                value={d.pf.remittanceDueDay}
                disabled={!editable}
                onChange={(v) => set("pf", { remittanceDueDay: v })}
              />
            </div>
            <Tog
              label="Restrict contributions to ceiling"
              hint="Compute on ₹15,000 when Basic exceeds it (EPS is always ceiling-restricted)."
              checked={d.pf.restrictToCeiling}
              disabled={!editable}
              onChange={(v) => set("pf", { restrictToCeiling: v })}
            />

            <Tog
              label="Employer contributes on actual Basic"
              hint="Voluntary higher employer share even when the ceiling applies."
              checked={d.pf.employerOnActual}
              disabled={!editable}
              onChange={(v) => set("pf", { employerOnActual: v })}
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Employees' State Insurance</div>
              <Switch
                checked={d.esi.enabled}
                disabled={!editable}
                onCheckedChange={(v) => set("esi", { enabled: v })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Num
                label="Employee"
                suffix="%"
                value={d.esi.employeeRate}
                disabled={!editable}
                onChange={(v) => set("esi", { employeeRate: v })}
              />

              <Num
                label="Employer"
                suffix="%"
                value={d.esi.employerRate}
                disabled={!editable}
                onChange={(v) => set("esi", { employerRate: v })}
              />

              <Num
                label="Gross wage threshold"
                suffix="₹"
                value={d.esi.wageThreshold}
                disabled={!editable}
                onChange={(v) => set("esi", { wageThreshold: v })}
              />

              <Num
                label="Threshold — persons with disability"
                suffix="₹"
                value={d.esi.disabledThreshold}
                disabled={!editable}
                onChange={(v) => set("esi", { disabledThreshold: v })}
              />

              <Num
                label="Remittance due day"
                value={d.esi.remittanceDueDay}
                disabled={!editable}
                onChange={(v) => set("esi", { remittanceDueDay: v })}
              />
            </div>
            <Tog
              label="Lock membership to contribution period"
              hint="An employee crossing the threshold mid-period stays covered until Sep / Mar."
              checked={d.esi.lockMembershipToPeriod}
              disabled={!editable}
              onChange={(v) => set("esi", { lockMembershipToPeriod: v })}
            />
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <div className="font-semibold">TDS on salary (Section 192) — New Tax Regime only</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Tax regime</Label>
                <Input
                  value="New Regime (s.115BAC) — applies to all employees"
                  readOnly
                  className="bg-muted/40"
                />
              </div>
              <Num
                label="Standard deduction u/s 16(ia)"
                suffix="₹"
                value={d.tds.standardDeductionNew}
                disabled={!editable}
                onChange={(v) => set("tds", { standardDeductionNew: v })}
              />

              <Num
                label="Health & Education Cess"
                suffix="%"
                value={d.tds.cessRate}
                disabled={!editable}
                onChange={(v) => set("tds", { cessRate: v })}
              />

              <Num
                label="Challan 281 due day"
                value={d.tds.remittanceDueDay}
                disabled={!editable}
                onChange={(v) => set("tds", { remittanceDueDay: v })}
              />

              <Num
                label="87A rebate — taxable income limit"
                suffix="₹"
                value={d.tds.rebate87aLimitNew}
                disabled={!editable}
                onChange={(v) => set("tds", { rebate87aLimitNew: v })}
              />

              <Num
                label="87A rebate — maximum"
                suffix="₹"
                value={d.tds.rebate87aMaxNew}
                disabled={!editable}
                onChange={(v) => set("tds", { rebate87aMaxNew: v })}
              />

              <Num
                label="80CCD(2) employer NPS cap"
                suffix="% of Basic"
                value={d.tds.npsEmployerDeductionCapNewPct}
                disabled={!editable}
                onChange={(v) => set("tds", { npsEmployerDeductionCapNewPct: v })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-border rounded-lg border p-3">
                <div className="mb-1 text-xs font-semibold">Slabs — FY 2026-27 (new regime)</div>
                <table className="w-full text-xs">
                  <tbody>
                    {NEW_REGIME_SLAB_ROWS.map((r) => (
                      <tr key={r.range} className="border-border border-t">
                        <td className="py-1">{r.range}</td>
                        <td className="py-1 text-right font-medium">{r.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-muted-foreground mt-1 text-[11px]">
                  {NEW_REGIME_RULES.surcharge}
                </div>
              </div>
              <div className="border-border space-y-1 rounded-lg border p-3 text-xs">
                <div className="font-semibold">Allowed under the new regime</div>
                <ul className="text-muted-foreground list-disc pl-4">
                  {NEW_REGIME_RULES.allowed.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <div className="pt-1 font-semibold">Not applicable (not collected)</div>
                <ul className="text-muted-foreground list-disc pl-4">
                  {NEW_REGIME_RULES.notAllowed.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-border bg-muted/20 text-muted-foreground flex gap-2 rounded-lg border p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              TDS is projected annually from each month's earned gross plus declared
              previous-employer and other income (Form 12BB, new-regime fields only), less standard
              deduction and 80CCD(2), then spread across remaining months. Verify slab rates against
              the latest Finance Act before each FY.
            </div>
          </CardContent>
        </Card>
      </div>
      {dirty && (
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" /> Unsaved changes.
        </div>
      )}
      {dirty && errors.length > 0 && (
        <ul className="text-destructive list-disc pl-5 text-xs">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
