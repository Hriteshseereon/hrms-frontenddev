// Self-appraisal: employee form (purpose · supported goals · quarter · timeline · ratings · value proposition · submit),
// status stepper, approval queues for Manager / HR / Unit Head, and HR's "apply pay grade" step.
import { usePromotions } from "@/features/employees/data/people-cases";
import { captureFiles } from "@/lib/attachments";
import { useMemo, useState } from "react";
import {
  ClipboardSignature,
  Send,
  CheckCircle2,
  Undo2,
  XCircle,
  BadgeIndianRupee,
  Paperclip,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { useGoals, goalTone } from "@/features/performance/data/goals-data";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useSalaryStructures, computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  APPRAISAL_PURPOSES,
  QUARTERS,
  STAGE_FLOW,
  applyAppraisalOutcome,
  appraisalTone,
  blankRatings,
  createSelfAppraisal,
  decideAppraisal,
  goalsForEmployee,
  renderAppraisalLetter,
  stepForStage,
  unitHeadsFor,
  updateDraft,
  useSelfAppraisals,
} from "@/features/performance/data/self-appraisal";
import { useScopedIds } from "@/features/employees/components/CasePieces";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);
/** Who may act at each approval step. The Manager step is scoped to the reporting manager's own team by the caller (My Team → Team Reviews). */
const STEP_ROLES = {
  Manager: ["SuperAdmin", "Admin", "CEO", "COO", "CTO", "CHRO", "HR", "HOD", "Manager"],
  HR: ["SuperAdmin", "Admin", "CEO", "CHRO", "HR"],
  "Unit Head": ["SuperAdmin", "Admin", "CEO", "COO", "CFO", "CTO", "CHRO", "HOD"],
};
const Pills = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        className={cn(
          "h-9 w-9 rounded-md border text-xs font-semibold sm:h-7 sm:w-7",
          (value ?? 0) >= n ? "bg-gradient-emerald border-primary text-white" : "border-border",
          onChange && "hover:bg-muted",
        )}
      >
        {n}
      </button>
    ))}
  </div>
);

