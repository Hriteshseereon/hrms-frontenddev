import { useMemo, useState } from "react";
import { UserMinus2, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import {
  retireEmployee,
  useHrPolicy,
  useRetirementCandidates,
  useRetirements,
} from "@/features/exit/data/hr-policy";
import { useScopeMatch } from "@/features/organization/data/tenancy";

export function RetirementTab() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const policy = useHrPolicy();
  const candidates = useRetirementCandidates(orgId);
  const inScope = useScopeMatch();
  const records = useRetirements().filter((r) => inScope(r.orgId, r.empId));
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [retiredOn, setRetiredOn] = useState("");
  const [reason, setReason] = useState("Superannuation");
  const [note, setNote] = useState("");
  const [reEngage, setReEngage] = useState(true);
  const [months, setMonths] = useState(String(policy.contractExtensionMonths));
  const [ctc, setCtc] = useState("");
  const editable = can(me.role, "employee.manage");
  const rows = useMemo(
    () =>
      candidates.filter((c) =>
        `${c.name} ${c.id} ${c.dept}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [candidates, q],
  );

  const open = (c) => {
    setTarget(c);
    setRetiredOn(c.daysAway > 0 ? c.retirementDate : new Date().toISOString().slice(0, 10));
    setReason("Superannuation");
    setNote("");
    setReEngage(true);
    setMonths(String(policy.contractExtensionMonths));
    setCtc(String(Math.round(getEmployeeProfile(c.id).payroll.ctc * 0.8)));
  };
  const submit = () => {
    if (!target) return;
    const r = retireEmployee({
      empId: target.id,
      retiredOn,
      reason,
      note,
      reEngage,
      contractMonths: Number(months),
      contractCtc: Number(ctc),
      by: me,
    });
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) setTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          {
            l: "Retirement age",
            v: `${policy.retirementAge} yrs`,
            s: "configurable in Notification Centre",
          },
          {
            l: "Notice lead time",
            v: `${policy.retirementNoticeDays} days`,
            s: "auto e-mail to employee + HR",
          },
          {
            l: "Approaching",
            v: String(candidates.filter((c) => c.flagged && !c.retired && c.daysAway >= 0).length),
            s: "within the notice window",
          },
          {
            l: "Retired this year",
            v: String(
              records.filter((r) => r.retiredOn.startsWith(String(new Date().getFullYear())))
                .length,
            ),
            s: `${records.filter((r) => r.reEngaged).length} re-engaged on contract`,
          },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">{s.l}</div>
              <div className="mt-1 text-2xl font-bold">{s.v}</div>
              <div className="text-muted-foreground text-[11px]">{s.s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <UserMinus2 className="text-primary h-4 w-4" /> Retirement schedule
              </div>
              <div className="text-muted-foreground text-xs">
                Every employee's retirement date at age {policy.retirementAge}, computed from date
                of birth. Flagged rows are inside the notice window.
              </div>
            </div>
            <div className="border-border bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex-none">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-6 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:w-44"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Employee",
                    "Department",
                    "Date of birth",
                    "Age",
                    "Retirement date",
                    "Days away",
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
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className={cn("hover:bg-muted/30", c.flagged && !c.retired && "bg-gold/5")}
                  >
                    <td className="p-3 font-medium">
                      {c.name}
                      <div className="text-muted-foreground font-mono text-xs">{c.id}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{c.dept}</td>
                    <td className="text-muted-foreground p-3">{c.dob}</td>
                    <td className="p-3">{c.age}</td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">{c.retirementDate}</span>
                    </td>
                    <td className={cn("p-3 tabular-nums", c.daysAway < 0 && "text-destructive")}>
                      {c.daysAway < 0 ? `${-c.daysAway} overdue` : c.daysAway}
                    </td>
                    <td className="p-3">
                      {c.retired ? (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted text-muted-foreground"
                        >
                          Retired
                        </Badge>
                      ) : c.flagged ? (
                        <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
                          Notice sent
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {editable && !c.retired && (
                        <Button
                          size="sm"
                          variant={c.flagged ? "default" : "outline"}
                          className={c.flagged ? "bg-gradient-emerald h-7 text-white" : "h-7"}
                          onClick={() => open(c)}
                        >
                          Process retirement
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {records.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <RefreshCw className="text-primary h-4 w-4" /> Processed retirements & contract
              re-engagements
            </div>
            <div className="space-y-2">
              {records.map((r) => (
                <div
                  key={r.empId}
                  className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {r.name} <span className="text-muted-foreground text-xs">{r.empId}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {r.reason} · retired <span className="whitespace-nowrap">{r.retiredOn}</span>{" "}
                      · processed by {r.processedBy} on{" "}
                      <span className="whitespace-nowrap">{r.processedOn}</span>
                      {r.note ? ` — ${r.note}` : ""}
                    </div>
                  </div>
                  <div className="ml-auto">
                    {r.reEngaged ? (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        Contract {r.contractHireId} · from {r.contractFrom} · {r.contractMonths} mo
                        · {inr(r.contractCtc ?? 0)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Exited</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Retire {target?.name}</DialogTitle>
            <DialogDescription>
              Closes the current employment. Optionally start a new contract engagement the next day
              — history, group joining date and PF/UAN are carried forward.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Retirement date</Label>
              <Input type="date" value={retiredOn} onChange={(e) => setRetiredOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Superannuation", "Voluntary retirement", "Medical"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-border flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <div className="text-sm font-medium">Re-engage on contract</div>
                <div className="text-muted-foreground text-xs">
                  Creates a Contract employment record starting the day after retirement.
                </div>
              </div>
              <Switch checked={reEngage} onCheckedChange={setReEngage} />
            </div>
            {reEngage && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Contract length (months)</Label>
                  <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Contract CTC (₹&nbsp;/ year)
                  </Label>
                  <Input type="number" value={ctc} onChange={(e) => setCtc(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">Note</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Handover, gratuity settlement reference…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!retiredOn}
              onClick={submit}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
