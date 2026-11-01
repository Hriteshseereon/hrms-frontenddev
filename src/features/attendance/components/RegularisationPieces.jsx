// Missed punch-out regularisation: the employee's request dialog + list, and the approver queue (manager / HR).
import { useCallback, useEffect, useState } from "react";
import { Loader2, ClipboardCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { attendanceApi } from "@/api/attendanceApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** `{detail:[{loc,msg}]}` → `{ fields: {name: msg}, general }`. */
export function apiError(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;
  const fields = {};
  let general = "";
  if (Array.isArray(detail)) {
    detail.forEach((d, i) => {
      const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
      if (key && key !== "body" && typeof key === "string") fields[key] = d.msg;
      if (i === 0) general = d.msg;
    });
  } else if (typeof detail === "string") general = detail;
  return { fields, general: general || err?.message || fallback, status: err?.response?.status };
}

export const itemsOf = (res) => (Array.isArray(res) ? res : (res?.items ?? []));

const STATUS_TONE = {
  PENDING: "border-gold/40 bg-gold/15 text-gold",
  APPROVED: "border-primary/30 bg-primary/10 text-primary",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  WITHDRAWN: "border-border bg-muted text-muted-foreground",
  CLOSED: "border-border bg-muted text-muted-foreground",
};

export function RequestStatus({ r }) {
  return (
    <Badge variant="outline" className={STATUS_TONE[r.status] ?? ""}>
      {r.status === "PENDING" && r.stage ? `Pending · ${r.stage === "HR" ? "HR" : "Manager"}` : r.status}
    </Badge>
  );
}

const hhmm = (t) => (t ? String(t).slice(0, 5) : "—");

/** Employee request: actual out time (+ next day for night shifts) and a reason. Server validates the rules. */
export function RegularisationDialog({ target, onClose, onDone }) {
  const [outTime, setOutTime] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOutTime("");
    setNextDay(false);
    setReason("");
    setErrors({});
  }, [target]);

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      await attendanceApi.createRegularisation({
        ...(target.punch_id ? { punch_id: target.punch_id } : { date: target.date }),
        requested_out_time: outTime,
        next_day: nextDay,
        reason: reason.trim(),
      });
      toast.success("Regularisation request sent");
      onDone?.();
      onClose();
    } catch (err) {
      const { fields, general } = apiError(err);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(general);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request regularisation</DialogTitle>
          <DialogDescription>
            {target ? `${target.date}${target.in_time ? ` · punched in ${hhmm(target.in_time)}` : ""}` : ""} —
            tell us when you actually finished. Your manager / HR will approve it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Actual out time</Label>
            <Input
              type="time"
              value={outTime}
              onChange={(e) => setOutTime(e.target.value)}
              className={errors.requested_out_time ? "border-destructive" : ""}
            />
            {errors.requested_out_time && (
              <p className="text-destructive text-[11px]">{errors.requested_out_time}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={nextDay} onCheckedChange={(v) => setNextDay(!!v)} />
            Out time is on the next day (night shift)
          </label>
          <div className="space-y-1">
            <Label className="text-xs">Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Forgot to punch out, client site, power cut…"
              className={errors.reason ? "border-destructive" : ""}
            />
            {errors.reason && <p className="text-destructive text-[11px]">{errors.reason}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={saving || !outTime || !reason.trim()}
            onClick={submit}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Missed punch-out banner rows: request / pending+withdraw / rejected+request again. */
export function MissedPunchBanner({ missed, locked, onRequest, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  if (!missed?.length) return null;

  const withdraw = async (id) => {
    setBusyId(id);
    try {
      await attendanceApi.withdrawRegularisation(id);
      toast.success("Request withdrawn");
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err).general);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-gold/40 bg-gold/10 space-y-2 rounded-lg border p-3 text-xs">
      <div className="font-semibold">You forgot to punch out. These days are not counted until regularised.</div>
      {missed.map((m) => {
        const reg = m.regularisation;
        return (
          <div key={m.punch_id} className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap">
              {m.date} · in {hhmm(m.in_time)}
            </span>
            {reg?.status === "PENDING" && (
              <>
                <Badge variant="outline" className={STATUS_TONE.PENDING}>
                  Pending
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={busyId === reg.id}
                  onClick={() => withdraw(reg.id)}
                >
                  Withdraw
                </Button>
              </>
            )}
            {reg?.status === "REJECTED" && (
              <Badge variant="outline" className={STATUS_TONE.REJECTED}>
                Rejected
              </Badge>
            )}
            {(!reg || reg.status === "REJECTED") && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={locked}
                onClick={() => onRequest(m)}
              >
                {reg ? "Request again" : "Request regularisation"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The employee's own requests with status and withdraw. */
export function MyRegularisationRequests({ refreshKey, onChanged }) {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(itemsOf(await attendanceApi.getMyRegularisations()));
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const withdraw = async (id) => {
    setBusyId(id);
    try {
      await attendanceApi.withdrawRegularisation(id);
      toast.success("Request withdrawn");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err).general);
    } finally {
      setBusyId(null);
    }
  };

  if (!items?.length) return null;
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="border-border border-b p-4 text-sm font-semibold">My regularisation requests</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Out time</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Decision</th>
              <th className="p-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {items.map((r) => {
              const d = r.hr_decision ?? r.manager_decision;
              return (
                <tr key={r.id}>
                  <td className="p-3 whitespace-nowrap">{r.date}</td>
                  <td className="p-3 whitespace-nowrap">
                    {hhmm(r.approved_out_time || r.requested_out_time)}
                    {r.next_day ? " (+1 day)" : ""}
                  </td>
                  <td className="p-3">{r.reason}</td>
                  <td className="p-3">
                    <RequestStatus r={r} />
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">{d?.reason || (d ? d.status : "—")}</td>
                  <td className="p-3 text-right">
                    {r.can_withdraw && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={busyId === r.id}
                        onClick={() => withdraw(r.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Approver queue. Shown to reporting managers (their line) and HR / admin; anyone else gets nothing. */
export function RegularisationApprovals({ isHr = false, onChanged }) {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [visible, setVisible] = useState(isHr);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [edits, setEdits] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getRegularisationQueue({ status, page: 1, limit: 50 });
      const rows = itemsOf(res);
      setItems(rows);
      if (rows.length) setVisible(true);
      else if (status === "pending" && !isHr) {
        // a manager with nothing pending still needs the card if they have decided requests before
        const all = await attendanceApi.getRegularisationQueue({ status: "all", page: 1, limit: 1 });
        setVisible(itemsOf(all).length > 0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, isHr]);
  useEffect(() => {
    load();
  }, [load]);

  const decide = async (r, action) => {
    const e = edits[r.id] ?? {};
    if (action === "reject" && !e.reason?.trim()) {
      toast.error("Enter a reason to reject");
      return;
    }
    setBusyId(r.id);
    try {
      const res = await attendanceApi.decideRegularisation(r.id, {
        action,
        ...(e.reason?.trim() ? { reason: e.reason.trim() } : {}),
        ...(action === "approve" && isHr && r.stage === "HR" && e.outTime ? { approved_out_time: e.outTime } : {}),
      });
      toast.success(res?.message || (action === "approve" ? "Approved" : "Rejected"));
      await load();
      onChanged?.();
    } catch (err) {
      const { fields, general } = apiError(err);
      toast.error(fields.reason || general);
    } finally {
      setBusyId(null);
    }
  };

  if (!visible) return null;
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="text-primary h-4 w-4" /> Punch regularisation approvals
          {loading && <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />}
        </div>
        <div className="ml-auto w-[150px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["pending", "approved", "rejected", "withdrawn", "all"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="divide-border divide-y">
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-[180px]">
              <div className="font-medium">
                {r.employee_name} <span className="text-muted-foreground text-xs">{r.employee_code}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {r.date} · in {hhmm(r.requested_in_time)} · out {hhmm(r.requested_out_time)}
                {r.next_day ? " (+1 day)" : ""}
              </div>
            </div>
            <div className="min-w-[160px] flex-1 text-xs">{r.reason}</div>
            <RequestStatus r={r} />
            {r.can_decide && (
              <div className="flex flex-wrap items-center gap-2">
                {isHr && r.stage === "HR" && (
                  <Input
                    type="time"
                    className="h-8 w-28"
                    aria-label="Approved out time"
                    value={edits[r.id]?.outTime ?? ""}
                    onChange={(e) =>
                      setEdits((m) => ({ ...m, [r.id]: { ...m[r.id], outTime: e.target.value } }))
                    }
                  />
                )}
                <Input
                  className="h-8 w-40"
                  placeholder="Reason (needed to reject)"
                  value={edits[r.id]?.reason ?? ""}
                  onChange={(e) =>
                    setEdits((m) => ({ ...m, [r.id]: { ...m[r.id], reason: e.target.value } }))
                  }
                />
                <Button
                  size="sm"
                  className="bg-gradient-emerald h-8 text-white"
                  disabled={busyId === r.id}
                  onClick={() => decide(r, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={busyId === r.id}
                  onClick={() => decide(r, "reject")}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="text-muted-foreground p-6 text-center text-sm">No {status} requests.</div>
        )}
      </div>
    </Card>
  );
}
