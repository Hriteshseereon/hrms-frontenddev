import { useMemo, useState } from "react";
import {
  Plus,
  Check,
  RotateCcw,
  Paperclip,
  Play,
  FileText,
  HelpCircle,
  Upload,
  Download,
  Award,
  Link2,
  X,
  Star,
  Eye,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  useScopedEmployees,
  Field,
  SectionTitle,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import { TRAINING_TYPE_NAMES, TRAINER_NAMES } from "@/features/performance/data/training-data";
import { OFFICES } from "@/features/employees/data/hr-data";
import { cn, safeUrl } from "@/lib/utils";
import { usePerformanceScope } from "@/features/performance/components/scope";
import {
  TRAINING_MODES,
  TRAINING_PURPOSES,
  TRAINING_REVIEW_PARAMS,
  addProgramme,
  assignTone,
  assignTraining,
  renderTrainingCertificate,
  renderTrainingReviewPdf,
  submitTrainingReview,
  useAssignments,
  useResources,
  useTrainingCatalog,
} from "@/features/performance/data/training-assign";

export const kindIcon = (k) =>
  k === "Video" ? Play : k === "Document" ? FileText : k === "Quiz" ? HelpCircle : Upload;

function Stars({ value, onChange }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(
            "h-5 w-5",
            n <= value ? "text-gold" : "text-muted-foreground/40",
            onChange && "hover:text-gold",
          )}
        >
          <Star className="h-full w-full" fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

/** Manager / HR / Admin view — assign, track, evaluate, certify. */
export function TrainingAssignmentsTab() {
  const perf = usePerformanceScope();
  // Active entity only (every entity's assignments were listed); managers / HODs see their own people.
  const rows = useAssignments().filter((a) => perf.canSee(a.empId));
  const employees = useScopedEmployees().filter((e) => perf.canSee(e.id));
  const [status, setStatus] = useState("all");
  const [emp, setEmp] = useState("all");
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [view, setView] = useState(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (a) => (status === "all" || a.status === status) && (emp === "all" || a.empId === emp),
      ),
    [rows, status, emp],
  );
  const live = (a) => (a ? (rows.find((x) => x.id === a.id) ?? a) : null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {[
          { label: "Assigned", value: rows.length },
          { label: "In progress", value: rows.filter((a) => a.status === "In Progress").length },
          {
            label: "Awaiting review",
            value: rows.filter((a) => a.status === "Submitted" || a.status === "Under Review")
              .length,
          },
          { label: "Certified", value: rows.filter((a) => a.certificateRef).length },
          {
            label: "Overdue",
            value: rows.filter(
              (a) => a.status !== "Completed" && a.dueDate < new Date().toISOString().slice(0, 10),
            ).length,
          },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">
                {s.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Employee</Label>
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "Not Started",
                  "In Progress",
                  "Submitted",
                  "Under Review",
                  "Completed",
                  "Reassigned",
                ].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> Assign Training
              </Button>
            </DialogTrigger>
            <AssignDialog onDone={() => setOpen(false)} />
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Training</th>
                <th className="p-3 text-left">Purpose / mode</th>
                <th className="p-3 text-left">Timeline</th>
                <th className="p-3 text-left">Mandatory</th>
                <th className="w-[170px] p-3 text-left">Progress</th>
                <th className="p-3 text-left">Review</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 align-top">
                  <td className="p-3">
                    {a.employee}
                    <div className="text-muted-foreground text-xs">{a.empId}</div>
                  </td>
                  <td className="p-3">
                    {a.training}
                    <div className="text-muted-foreground text-xs">
                      assigned by {a.assignedBy} ·{" "}
                      <span className="whitespace-nowrap">{a.assignedOn}</span>
                      {a.includeInGoals ? " · in goals" : ""}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {a.purpose ?? "—"}
                    <div className="text-muted-foreground">
                      {a.mode ?? "—"}
                      {a.durationHours ? ` · ${a.durationHours} h` : ""}
                    </div>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">{a.startDate ?? a.assignedOn}</span> →{" "}
                    <b
                      className={
                        a.status !== "Completed" &&
                        a.dueDate < new Date().toISOString().slice(0, 10)
                          ? "text-destructive"
                          : "text-foreground"
                      }
                    >
                      <span className="whitespace-nowrap">{a.dueDate}</span>
                    </b>
                  </td>
                  <td className="p-3">
                    {a.mandatory ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-destructive"
                      >
                        Mandatory
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Optional</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Progress value={a.progress} />
                    <div className="text-muted-foreground mt-1 text-xs">
                      {a.progress}%{a.score ? ` · score ${a.score}` : ""}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {a.review ? (
                      <div>
                        <b>{a.review.overall}/5</b> · {a.review.outcome}
                        <div className="text-muted-foreground">
                          {a.review.recommendation}
                          {a.certificateRef ? ` · ${a.certificateRef}` : ""}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not reviewed</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={assignTone(a.status)}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setView(a)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(a.status === "Submitted" || a.status === "Under Review") && (
                      <Button size="sm" variant="outline" onClick={() => setReview(a)}>
                        {a.review ? "Re-review" : "Review"}
                      </Button>
                    )}
                    {a.review && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => renderTrainingReviewPdf(a)}
                        title="Review report PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {a.certificateRef && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => renderTrainingCertificate(a)}
                        title="Certificate"
                      >
                        <Award className="text-gold h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-10 text-center">
                    No training assignments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {review && <ReviewPanel a={live(review)} onClose={() => setReview(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {view && <AssignmentDetail a={live(view)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AssignmentDetail({ a }) {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{a.training}</DialogTitle>
        <DialogDescription>
          {a.employee} ({a.empId}) · assigned by {a.assignedBy} on{" "}
          <span className="whitespace-nowrap">{a.assignedOn}</span>
        </DialogDescription>
      </DialogHeader>
      <KV
        items={[
          ["Purpose", a.purpose],
          ["Description", a.description],
          ["Mode / trainer", `${a.mode ?? "—"} · ${a.trainer ?? "—"}`],
          ["Duration", a.durationHours ? `${a.durationHours} h` : "—"],
          [
            "Timeline",
            `${a.startDate ?? a.assignedOn} → ${a.endDate ?? "—"} · deadline ${a.dueDate}`,
          ],
          ["Mandatory", a.mandatory ? "Yes" : "No"],
          ["Included in goals", a.includeInGoals ? `Yes${a.goalId ? ` (${a.goalId})` : ""}` : "No"],
          ["Skills", (a.skills ?? []).join(", ")],
          [
            "Links",
            a.links?.length ? (
              <span className="flex flex-wrap gap-2">
                {a.links.map((l) => (
                  <a
                    key={l.url}
                    href={safeUrl(l.url) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    {l.label}
                  </a>
                ))}
              </span>
            ) : (
              "—"
            ),
          ],
          ["Submission", a.submission],
        ]}
      />
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs tracking-wider uppercase">Modules</Label>
        {a.modules.map((m) => {
          const Icon = kindIcon(m.kind);
          return (
            <div
              key={m.id}
              className="border-border flex items-center gap-3 rounded-lg border p-2 text-sm"
            >
              <Icon className="text-primary h-4 w-4 shrink-0" />
              <div className="flex-1">
                {m.title}
                <div className="text-muted-foreground text-xs">
                  {m.kind} · {m.duration}
                </div>
              </div>
              <Badge
                variant="outline"
                className={m.done ? "border-primary/30 bg-primary/10 text-primary" : ""}
              >
                {m.done ? "Done" : "Pending"}
              </Badge>
            </div>
          );
        })}
      </div>
      {a.review && (
        <div className="border-primary/20 bg-primary/5 space-y-1 rounded-lg border p-3 text-sm">
          <div className="font-semibold">
            Review · {a.review.overall}/5 · {a.review.outcome} · {a.review.recommendation}
          </div>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {TRAINING_REVIEW_PARAMS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <span>{label}</span>
                <Stars value={a.review.ratings[k]} />
              </div>
            ))}
          </div>
          <div className="text-muted-foreground text-xs">{a.review.learnings}</div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => renderTrainingReviewPdf(a)}>
              <Download className="h-4 w-4" /> Review report PDF
            </Button>
            {a.certificateRef && (
              <Button size="sm" variant="outline" onClick={() => renderTrainingCertificate(a)}>
                <Award className="text-gold h-4 w-4" /> Certificate {a.certificateRef}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewPanel({ a, onClose }) {
  const me = useCurrentUser();
  const r = a.review;
  const [progressPct, setProgressPct] = useState(r?.progressPct ?? a.progress);
  const [outcome, setOutcome] = useState(r?.outcome ?? "Objectives met");
  const [bottlenecks, setBottlenecks] = useState(r?.bottlenecks ?? "");
  const [learnings, setLearnings] = useState(r?.learnings ?? "");
  const [applicationPlan, setApplicationPlan] = useState(r?.applicationPlan ?? "");
  const [ratings, setRatings] = useState(
    r?.ratings ?? { skills: 0, efficiency: 0, knowledge: 0, participation: 0, application: 0 },
  );
  const [recommendation, setRecommendation] = useState(r?.recommendation ?? "Certify");
  const [comments, setComments] = useState(r?.comments ?? "");
  const [attachments, setAttachments] = useState(
    r?.attachments ?? (a.submission ? [a.submission] : []),
  );
  const overall = +(Object.values(ratings).reduce((s, v) => s + v, 0) / 5).toFixed(1);
  const submit = () => {
    if (a.empId === me.id) return toast.error("You cannot review your own training.");
    if (Object.values(ratings).some((v) => !v)) return toast.error("Rate every parameter.");
    if (!learnings.trim()) return toast.error("Record the learnings / outcome.");
    const res = submitTrainingReview(
      a.id,
      {
        progressPct,
        outcome,
        bottlenecks,
        learnings,
        applicationPlan,
        ratings,
        recommendation,
        comments,
        attachments,
      },
      me,
    );
    toast[res.ok ? "success" : "error"](res.message);
    if (res.ok) onClose();
  };
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Training review — {a.training}</DialogTitle>
        <DialogDescription>
          {a.employee} · {a.purpose ?? "—"} · {a.mode ?? "—"} · deadline{" "}
          <span className="whitespace-nowrap">{a.dueDate}</span>. Parameter-based review; “Certify”
          issues the completion certificate and closes the linked goal.
        </DialogDescription>
      </DialogHeader>
      <SectionTitle n={1} title="Progress & outcome" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Progress (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={progressPct}
            onChange={(e) =>
              setProgressPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
            }
          />
          <Progress value={progressPct} className="mt-1" />
        </Field>
        <Field label="Outcome vs objectives" required>
          <Select value={outcome} onValueChange={(v) => setOutcome(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Objectives met", "Partially met", "Not met"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="border-border rounded-lg border p-2 text-xs">
          <div className="text-muted-foreground">Modules</div>
          {a.modules.map((m) => (
            <div key={m.id} className="flex items-center gap-1">
              {m.done ? (
                <Check className="text-primary h-3 w-3" />
              ) : (
                <span className="border-muted-foreground/50 h-3 w-3 rounded-full border" />
              )}
              {m.title}
            </div>
          ))}
          {a.submission && (
            <div className="mt-1 flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {a.submission}
            </div>
          )}
        </div>
      </div>
      <SectionTitle n={2} title="Ratings" sub="1 = below expectation · 5 = outstanding" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TRAINING_REVIEW_PARAMS.map(([k, label]) => (
          <div
            key={k}
            className="border-border flex items-center justify-between rounded-lg border p-2 text-sm"
          >
            <span>{label}</span>
            <Stars value={ratings[k]} onChange={(n) => setRatings({ ...ratings, [k]: n })} />
          </div>
        ))}
        <div className="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border p-2 text-sm">
          <span className="font-semibold">Overall</span>
          <span className="text-xl font-bold">
            {overall || "—"} <span className="text-muted-foreground text-xs font-normal">/ 5</span>
          </span>
        </div>
      </div>
      <SectionTitle n={3} title="Observations" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Learnings / what was achieved" required className="sm:col-span-2">
          <Textarea rows={3} value={learnings} onChange={(e) => setLearnings(e.target.value)} />
        </Field>
        <Field label="Bottlenecks / challenges">
          <Textarea rows={2} value={bottlenecks} onChange={(e) => setBottlenecks(e.target.value)} />
        </Field>
        <Field label="Application plan on the job">
          <Textarea
            rows={2}
            value={applicationPlan}
            onChange={(e) => setApplicationPlan(e.target.value)}
          />
        </Field>
        <Field label="Recommendation" required>
          <Select value={recommendation} onValueChange={(v) => setRecommendation(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Certify", "Extend deadline", "Reassign", "Advanced training"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reviewer comments">
          <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Evidence (assessment, submission, trainer feedback)"
        />
      </div>
      <DialogFooter className="flex-wrap gap-2">
        {a.review && (
          <Button variant="outline" onClick={() => renderTrainingReviewPdf(a)}>
            <Download className="h-4 w-4" /> Review report PDF
          </Button>
        )}
        {a.certificateRef && (
          <Button variant="outline" onClick={() => renderTrainingCertificate(a)}>
            <Award className="text-gold h-4 w-4" /> Certificate
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={submit}>
          {recommendation === "Certify" ? (
            <>
              <Award className="h-4 w-4" /> Save review &amp; certify
            </>
          ) : recommendation === "Reassign" ? (
            <>
              <RotateCcw className="h-4 w-4" /> Save review &amp; reassign
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Save review
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AssignDialog({ onDone }) {
  const me = useCurrentUser();
  const catalog = useTrainingCatalog();
  const perf = usePerformanceScope();
  // A manager / HOD assigns only to their own people.
  const employees = useScopedEmployees().filter((e) => perf.canSee(e.id));
  const [source, setSource] = useState("existing");
  const [trainingId, setTrainingId] = useState("");
  const [q, setQ] = useState("");
  const [empIds, setEmpIds] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [includeInGoals, setIncludeInGoals] = useState(true);
  const [purpose, setPurpose] = useState(TRAINING_PURPOSES[0]);
  const [note, setNote] = useState("");
  // new programme
  const [title, setTitle] = useState("");
  const [type, setType] = useState(TRAINING_TYPE_NAMES[0] ?? "");
  const [description, setDescription] = useState("");
  const [trainer, setTrainer] = useState(TRAINER_NAMES[0] ?? "");
  const [mode, setMode] = useState("Online (self-paced)");
  const [links, setLinks] = useState([{ label: "", url: "" }]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [durationHours, setDurationHours] = useState("8");
  const [skills, setSkills] = useState("");
  const [branch, setBranch] = useState(OFFICES[0]);
  const [location, setLocation] = useState("Online");
  const [materials, setMaterials] = useState([]);

  const existing = catalog.find((t) => t.id === trainingId);
  const filteredEmp = employees.filter(
    (e) => !q || [e.name, e.id, e.dept, e.role].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  const pickExisting = (id) => {
    setTrainingId(id);
    const t = catalog.find((x) => x.id === id);
    if (t) {
      setDueDate(t.deadline);
      setStartDate(t.start);
      setMandatory(t.mandatory);
      setIncludeInGoals(t.includeInGoals);
      setPurpose(t.purpose);
    }
  };
  const submit = () => {
    let programme = existing;
    if (!empIds.length) return toast.error("Select at least one employee.");
    if (!dueDate) return toast.error("Deadline is required.");
    if (source === "new") {
      if (!title.trim()) return toast.error("Training title is required.");
      if (start && end && end < start)
        return toast.error("Timeline end must not be before its start.");
      if (!(Number(durationHours) > 0)) return toast.error("Duration must be more than 0 hours.");
      if (links.some((l) => l.url.trim() && !/^https?:\/\/\S+$/i.test(l.url.trim())))
        return toast.error("Links must start with https://");
      programme = addProgramme(
        {
          title,
          type,
          description,
          purpose,
          trainer,
          mode,
          links: links
            .filter((l) => l.url.trim())
            .map((l) => ({ label: l.label || l.url, url: l.url })),
          start: start || startDate,
          end: end || dueDate,
          deadline: dueDate,
          durationHours: Number(durationHours) || 0,
          mandatory,
          includeInGoals,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          branch,
          location,
          status: "Planned",
          materials,
        },
        me,
      );
    }
    if (!programme) return toast.error("Select a training or add a new one.");
    const r = assignTraining(
      { programme, empIds, dueDate, startDate, mandatory, includeInGoals, purpose, note },
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onDone();
  };
  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Assign training</DialogTitle>
        <DialogDescription>
          Pick a programme from the catalogue or add a new one (title, description, links, timeline,
          deadline, mandatory, purpose). “Include in goals” creates a goal for each employee that
          closes on certification.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <SectionTitle n={1} title="Training programme" />
        <RadioGroup value={source} onValueChange={(v) => setSource(v)} className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="existing" id="src-e" />
            <Label htmlFor="src-e" className="font-normal">
              Select from catalogue
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="new" id="src-n" />
            <Label htmlFor="src-n" className="font-normal">
              Add a new training
            </Label>
          </div>
        </RadioGroup>
        {source === "existing" ? (
          <div className="space-y-2">
            <Select value={trainingId} onValueChange={pickExisting}>
              <SelectTrigger>
                <SelectValue placeholder="Select training" />
              </SelectTrigger>
              <SelectContent>
                {catalog
                  .filter((t) => t.status !== "Cancelled")
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} · {t.type} · {t.mode}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {existing && (
              <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-xs">
                <div>
                  <b>{existing.title}</b> · {existing.type} · {existing.trainer} ·{" "}
                  {existing.durationHours} h · {existing.mode}
                </div>
                <div className="text-muted-foreground">{existing.description}</div>
                <div>
                  Timeline {existing.start} → {existing.end} · deadline {existing.deadline} ·{" "}
                  {existing.branch} · {existing.location}
                </div>
                {existing.links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {existing.links.map((l) => (
                      <a
                        key={l.url}
                        href={safeUrl(l.url) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        {l.label}
                      </a>
                    ))}
                  </div>
                )}
                {existing.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {existing.skills.map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Title" required className="sm:col-span-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SAP CPI Integration Fundamentals"
              />
            </Field>
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPE_NAMES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-3">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the programme covers and the expected outcome"
              />
            </Field>
            <Field label="Trainer">
              <Select value={trainer} onValueChange={setTrainer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINER_NAMES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="Internal SME">Internal SME</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mode">
              <Select value={mode} onValueChange={(v) => setMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Duration (hours)">
              <Input
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </Field>
            <Field label="Timeline — start">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Timeline — end">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="Skills covered" hint="Comma separated">
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} />
            </Field>
            <Field label="Branch">
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                  <SelectItem value="All branches">All branches</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location / platform">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-muted-foreground text-xs">
                Links (LMS, videos, reading, meeting)
              </Label>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-full sm:w-40"
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) =>
                      setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="https://…"
                    value={l.url}
                    onChange={(e) =>
                      setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLinks([...links, { label: "", url: "" }])}
              >
                <Link2 className="h-4 w-4" /> Add link
              </Button>
            </div>
            <div className="sm:col-span-3">
              <AttachmentsInput
                value={materials}
                onChange={setMaterials}
                label="Materials (slides, handbook)"
              />
            </div>
          </div>
        )}
        <SectionTitle n={2} title="Assignment" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Purpose" required>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_PURPOSES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Deadline" required>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <div className="space-y-2 pt-5">
            <div className="flex items-center gap-2 text-sm">
              <Checkbox id="mand" checked={mandatory} onCheckedChange={(v) => setMandatory(!!v)} />
              <Label htmlFor="mand" className="font-normal">
                Mandatory
              </Label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="goals"
                checked={includeInGoals}
                onCheckedChange={(v) => setIncludeInGoals(!!v)}
              />
              <Label htmlFor="goals" className="font-normal">
                Include in employee goals
              </Label>
            </div>
          </div>
          <Field label="Note to employees" className="sm:col-span-4">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional message in the assignment alert"
            />
          </Field>
        </div>
        <SectionTitle n={3} title={`Employees (${empIds.length} selected)`} />
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / department / designation"
            className="max-w-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() =>
              setEmpIds(
                filteredEmp.length > 0 && empIds.length === filteredEmp.length
                  ? []
                  : filteredEmp.map((e) => e.id),
              )
            }
          >
            {filteredEmp.length > 0 && empIds.length === filteredEmp.length
              ? "Clear all"
              : "Select all shown"}
          </Button>
        </div>
        <div className="border-border grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-3">
          {filteredEmp.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={empIds.includes(e.id)}
                onCheckedChange={(v) =>
                  setEmpIds((p) => (v ? [...p, e.id] : p.filter((x) => x !== e.id)))
                }
              />
              <span>
                {e.name}
                <span className="text-muted-foreground block text-[11px]">
                  {e.dept} · {e.role}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={submit}>
          <Plus className="h-4 w-4" /> Assign to {empIds.length || ""} employee(s)
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Getting Started resource library — product videos, docs, SOPs, FAQs, guides. */
export function GettingStartedTab() {
  const resources = useResources();
  const [cat, setCat] = useState("all");
  const rows = resources.filter((r) => cat === "all" || r.category === cat);

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="text-primary h-4 w-4" /> Getting Started
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Product videos, documentation, SOPs, FAQs and user guides.
            </p>
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="ml-auto w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {["Product Videos", "Documentation", "SOPs", "FAQs", "User Guides"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id} className="shadow-card">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{r.category}</Badge>
                <span className="text-muted-foreground ml-auto text-xs">{r.format}</span>
              </div>
              <h3 className="font-semibold">{r.title}</h3>
              <p className="text-muted-foreground text-xs">{r.description}</p>
              <div className="text-muted-foreground text-xs">
                {r.duration} · {r.audience}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 w-full"
                disabled={!r.url || r.url === "#"}
                title={
                  !r.url || r.url === "#" ? "No link configured for this resource yet" : undefined
                }
                onClick={() => safeUrl(r.url) && window.open(safeUrl(r.url), "_blank", "noopener")}
              >
                {!r.url || r.url === "#" ? "Link not configured" : "Open resource"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
