// Exit Management workflow pieces — Notice Period → clearance checklist (officer-wise) → Final Settlement
// (F&F settled · exit interview) → Complete exit, plus the Retain audit form.
import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Wallet,
  MessageSquareText,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Send,
  FileCheck2,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useSalaryStructures } from "@/features/payroll/data/salary-engine";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { exportReportPdf } from "@/lib/export-utils";
import {
  CLEARANCE_AREAS,
  allCleared,
  assignClearanceOfficer,
  clearedCount,
  completeClearance,
  completeExit,
  fmtDate,
  markExitInterview,
  moveToClearance,
  noticeProgress,
  setClearance,
  stageTone,
  todayISO,
} from "@/features/exit/data/exit-data";
import {
  RETENTION_GROUNDS,
  RETENTION_TYPES,
  fnfForExit,
  retainWithForm,
  retentionForExit,
  settleFnf,
  useExitSurveys,
  useFnf,
  useRetention,
} from "@/features/exit/data/separation-data";
import { FnfPanel, useCanRetain } from "@/features/exit/components/SeparationPieces";
import { ExitIdentity, ExitStepper, ExitTimeline } from "@/features/exit/components/ExitPieces";
import { Field, SectionTitle, AttachmentsInput } from "@/features/employees/components/CasePieces";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);

