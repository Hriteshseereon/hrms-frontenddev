// Drill-down for a failed payroll compliance check: what failed, why, where it is fixed, and the two ways out —
// HR resolves it here (fix the statutory record / verify manually / override with justification) or sends it to the
// concerned person, which drops a notification in their portal and marks the check "Escalated" until it clears.
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Send,
  ShieldCheck,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  findEmployee,
  getEmployeeProfile,
  useDirectory,
} from "@/features/employees/data/employee-directory";
import {
  escalateCheck,
  guideFor,
  isOpenCheck,
  overridePermission,
  resolveCheck,
  periodLabel,
} from "@/features/payroll/data/payroll-engine";
import { EmployeePicker, Field, KV } from "@/features/employees/components/CasePieces";

export const levelTone = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-gold/40 bg-gold/15 text-gold",
  info: "border-border bg-muted text-muted-foreground",
};

export const checkLabelTone = {
  "Check failed": "border-destructive/40 bg-destructive/10 text-destructive",
  Warning: "border-gold/40 bg-gold/15 text-gold",
  Escalated:
    "border-[oklch(0.6_0.15_260)]/40 bg-[oklch(0.6_0.15_260)]/10 text-[oklch(0.4_0.15_260)] dark:text-[oklch(0.78_0.12_260)]",
  Resolved: "border-primary/40 bg-primary/10 text-primary",
  OK: "border-border bg-muted text-muted-foreground",
  Open: "border-destructive/40 bg-destructive/10 text-destructive",
  Overridden: "border-primary/40 bg-primary/10 text-primary",
};

const statusOf = (c) => c.status ?? "Open";

