import { useState } from "react";
import { UserCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EMPLOYEES } from "@/features/employees/data/employee-directory";
import {
  substituteStore,
  addSubstitute,
  endSubstitute,
  useManagerMap,
  directReports,
  SUBSTITUTE_SCOPES,
} from "@/features/organization/data/manager-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";

export function SubstitutesTab() {
  const rows = substituteStore.use();
  const me = useCurrentUser();
  const canManage = can(me.role, "role.manage");
  const map = useManagerMap();
  const managers = EMPLOYEES.filter((e) => directReports(map, e.id).length > 0);
  const [detail, setDetail] = useState(null);

  const [open, setOpen] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [substituteId, setSubstituteId] = useState("");
  const [scope, setScope] = useState("All Manager Duties");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const windowInvalid = !!from && !!to && to < from;
  // One substitute per manager at a time — a second active cover over the same dates would leave approvals ambiguous.
  const overlapping =
    !!managerId &&
    !!from &&
    !!to &&
    rows.find(
      (s) => s.status === "Active" && s.managerId === managerId && !(to < s.from || from > s.to),
    );
  const valid =
    managerId &&
    substituteId &&
    from &&
    to &&
    !windowInvalid &&
    !overlapping &&
    managerId !== substituteId;

  function submit() {
    const m = EMPLOYEES.find((e) => e.id === managerId);
    const s = EMPLOYEES.find((e) => e.id === substituteId);
    addSubstitute({
      managerId,
      manager: m.name,
      substituteId,
      substitute: s.name,
      scope,
      from,
      to,
      reason: reason.trim(),
    });
    toast.success(`${s.name} will cover for ${m.name}`);
    setOpen(false);
    setManagerId("");
    setSubstituteId("");
    setFrom("");
    setTo("");
    setReason("");
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Substitute Assignments</div>
              <div className="text-muted-foreground text-xs">
                Delegate manager duties — approvals and reviews — while a manager is away
              </div>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald text-white" disabled={!canManage}>
                <Plus className="h-4 w-4" /> Assign Substitute
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Assign a substitute manager</DialogTitle>
                <DialogDescription>
                  The substitute sees the manager's team and duties in their employee portal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Manager <span className="text-destructive">*</span>
                  </Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} · {directReports(map, m.id).length} reports
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Substitute <span className="text-destructive">*</span>
                  </Label>
                  <Select value={substituteId} onValueChange={setSubstituteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEES.filter((e) => e.id !== managerId).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Delegated duties</Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSTITUTE_SCOPES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    From <span className="text-destructive">*</span>
                  </Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    To <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    min={from || undefined}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                  {windowInvalid && (
                    <p className="text-destructive text-xs">"To" must be on or after "From".</p>
                  )}
                  {overlapping && (
                    <p className="text-destructive text-xs">
                      {overlapping.substitute} already covers this manager {overlapping.from} →{" "}
                      {overlapping.to} ({overlapping.id}). End it first or pick other dates.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Reason</Label>
                  <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!valid}
                  className="bg-gradient-emerald text-white"
                  onClick={submit}
                >
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Ref</th>
                <th className="p-3 text-left">Manager</th>
                <th className="p-3 text-left">Substitute</th>
                <th className="p-3 text-left">Duties</th>
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((s) => (
                <tr key={s.id} className={`${clickableRow} align-top`} onClick={() => setDetail(s)}>
                  <td className="text-muted-foreground p-3 font-mono text-xs">{s.id}</td>
                  <td className="p-3 font-medium">{s.manager}</td>
                  <td className="p-3 font-medium">
                    {s.substitute}
                    <div className="text-muted-foreground text-xs font-normal">{s.reason}</div>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {s.scope}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground p-3">
                    {s.from} → {s.to}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        s.status === "Active"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {s.status === "Active" && canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          endSubstitute(s.id);
                          toast.success("Substitute assignment ended");
                        }}
                      >
                        End now
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-10 text-center">
                    No substitutes assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={`${detail.id} · ${detail.substitute} for ${detail.manager}`}
            subtitle={`${detail.scope} · ${detail.from} → ${detail.to}`}
            badges={
              <Badge
                variant="outline"
                className={
                  detail.status === "Active"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }
              >
                {detail.status}
              </Badge>
            }
            record={detail}
            labels={{
              managerId: "Manager ID",
              substituteId: "Substitute ID",
              scope: "Delegated duties",
              from: "From date",
              to: "To date",
            }}
            sections={[
              {
                title: "Assignment",
                keys: ["id", "manager", "managerId", "substitute", "substituteId", "status"],
              },
              { title: "Scope & period", keys: ["scope", "from", "to", "reason"] },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
