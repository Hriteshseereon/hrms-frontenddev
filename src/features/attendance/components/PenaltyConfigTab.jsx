import { useEffect, useState } from "react";
import { Plus, ShieldAlert, Gift, SplitSquareHorizontal } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OFFICES } from "@/features/employees/data/hr-data";
import {
  penaltyRuleStore,
  overtimeRuleStore,
  halfDayPolicyStore,
} from "@/features/attendance/data/attendance-data";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import {
  dailyWageOf,
  STANDARD_WORKING_DAYS_PER_MONTH,
} from "@/features/attendance/data/shift-timing";
import { Wallet } from "lucide-react";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const TRIGGERS = ["Short Hours", "Late Arrival", "Half Day", "Absent", "Early Exit"];
const DEDUCTIONS = ["Fixed Amount", "% of Daily Wage", "Leave Deduction"];
const REWARDS = ["Multiplier of Hourly Rate", "Fixed Amount / hr", "Comp Off"];

export function PenaltyConfigTab() {
  // Persisted rule sets (they were in-memory lists, and "Save Policy" only showed a toast without saving anything).
  const penalties = penaltyRuleStore.use();
  const setPenalties = penaltyRuleStore.set;
  const overtime = overtimeRuleStore.use();
  const setOvertime = overtimeRuleStore.set;
  const savedPolicy = halfDayPolicyStore.use();
  const [policy, setPolicy] = useState(savedPolicy);
  // The store hydrates from localStorage after the first render — keep the form in step with the saved policy.
  useEffect(() => setPolicy(savedPolicy), [savedPolicy]);
  const employees = useScopedEmployees();
  const nextSerial = (ids) =>
    ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, "")) || 0), 0) + 1;
  const [openP, setOpenP] = useState(false);
  const [openO, setOpenO] = useState(false);
  const [penaltyDetail, setPenaltyDetail] = useState(null);
  const [overtimeDetail, setOvertimeDetail] = useState(null);

  const [pf, setPf] = useState({});
  const [of_, setOf] = useState({});

  function addPenalty() {
    setPenalties((prev) => [
      {
        id: `PEN-${String(nextSerial(prev.map((x) => x.id))).padStart(2, "0")}`,
        name: (pf.name ?? "").trim(),
        trigger: pf.trigger ?? "Short Hours",
        threshold: pf.threshold ?? "",
        deductionType: pf.deductionType ?? "Fixed Amount",
        deductionValue: pf.deductionValue ?? "",
        graceCount: Math.max(0, Number(pf.graceCount ?? 0) || 0),
        appliesTo: pf.appliesTo ?? "All offices",
        active: true,
      },
      ...prev,
    ]);
    setPf({});
    setOpenP(false);
    toast.success("Penalty rule created");
  }

  function addOvertime() {
    setOvertime((prev) => [
      {
        id: `OTR-${String(nextSerial(prev.map((x) => x.id))).padStart(2, "0")}`,
        name: (of_.name ?? "").trim(),
        appliesAfter: of_.appliesAfter ?? "",
        rewardType: of_.rewardType ?? "Multiplier of Hourly Rate",
        rewardValue: of_.rewardValue ?? "",
        requiresApproval: of_.requiresApproval !== "no",
        monthlyCap: of_.monthlyCap ?? "No cap",
        active: true,
      },
      ...prev,
    ]);
    setOf({});
    setOpenO(false);
    toast.success("Overtime rule created");
  }

  return (
    <div className="space-y-6">
      {/* Per-day wage reference — the same figure "% of Daily Wage" deductions below are based on. */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Per-Day Wage Reference</div>
              <div className="text-muted-foreground text-xs">
                Effective daily wage = gross monthly salary ÷ {STANDARD_WORKING_DAYS_PER_MONTH}{" "}
                working days. This is the same figure used wherever "% of Daily Wage" deductions
                apply below, and on each employee's own attendance screen.
              </div>
            </div>
          </div>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Designation</th>
                  <th className="p-3 text-right">Per-Day Wage</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {employees.slice(0, 6).map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="text-muted-foreground p-3">{u.role}</td>
                    <td className="p-3 text-right font-semibold">
                      ₹&nbsp;
                      {dailyWageOf(u.id).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Half day policy */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <SplitSquareHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Half-Day & Work Hour Policy</div>
              <div className="text-muted-foreground text-xs">
                Defines when a day is treated as full, half or absent.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Minimum hours for a full day</Label>
              <Input
                type="number"
                step="0.25"
                value={policy.minHoursFullDay}
                onChange={(e) => setPolicy({ ...policy, minHoursFullDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum hours for a half day</Label>
              <Input
                type="number"
                step="0.25"
                value={policy.minHoursHalfDay}
                onChange={(e) => setPolicy({ ...policy, minHoursHalfDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max half-days per month</Label>
              <Input
                type="number"
                value={policy.maxPerMonth}
                onChange={(e) => setPolicy({ ...policy, maxPerMonth: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>First-half window</Label>
              <Input
                value={policy.firstHalfWindow}
                onChange={(e) => setPolicy({ ...policy, firstHalfWindow: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Second-half window</Label>
              <Input
                value={policy.secondHalfWindow}
                onChange={(e) => setPolicy({ ...policy, secondHalfWindow: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch
                checked={policy.countsAgainstLeave}
                onCheckedChange={(v) => setPolicy({ ...policy, countsAgainstLeave: v })}
                id="cal"
              />
              <Label htmlFor="cal" className="mb-0">
                Deduct half-day from leave balance
              </Label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => {
                if (
                  !(policy.minHoursHalfDay > 0) ||
                  !(policy.minHoursFullDay > policy.minHoursHalfDay) ||
                  policy.minHoursFullDay > 24
                )
                  return toast.error(
                    "Full-day hours must be greater than half-day hours (and at most 24).",
                  );
                if (policy.maxPerMonth < 0)
                  return toast.error("Max half-days per month cannot be negative.");
                halfDayPolicyStore.set(policy);
                toast.success("Work hour policy saved");
              }}
            >
              Save Policy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Penalty rules */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-destructive/10 text-destructive grid h-10 w-10 place-items-center rounded-xl">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Penalty Configuration</div>
                <div className="text-muted-foreground text-xs">
                  Deductions applied when work hours or timings are not met.
                </div>
              </div>
            </div>
            <Dialog open={openP} onOpenChange={setOpenP}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald text-white">
                  <Plus className="h-4 w-4" /> New Penalty Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>New penalty rule</DialogTitle>
                  <DialogDescription>
                    Configure the trigger and the deduction that follows.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Rule name</Label>
                    <Input
                      value={pf.name ?? ""}
                      onChange={(e) => setPf({ ...pf, name: e.target.value })}
                      placeholder="Short work hours deduction"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trigger</Label>
                    <Select value={pf.trigger} onValueChange={(v) => setPf({ ...pf, trigger: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGERS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Threshold</Label>
                    <Input
                      value={pf.threshold ?? ""}
                      onChange={(e) => setPf({ ...pf, threshold: e.target.value })}
                      placeholder="< 7.5 hrs / day"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deduction type</Label>
                    <Select
                      value={pf.deductionType}
                      onValueChange={(v) => setPf({ ...pf, deductionType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEDUCTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deduction value</Label>
                    <Input
                      value={pf.deductionValue ?? ""}
                      onChange={(e) => setPf({ ...pf, deductionValue: e.target.value })}
                      placeholder="25% or ₹\u00A0250"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grace count / month</Label>
                    <Input
                      type="number"
                      value={pf.graceCount ?? ""}
                      onChange={(e) => setPf({ ...pf, graceCount: e.target.value })}
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Applies to</Label>
                    <Select
                      value={pf.appliesTo}
                      onValueChange={(v) => setPf({ ...pf, appliesTo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All offices" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All offices">All offices</SelectItem>
                        {OFFICES.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenP(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-gradient-emerald text-white"
                    disabled={
                      !pf.name?.trim() ||
                      !pf.trigger ||
                      !pf.deductionType ||
                      !pf.threshold?.trim() ||
                      !pf.deductionValue?.trim() ||
                      Number(pf.graceCount ?? 0) < 0
                    }
                    onClick={addPenalty}
                  >
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Rule</th>
                  <th className="p-3 text-left">Trigger</th>
                  <th className="p-3 text-left">Threshold</th>
                  <th className="p-3 text-left">Deduction</th>
                  <th className="p-3 text-left">Grace</th>
                  <th className="p-3 text-left">Applies To</th>
                  <th className="p-3 text-left">Active</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {penalties.map((r) => (
                  <tr key={r.id} className={clickableRow} onClick={() => setPenaltyDetail(r)}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">{r.id}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{r.trigger}</Badge>
                    </td>
                    <td className="text-muted-foreground p-3">{r.threshold}</td>
                    <td className="p-3">
                      <span className="text-destructive font-semibold">{r.deductionValue}</span>{" "}
                      <span className="text-muted-foreground text-xs">· {r.deductionType}</span>
                    </td>
                    <td className="p-3">{r.graceCount}</td>
                    <td className="text-muted-foreground p-3">{r.appliesTo}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={r.active}
                        onCheckedChange={(v) =>
                          setPenalties((p) =>
                            p.map((x) => (x.id === r.id ? { ...x, active: v } : x)),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Overtime rules */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gold/20 text-gold grid h-10 w-10 place-items-center rounded-xl">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Overtime Rewards</div>
                <div className="text-muted-foreground text-xs">
                  How extra hours are compensated back to employees.
                </div>
              </div>
            </div>
            <Dialog open={openO} onOpenChange={setOpenO}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald text-white">
                  <Plus className="h-4 w-4" /> New Overtime Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>New overtime rule</DialogTitle>
                  <DialogDescription>
                    Define when overtime kicks in and how it is rewarded.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Rule name</Label>
                    <Input
                      value={of_.name ?? ""}
                      onChange={(e) => setOf({ ...of_, name: e.target.value })}
                      placeholder="Weekday overtime"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Applies after</Label>
                    <Input
                      value={of_.appliesAfter ?? ""}
                      onChange={(e) => setOf({ ...of_, appliesAfter: e.target.value })}
                      placeholder="> 8.5 hrs / day"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reward type</Label>
                    <Select
                      value={of_.rewardType}
                      onValueChange={(v) => setOf({ ...of_, rewardType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {REWARDS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reward value</Label>
                    <Input
                      value={of_.rewardValue ?? ""}
                      onChange={(e) => setOf({ ...of_, rewardValue: e.target.value })}
                      placeholder="1.5× or ₹\u00A0180"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monthly cap</Label>
                    <Input
                      value={of_.monthlyCap ?? ""}
                      onChange={(e) => setOf({ ...of_, monthlyCap: e.target.value })}
                      placeholder="30 hrs"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Requires manager approval</Label>
                    <Select
                      value={of_.requiresApproval ?? "yes"}
                      onValueChange={(v) => setOf({ ...of_, requiresApproval: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenO(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-gradient-emerald text-white"
                    disabled={
                      !of_.name?.trim() ||
                      !of_.rewardType ||
                      !of_.appliesAfter?.trim() ||
                      !of_.rewardValue?.trim()
                    }
                    onClick={addOvertime}
                  >
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Rule</th>
                  <th className="p-3 text-left">Applies After</th>
                  <th className="p-3 text-left">Reward</th>
                  <th className="p-3 text-left">Approval</th>
                  <th className="p-3 text-left">Monthly Cap</th>
                  <th className="p-3 text-left">Active</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {overtime.map((r) => (
                  <tr key={r.id} className={clickableRow} onClick={() => setOvertimeDetail(r)}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">{r.id}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{r.appliesAfter}</td>
                    <td className="p-3">
                      <span className="text-primary font-semibold">{r.rewardValue}</span>{" "}
                      <span className="text-muted-foreground text-xs">· {r.rewardType}</span>
                    </td>
                    <td className="p-3">{r.requiresApproval ? "Required" : "Automatic"}</td>
                    <td className="p-3">{r.monthlyCap}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={r.active}
                        onCheckedChange={(v) =>
                          setOvertime((p) =>
                            p.map((x) => (x.id === r.id ? { ...x, active: v } : x)),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {penaltyDetail && (
        <RecordDetailDialog
          onClose={() => setPenaltyDetail(null)}
          title={penaltyDetail.name}
          subtitle={`${penaltyDetail.id} · ${penaltyDetail.trigger}`}
          badges={
            <>
              <Badge variant="outline">{penaltyDetail.trigger}</Badge>
              <Badge
                variant="outline"
                className={
                  penaltyDetail.active ? "border-primary/30 bg-primary/10 text-primary" : ""
                }
              >
                {penaltyDetail.active ? "Active" : "Inactive"}
              </Badge>
            </>
          }
          record={penaltyDetail}
          labels={{
            id: "Rule ID",
            name: "Rule",
            deductionType: "Deduction type",
            deductionValue: "Deduction",
            graceCount: "Grace count",
            appliesTo: "Applies to",
          }}
          sections={[
            { title: "Rule", keys: ["id", "name", "trigger", "threshold", "appliesTo", "active"] },
            { title: "Penalty", keys: ["deductionType", "deductionValue", "graceCount"] },
          ]}
        />
      )}
      {overtimeDetail && (
        <RecordDetailDialog
          onClose={() => setOvertimeDetail(null)}
          title={overtimeDetail.name}
          subtitle={`${overtimeDetail.id} · applies after ${overtimeDetail.appliesAfter}`}
          badges={
            <>
              <Badge variant="outline">{overtimeDetail.rewardType}</Badge>
              <Badge
                variant="outline"
                className={
                  overtimeDetail.active ? "border-primary/30 bg-primary/10 text-primary" : ""
                }
              >
                {overtimeDetail.active ? "Active" : "Inactive"}
              </Badge>
            </>
          }
          record={{
            ...overtimeDetail,
            requiresApproval: overtimeDetail.requiresApproval
              ? "Manager approval required"
              : "Automatic",
          }}
          labels={{
            id: "Rule ID",
            name: "Rule",
            appliesAfter: "Applies after",
            rewardType: "Reward type",
            rewardValue: "Reward",
            requiresApproval: "Approval",
            monthlyCap: "Monthly cap",
          }}
        />
      )}
    </div>
  );
}
