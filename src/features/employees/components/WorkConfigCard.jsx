import { useState } from "react";
import { CalendarCog, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { stateOfBranch } from "@/features/payroll/data/statutory-data";
import {
  BRANCH_WORKDAY_DEFAULT,
  saveWorkConfig,
  usePatterns,
  useWorkConfigs,
  workConfigOf,
} from "@/features/attendance/data/attendance-pattern";
import {
  saveStatutoryProfile,
  statutoryProfileOf,
  useStatutoryProfiles,
} from "@/features/payroll/data/contributions-data";
import { computePayslipFor } from "@/features/payroll/data/payroll-engine";
import { useInsurancePlans } from "@/features/organization/data/hr-masters";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WorkConfigCard({ empId, branch }) {
  const me = useCurrentUser();
  const insurancePlans = useInsurancePlans();
  const editable = can(me.role, "employee.manage");
  usePatterns();
  useWorkConfigs();
  useStatutoryProfiles();
  const patterns = usePatterns();
  const cfg = workConfigOf(empId);
  const pattern = patterns.find((p) => p.id === cfg.patternId) ?? patterns[0];
  const sp = statutoryProfileOf(empId);
  const slip = computePayslipFor(empId, "2026-08");
  const [open, setOpen] = useState(false);
  const [patternId, setPatternId] = useState(cfg.patternId);
  const [override, setOverride] = useState(Boolean(cfg.workday));
  const [wd, setWd] = useState(cfg.workday ?? { ...BRANCH_WORKDAY_DEFAULT, note: "" });
  const [prof, setProf] = useState(sp);

  const save = () => {
    saveWorkConfig({ empId, patternId, workday: override ? wd : null, updatedBy: me.name });
    saveStatutoryProfile(prof);
    setOpen(false);
    toast.success("Employment configuration saved — reflected in the next payroll check");
  };

  const kv = [
    [
      "Attendance pattern",
      <span key="k72">
        {pattern.name}{" "}
        <span className="text-muted-foreground">
          · {pattern.workingDays} days, {pattern.paidLeaveDays} paid,{" "}
          {pattern.lopEnabled ? "LOP applies" : "no LOP"}
        </span>
      </span>,
    ],
    [
      "Workday configuration",
      cfg.workday ? (
        <span className="text-primary font-medium">
          {cfg.workday.daysPerWeek} days/week · {cfg.workday.hoursPerDay} h/day · timesheet{" "}
          {cfg.workday.timesheetRequired ? "required" : "not required"} · off{" "}
          {cfg.workday.weekOffs.join(", ")}
          {cfg.workday.note ? ` · ${cfg.workday.note}` : ""}
        </span>
      ) : (
        <span>
          Branch default · {BRANCH_WORKDAY_DEFAULT.daysPerWeek} days/week ·{" "}
          {BRANCH_WORKDAY_DEFAULT.hoursPerDay} h/day · timesheet required
        </span>
      ),
    ],
    ["Payroll state", `${stateOfBranch(branch)} (from branch ${branch})`],
    ["Tax regime", sp.regime],
    [
      "PF",
      `${sp.pfApplicable ? "Member" : "Exempt (Form 11)"}${sp.pfInternationalWorker ? " · international worker" : ""}`,
    ],
    [
      "ESI",
      sp.esiOverride === "Auto"
        ? `Auto by gross threshold${slip ? ` → ${slip.esi.applicable ? "covered" : "not covered"}` : ""}`
        : sp.esiOverride,
    ],
    [
      "Projected this month",
      slip ? (
        <span>
          Earned {inr(slip.earnedGross)} · deductions {inr(slip.totalDeductions)} · net{" "}
          <b className="text-primary">{inr(slip.net)}</b>
          {slip.lop.lopDays ? (
            <span className="text-destructive"> · {slip.lop.lopDays} LOP</span>
          ) : null}
        </span>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCog className="text-primary h-4 w-4" /> Employment Configuration
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            updated {cfg.updatedOn} · {cfg.updatedBy}
          </Badge>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPatternId(cfg.patternId);
                setOverride(Boolean(cfg.workday));
                setWd(cfg.workday ?? { ...BRANCH_WORKDAY_DEFAULT, note: "" });
                setProf(sp);
                setOpen(true);
              }}
            >
              Configure
            </Button>
          )}
        </div>
      </div>
      <div className="divide-border/60 divide-y text-sm">
        {kv.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[200px_1fr]">
            <span className="text-muted-foreground">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employment configuration</DialogTitle>
            <DialogDescription>
              Attendance pattern and per-employee workday override layered on the branch default;
              statutory profile used by payroll.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Attendance pattern (drives LOP)
              </Label>
              <Select value={patternId} onValueChange={setPatternId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-muted-foreground text-xs">
                {patterns.find((p) => p.id === patternId)?.description}
              </div>
            </div>

            <div className="border-border space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Override branch workday</div>
                  <div className="text-muted-foreground text-xs">
                    Branch default: {BRANCH_WORKDAY_DEFAULT.daysPerWeek} days ·{" "}
                    {BRANCH_WORKDAY_DEFAULT.hoursPerDay} h · timesheet required · off{" "}
                    {BRANCH_WORKDAY_DEFAULT.weekOffs.join(", ")}
                  </div>
                </div>
                <Switch checked={override} onCheckedChange={setOverride} />
              </div>
              {override && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Days / week</Label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={wd.daysPerWeek}
                      onChange={(e) => setWd({ ...wd, daysPerWeek: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Hours / day</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={wd.hoursPerDay}
                      onChange={(e) => setWd({ ...wd, hoursPerDay: Number(e.target.value) })}
                    />
                  </div>
                  <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <span>Timesheet required</span>
                    <Switch
                      checked={wd.timesheetRequired}
                      onCheckedChange={(v) => setWd({ ...wd, timesheetRequired: v })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-muted-foreground text-xs">Weekly offs</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={wd.weekOffs.includes(d) ? "default" : "outline"}
                          className={
                            wd.weekOffs.includes(d) ? "bg-gradient-emerald h-7 text-white" : "h-7"
                          }
                          onClick={() =>
                            setWd({
                              ...wd,
                              weekOffs: wd.weekOffs.includes(d)
                                ? wd.weekOffs.filter((x) => x !== d)
                                : [...wd.weekOffs, d],
                            })
                          }
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-muted-foreground text-xs">Note</Label>
                    <Input
                      value={wd.note}
                      onChange={(e) => setWd({ ...wd, note: e.target.value })}
                      placeholder="e.g. Rotational shift roster, site posting"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-border space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="text-primary h-4 w-4" /> Statutory profile
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Tax regime</Label>
                  <Input
                    value="New Regime (s.115BAC) — organisation-wide"
                    readOnly
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">ESI coverage</Label>
                  <Select
                    value={prof.esiOverride}
                    onValueChange={(v) =>
                      setProf({
                        ...prof,
                        esiOverride: v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto">Auto (gross threshold)</SelectItem>
                      <SelectItem value="Covered">Covered (period lock)</SelectItem>
                      <SelectItem value="Not covered">Not covered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>PF member</span>
                  <Switch
                    checked={prof.pfApplicable}
                    onCheckedChange={(v) => setProf({ ...prof, pfApplicable: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">PF basis (employee-specific · item 13)</Label>
                  <Select
                    value={prof.pfMode ?? "Org default"}
                    onValueChange={(v) => setProf({ ...prof, pfMode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Org default">Org default (Payroll Config)</SelectItem>
                      <SelectItem value="Capped">Capped — 12% of ₹15,000</SelectItem>
                      <SelectItem value="Full">Statutory 12% on full basic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Insurance plans (Master Data)</Label>
                  <div className="flex flex-wrap gap-1">
                    {insurancePlans
                      .filter((p) => p.active)
                      .map((p) => {
                        const on = (prof.insurancePlanIds ?? []).includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setProf({
                                ...prof,
                                insurancePlanIds: on
                                  ? (prof.insurancePlanIds ?? []).filter((x) => x !== p.id)
                                  : [...(prof.insurancePlanIds ?? []), p.id],
                              })
                            }
                            className={
                              on
                                ? "border-primary bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-xs"
                                : "border-border rounded-full border px-2 py-0.5 text-xs"
                            }
                          >
                            {p.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
                <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>International worker (no ceiling)</span>
                  <Switch
                    checked={prof.pfInternationalWorker}
                    onCheckedChange={(v) => setProf({ ...prof, pfInternationalWorker: v })}
                  />
                </div>
                <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>Person with disability (ESI ₹25k)</span>
                  <Switch
                    checked={prof.personWithDisability}
                    onCheckedChange={(v) => setProf({ ...prof, personWithDisability: v })}
                  />
                </div>
                <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>PAN verified</span>
                  <Switch
                    checked={prof.panVerified}
                    onCheckedChange={(v) => setProf({ ...prof, panVerified: v })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gradient-emerald text-white" onClick={save}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