/* ------------------------------------ Employee form ------------------------------------ */
export function SelfAppraisalForm({ existing, onDone }) {
  const me = useCurrentUser();
  useGoals();
  const [purpose, setPurpose] = useState(existing?.purpose ?? "Annual appraisal (increment)");
  const [quarter, setQuarter] = useState(existing?.quarter ?? QUARTERS[1]);
  const [timeline, setTimeline] = useState(
    existing?.timeline ?? { from: "2026-04-01", to: "2026-09-30" },
  );
  const [goals, setGoals] = useState(existing?.goals ?? goalsForEmployee(me.id));
  const [ratings, setRatings] = useState(existing?.ratings ?? blankRatings());
  const [value, setValue] = useState(
    existing?.value ?? {
      achievements: "",
      valueCreated: "",
      justification: "",
      askedFor: "",
      expectedGrade: getEmployeeProfile(me.id).job.grade,
      expectedHikePct: null,
    },
  );
  const [attachments, setAttachments] = useState(existing?.attachments ?? []);
  const structures = useSalaryStructures().filter((s) => s.active);
  const p = getEmployeeProfile(me.id);
  const save = (submit) => {
    const payload = {
      purpose,
      quarter,
      timeline,
      goals,
      ratings,
      value,
      attachments,
      empId: me.id,
    };
    const r = existing
      ? updateDraft(existing.id, payload, me, submit)
      : createSelfAppraisal(payload, me, submit);
    act(r);
    if (r.ok) onDone();
  };
  const missing = ratings.filter((r) => r.self === null).length;
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1 · Purpose, period &amp; timeline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Purpose of this appraisal *</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPRAISAL_PURPOSES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Quarter / cycle</Label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timeline from</Label>
            <Input
              type="date"
              value={timeline.from}
              onChange={(e) => setTimeline({ ...timeline, from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timeline to</Label>
            <Input
              type="date"
              value={timeline.to}
              onChange={(e) => setTimeline({ ...timeline, to: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Current grade · CTC</Label>
            <div className="border-border bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm">
              {p.job.grade} · {inr(p.payroll.ctc)}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reporting to</Label>
            <div className="border-border bg-muted/40 flex h-9 items-center truncate rounded-md border px-3 text-sm">
              {p.job.reportingManager}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            2 · Supported goals{" "}
            <span className="text-muted-foreground text-xs font-normal">
              — your goals with live status; describe the achievement and rate yourself
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {goals.length === 0 && (
            <div className="text-muted-foreground text-xs">
              No goals on record — create goals under My Goals first, or continue without.
            </div>
          )}
          {goals.map((g, i) => (
            <div
              key={g.goalId}
              className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_1.6fr_auto]"
            >
              <div>
                <div className="text-sm font-medium">{g.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <Badge variant="outline" className={goalTone(g.status)}>
                    {g.status}
                  </Badge>
                  <span className="text-muted-foreground">{g.progress}% progress</span>
                </div>
              </div>
              <Input
                className="h-8"
                placeholder="What was achieved against this goal"
                value={g.achievement}
                onChange={(e) =>
                  setGoals(
                    goals.map((x, k) => (k === i ? { ...x, achievement: e.target.value } : x)),
                  )
                }
              />
              <Pills
                value={g.selfRating}
                onChange={(n) =>
                  setGoals(goals.map((x, k) => (k === i ? { ...x, selfRating: n } : x)))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">3 · Self ratings on the evaluation parameters *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ratings.map((r, i) => (
            <div
              key={r.paramId}
              className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_auto_1.4fr]"
            >
              <div className="text-sm font-medium">{r.name}</div>
              <Pills
                value={r.self}
                onChange={(n) =>
                  setRatings(ratings.map((x, k) => (k === i ? { ...x, self: n } : x)))
                }
              />
              <Input
                className="h-8"
                placeholder="Evidence for this rating"
                value={r.note}
                onChange={(e) =>
                  setRatings(ratings.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">4 · Value proposition *</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Key achievements in the period</Label>
            <Textarea
              rows={3}
              value={value.achievements}
              onChange={(e) => setValue({ ...value, achievements: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Value created for the company (revenue, savings, client impact)
            </Label>
            <Textarea
              rows={3}
              value={value.valueCreated}
              onChange={(e) => setValue({ ...value, valueCreated: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Why this appraisal is deserved (justification) *</Label>
            <Textarea
              rows={3}
              value={value.justification}
              onChange={(e) => setValue({ ...value, justification: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expected grade</Label>
            <Select
              value={value.expectedGrade}
              onValueChange={(v) => setValue({ ...value, expectedGrade: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {structures.map((s) => (
                  <SelectItem key={s.grade} value={s.grade}>
                    {s.grade} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expected hike %</Label>
            <Input
              type="number"
              min={0}
              value={value.expectedHikePct ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  expectedHikePct: e.target.value === "" ? null : +e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Supporting documents</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                multiple
                className="max-w-xs text-xs"
                onChange={(e) => {
                  captureFiles(e.target.files);
                  setAttachments([
                    ...attachments,
                    ...Array.from(e.target.files ?? []).map((f) => f.name),
                  ]);
                  e.target.value = "";
                }}
              />
              {attachments.map((a) => (
                <Badge key={a} variant="outline">
                  <Paperclip className="mr-1 h-3 w-3" />
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => save(false)}>
          Save draft
        </Button>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={missing > 0 || !value.justification.trim()}
          onClick={() => save(true)}
        >
          <Send className="h-4 w-4" /> Submit for approval (Manager → HR → Unit Head)
        </Button>
        {missing > 0 && (
          <span className="text-destructive text-xs">{missing} parameter(s) unrated</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------ Read-only detail + stepper ------------------------------------ */
export function SelfAppraisalDetail({ a }) {
  const idx =
    a.stage === "Sent back"
      ? 0
      : a.stage === "Rejected"
        ? STAGE_FLOW.indexOf("Approved")
        : STAGE_FLOW.indexOf(a.stage);
  return (
    <div className="space-y-3 text-sm">
      <WorkflowStepper
        steps={STAGE_FLOW.map((s) => (s === "Draft" ? "Self-appraisal" : s))}
        active={idx}
        failed={a.stage === "Rejected"}
        title={`${a.purpose} · ${a.quarter}`}
        badge={
          <Badge variant="outline" className={appraisalTone(a.stage)}>
            {a.stage}
          </Badge>
        }
      />
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
        {[
          ["Employee", `${a.employee} · ${a.designation}`],
          ["Timeline", `${a.timeline.from} → ${a.timeline.to}`],
          ["Asked for", `${a.value.expectedGrade} · ${a.value.expectedHikePct ?? "—"} %`],
          ["Submitted", a.submittedOn ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
            <div className="font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Supported goals
        </div>
        {a.goals.map((g) => (
          <div
            key={g.goalId}
            className="border-border mt-1 flex items-center justify-between rounded-lg border p-2"
          >
            <div>
              <div className="font-medium">{g.title}</div>
              <div className="text-muted-foreground text-xs">
                {g.status} · {g.progress}% · {g.achievement || "—"}
              </div>
            </div>
            <Badge variant="outline">{g.selfRating ?? "—"}/5</Badge>
          </div>
        ))}
      </div>
      <div>
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Self ratings
        </div>
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {a.ratings.map((r) => (
            <div
              key={r.paramId}
              className="border-border flex items-center justify-between rounded-lg border p-2"
            >
              <span>
                {r.name}
                <span className="text-muted-foreground text-xs"> · {r.note}</span>
              </span>
              <Badge variant="outline">{r.self ?? "—"}/5</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ["Achievements", a.value.achievements],
          ["Value created", a.value.valueCreated],
          ["Justification", a.value.justification],
        ].map(([k, v]) => (
          <div
            key={k}
            className={cn(
              "border-border rounded-lg border p-2",
              k === "Justification" && "sm:col-span-2",
            )}
          >
            <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
            <div>{v || "—"}</div>
          </div>
        ))}
      </div>
      {a.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {a.attachments.map((x) => (
            <Badge key={x} variant="outline">
              <Paperclip className="mr-1 h-3 w-3" />
              {x}
            </Badge>
          ))}
        </div>
      )}
      {a.approvals.length > 0 && (
        <div>
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Approvals
          </div>
          {a.approvals.map((x, i) => (
            <div key={i} className="border-border mt-1 rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {x.step} · {x.by}
                </span>
                <Badge
                  variant="outline"
                  className={
                    x.decision === "Approved"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-destructive/30 text-destructive"
                  }
                >
                  {x.decision} · {x.on}
                </Badge>
              </div>
              <div className="text-muted-foreground text-xs">
                {x.comments}
                {x.rating ? ` · rating ${x.rating}/5` : ""}
                {x.recommendedGrade ? ` · recommends ${x.recommendedGrade}` : ""}
                {x.recommendedHikePct != null ? ` / ${x.recommendedHikePct} %` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {a.outcome && (
        <div className="border-primary/30 bg-primary/5 rounded-xl border p-3">
          <div className="flex items-center gap-2 font-semibold">
            <BadgeIndianRupee className="text-primary h-4 w-4" /> Applied on{" "}
            <span className="whitespace-nowrap">{a.outcome.appliedOn}</span> by{" "}
            {a.outcome.appliedBy}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
            {[
              ["Grade", `${a.outcome.previousGrade} → ${a.outcome.newGrade}`],
              ["CTC", `${inr(a.outcome.previousCtc)} → ${inr(a.outcome.newCtc)}`],
              ["Hike", `${a.outcome.hikePct} %`],
              ["Effective", a.outcome.effectiveFrom],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-muted-foreground">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>
              {a.outcome.letterType} <span className="font-mono">{a.outcome.letterRef}</span> ·{" "}
              {a.outcome.remarks}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7"
              onClick={() => {
                if (!renderAppraisalLetter(a))
                  toast.error(`No active ${a.outcome.letterType} template in Doc Master`);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download letter
            </Button>
          </div>
        </div>
      )}
      <div className="text-muted-foreground border-border space-y-0.5 border-t pt-2 text-xs">
        {a.history.map((h, i) => (
          <div key={i}>
            {h.at} · {h.by} — {h.action}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------ Approval queue (Manager / HR / Unit Head) ------------------------------------ */
export function AppraisalApprovals({ step, filter }) {
  const me = useCurrentUser();
  const all = useSelfAppraisals();
  const scoped = useScopedIds();
  const stage =
    step === "Manager" ? "Manager Review" : step === "HR" ? "HR Review" : "Unit Head Review";
  // Active entity only, never your own appraisal, and at the Unit Head step an HOD sees only the appraisals routed to them
  // (the queue used to list every entity's records to any approver role).
  const rows = all.filter(
    (a) =>
      a.stage === stage &&
      a.empId !== me.id &&
      (step === "Manager" || scoped.has(a.empId)) &&
      (!filter || filter(a)) &&
      (step !== "Unit Head" ||
        me.role !== "HOD" ||
        unitHeadsFor(a.empId).some((u) => u.id === me.id)),
  );
  const [open, setOpen] = useState(null);
  const [comments, setComments] = useState("");
  const [rating, setRating] = useState(null);
  const [hike, setHike] = useState(null);
  const [grade, setGrade] = useState("");
  const structures = useSalaryStructures().filter((s) => s.active);
  const mayAct = STEP_ROLES[step].includes(me.role);
  const decide = (d) => {
    if (!open) return;
    const r = decideAppraisal(
      open.id,
      step,
      d,
      {
        rating,
        comments,
        recommendedHikePct: hike,
        recommendedGrade: grade || open.value.expectedGrade,
      },
      me,
    );
    act(r);
    if (!r.ok) return;
    setOpen(null);
    setComments("");
    setRating(null);
    setHike(null);
    setGrade("");
  };
  if (!mayAct) return null;
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardSignature className="text-primary h-4 w-4" /> Self-appraisals awaiting {step}{" "}
          approval <Badge variant="outline">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {["Employee", "Purpose", "Cycle", "Asked for", "Submitted", "Previous steps", ""].map(
                (h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground p-6 text-center">
                  Nothing waiting at the {step} step.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">
                  {a.employee}
                  <div className="text-muted-foreground text-xs">
                    {a.designation} · {a.dept}
                  </div>
                </td>
                <td className="p-3 text-xs">{a.purpose}</td>
                <td className="p-3 text-xs">{a.quarter}</td>
                <td className="p-3 text-xs">
                  {a.value.expectedGrade} · {a.value.expectedHikePct ?? "—"} %
                </td>
                <td className="p-3 text-xs">
                  <span className="whitespace-nowrap">{a.submittedOn}</span>
                </td>
                <td className="p-3 text-xs">
                  {a.approvals.map((x) => `${x.step} ✓`).join(" · ") || "—"}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    onClick={() => {
                      setOpen(a);
                      setGrade(a.approvals.slice(-1)[0]?.recommendedGrade ?? a.value.expectedGrade);
                      setHike(
                        a.approvals.slice(-1)[0]?.recommendedHikePct ?? a.value.expectedHikePct,
                      );
                    }}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {step} review — {open.employee}
                </DialogTitle>
                <DialogDescription>
                  Approve to move to the next step, send back for revision, or reject.
                </DialogDescription>
              </DialogHeader>
              <SelfAppraisalDetail a={open} />
              <div className="border-border grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-4">
                <div className="space-y-1 sm:col-span-4">
                  <Label className="text-xs">Your comments *</Label>
                  <Textarea
                    rows={3}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Assessment of the goals, ratings and value claimed"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Your rating</Label>
                  <Pills value={rating} onChange={setRating} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Recommended grade</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.map((s) => (
                        <SelectItem key={s.grade} value={s.grade}>
                          {s.grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Recommended hike %</Label>
                  <Input
                    type="number"
                    className="h-9"
                    value={hike ?? ""}
                    onChange={(e) => setHike(e.target.value === "" ? null : +e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!comments.trim()}
                  onClick={() => decide("Sent back")}
                >
                  <Undo2 className="h-4 w-4" /> Send back
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive"
                  disabled={!comments.trim()}
                  onClick={() => decide("Rejected")}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!comments.trim()}
                  onClick={() => decide("Approved")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve{" "}
                  {step === "Unit Head" ? "(final)" : "→ next step"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------ HR: apply the outcome (pay grade / CTC / letter) ------------------------------------ */
export function ApplyAppraisalPanel() {
  const me = useCurrentUser();
  const scoped = useScopedIds();
  const all = useSelfAppraisals().filter((a) => scoped.has(a.empId));
  const rows = all.filter((a) => a.stage === "Approved");
  const applied = all.filter((a) => a.stage === "Applied");
  const structures = useSalaryStructures().filter((s) => s.active);
  const [open, setOpen] = useState(null);
  const [grade, setGrade] = useState("");
  const [ctc, setCtc] = useState(0);
  const [eff, setEff] = useState("");
  const [letter, setLetter] = useState("Increment Letter");
  const [remarks, setRemarks] = useState("");
  const [designation, setDesignation] = useState("");
  const preview = useMemo(
    () => (grade && ctc ? computeSalaryBreakup(ctc, grade) : null),
    [grade, ctc],
  );
  // First day of next month in local time (toISOString() would shift a local midnight back to the previous UTC day, i.e. the last day of this month in IST).
  const firstOfNextMonth = () => {
    const d = new Date();
    const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const m = (d.getMonth() + 1) % 12;
    return `${y}-${String(m + 1).padStart(2, "0")}-01`;
  };
  const start = (a) => {
    const p = getEmployeeProfile(a.empId);
    const last = a.approvals.slice(-1)[0];
    const g = last?.recommendedGrade ?? a.value.expectedGrade;
    const h = last?.recommendedHikePct ?? a.value.expectedHikePct ?? 10;
    setOpen(a);
    setGrade(g);
    setCtc(Math.round((p.payroll.ctc * (1 + h / 100)) / 1000) * 1000);
    setEff(firstOfNextMonth());
    setLetter(g !== p.job.grade ? "Promotion Letter" : "Increment Letter");
    setRemarks(`Per ${a.purpose} approved by ${a.approvals.map((x) => x.by).join(", ")}.`);
    setDesignation(a.designation);
  };
  // Applying a pay grade changes compensation — same gate as the payroll / HR appraisal screens.
  if (!can(me.role, "payroll.manage")) return null;
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BadgeIndianRupee className="text-primary h-4 w-4" /> Approved — apply pay grade &amp;
            issue letter <Badge variant="outline">{rows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Employee", "Purpose", "Current grade · CTC", "Recommended", "Approvals", ""].map(
                  (h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-6 text-center">
                    No fully-approved appraisals waiting.
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const p = getEmployeeProfile(a.empId);
                const last = a.approvals.slice(-1)[0];
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {a.employee}
                      <div className="text-muted-foreground text-xs">{a.designation}</div>
                    </td>
                    <td className="p-3 text-xs">{a.purpose}</td>
                    <td className="p-3 text-xs">
                      {p.job.grade} · {inr(p.payroll.ctc)}
                    </td>
                    <td className="p-3 text-xs">
                      {last?.recommendedGrade ?? a.value.expectedGrade} ·{" "}
                      {last?.recommendedHikePct ?? a.value.expectedHikePct ?? "—"} %
                    </td>
                    <td className="p-3 text-xs">{a.approvals.map((x) => x.step).join(" → ")}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        onClick={() => start(a)}
                      >
                        Update pay grade
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Applied appraisals <Badge variant="outline">{applied.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Employee", "Grade", "CTC", "Hike", "Effective", "Letter", "Applied"].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {applied.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-6 text-center">
                    None yet.
                  </td>
                </tr>
              )}
              {applied.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 font-medium">{a.employee}</td>
                  <td className="p-3">
                    {a.outcome.previousGrade} → {a.outcome.newGrade}
                  </td>
                  <td className="p-3">
                    {inr(a.outcome.previousCtc)} → {inr(a.outcome.newCtc)}
                  </td>
                  <td className="text-primary p-3 font-semibold">{a.outcome.hikePct} %</td>
                  <td className="p-3">{a.outcome.effectiveFrom}</td>
                  <td className="p-3 font-mono text-xs">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => {
                        if (!renderAppraisalLetter(a))
                          toast.error("No letter template in Doc Master");
                      }}
                    >
                      {a.outcome.letterType} · {a.outcome.letterRef}
                    </button>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">{a.outcome.appliedOn}</span> ·{" "}
                    {a.outcome.appliedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>Apply appraisal — {open.employee}</DialogTitle>
                <DialogDescription>
                  The new grade and CTC update the salary structure, payroll and the employee's
                  profile; the letter is generated from Doc Master and e-mailed; the outcome appears
                  on the employee's dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">New grade / structure</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.map((s) => (
                        <SelectItem key={s.grade} value={s.grade}>
                          {s.grade} · {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">New annual CTC (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={ctc}
                    onChange={(e) => setCtc(+e.target.value)}
                  />
                  <div className="text-muted-foreground text-[11px]">
                    Current {inr(getEmployeeProfile(open.empId).payroll.ctc)} → hike{" "}
                    {getEmployeeProfile(open.empId).payroll.ctc
                      ? (
                          ((ctc - getEmployeeProfile(open.empId).payroll.ctc) /
                            getEmployeeProfile(open.empId).payroll.ctc) *
                          100
                        ).toFixed(1)
                      : 0}{" "}
                    %
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Effective from</Label>
                  <Input type="date" value={eff} onChange={(e) => setEff(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Letter</Label>
                  <Select value={letter} onValueChange={(v) => setLetter(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Increment Letter">Increment letter</SelectItem>
                      <SelectItem value="Promotion Letter">Promotion letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">New designation (promotion)</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs">Remarks on the letter</Label>
                  <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>
              {preview && (
                <div className="border-border rounded-lg border p-3 text-xs">
                  <div className="mb-1 font-semibold">
                    Revised monthly structure (grade {grade}) — gross {inr(preview.monthlyGross)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {preview.earnings.map((e) => (
                      <Badge key={e.code} variant="outline">
                        {e.label} {inr(e.monthly)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!grade || !(ctc > 0) || !eff}
                  onClick={() => {
                    const r = applyAppraisalOutcome(
                      open.id,
                      {
                        newGrade: grade,
                        newCtc: ctc,
                        effectiveFrom: eff,
                        letterType: letter,
                        remarks,
                        newDesignation: designation !== open.designation ? designation : undefined,
                      },
                      me,
                    );
                    act(r);
                    if (r.ok) setOpen(null);
                  }}
                >
                  <Download className="h-4 w-4" /> Apply &amp; issue{" "}
                  {letter.replace(" Letter", "").toLowerCase()} letter
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------ Employee dashboard card ------------------------------------ */
export function AppraisalOutcomeCard({ empId }) {
  const all = useSelfAppraisals().filter((a) => a.empId === empId);
  const live = all.find((a) => !["Applied", "Rejected"].includes(a.stage));
  const done = all
    .filter((a) => a.outcome)
    .sort((x, y) => (x.outcome.appliedOn < y.outcome.appliedOn ? 1 : -1))[0];
  const promos = usePromotions().filter(
    (p) => p.empId === empId && p.status !== "Rejected" && p.status !== "Draft",
  );
  const promoLive = promos.find((p) => p.status === "Pending approval" || p.status === "Approved");
  const promoDone = promos
    .filter((p) => p.status === "Effective")
    .sort((x, y) => (x.effectiveFrom < y.effectiveFrom ? 1 : -1))[0];
  if (!live && !done && !promoLive && !promoDone) return null;
  return (
    <Card className="shadow-card border-primary/20">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeIndianRupee className="text-primary h-4 w-4" /> Appraisal &amp; promotion
        </div>
        {done && (
          <div className="bg-primary/5 rounded-lg p-2 text-xs">
            <div className="font-medium">
              Latest appraisal outcome · applied{" "}
              <span className="whitespace-nowrap">{done.outcome.appliedOn}</span>
            </div>
            <div>
              Grade {done.outcome.previousGrade} → <b>{done.outcome.newGrade}</b> · CTC{" "}
              {inr(done.outcome.previousCtc)} → <b>{inr(done.outcome.newCtc)}</b> (+
              {done.outcome.hikePct} %) effective {done.outcome.effectiveFrom} ·{" "}
              {done.outcome.letterType} {done.outcome.letterRef}
            </div>
          </div>
        )}
        {promoDone && (
          <div className="bg-primary/5 rounded-lg p-2 text-xs">
            <div className="font-medium">Promotion · effective {promoDone.effectiveFrom}</div>
            <div>
              {promoDone.fromDesignation} → <b>{promoDone.toDesignation}</b> · grade{" "}
              {promoDone.fromGrade} → <b>{promoDone.toGrade}</b> · CTC {inr(promoDone.fromCtc)} →{" "}
              <b>{inr(promoDone.toCtc)}</b> (+{promoDone.hikePct} %) · {promoDone.letterType}{" "}
              {promoDone.letterRef} — download on My Movements &amp; Letters
            </div>
          </div>
        )}
        {promoLive && (
          <div className="flex items-center justify-between text-xs">
            <span>
              Promotion to {promoLive.toDesignation} · {promoLive.purpose}
            </span>
            <Badge
              variant="outline"
              className={appraisalTone(promoLive.status === "Approved" ? "Approved" : "HR Review")}
            >
              {promoLive.status}
            </Badge>
          </div>
        )}
        {live && (
          <div className="flex items-center justify-between text-xs">
            <span>
              {live.purpose} · {live.quarter}
            </span>
            <Badge variant="outline" className={appraisalTone(live.stage)}>
              {live.stage}
            </Badge>
          </div>
        )}
        <div className="text-muted-foreground text-[11px]">
          {stepForStage(live?.stage ?? "Applied")
            ? `Waiting on ${stepForStage(live.stage)} approval`
            : done
              ? "Reflected in your salary structure and payslips"
              : ""}
        </div>
      </CardContent>
    </Card>
  );
}