/** Dialog listing every check for one employee (or a single run-level check) with the resolve / escalate actions. */
export function ComplianceCheckDialog({ run, empId, checkId, canAct, onClose }) {
  const checks = useMemo(() => {
    const list = checkId
      ? run.checks.filter((c) => c.id === checkId)
      : run.checks.filter((c) => c.empId === empId);
    const order = { error: 0, warning: 1, info: 2 };
    return [...list].sort((a, b) =>
      isOpenCheck(a) === isOpenCheck(b) ? order[a.level] - order[b.level] : isOpenCheck(a) ? -1 : 1,
    );
  }, [run, empId, checkId]);
  const line = empId ? run.lines.find((l) => l.empId === empId) : undefined;
  const first = checks[0];
  const [active, setActive] = useState(first?.id ?? "");
  const current = checks.find((c) => c.id === active) ?? first;
  const openCount = checks.filter((c) => isOpenCheck(c)).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary h-4 w-4" />
            {line
              ? `${line.name} · compliance checks`
              : `${first?.code ?? "Check"} · ${periodLabel(run.period)}`}
          </DialogTitle>
          <DialogDescription>
            {line
              ? `${line.empId} · ${line.designation} · ${line.dept} · ${line.branch} (${line.state}) · run ${run.id} · ${periodLabel(run.period)}`
              : `Run-level check on ${run.id}`}
            {" · "}
            {openCount ? `${openCount} open` : "nothing outstanding"}
          </DialogDescription>
        </DialogHeader>

        {checks.length === 0 && (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No checks recorded for this employee in {run.id}.
          </div>
        )}

        {checks.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  levelTone[c.level],
                  current?.id === c.id ? "ring-primary/40 ring-2" : "opacity-80 hover:opacity-100",
                )}
              >
                {c.code} · {statusOf(c)}
              </button>
            ))}
          </div>
        )}

        {current && (
          <CheckPanel key={current.id} run={run} check={current} canAct={canAct} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckPanel({ run, check, canAct, onDone }) {
  const me = useCurrentUser();
  const directory = useDirectory();
  const guide = guideFor(check.code);
  const emp = check.empId ? findEmployee(check.empId) : undefined;
  const profile = emp ? getEmployeeProfile(emp.id) : undefined;
  const line = check.empId ? run.lines.find((l) => l.empId === check.empId) : undefined;
  const currentValue = guide.field && line ? line.statutory[guide.field] : "";
  const frozen = !["Draft", "Checks Failed", "Checks Passed", "Rejected"].includes(run.status);
  const open = isOpenCheck(check);

  const [mode, setMode] = useState(null);
  const [value, setValue] = useState(currentValue === "Not applicable" ? "" : currentValue);
  const [note, setNote] = useState("");
  const [toId, setToId] = useState("");
  const [due, setDue] = useState("");

  const managerName = profile?.job.reportingManager;
  const manager = managerName ? directory.find((e) => e.name === managerName) : undefined;
  const suggestions = [
    emp && { id: emp.id, label: `${emp.name} (employee)`, why: "Self-service fix from My Profile" },
    manager && { id: manager.id, label: `${manager.name} (manager)`, why: "Reporting manager" },
    { id: "SRN-0004", label: "Varen Mishra (HR head)", why: "Statutory records" },
    { id: "SRN-0002", label: "Saras Venkatesh (CFO)", why: "Finance / payroll policy" },
    { id: "SRN-0017", label: "Kiran Shetty (Ops HoD)", why: "Attendance & wage roll" },
  ]
    .filter(Boolean)
    // Only people of the run's own organisation — the fixed HR / CFO / Ops suggestions belong to the Seereon entity.
    .filter((s) => directory.find((e) => e.id === s.id)?.orgId === run.orgId);
  const to = directory.find((e) => e.id === toId);

  const act = (r) => {
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onDone();
  };

  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl border p-4", levelTone[check.level])}>
        <div className="flex flex-wrap items-center gap-2">
          {check.level === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : check.level === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <span className="font-mono text-xs font-semibold">{check.code}</span>
          <span className="text-sm font-semibold">{guide.title}</span>
          <Badge variant="outline" className={cn("ml-auto", checkLabelTone[statusOf(check)])}>
            {statusOf(check)}
          </Badge>
        </div>
        <p className="text-foreground/90 mt-2 text-sm">{check.message}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Why it fails
          </div>
          <p className="text-sm">{guide.cause || "—"}</p>
          <KV
            cols={1}
            items={[
              ["Area", guide.area],
              ["Normally fixed by", guide.owner],
              ["HR can fix here", guide.hrFixable ? "Yes" : "No — send to the concerned person"],
            ]}
          />
        </div>
        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Where to fix it
          </div>
          <p className="text-sm">{guide.fix}</p>
          {line && guide.field && (
            <KV
              cols={1}
              items={[
                [
                  guide.fieldLabel ?? guide.field,
                  <span key="k209" className="font-mono">
                    {currentValue || <em className="text-destructive not-italic">blank</em>}
                  </span>,
                ],
              ]}
            />
          )}
          {line && (
            <KV
              cols={1}
              items={[
                ["Earned gross", `₹\u00A0${line.earnedGross.toLocaleString("en-IN")}`],
                ["Net pay", `₹\u00A0${line.net.toLocaleString("en-IN")}`],
                [
                  "PF / ESI",
                  `${line.pf.applicable ? "PF ✓" : "PF –"} · ${line.esi.applicable ? "ESI ✓" : "ESI –"}`,
                ],
              ]}
            />
          )}
        </div>
      </div>

      {(check.resolution || check.escalation) && (
        <div className="border-primary/30 bg-primary/5 space-y-1.5 rounded-xl border p-4 text-sm">
          {check.escalation && (
            <div className="flex items-start gap-2">
              <Send className="mt-0.5 h-4 w-4 text-[oklch(0.5_0.15_260)] dark:text-[oklch(0.78_0.12_260)]" />
              <div>
                <b>Sent to {check.escalation.toName}</b> ({check.escalation.toRole}) by{" "}
                {check.escalation.by} on {check.escalation.on}
                {check.escalation.due ? ` · due ${check.escalation.due}` : ""}
                {check.escalation.note && (
                  <div className="text-muted-foreground">“{check.escalation.note}”</div>
                )}
                <div className="text-muted-foreground text-xs">
                  Notification delivered to their portal bell. The check clears automatically on the
                  next re-run once the record is corrected.
                </div>
              </div>
            </div>
          )}
          {check.resolution && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-primary mt-0.5 h-4 w-4" />
              <div>
                <b>{check.resolution.action}</b> by {check.resolution.by} on {check.resolution.on}
                {check.resolution.changes && (
                  <div className="font-mono text-xs">{check.resolution.changes}</div>
                )}
                {check.resolution.note && (
                  <div className="text-muted-foreground">“{check.resolution.note}”</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {canAct && !frozen && open && (
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Resolve
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {guide.hrFixable && guide.field && (
              <Button
                variant={mode === "fix" ? "default" : "outline"}
                className={cn(mode === "fix" && "bg-gradient-emerald text-white")}
                onClick={() => setMode("fix")}
              >
                <Wrench className="h-4 w-4" /> Fix record here
              </Button>
            )}
            <Button
              variant={mode === "verify" ? "default" : "outline"}
              className={cn(mode === "verify" && "bg-gradient-emerald text-white")}
              disabled={!overridePermission(run, check, me).ok}
              title={overridePermission(run, check, me).reason}
              onClick={() => setMode("verify")}
            >
              <ShieldCheck className="h-4 w-4" />{" "}
              {check.level === "error" ? "Override with justification" : "Verified manually"}
            </Button>
            <Button
              variant={mode === "send" ? "default" : "outline"}
              className={cn(mode === "send" && "bg-gradient-emerald text-white")}
              onClick={() => setMode("send")}
            >
              <Send className="h-4 w-4" /> Send to concerned person
            </Button>
          </div>

          {mode === "fix" && guide.field && (
            <div className="border-border space-y-3 rounded-xl border p-4">
              <Field label={guide.fieldLabel ?? guide.field} required hint={guide.fieldHint}>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value.toUpperCase())}
                  placeholder={guide.fieldHint}
                  className="font-mono"
                />
              </Field>
              <Field
                label="Note for the audit trail"
                hint="Source of the number — EPFO portal, previous employer passbook, document received on…"
              >
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. UAN taken from EPFO member portal on 28 Jul; passbook attached to the employee file."
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!value.trim()}
                  onClick={() =>
                    act(
                      resolveCheck(run.id, check.id, me, {
                        action: "Record fixed",
                        note,
                        patch: { [guide.field]: value.trim() },
                      }),
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" /> Save & re-check
                </Button>
              </div>
            </div>
          )}

          {!overridePermission(run, check, me).ok && (
            <p className="text-muted-foreground text-[11px]">
              {overridePermission(run, check, me).reason}
            </p>
          )}

          {mode === "verify" && (
            <div className="border-border space-y-3 rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">
                {check.level === "error"
                  ? "Overriding a blocking error lets the run proceed to approval. It stays on the run's audit trail with your name and justification — use only when the record has been verified outside the system."
                  : "Confirms you have checked this manually; the warning is acknowledged and the note is kept on the run's audit trail."}
              </p>
              <Field label="Justification" required>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was verified, with whom, and why the run can proceed…"
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!note.trim()}
                  onClick={() =>
                    act(
                      resolveCheck(run.id, check.id, me, {
                        action:
                          check.level === "error"
                            ? "Overridden with justification"
                            : "Verified manually",
                        note,
                      }),
                    )
                  }
                >
                  <ShieldCheck className="h-4 w-4" />{" "}
                  {check.level === "error" ? "Override & continue" : "Mark verified"}
                </Button>
              </div>
            </div>
          )}

          {mode === "send" && (
            <div className="border-border space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.why}
                    onClick={() => setToId(s.id)}
                    className={cn(
                      "hover:bg-muted rounded-full border px-2.5 py-1 text-[11px] transition",
                      toId === s.id ? "border-primary bg-primary/10 text-primary" : "border-border",
                    )}
                  >
                    <UserRound className="mr-1 inline h-3 w-3" />
                    {s.label}
                  </button>
                ))}
              </div>
              <Field
                label="Concerned person"
                required
                hint="They receive an in-app notification with the issue, the employee and your note; the check shows as Escalated until it clears on re-run."
              >
                <EmployeePicker value={toId} onChange={(id) => setToId(id)} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Needed by">
                  <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </Field>
                <Field label="Pay date of this run">
                  <Input value={run.payDate} readOnly className="bg-muted/40" />
                </Field>
              </div>
              <Field label="Note to the concerned person" required>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`e.g. ${guide.fix}`}
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!toId || !note.trim()}
                  onClick={() =>
                    act(
                      escalateCheck(run.id, check.id, me, {
                        toId,
                        toName: to?.name ?? toId,
                        toRole: to?.role ?? "",
                        note,
                        due: due || undefined,
                      }),
                    )
                  }
                >
                  <Send className="h-4 w-4" /> Send & notify
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {canAct && frozen && (
        <p className="text-muted-foreground text-xs">
          Checks are frozen once the run is {run.status}. Reopen the run as draft to change them.
        </p>
      )}
      {!canAct && (
        <p className="text-muted-foreground text-xs">
          Your role can view compliance checks but not resolve them.
        </p>
      )}
    </div>
  );
}
