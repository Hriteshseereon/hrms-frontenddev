import { useMemo, useState } from "react";
import {
  ClipboardX,
  Plus,
  Check,
  X,
  Archive,
  Trash2,
  Eye,
  FileDown,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  findEmployee,
  getEmployeeProfile,
  useDirectory,
} from "@/features/employees/data/employee-directory";
import { usePerformanceScope } from "@/features/performance/components/scope";
import { useGoals } from "@/features/performance/data/goals-data";
import { exportReportPdf } from "@/lib/export-utils";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import {
  PIP_CADENCES,
  PIP_REASON_CATEGORIES,
  PIP_SUPPORT,
  ackPIP,
  addPIPReview,
  createDetailedPIP,
  pipTone,
  updatePIP,
  usePIPs,
} from "@/features/performance/data/pip-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import { clickableRow } from "@/components/common/RecordDetail";

/**
 * PIP lives inside the single admin app; who can see it is governed by RBAC and
 * the reporting hierarchy — a manager only ever sees their own reporting tree.
 */
export function PIPTab({ managerId }) {
  const pips = usePIPs();
  const perf = usePerformanceScope();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  // Tenant + hierarchy scope. The old `allReports()` only knew the SRN-014x reporting links, so a real manager
  // (e.g. Subh Sahoo) saw no PIPs and could not pick any team member in the form.
  const rows = pips.filter((p) => perf.canSee(p.empId));
  const active = rows.find((p) => p.id === detailId) ?? null;

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardX className="text-primary h-4 w-4" /> Performance Improvement Plans
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Structured plans — why the PIP, detailed reason, date & time range with checkpoints,
              concerned persons, linked goals / tasks, objectives, support and consequences. Click a
              plan to open it.
              {managerId || !perf.orgWide ? " You only see employees reporting to you." : ""}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium ml-auto text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create PIP
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Ref",
                  "Employee",
                  "Why",
                  "Period",
                  "Cadence",
                  "Concerned",
                  "Objectives",
                  "Ack",
                  "Status",
                  "",
                ].map((h) => (
                  <th key={h} className="p-3 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={cn(clickableRow, "align-top")}
                  onClick={() => setDetailId(p.id)}
                >
                  <td className="text-muted-foreground p-3 font-mono text-xs">{p.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{p.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {p.empId}
                      {p.designation ? ` · ${p.designation}` : ""}
                    </div>
                  </td>
                  <td className="max-w-[280px] p-3 text-xs">
                    {p.reasonCategory && (
                      <Badge variant="outline" className="mb-1">
                        {p.reasonCategory}
                      </Badge>
                    )}
                    <div className="text-muted-foreground line-clamp-2">{p.reason}</div>
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {p.start} → {p.end}
                    {p.timeRange && (
                      <div className="text-muted-foreground">
                        {p.timeRange.startTime}–{p.timeRange.endTime}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.cadence ?? "—"}
                    <div className="text-muted-foreground">
                      {p.checkpoints?.length ?? 0} checkpoints
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {[
                      p.concerned?.manager?.name,
                      p.concerned?.hrPartner?.name,
                      p.concerned?.mentor?.name,
                    ]
                      .filter(Boolean)
                      .join(", ") || p.raisedBy}
                  </td>
                  <td className="p-3 text-xs">
                    {p.objectives.filter((o) => o.done).length}/{p.objectives.length} met
                  </td>
                  <td className="p-3 text-xs">
                    {p.employeeAck ? (
                      <span className="text-primary">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={pipTone(p.status)}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Eye className="text-muted-foreground h-4 w-4" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted-foreground p-10 text-center">
                    No improvement plans on record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create performance improvement plan</DialogTitle>
              <DialogDescription>
                Everything the employee and the concerned persons need to understand the plan:
                reason, evidence, timeline with checkpoints, objectives, support and consequences.
              </DialogDescription>
            </DialogHeader>
            <PIPForm managerId={managerId} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={!!active} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {active && <PIPDetail pip={active} mode="hr" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Detail ---------------- */
export function PIPDetail({ pip, mode }) {
  const me = useCurrentUser();
  const [mgr, setMgr] = useState(pip.managerRemarks);
  const [hr, setHr] = useState(pip.hrRemarks);
  const [evalText, setEvalText] = useState(pip.finalEvaluation);
  const [note, setNote] = useState("");
  // Checkpoint notes are logged against a checkpoint date (default: the latest scheduled checkpoint not yet reviewed, else today).
  const [noteDate, setNoteDate] = useState(() => {
    const t = new Date().toISOString().slice(0, 10);
    const due = (pip.checkpoints ?? []).filter(
      (c) => c <= t && !pip.reviews.some((r) => r.date === c),
    );
    return due[due.length - 1] ?? t;
  });
  const [ack, setAck] = useState("");
  const pdf = () =>
    exportReportPdf({
      title: `Performance Improvement Plan ${pip.id}`,
      subtitle: `${pip.employee} (${pip.empId}) · ${pip.start} → ${pip.end} · raised by ${pip.raisedBy} · ${pip.status}`,
      columns: ["Item", "Detail"],
      rows: [
        ["Reason", `${pip.reasonCategory ?? ""} — ${pip.reason}`],
        ["Detailed reason", pip.detailedReason ?? "—"],
        ["Evidence", pip.evidence ?? "—"],
        ["Prior actions", pip.priorActions ?? "—"],
        [
          "Timeline",
          `${pip.start} → ${pip.end}${pip.timeRange ? ` · ${pip.timeRange.startTime}–${pip.timeRange.endTime}` : ""} · ${pip.cadence ?? ""} checkpoints: ${(pip.checkpoints ?? []).join(", ")}`,
        ],
        [
          "Concerned persons",
          [
            pip.concerned?.manager && `Manager ${pip.concerned.manager.name}`,
            pip.concerned?.hrPartner && `HR ${pip.concerned.hrPartner.name}`,
            pip.concerned?.mentor && `Mentor ${pip.concerned.mentor.name}`,
            ...(pip.concerned?.others ?? []).map((o) => o.name),
          ]
            .filter(Boolean)
            .join("; "),
        ],
        [
          "Goals",
          (pip.goals ?? []).map((g) => `${g.title} (${g.status}, ${g.progress} %)`).join("; ") ||
            "—",
        ],
        ["Tasks", (pip.tasks ?? []).join("; ") || "—"],
        ...pip.objectives.map((o) => [
          `Objective${o.done ? " ✓" : ""}`,
          `${o.objective} — measure: ${o.measure}${o.targetDate ? ` by ${o.targetDate}` : ""}`,
        ]),
        ["Support", (pip.support ?? []).join(", ") || "—"],
        ["Expected outcome", pip.expectedOutcome ?? "—"],
        ["Consequences", pip.consequences ?? "—"],
        ...pip.reviews.map((r) => [`Checkpoint ${r.date}`, `${r.by}: ${r.notes}`]),
        ["Manager remarks", pip.managerRemarks || "—"],
        ["HR remarks", pip.hrRemarks || "—"],
        ["Final evaluation", pip.finalEvaluation || "—"],
        [
          "Employee acknowledgement",
          pip.employeeAck ? `${pip.employeeAck.on} — ${pip.employeeAck.comment}` : "Pending",
        ],
      ],
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardX className="text-primary h-5 w-5" /> {pip.employee} · {pip.id}
        </DialogTitle>
        <DialogDescription>
          {pip.designation ? `${pip.designation} · ${pip.department} · ` : ""}
          {pip.start} → {pip.end}
          {pip.timeRange ? ` · ${pip.timeRange.startTime}–${pip.timeRange.endTime}` : ""} · raised
          by {pip.raisedBy}
          {pip.createdOn ? ` on ${pip.createdOn}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={pipTone(pip.status)}>
          {pip.status}
        </Badge>
        {pip.reasonCategory && <Badge variant="outline">{pip.reasonCategory}</Badge>}
        {pip.cadence && <Badge variant="outline">{pip.cadence} checkpoints</Badge>}
        <Badge variant="outline">
          {pip.objectives.filter((o) => o.done).length}/{pip.objectives.length} objectives met
        </Badge>
        {pip.employeeAck ? (
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Acknowledged {pip.employeeAck.on}
          </Badge>
        ) : (
          <Badge variant="outline">Acknowledgement pending</Badge>
        )}
      </div>
      <div className="space-y-4">
        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Why this PIP
          </div>
          <p className="text-sm font-medium">{pip.reason}</p>
          {pip.detailedReason && <p className="text-sm">{pip.detailedReason}</p>}
          <KV
            items={[
              ["Evidence", pip.evidence ?? "—"],
              ["Prior actions taken", pip.priorActions ?? "—"],
              ["Expected outcome", pip.expectedOutcome ?? "—"],
              ["Consequences", pip.consequences ?? "—"],
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Concerned persons
            </div>
            <KV
              cols={1}
              items={[
                [
                  "Reporting manager",
                  pip.concerned?.manager
                    ? `${pip.concerned.manager.name} · ${pip.concerned.manager.role}`
                    : pip.raisedBy,
                ],
                [
                  "HR partner",
                  pip.concerned?.hrPartner
                    ? `${pip.concerned.hrPartner.name} · ${pip.concerned.hrPartner.role}`
                    : "—",
                ],
                [
                  "Mentor / buddy",
                  pip.concerned?.mentor
                    ? `${pip.concerned.mentor.name} · ${pip.concerned.mentor.role}`
                    : "—",
                ],
                ["Others", (pip.concerned?.others ?? []).map((o) => o.name).join(", ") || "—"],
              ]}
            />
          </div>
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Timeline & checkpoints
            </div>
            <KV
              cols={1}
              items={[
                ["Date range", `${pip.start} → ${pip.end}`],
                [
                  "Working hours in scope",
                  pip.timeRange ? `${pip.timeRange.startTime} – ${pip.timeRange.endTime}` : "—",
                ],
                ["Cadence", pip.cadence ?? "—"],
              ]}
            />
            <div className="flex flex-wrap gap-1">
              {(pip.checkpoints ?? []).map((c) => {
                const done = pip.reviews.some((r) => r.date === c);
                return (
                  <Badge
                    key={c}
                    variant="outline"
                    className={cn(
                      "font-normal",
                      done && "border-primary/30 bg-primary/10 text-primary",
                    )}
                  >
                    {c}
                    {done ? " ✓" : ""}
                  </Badge>
                );
              })}
              {(pip.checkpoints ?? []).length === 0 && (
                <span className="text-muted-foreground text-xs">No checkpoints scheduled.</span>
              )}
            </div>
          </div>
        </div>
        {((pip.goals?.length ?? 0) > 0 || (pip.tasks?.length ?? 0) > 0) && (
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Concerned goals & tasks
            </div>
            {(pip.goals ?? []).map((g) => (
              <div key={g.goalId} className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{g.status}</Badge>
                <span>{g.title}</span>
                <span className="text-muted-foreground ml-auto text-xs">{g.progress} %</span>
              </div>
            ))}
            {(pip.tasks ?? []).length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {(pip.tasks ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wider uppercase">
            Objectives & measures
          </Label>
          {pip.objectives.map((o) => (
            <div key={o.id} className="border-border flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={o.done}
                disabled={
                  mode === "self" ||
                  pip.status === "Successful" ||
                  pip.status === "Failed" ||
                  pip.status === "Archived"
                }
                onCheckedChange={() =>
                  updatePIP(pip.id, {
                    objectives: pip.objectives.map((x) =>
                      x.id === o.id ? { ...x, done: !x.done } : x,
                    ),
                  })
                }
              />
              <div className="flex-1">
                <div className={"text-sm " + (o.done ? "text-muted-foreground line-through" : "")}>
                  {o.objective}
                </div>
                <div className="text-muted-foreground text-xs">
                  Measure: {o.measure}
                  {o.targetDate ? ` · by ${o.targetDate}` : ""}
                  {o.owner ? ` · owner ${o.owner}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
        {(pip.support?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-muted-foreground self-center text-xs">Support provided:</span>
            {(pip.support ?? []).map((s) => (
              <Badge key={s} variant="outline" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}
        {(pip.attachments?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-muted-foreground self-center text-xs">Attachments:</span>
            {(pip.attachments ?? []).map((s) => (
              <Badge key={s} variant="outline" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wider uppercase">
            Checkpoint reviews
          </Label>
          {pip.reviews.map((r) => (
            <div key={r.id} className="border-border rounded-lg border p-3">
              <div className="text-sm">{r.notes}</div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {r.by} · <span className="whitespace-nowrap">{r.date}</span>
              </div>
            </div>
          ))}
          {pip.reviews.length === 0 && (
            <div className="text-muted-foreground text-xs">No checkpoint notes yet.</div>
          )}
          {mode === "hr" && (
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[200px] flex-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a checkpoint note"
              />
              <Input
                type="date"
                className="w-full sm:w-40"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                title="Checkpoint date"
              />
              <Button
                variant="outline"
                disabled={!note.trim() || !noteDate}
                onClick={() => {
                  addPIPReview(pip.id, me.name, note.trim(), noteDate);
                  updatePIP(pip.id, {
                    history: [
                      ...(pip.history ?? []),
                      {
                        at: new Date().toISOString().slice(0, 10),
                        by: me.name,
                        action: `Checkpoint note added (${noteDate})`,
                      },
                    ],
                  });
                  setNote("");
                  toast.success("Checkpoint note added");
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        {mode === "hr" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Manager remarks</Label>
                <Textarea rows={3} value={mgr} onChange={(e) => setMgr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">HR remarks</Label>
                <Textarea rows={3} value={hr} onChange={(e) => setHr(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Final evaluation</Label>
              <Textarea rows={2} value={evalText} onChange={(e) => setEvalText(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updatePIP(pip.id, {
                  managerRemarks: mgr,
                  hrRemarks: hr,
                  finalEvaluation: evalText,
                });
                toast.success("PIP updated");
              }}
            >
              Save remarks
            </Button>
          </>
        )}
        {mode === "self" && (
          <div className="border-border space-y-2 rounded-xl border p-4">
            <KV
              items={[
                ["Manager remarks", pip.managerRemarks || "—"],
                ["HR remarks", pip.hrRemarks || "—"],
                ["Final evaluation", pip.finalEvaluation || "—"],
              ]}
            />
            {!pip.employeeAck && pip.empId === me.id && (
              <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-3">
                <Textarea
                  rows={2}
                  value={ack}
                  onChange={(e) => setAck(e.target.value)}
                  placeholder="Your comment (optional)"
                />
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    ackPIP(pip.id, ack.trim());
                    toast.success("Plan acknowledged");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Acknowledge the plan
                </Button>
              </div>
            )}
          </div>
        )}
        {(pip.history?.length ?? 0) > 0 && (
          <div className="text-muted-foreground space-y-0.5 text-xs">
            {(pip.history ?? []).map((h, i) => (
              <div key={i}>
                {h.at} · {h.by} — {h.action}
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={pdf}>
          <FileDown className="h-4 w-4" /> PIP PDF
        </Button>
        {mode === "hr" && pip.empId !== me.id && (
          <>
            {pip.status !== "Archived" && (
              <Button
                variant="outline"
                onClick={() => {
                  updatePIP(pip.id, {
                    status: "Archived",
                    history: [
                      ...(pip.history ?? []),
                      {
                        at: new Date().toISOString().slice(0, 10),
                        by: me.name,
                        action: "Archived",
                      },
                    ],
                  });
                  toast.success("PIP archived");
                }}
              >
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
            {(pip.status === "Draft" ||
              pip.status === "Active" ||
              pip.status === "Under Review") && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    if (!evalText.trim())
                      return toast.error("Write the final evaluation before closing the plan.");
                    updatePIP(pip.id, {
                      status: "Failed",
                      managerRemarks: mgr,
                      hrRemarks: hr,
                      finalEvaluation: evalText.trim(),
                      history: [
                        ...(pip.history ?? []),
                        {
                          at: new Date().toISOString().slice(0, 10),
                          by: me.name,
                          action: "Closed — objectives not met",
                        },
                      ],
                    });
                    pushAlert({
                      empId: pip.empId,
                      kind: "review",
                      to: "/emp/appraisals",
                      title: `Improvement plan ${pip.id} closed`,
                      body: "Outcome: objectives not met. Read the final evaluation on My Appraisals.",
                    });
                    toast.success("PIP marked failed");
                  }}
                >
                  <X className="h-4 w-4" /> Mark failed
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    if (!evalText.trim())
                      return toast.error("Write the final evaluation before closing the plan.");
                    if (pip.objectives.some((o) => !o.done))
                      return toast.error(
                        "Tick every objective as met before closing the plan as successful.",
                      );
                    updatePIP(pip.id, {
                      status: "Successful",
                      managerRemarks: mgr,
                      hrRemarks: hr,
                      finalEvaluation: evalText.trim(),
                      history: [
                        ...(pip.history ?? []),
                        {
                          at: new Date().toISOString().slice(0, 10),
                          by: me.name,
                          action: "Closed — objectives met",
                        },
                      ],
                    });
                    pushAlert({
                      empId: pip.empId,
                      kind: "review",
                      to: "/emp/appraisals",
                      title: `Improvement plan ${pip.id} closed — successful`,
                      body: "Objectives met. Read the final evaluation on My Appraisals.",
                    });
                    toast.success("PIP marked successful");
                  }}
                >
                  <Check className="h-4 w-4" /> Mark successful
                </Button>
              </>
            )}
          </>
        )}
      </DialogFooter>
    </>
  );
}

/* ---------------- Detailed form ---------------- */
const stepDays = { Weekly: 7, Fortnightly: 14, Monthly: 30 };
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function checkpointsFor(start, end, cadence) {
  if (!start || !end) return [];
  const out = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  d.setDate(d.getDate() + stepDays[cadence]);
  while (d <= last && out.length < 26) {
    out.push(isoLocal(d));
    d.setDate(d.getDate() + stepDays[cadence]);
  }
  if (out[out.length - 1] !== end) out.push(end);
  return out;
}

function PIPForm({ onDone }) {
  const me = useCurrentUser();
  const directory = useDirectory();
  const allGoals = useGoals();
  const perf = usePerformanceScope();
  const [empId, setEmpId] = useState("");
  const emp = findEmployee(empId);
  const profile = emp ? getEmployeeProfile(emp.id) : null;
  const managerRow = profile
    ? directory.find((e) => e.name === profile.job.reportingManager)
    : undefined;
  const personOf = (id) => {
    const e = findEmployee(id);
    return e ? { id: e.id, name: e.name, role: e.role } : undefined;
  };

  const [reasonCategory, setReasonCategory] = useState("Delivery / productivity slippage");
  const [reason, setReason] = useState("");
  const [detailedReason, setDetailedReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [priorActions, setPriorActions] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:30");
  const [cadence, setCadence] = useState("Weekly");
  const [hrPartner, setHrPartner] = useState("");
  const [mentor, setMentor] = useState("");
  const [other, setOther] = useState("");
  const [goalIds, setGoalIds] = useState([]);
  const [tasks, setTasks] = useState([""]);
  const [objectives, setObjectives] = useState([
    { id: "OBJ-1", objective: "", measure: "", done: false, targetDate: "" },
  ]);
  const [support, setSupport] = useState([]);
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [consequences, setConsequences] = useState(
    "If the objectives are not met by the end date, the plan may be extended once or further action taken as per the HR policy.",
  );
  const [attachments, setAttachments] = useState([]);
  const checkpoints = useMemo(() => checkpointsFor(start, end, cadence), [start, end, cadence]);
  const empGoals = allGoals.filter((g) => g.ownerId === empId);
  const valid =
    emp &&
    reason.trim() &&
    detailedReason.trim() &&
    start &&
    end &&
    end >= start &&
    (!startTime || !endTime || endTime > startTime) &&
    objectives.some((o) => o.objective.trim() && o.measure.trim());

  const submit = () => {
    if (!emp) return;
    const r = createDetailedPIP(
      {
        empId: emp.id,
        employee: emp.name,
        designation: emp.role,
        department: emp.dept,
        raisedBy: me.name,
        raisedById: me.id,
        reason: reason.trim(),
        reasonCategory,
        detailedReason: detailedReason.trim(),
        evidence: evidence.trim(),
        priorActions: priorActions.trim(),
        start,
        end,
        timeRange: { startTime, endTime },
        cadence,
        checkpoints,
        concerned: {
          manager: managerRow
            ? { id: managerRow.id, name: managerRow.name, role: managerRow.role }
            : personOf(me.id),
          hrPartner: personOf(hrPartner),
          mentor: personOf(mentor),
          others: [personOf(other)].filter(Boolean),
        },
        goals: empGoals
          .filter((g) => goalIds.includes(g.id))
          .map((g) => ({ goalId: g.id, title: g.title, status: g.status, progress: g.progress })),
        tasks: tasks.map((t) => t.trim()).filter(Boolean),
        objectives: objectives.filter((o) => o.objective.trim()),
        support,
        expectedOutcome: expectedOutcome.trim(),
        consequences: consequences.trim(),
        attachments,
        employeeAck: null,
      },
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onDone();
  };

  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee & why the PIP" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Employee" required className="sm:col-span-2">
          <EmployeePicker
            value={empId}
            onChange={(id) => setEmpId(id)}
            exclude={directory.filter((e) => !perf.canSee(e.id) || e.id === me.id).map((e) => e.id)}
          />
        </Field>
        {emp && (
          <div className="bg-muted/40 flex flex-wrap gap-x-6 gap-y-1 rounded-lg p-3 text-xs sm:col-span-2">
            <span>
              {emp.role} · {emp.dept} · {emp.branch}
            </span>
            <span>
              Reporting to <b>{profile?.job.reportingManager}</b>
            </span>
            <span>
              Grade <b>{profile?.job.grade}</b>
            </span>
            <span>{empGoals.length} goal(s) on record</span>
          </div>
        )}
        <Field label="Reason category" required>
          <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIP_REASON_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Raised by">
          <Input value={`${me.name} (${me.role})`} disabled />
        </Field>
        <Field label="Reason (summary)" required className="sm:col-span-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="One line — what triggered the plan"
          />
        </Field>
        <Field
          label="Detailed reason"
          required
          className="sm:col-span-2"
          hint="Specific, dated, evidence-based — this is what the employee reads"
        >
          <Textarea
            rows={4}
            value={detailedReason}
            onChange={(e) => setDetailedReason(e.target.value)}
          />
        </Field>
        <Field label="Evidence / references">
          <Textarea
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Sprint reports, client mails, attendance…"
          />
        </Field>
        <Field label="Prior actions taken">
          <Textarea
            rows={2}
            value={priorActions}
            onChange={(e) => setPriorActions(e.target.value)}
            placeholder="Feedback given on…, coaching, warnings"
          />
        </Field>
      </div>

      <SectionTitle
        n={2}
        title="Time & date range"
        sub="Checkpoints are generated from the cadence"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Field label="Start date" required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End date" required>
          <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Working hours from">
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="to">
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
        <Field label="Checkpoint cadence">
          <Select value={cadence} onValueChange={(v) => setCadence(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIP_CADENCES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-1 sm:col-span-5">
          {checkpoints.map((c) => (
            <Badge key={c} variant="outline" className="font-normal">
              {c}
            </Badge>
          ))}
          {checkpoints.length === 0 && (
            <span className="text-muted-foreground text-xs">Set the dates to see checkpoints.</span>
          )}
        </div>
      </div>

      <SectionTitle
        n={3}
        title="Concerned persons"
        sub="Everyone here is notified and can add checkpoint notes"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Reporting manager">
          <Input
            value={
              managerRow
                ? `${managerRow.name} · ${managerRow.role}`
                : (profile?.job.reportingManager ?? "—")
            }
            disabled
          />
        </Field>
        <Field label="HR partner">
          <EmployeePicker value={hrPartner} onChange={(id) => setHrPartner(id)} />
        </Field>
        <Field label="Mentor / buddy">
          <EmployeePicker value={mentor} onChange={(id) => setMentor(id)} />
        </Field>
        <Field label="Other concerned person (skip-level, client lead)" className="sm:col-span-3">
          <EmployeePicker value={other} onChange={(id) => setOther(id)} />
        </Field>
      </div>

      <SectionTitle
        n={4}
        title="Concerned goals & tasks"
        sub="Link the goals the PIP is about and list specific tasks"
      />
      <div className="space-y-2">
        {empGoals.length === 0 && (
          <div className="text-muted-foreground text-xs">
            {empId ? "No goals on record for this employee." : "Select an employee to load goals."}
          </div>
        )}
        {empGoals.map((g) => (
          <label
            key={g.id}
            className="border-border flex items-center gap-2 rounded-lg border p-2 text-sm"
          >
            <Checkbox
              checked={goalIds.includes(g.id)}
              onCheckedChange={(v) =>
                setGoalIds(v ? [...goalIds, g.id] : goalIds.filter((x) => x !== g.id))
              }
            />
            <span className="font-medium">{g.title}</span>
            <Badge variant="outline" className="ml-auto">
              {g.status}
            </Badge>
            <span className="text-muted-foreground text-xs">{g.progress} %</span>
          </label>
        ))}
        <Label className="text-muted-foreground text-xs">Tasks</Label>
        {tasks.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={t}
              onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="e.g. Close SPOT-412 by sprint 33"
            />
            {tasks.length > 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive shrink-0"
                onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setTasks([...tasks, ""])}>
          <Plus className="h-3.5 w-3.5" /> Add task
        </Button>
      </div>

      <SectionTitle n={5} title="Objectives, support & consequences" />
      <div className="space-y-2">
        {objectives.map((o, i) => (
          <div
            key={o.id}
            className="border-border grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-12"
          >
            <Field label="Objective" required className="sm:col-span-5">
              <Input
                value={o.objective}
                onChange={(e) =>
                  setObjectives((p) =>
                    p.map((x, y) => (y === i ? { ...x, objective: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label="Measure of success" required className="sm:col-span-4">
              <Input
                value={o.measure}
                onChange={(e) =>
                  setObjectives((p) =>
                    p.map((x, y) => (y === i ? { ...x, measure: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label="Target date" className="sm:col-span-2">
              <Input
                type="date"
                value={o.targetDate ?? ""}
                onChange={(e) =>
                  setObjectives((p) =>
                    p.map((x, y) => (y === i ? { ...x, targetDate: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <div className="flex items-end justify-end">
              {objectives.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setObjectives((p) => p.filter((_, y) => y !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setObjectives((p) => [
              ...p,
              {
                id: `OBJ-${p.reduce((m, o) => Math.max(m, Number(o.id.replace(/^OBJ-/, "")) || 0), 0) + 1}`,
                objective: "",
                measure: "",
                done: false,
                targetDate: "",
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add objective
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-muted-foreground text-xs">Support provided</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {PIP_SUPPORT.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  support.includes(s)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border",
                )}
              >
                <Checkbox
                  checked={support.includes(s)}
                  onCheckedChange={(v) =>
                    setSupport(v ? [...support, s] : support.filter((x) => x !== s))
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </div>
        <Field label="Expected outcome at the end of the plan">
          <Textarea
            rows={2}
            value={expectedOutcome}
            onChange={(e) => setExpectedOutcome(e.target.value)}
          />
        </Field>
        <Field label="Consequences if not met">
          <Textarea
            rows={2}
            value={consequences}
            onChange={(e) => setConsequences(e.target.value)}
          />
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Attachments (evidence, prior feedback)"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
          Create PIP & notify
        </Button>
      </DialogFooter>
    </div>
  );
}