/* ------------------------------------------------------------------ Retain form ------------------------------------------------------------------ */
export function RetainFormDialog({ request, open, onClose }) {
  const me = useCurrentUser();
  const structures = useSalaryStructures();
  const profile = getEmployeeProfile(request.empId);
  const [grounds, setGrounds] = useState([]);
  const [justification, setJustification] = useState("");
  const [qualification, setQualification] = useState("");
  const [types, setTypes] = useState([]);
  const [discussionSummary, setDiscussionSummary] = useState("");
  const [discussedOn, setDiscussedOn] = useState(todayISO());
  const [discussedBy, setDiscussedBy] = useState(`${request.managerName}, ${me.name}`);
  const [payChange, setPayChange] = useState(false);
  const [newDesignation, setNewDesignation] = useState("");
  const [newGrade, setNewGrade] = useState(profile.job.grade);
  const [newCtc, setNewCtc] = useState(String(profile.payroll.ctc));
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [retentionBonus, setRetentionBonus] = useState("0");
  const [clawbackMonths, setClawbackMonths] = useState("12");
  const [appraisalRef, setAppraisalRef] = useState("");
  const [conditions, setConditions] = useState(
    "Employment continues on the existing records — date of joining, leave balances, gratuity continuity and seniority unchanged.",
  );
  const [approvedBy, setApprovedBy] = useState("Farah Khan");
  const [reviewAfterMonths, setReviewAfterMonths] = useState("6");
  const [attachments, setAttachments] = useState([]);
  const toggle = (list, v, set) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ctcNum = Number(newCtc) || 0;
  const hike = profile.payroll.ctc
    ? +(((ctcNum - profile.payroll.ctc) / profile.payroll.ctc) * 100).toFixed(1)
    : 0;
  const submit = () => {
    if (payChange && !(ctcNum > 0)) return toast.error("Enter the revised annual CTC.");
    const r = retainWithForm(
      request,
      {
        grounds,
        justification,
        qualification,
        retentionType: types,
        discussionSummary,
        discussedOn,
        discussedBy,
        newDesignation: payChange ? newDesignation : "",
        newGrade: payChange ? newGrade : profile.job.grade,
        previousCtc: profile.payroll.ctc,
        newCtc: payChange ? ctcNum : profile.payroll.ctc,
        effectiveFrom,
        retentionBonus: Number(retentionBonus) || 0,
        clawbackMonths: Number(clawbackMonths) || 0,
        appraisalRef,
        conditions,
        approvedBy,
        approvedOn: todayISO(),
        reviewAfterMonths: Number(reviewAfterMonths) || 0,
        attachments,
      },
      me,
    );
    act(r);
    if (r.ok) onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshake className="text-primary h-5 w-5" /> Retain {request.empName}
          </DialogTitle>
          <DialogDescription>
            Retention audit record — grounds, qualification, discussion, revised terms (if any) and
            approvals. On submit the resignation closes as <b>Retained</b> and the employee
            continues on the existing employment records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Resignation</div>
              <b>
                {request.id} ·{" "}
                <span className="whitespace-nowrap">{fmtDate(request.appliedOn)}</span>
              </b>
            </div>
            <div>
              <div className="text-muted-foreground">Stated reason</div>
              <b>{request.reason}</b>
            </div>
            <div>
              <div className="text-muted-foreground">Current grade / CTC</div>
              <b>
                {profile.job.grade} · ₹{profile.payroll.ctc.toLocaleString("en-IN")}
              </b>
            </div>
            <div>
              <div className="text-muted-foreground">Notice ends</div>
              <b>{fmtDate(request.noticeEnd)}</b>
            </div>
          </div>
          <SectionTitle
            n={1}
            title="Grounds for retention"
            sub="Why the organisation wants to retain this employee (audit)"
          />
          <div className="flex flex-wrap gap-1.5">
            {RETENTION_GROUNDS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggle(grounds, g, setGrounds)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  grounds.includes(g)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Business justification" required>
              <Textarea
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Replacement cost, project criticality, client dependency…"
              />
            </Field>
            <Field
              label="How the employee qualified"
              required
              hint="Ratings, achievements, certifications, tenure"
            >
              <Textarea
                rows={3}
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
              />
            </Field>
          </div>
          <SectionTitle n={2} title="Retention discussion & offer" />
          <div className="flex flex-wrap gap-1.5">
            {RETENTION_TYPES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  toggle(types, g, setTypes);
                  if (g === "Compensation correction" || g === "Promotion / grade change")
                    setPayChange(true);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  types.includes(g) ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Discussion summary" required className="sm:col-span-3">
              <Textarea
                rows={3}
                value={discussionSummary}
                onChange={(e) => setDiscussionSummary(e.target.value)}
                placeholder="What the employee asked for, what was offered, employee's response"
              />
            </Field>
            <Field label="Discussed on">
              <Input
                type="date"
                value={discussedOn}
                onChange={(e) => setDiscussedOn(e.target.value)}
              />
            </Field>
            <Field label="Discussed by" className="sm:col-span-2">
              <Input value={discussedBy} onChange={(e) => setDiscussedBy(e.target.value)} />
            </Field>
            <Field label="Retention bonus (₹)" hint="0 if none">
              <Input
                type="number"
                value={retentionBonus}
                onChange={(e) => setRetentionBonus(e.target.value)}
              />
            </Field>
            <Field label="Clawback period (months)">
              <Input
                type="number"
                value={clawbackMonths}
                onChange={(e) => setClawbackMonths(e.target.value)}
              />
            </Field>
            <Field label="Linked appraisal / review">
              <Input
                value={appraisalRef}
                onChange={(e) => setAppraisalRef(e.target.value)}
                placeholder="SA-2026-… / RV-…"
              />
            </Field>
          </div>
          <SectionTitle
            n={3}
            title="Revised terms at retention"
            sub="Tick only if a new salary structure, grade or designation was agreed"
          />
          <div className="flex items-center gap-2 text-sm">
            <Checkbox id="pc" checked={payChange} onCheckedChange={(v) => setPayChange(!!v)} />
            <Label htmlFor="pc" className="font-normal">
              New salary structure / appraisal at the time of retention
            </Label>
          </div>
          {payChange && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="New designation" hint="Blank = unchanged">
                <Input
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  placeholder={profile.job.grade ? "e.g. Senior Data Engineer" : ""}
                />
              </Field>
              <Field label="New grade">
                <Select value={newGrade} onValueChange={setNewGrade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {structures.map((s) => (
                      <SelectItem key={s.grade} value={s.grade}>
                        {s.grade} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="New annual CTC (₹)">
                <Input type="number" value={newCtc} onChange={(e) => setNewCtc(e.target.value)} />
                <p className={cn("text-[11px]", hike < 0 ? "text-destructive" : "text-primary")}>
                  {hike} % on ₹{profile.payroll.ctc.toLocaleString("en-IN")}
                </p>
              </Field>
              <Field label="Effective from">
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </Field>
            </div>
          )}
          <SectionTitle n={4} title="Conditions, approval & follow-up" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Conditions / continuity note" className="sm:col-span-3">
              <Textarea
                rows={2}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
              />
            </Field>
            <Field label="Approved by" required>
              <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
            </Field>
            <Field label="Review after (months)">
              <Input
                type="number"
                value={reviewAfterMonths}
                onChange={(e) => setReviewAfterMonths(e.target.value)}
              />
            </Field>
            <AttachmentsInput
              value={attachments}
              onChange={setAttachments}
              label="Attachments (discussion notes, benchmark, approvals)"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button className="bg-gradient-emerald text-white" onClick={submit}>
              <UserCheck className="h-4 w-4" /> Mark retained — continue employment
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only retention audit (shown on the exit file and the Retention report). */
export function RetentionAudit({ rc }) {
  const f = rc.form;
  if (!f) return null;
  const rows = [
    ["Grounds", f.grounds.join(", ")],
    ["Justification", f.justification],
    ["How the employee qualified", f.qualification],
    ["Retention type", f.retentionType.join(", ")],
    ["Discussion", `${f.discussionSummary} (${f.discussedOn} · ${f.discussedBy})`],
    [
      "Revised terms",
      f.newCtc !== f.previousCtc
        ? `${f.newDesignation ? f.newDesignation + " · " : ""}grade ${f.newGrade} · CTC ₹${f.previousCtc.toLocaleString("en-IN")} → ₹${f.newCtc.toLocaleString("en-IN")} effective ${f.effectiveFrom}${f.letterRef ? ` · letter ${f.letterRef}` : ""}`
        : "No change to compensation",
    ],
    [
      "Retention bonus",
      f.retentionBonus
        ? `₹${f.retentionBonus.toLocaleString("en-IN")} · clawback ${f.clawbackMonths} months`
        : "None",
    ],
    ["Linked appraisal", f.appraisalRef || "—"],
    ["Conditions", f.conditions],
    ["Approved by", `${f.approvedBy} · ${f.approvedOn}`],
    ["Review after", `${f.reviewAfterMonths} months`],
    ["Attachments", f.attachments.join(", ") || "—"],
  ];
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-muted-foreground w-36 shrink-0">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          exportReportPdf({
            title: `Retention audit — ${rc.employee}`,
            subtitle: `${rc.id} · resignation ${rc.exitId} · retained ${rc.closedOn ?? ""}`,
            columns: ["Item", "Detail"],
            rows,
          })
        }
      >
        <Download className="h-4 w-4" /> Retention audit PDF
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ Notice period card ------------------------------------------------------------------ */
export function NoticeActions({ request, onOpen }) {
  const me = useCurrentUser();
  const dir = useDirectory();
  useRetention();
  const rc = retentionForExit(request.id);
  const [retain, setRetain] = useState(false);
  const [move, setMove] = useState(false);
  const [officers, setOfficers] = useState({});
  const { served, remaining, pct } = noticeProgress(request);
  // The leaver is never offered as their own clearance officer.
  const people = useMemo(
    () => [...new Set(dir.map((e) => e.name))].filter((n) => n !== request.empName).sort(),
    [dir, request.empName],
  );
  // Moving to clearance is an HR step (never on your own exit); retention follows the configured retention owners.
  const canMove = can(me.role, "exit.hr.approve") && request.empId !== me.id;
  const canRetain = useCanRetain();
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              {request.empName}{" "}
              <span className="text-muted-foreground text-xs font-normal">· {request.id}</span>
            </div>
            <ExitIdentity request={request} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={stageTone(request.stage)}>
              {request.stage}
            </Badge>
            {rc && (
              <Badge variant="outline" className="border-gold/40 bg-gold/10">
                {rc.status === "Retained" ? "Retained" : "Retention in progress"}
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
          <div className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground">Notice</div>
            <b>
              {request.noticeDays} days ·{" "}
              <span className="whitespace-nowrap">{fmtDate(request.noticeStart)}</span> →{" "}
              <span className="whitespace-nowrap">{fmtDate(request.noticeEnd)}</span>
            </b>
          </div>
          <div className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground">Served / remaining</div>
            <b>
              {served} / {remaining} days
            </b>
          </div>
          <div className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground">Reason</div>
            <b>{request.reason}</b>
          </div>
          <div className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground">Accepted by HR</div>
            <b>
              {request.hrDecision?.by} ·{" "}
              <span className="whitespace-nowrap">{fmtDate(request.hrDecision?.on ?? null)}</span>
            </b>
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex flex-wrap gap-2">
          {canMove && (
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => setMove(true)}
            >
              <ArrowRight className="h-4 w-4" /> Move for clearance checklist
            </Button>
          )}
          {!rc && canRetain && (
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 text-primary"
              onClick={() => setRetain(true)}
            >
              <HeartHandshake className="h-4 w-4" /> Retain
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onOpen}>
            View full exit file
          </Button>
        </div>
      </CardContent>
      <RetainFormDialog request={request} open={retain} onClose={() => setRetain(false)} />
      <Dialog open={move} onOpenChange={setMove}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Move {request.empName} to the HR clearance checklist</DialogTitle>
            <DialogDescription>
              Confirm the officer responsible for each clearance. Each officer is notified and
              records their clearance with a note and date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CLEARANCE_AREAS.map((a) => {
              const cur =
                officers[a.key] ??
                request.clearances[a.key]?.officer ??
                a.defaultOfficer ??
                request.managerName;
              return (
                <div key={a.key} className="border-border space-y-1 rounded-lg border p-2 text-xs">
                  <div className="font-medium">
                    {a.label} <span className="text-muted-foreground">· {a.owner}</span>
                  </div>
                  <Select
                    value={cur}
                    onValueChange={(v) => setOfficers({ ...officers, [a.key]: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set([cur, ...people])].filter(Boolean).map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMove(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => {
                act(moveToClearance(request.id, me, officers));
                setMove(false);
              }}
            >
              <Send className="h-4 w-4" /> Notify officers &amp; move to clearance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ Clearance board ------------------------------------------------------------------ */
export function ClearanceBoard({ request, onOpen, canClear: canClearRole }) {
  const me = useCurrentUser();
  const dir = useDirectory();
  const [openArea, setOpenArea] = useState(null);
  const done = clearedCount(request);
  const people = useMemo(
    () => [...new Set(dir.map((e) => e.name))].filter((n) => n !== request.empName).sort(),
    [dir, request.empName],
  );
  // Nobody runs the clearance checklist of their own exit.
  const canClear = canClearRole && request.empId !== me.id;
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              {request.empName}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · {request.id} · LWD{" "}
                <span className="whitespace-nowrap">{fmtDate(request.noticeEnd)}</span>
              </span>
            </div>
            <ExitIdentity request={request} />
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Clearances</div>
            <div className="text-xl font-bold">
              {done} / {CLEARANCE_AREAS.length}
            </div>
          </div>
        </div>
        <Progress value={(done / CLEARANCE_AREAS.length) * 100} className="h-2" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CLEARANCE_AREAS.map((a) => {
            const c = request.clearances[a.key];
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setOpenArea(a.key)}
                className={cn(
                  "hover:bg-muted/40 rounded-lg border p-2.5 text-left text-xs transition",
                  c.status === "Cleared"
                    ? "border-primary/40 bg-primary/5"
                    : c.status === "Blocked"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold">{a.label}</span>
                  {c.status === "Cleared" ? (
                    <CheckCircle2 className="text-primary h-4 w-4" />
                  ) : c.status === "Blocked" ? (
                    <XCircle className="text-destructive h-4 w-4" />
                  ) : (
                    <span className="border-muted-foreground/50 h-4 w-4 rounded-full border border-dashed" />
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Officer: <b className="text-foreground">{c.officer || "—"}</b>
                </div>
                <div className="text-muted-foreground">
                  {c.status === "Pending"
                    ? `${c.ticked.length}/${a.checklist.length} items`
                    : `${c.status} · ${c.by} · ${fmtDate(c.on)}`}
                </div>
                {c.note && <div className="mt-1 line-clamp-2">{c.note}</div>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {canClear && (
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!allCleared(request)}
              onClick={() => act(completeClearance(request.id, me))}
            >
              <ClipboardCheck className="h-4 w-4" /> Clearance complete → final settlement
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportReportPdf({
                title: `Clearance checklist — ${request.empName}`,
                subtitle: `${request.id} · started ${fmtDate(request.clearanceStartedOn)} · LWD ${fmtDate(request.noticeEnd)}`,
                columns: ["Clearance", "Officer", "Status", "On", "Items", "Note"],
                rows: CLEARANCE_AREAS.map((a) => {
                  const c = request.clearances[a.key];
                  return [
                    a.label,
                    c.officer,
                    c.status,
                    c.on ?? "—",
                    `${c.ticked.length}/${a.checklist.length}`,
                    c.note || "—",
                  ];
                }),
              })
            }
          >
            <Download className="h-4 w-4" /> Checklist PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpen}>
            View full exit file
          </Button>
        </div>
      </CardContent>
      <Dialog open={!!openArea} onOpenChange={(o) => !o && setOpenArea(null)}>
        <DialogContent className="sm:max-w-xl">
          {openArea && (
            <ClearanceForm
              request={request}
              area={openArea}
              people={people}
              canClear={canClear}
              onDone={() => setOpenArea(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ClearanceForm({ request, area, people, canClear, onDone }) {
  const me = useCurrentUser();
  const a = CLEARANCE_AREAS.find((x) => x.key === area);
  const c = request.clearances[area];
  const [officer, setOfficer] = useState(c.officer);
  const [ticked, setTicked] = useState(c.ticked);
  const [note, setNote] = useState(c.note);
  const [amount, setAmount] = useState(String(c.amount ?? 0));
  const isOfficer = request.empId !== me.id && (canClear || c.officer === me.name);
  const decide = (status) => {
    if (status === "Cleared" && ticked.length < a.checklist.length)
      return toast.error("Tick every checklist item before clearing.");
    if (status === "Blocked" && !note.trim())
      return toast.error("Record why the clearance is blocked.");
    if (area === "finance" && Number(amount) < 0)
      return toast.error("Outstanding amount cannot be negative.");
    if (officer !== c.officer && !assignClearanceOfficer(request.id, area, officer, me))
      return toast.error("That officer cannot be assigned on this exit.");
    if (
      !setClearance(
        request.id,
        area,
        status,
        me,
        note,
        area === "finance" ? Number(amount) || 0 : undefined,
        ticked,
      )
    )
      return toast.error("This exit is no longer in the clearance checklist.");
    toast.success(
      `${a.label}: ${status}${status === "Cleared" ? " · recorded by " + me.name : ""}`,
    );
    onDone();
  };
  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" /> {a.label}
        </DialogTitle>
        <DialogDescription>{a.hint}</DialogDescription>
      </DialogHeader>
      <Field label="Clearance officer" required>
        <Select value={officer} onValueChange={setOfficer} disabled={!canClear}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...new Set([officer, ...people])].filter(Boolean).map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">
          Checklist ({ticked.length}/{a.checklist.length})
        </Label>
        {a.checklist.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${area}-${item}`}
              checked={ticked.includes(item)}
              disabled={!isOfficer}
              onCheckedChange={(v) =>
                setTicked(v ? [...ticked, item] : ticked.filter((x) => x !== item))
              }
            />
            <Label htmlFor={`${area}-${item}`} className="font-normal">
              {item}
            </Label>
          </div>
        ))}
      </div>
      {area === "finance" && (
        <Field label="Outstanding amount (₹) — recovered in F&F">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isOfficer}
          />
        </Field>
      )}
      <Field label="Officer's note">
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!isOfficer}
        />
      </Field>
      {c.by && (
        <div className="text-muted-foreground text-xs">
          Last updated by {c.by} on <span className="whitespace-nowrap">{fmtDate(c.on)}</span> ·{" "}
          {c.status}
        </div>
      )}
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
        {isOfficer && request.stage === "HR Clearance" && (
          <>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              onClick={() => decide("Blocked")}
            >
              <XCircle className="h-4 w-4" /> Block — dues pending
            </Button>
            <Button className="bg-gradient-emerald text-white" onClick={() => decide("Cleared")}>
              <CheckCircle2 className="h-4 w-4" /> Give clearance
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  );
}

/* ------------------------------------------------------------------ Final settlement ------------------------------------------------------------------ */
export function SettlementCard({ request, onOpen }) {
  const me = useCurrentUser();
  useFnf();
  const surveys = useExitSurveys();
  const survey = surveys.find((s) => s.exitId === request.id);
  const fnf = fnfForExit(request.id);
  const [fnfOpen, setFnfOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  // Closing the file is HR's (exit.complete); F&F settlement also Finance. Other viewers (managers / officers) see status only.
  // Never on your own exit file.
  const own = request.empId === me.id;
  const canComplete = can(me.role, "exit.complete") && !own;
  const canSettle = (can(me.role, "exit.complete") || can(me.role, "finance.manage")) && !own;
  const complete = () => {
    const r = completeExit(request.id, me, note);
    act(r);
    if (r.ok) {
      const t = templatesOf("Relieving Letter")[0];
      if (t)
        renderTemplate(t, {
          employee: request.empName,
          employeeId: request.empId,
          position: request.designation,
          department: request.dept,
          entity: "Seereon Consulting & IT Services Pvt. Ltd.",
          lastWorkingDay: fmtDate(request.noticeEnd),
          date: new Date().toLocaleDateString("en-IN"),
        });
      pushAlert({
        empId: request.empId,
        kind: "general",
        to: "/emp/resignation",
        title: "Exit completed — relieving letter issued",
        body: `Your exit is complete as of ${fmtDate(request.noticeEnd)}. Relieving and experience letters have been e-mailed.`,
      });
    }
  };
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              {request.empName}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · {request.id} · LWD{" "}
                <span className="whitespace-nowrap">{fmtDate(request.noticeEnd)}</span> · clearance
                completed{" "}
                <span className="whitespace-nowrap">{fmtDate(request.clearanceCompletedOn)}</span>
              </span>
            </div>
            <ExitIdentity request={request} />
          </div>
          <Badge variant="outline" className={stageTone(request.stage)}>
            {request.stage}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              request.fnfSettled ? "border-primary/40 bg-primary/5" : "border-border",
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              <Wallet className="text-primary h-4 w-4" /> Full &amp; final settlement
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {request.fnfSettled
                ? `Settled · ${request.fnfRef}`
                : fnf
                  ? `${fnf.id} · ${fnf.status} · net ${inr(fnf.net)}`
                  : "Not computed yet"}
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              request.exitInterviewDone ? "border-primary/40 bg-primary/5" : "border-border",
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              <MessageSquareText className="text-primary h-4 w-4" /> Exit interview
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {request.exitInterviewDone
                ? `${request.exitInterview?.mode} · ${fmtDate(request.exitInterview?.on ?? null)}`
                : survey
                  ? "Survey submitted by the employee — mark below"
                  : "Pending"}
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              request.fnfSettled && request.exitInterviewDone
                ? "border-primary/40 bg-primary/5"
                : "border-border border-dashed",
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              <FileCheck2 className="text-primary h-4 w-4" /> Complete exit
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {request.fnfSettled && request.exitInterviewDone
                ? "Ready — issues the relieving letter"
                : "Needs F&F settled and exit interview"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSettle && !request.fnfSettled && (
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => setFnfOpen(true)}
            >
              <Wallet className="h-4 w-4" /> Mark F&amp;F settled
            </Button>
          )}
          {canComplete && !request.exitInterviewDone && (
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => setIntOpen(true)}
            >
              <MessageSquareText className="h-4 w-4" /> Mark exit interview
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant={request.fnfSettled && request.exitInterviewDone ? "default" : "outline"}
              className={
                request.fnfSettled && request.exitInterviewDone
                  ? "bg-gradient-emerald text-white"
                  : ""
              }
              disabled={!(request.fnfSettled && request.exitInterviewDone)}
              onClick={complete}
            >
              <FileCheck2 className="h-4 w-4" /> Complete exit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onOpen}>
            View full exit file
          </Button>
        </div>
        {canComplete && request.fnfSettled && request.exitInterviewDone && (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              request.noticeEnd && todayISO() < request.noticeEnd
                ? `Early-release reason (required — LWD ${fmtDate(request.noticeEnd)})`
                : "Closing note for the exit file (optional)"
            }
            className="max-w-lg"
          />
        )}
      </CardContent>

      <Dialog open={fnfOpen} onOpenChange={setFnfOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Full &amp; final settlement — {request.empName}</DialogTitle>
            <DialogDescription>
              Review the computed statement first (pro-rata salary, leave encashment, gratuity,
              recoveries). Only a saved statement can be marked settled.
            </DialogDescription>
          </DialogHeader>
          <FnfPanel request={request} />
          <div className="border-border space-y-2 rounded-lg border p-3">
            <div className="text-sm font-semibold">Mark settled</div>
            {!fnf ? (
              <p className="text-muted-foreground text-xs">
                Compute and save the statement above, then enter the payment reference.
              </p>
            ) : (
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
                <Field label={`Payment reference (UTR) · net payable ${inr(fnf.net)}`}>
                  <Input
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="HDFC-UTR-…"
                  />
                </Field>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!ref.trim()}
                  onClick={() => {
                    const r = settleFnf(request.id, me, ref);
                    act(r);
                    if (r.ok) setFnfOpen(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark F&amp;F settled
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={intOpen} onOpenChange={setIntOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <ExitInterviewDialog request={request} onDone={() => setIntOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ExitInterviewDialog({ request, onDone }) {
  const me = useCurrentUser();
  useFnf();
  const surveys = useExitSurveys();
  const survey = surveys.find((s) => s.exitId === request.id);
  const rc = retentionForExit(request.id);
  const fnf = fnfForExit(request.id);
  const [mode, setMode] = useState(survey ? "Employee portal" : "Employee portal");
  const [file, setFile] = useState("");
  const [note, setNote] = useState("");
  const downloadForm = () => {
    const t = templatesOf("Exit Survey Form")[0];
    if (!t) return toast.error("No Exit Survey Form template in Doc Master");
    renderTemplate(
      t,
      {
        employee: request.empName,
        employeeId: request.empId,
        position: request.designation,
        department: request.dept,
        date: new Date().toLocaleDateString("en-IN"),
      },
      {
        columns: ["#", "Question", "Response"],
        rows: (t.fields ?? []).map((f, i) => [
          i + 1,
          f.label,
          f.type === "rating"
            ? "☐ 1  ☐ 2  ☐ 3  ☐ 4  ☐ 5"
            : f.options
              ? f.options.map((o) => `☐ ${o}`).join("   ")
              : "______________________________",
        ]),
      },
    );
  };
  const sendToEmployee = () => {
    pushAlert({
      empId: request.empId,
      kind: "general",
      to: "/emp/resignation",
      title: "Exit interview form — please submit",
      body: "Open Resignation & Exit and complete the exit survey before your last working day.",
    });
    toast.success(`Exit survey form sent to ${request.empName}'s portal.`);
  };
  const mark = () => {
    if (mode === "Employee portal" && !survey)
      return toast.error(
        "The employee has not submitted the survey yet — send the form or upload the filled copy.",
      );
    if (mode === "Uploaded form" && !file) return toast.error("Upload the filled form.");
    const r = markExitInterview(request.id, me, { mode, file: file || undefined, note });
    act(r);
    if (r.ok) onDone();
  };
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquareText className="text-primary h-5 w-5" /> Exit interview — {request.empName}
        </DialogTitle>
        <DialogDescription>
          Overview of the exit process so far, then record how the exit interview was completed.
        </DialogDescription>
      </DialogHeader>
      <ExitStepper request={request} />
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="border-border space-y-1 rounded-lg border p-3">
          <div className="text-sm font-semibold">Resignation &amp; decisions</div>
          <div>
            Applied <span className="whitespace-nowrap">{fmtDate(request.appliedOn)}</span> · reason{" "}
            <b>{request.reason}</b>
          </div>
          <div>
            Manager:{" "}
            {request.managerDecision
              ? `${request.managerDecision.action} · ${request.managerDecision.by} · ${fmtDate(request.managerDecision.on)}`
              : "—"}
          </div>
          <div>
            HR:{" "}
            {request.hrDecision
              ? `${request.hrDecision.action} · ${request.hrDecision.by} · ${fmtDate(request.hrDecision.on)} · notice ${request.noticeDays} days`
              : "—"}
          </div>
          <div>Retention: {rc ? `${rc.status} (${rc.id})` : "Not attempted"}</div>
        </div>
        <div className="border-border space-y-1 rounded-lg border p-3">
          <div className="text-sm font-semibold">Clearances &amp; settlement</div>
          {CLEARANCE_AREAS.map((a) => {
            const c = request.clearances[a.key];
            return (
              <div key={a.key}>
                {a.label}: <b>{c.status}</b>
                {c.by ? ` · ${c.by}` : ""}
              </div>
            );
          })}
          <div>
            F&amp;F: {fnf ? `${fnf.status} · net ${inr(fnf.net)}` : "not computed"}
            {request.fnfSettled ? ` · settled ${request.fnfRef}` : ""}
          </div>
        </div>
      </div>
      {survey && (
        <div className="border-primary/30 bg-primary/5 rounded-lg border p-3 text-xs">
          <div className="text-sm font-semibold">
            Employee's survey (submitted{" "}
            <span className="whitespace-nowrap">{survey.submittedOn}</span>)
          </div>
          <div>
            Ratings — manager {survey.ratings.manager}/5 · culture {survey.ratings.culture}/5 ·
            growth {survey.ratings.growth}/5 · compensation {survey.ratings.comp}/5 · work-life{" "}
            {survey.ratings.workLife}/5
          </div>
          <div>
            Primary reason: {survey.reason} · would rejoin: {survey.rejoin} · would recommend:{" "}
            {survey.recommend}
          </div>
          <div className="text-muted-foreground">{survey.feedback}</div>
        </div>
      )}
      <div className="border-border space-y-3 rounded-lg border p-3">
        <div className="text-sm font-semibold">How is the exit interview completed?</div>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v)}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {["Employee portal", "HR interview", "Uploaded form"].map((m) => (
            <label
              key={m}
              htmlFor={`m-${m}`}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs",
                mode === m ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <RadioGroupItem value={m} id={`m-${m}`} className="mt-0.5" />
              <span>
                <b>{m}</b>
                <br />
                <span className="text-muted-foreground">
                  {m === "Employee portal"
                    ? "Employee submits the survey from Resignation & Exit"
                    : m === "HR interview"
                      ? "HR conducts the interview and records notes"
                      : "Employee filled the printed form; HR uploads the scan"}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={sendToEmployee}>
            <Send className="h-4 w-4" /> Send form to employee portal
          </Button>
          <Button size="sm" variant="outline" onClick={downloadForm}>
            <Download className="h-4 w-4" /> Download exit interview form (PDF)
          </Button>
          <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Upload filled form
            <input
              type="file"
              accept=".pdf,.jpg,.png"
              className="hidden"
              onChange={(e) => {
                captureFiles(e.target.files);
                setFile(e.target.files?.[0]?.name ?? "");
                setMode("Uploaded form");
              }}
            />
          </label>
          {file && <Badge variant="outline">{file}</Badge>}
        </div>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            mode === "HR interview"
              ? "Interview notes — reasons, feedback, retention learnings, would rehire?"
              : "Notes (optional)"
          }
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={mark}>
          <CheckCircle2 className="h-4 w-4" /> Mark exit interview done
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ------------------------------------------------------------------ Exit file trail (for the sheet) ------------------------------------------------------------------ */
export function ExitFileTrail({ request }) {
  return <ExitTimeline request={request} />;
}
