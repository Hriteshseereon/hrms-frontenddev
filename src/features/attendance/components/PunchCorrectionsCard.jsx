// HR direct correction (HR / admin only): close missed punch-outs, correct a punch or add a missed one — all through the API.
import { useCallback, useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { attendanceApi } from "@/api/attendanceApi";
import { getEmployees } from "@/api/employeeApi";
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
import { listOf } from "@/features/employees/data/useEmployeeJobOptions";
import { apiError, itemsOf } from "@/features/attendance/components/RegularisationPieces";

const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
const todayIso = () => new Date().toLocaleDateString("en-CA");

export function PunchCorrectionsCard() {
  const [missed, setMissed] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [forbidden, setForbidden] = useState(false);

  const [outs, setOuts] = useState({});
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [inAt, setInAt] = useState("09:30");
  const [outAt, setOutAt] = useState("18:30");
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadMissed = useCallback(async () => {
    try {
      setMissed(itemsOf(await attendanceApi.listPunches({ missed: true, page: 1, limit: 50 })));
    } catch (err) {
      if (err?.response?.status === 403) setForbidden(true);
    }
  }, []);

  useEffect(() => {
    loadMissed();
    getEmployees({ page: 1, limit: 100 })
      .then((res) => setEmployees(listOf(res, ["items", "employees", "data"])))
      .catch(() => {});
  }, [loadMissed]);

  // A punch already on that day means "correct it"; otherwise the form adds a missed punch.
  useEffect(() => {
    setExisting(null);
    setNextDay(false);
    if (!empId || !date) return undefined;
    let alive = true;
    attendanceApi
      .listPunches({ employee_id: empId, from: date, to: date, page: 1, limit: 5 })
      .then((res) => {
        if (!alive) return;
        const p = itemsOf(res)[0] ?? null;
        setExisting(p);
        if (p) {
          const recordedIn = hhmm(p.in_time);
          const recordedOut = hhmm(p.out_time);
          setInAt(recordedIn || "09:30");
          setOutAt(recordedOut || "18:30");
          // Existing overnight punches already carry their actual out date. Reflect that in the
          // correction form instead of silently treating them as same-day punches.
          setNextDay(Boolean(p.out_date && p.out_date > p.date));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [empId, date]);

  const fail = (err) => {
    const { fields, general, status } = apiError(err);
    toast.error(status === 423 ? "Attendance for that month is locked" : fields.reason || general);
  };

  const closeMissed = async (p) => {
    const o = outs[p.id] ?? {};
    setSaving(true);
    try {
      await attendanceApi.regularisePunch(p.id, {
        out_time: o.outAt,
        next_day: !!o.nextDay,
        reason: (o.reason ?? "").trim(),
      });
      toast.success("Punch closed — the employee has been notified");
      await loadMissed();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (existing) {
        await attendanceApi.regularisePunch(existing.id, {
          out_time: outAt,
          in_time: inAt,
          next_day: nextDay,
          reason: reason.trim(),
        });
        toast.success("Punch corrected");
      } else {
        await attendanceApi.addPunch({
          employee_id: empId,
          date,
          in_time: inAt,
          out_time: outAt,
          next_day: nextDay,
          reason: reason.trim(),
        });
        toast.success("Missed punch added");
      }
      setReason("");
      await loadMissed();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  if (forbidden) return null;

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
                  <div className="font-semibold">{p.employee_name}</div>
                  <div className="text-muted-foreground">
                    {p.date} · in {hhmm(p.in_time)} · {p.source}
                  </div>
                  {p.regularisation && (
                    <div className="text-gold">Employee request: {p.regularisation.status}</div>
                  )}
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={saving || !outs[p.id]?.outAt || !outs[p.id]?.reason?.trim()}
                  onClick={() => closeMissed(p)}
                >
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
                  <SelectItem key={e.id} value={String(e.id)}>
                    {[e.first_name, e.last_name].filter(Boolean).join(" ") || e.work_email}
                    {e.employee_code ? ` · ${e.employee_code}` : ""}
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
            <Checkbox checked={nextDay} onCheckedChange={(v) => setNextDay(!!v)} />
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
              disabled={!empId || !reason.trim() || saving}
              onClick={save}
            >
              {existing ? "Correct punch" : "Add missed punch"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
