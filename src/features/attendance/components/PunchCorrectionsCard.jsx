// HR punch regularisation: close missed punch-outs and correct / add a punch for an employee. Employees are told to
// "ask HR to regularise" an open punch — this is where HR does it.
import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import {
  addRegularisedPunch,
  missedPunchOuts,
  regularisePunch,
  todayIso,
  usePunches,
} from "@/features/attendance/data/attendance-self";

export function PunchCorrectionsCard() {
  const me = useCurrentUser();
  const punches = usePunches();
  const employees = useScopedEmployees();
  const ids = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);
  const missed = missedPunchOuts(punches).filter((p) => ids.has(p.empId));

  const [outs, setOuts] = useState({});
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [inAt, setInAt] = useState("09:30");
  const [outAt, setOutAt] = useState("18:30");
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");

  const existing = punches
    .filter((p) => p.empId === empId && p.date === date)
    .sort((a, b) => (a.inAt < b.inAt ? 1 : -1))[0];

  const closeMissed = (p) => {
    const o = outs[p.id] ?? {};
    const r = regularisePunch(
      p.id,
      { inAt: p.inAt, outAt: o.outAt ?? "", nextDay: !!o.nextDay, reason: o.reason ?? "" },
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
  };

  const save = () => {
    const emp = employees.find((e) => e.id === empId);
    const r = existing
      ? regularisePunch(existing.id, { inAt, outAt, nextDay, reason }, me)
      : addRegularisedPunch({ empId, employee: emp?.name ?? empId, date, inAt, outAt, reason }, me);
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) setReason("");
  };

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="text-primary h-4 w-4" /> Punch regularisation
          <Badge variant="outline" className="ml-auto">
            {missed.length} missed punch-out{missed.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {missed.length > 0 && (
          <div className="space-y-2">
            {missed.map((p) => (
              <div
                key={p.id}
                className="border-border flex flex-wrap items-end gap-2 rounded-lg border p-2 text-xs"
              >
                <div className="min-w-[160px]">
                  <div className="font-semibold">{p.employee}</div>
                  <div className="text-muted-foreground">
                    {p.date} · in {p.inAt} · {p.source}
                  </div>
                </div>
                <Input
                  type="time"
                  className="h-8 w-full sm:w-28"
                  aria-label="Out time"
                  value={outs[p.id]?.outAt ?? ""}
                  onChange={(e) =>
                    setOuts((o) => ({ ...o, [p.id]: { ...o[p.id], outAt: e.target.value } }))
                  }
                />
                <label className="flex items-center gap-1">
                  <Checkbox
                    checked={!!outs[p.id]?.nextDay}
                    onCheckedChange={(v) =>
                      setOuts((o) => ({ ...o, [p.id]: { ...o[p.id], nextDay: !!v } }))
                    }
                  />
                  next day
                </label>
                <Input
                  className="h-8 min-w-0 flex-1"
                  placeholder="Reason (required)"
                  value={outs[p.id]?.reason ?? ""}
                  onChange={(e) =>
                    setOuts((o) => ({ ...o, [p.id]: { ...o[p.id], reason: e.target.value } }))
                  }
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => closeMissed(p)}>
                  Close punch
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Date</Label>
            <Input
              type="date"
              max={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">In</Label>
            <Input type="time" value={inAt} onChange={(e) => setInAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Out</Label>
            <Input type="time" value={outAt} onChange={(e) => setOutAt(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs">
            <Checkbox
              checked={nextDay}
              disabled={!existing}
              onCheckedChange={(v) => setNextDay(!!v)}
            />
            Out next day
          </label>
          <div className="space-y-1.5 sm:col-span-4">
            <Label className="text-muted-foreground text-xs">Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Device down, forgot to punch out, client site…"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              className="bg-gradient-emerald w-full text-white"
              disabled={!empId || !reason.trim()}
              onClick={save}
            >
              {existing ? `Correct punch ${existing.id}` : "Add missed punch"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
