// Shared goal form + detail popup used by every portal: HR / admins (Goals Management), managers (My Team, employee
// portal) assign goals to people; employees self-add goals with the same form. Person · goal · category · priority ·
// quarter · date range · success criteria · metrics & evaluation parameters · milestones · links · documents ·
// manager / HR remarks.
import { useMemo, useState } from "react";
import {
  Flag,
  Plus,
  Trash2,
  Link2,
  Paperclip,
  Check,
  X,
  FileDown,
  Milestone as MilestoneIcon,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useEvalParams } from "@/features/performance/data/performance-config";
import { useManagerMap } from "@/features/organization/data/manager-data";
import {
  raiseApproval,
  actOnApproval,
  approvalStore,
} from "@/features/administration/data/approval-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { exportReportPdf } from "@/lib/export-utils";
import {
  GOAL_CATEGORIES,
  GOAL_LEVELS,
  GOAL_PRIORITIES,
  GOAL_QUARTERS,
  GOAL_RATINGS,
  METRIC_UNITS,
  addMilestone,
  createGoal,
  goalTone,
  logGoal,
  toggleMilestone,
  updateGoal,
  updateMetric,
  useGoals,
} from "@/features/performance/data/goals-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";

const QUARTER_DATES = {
  "Q1 FY27 (Apr–Jun 2026)": ["2026-04-01", "2026-06-30"],
  "Q2 FY27 (Jul–Sep 2026)": ["2026-07-01", "2026-09-30"],
  "Q3 FY27 (Oct–Dec 2026)": ["2026-10-01", "2026-12-31"],
  "Q4 FY27 (Jan–Mar 2027)": ["2027-01-01", "2027-03-31"],
  "H1 FY27": ["2026-04-01", "2026-09-30"],
  "H2 FY27": ["2026-10-01", "2027-03-31"],
  "Annual FY 2026-27": ["2026-04-01", "2027-03-31"],
};
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
/** Only http(s) links are stored — a `javascript:` URL in an <a href> would execute when clicked. */
const isWebUrl = (u) => /^https?:\/\/[^\s]+$/i.test(u.trim());

/**
 * mode "assign": the current user (manager / HR / admin) picks the person. mode "self": the owner is the current user.
 * `restrictTo` limits the picker (e.g. a manager's direct reports).
 */
export function GoalForm({ mode, ownerId: fixedOwner, restrictTo, onDone }) {
  const me = useCurrentUser();
  const directory = useDirectory();
  const evalParams = useEvalParams().filter((p) => p.active);
  const allGoals = useGoals();
  const [ownerId, setOwnerId] = useState(mode === "self" ? me.id : (fixedOwner ?? ""));
  const owner = findEmployee(ownerId);
  const profile = owner ? getEmployeeProfile(owner.id) : null;
  const managerMap = useManagerMap();
  const managerRow = owner
    ? (findEmployee(managerMap[owner.id] ?? "") ??
      (profile ? directory.find((e) => e.name === profile.job.reportingManager) : undefined))
    : undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("Individual");
  const [category, setCategory] = useState("Delivery / project");
  const [priority, setPriority] = useState("High");
  const [quarter, setQuarter] = useState(GOAL_QUARTERS[1]);
  const [start, setStart] = useState(QUARTER_DATES[GOAL_QUARTERS[1]][0]);
  const [due, setDue] = useState(QUARTER_DATES[GOAL_QUARTERS[1]][1]);
  const [weight, setWeight] = useState("20");
  const [target, setTarget] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [alignedTo, setAlignedTo] = useState("");
  const [metrics, setMetrics] = useState([
    { id: uid("M"), name: "", unit: "Number", baseline: "", target: "", current: "", weight: 100 },
  ]);
  const [params, setParams] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [documents, setDocuments] = useState([]);
  const [managerRemarks, setManagerRemarks] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const parents = useMemo(() => allGoals.filter((g) => g.level !== "Individual"), [allGoals]);

  const pickQuarter = (q) => {
    setQuarter(q);
    const d = QUARTER_DATES[q];
    if (d) {
      setStart(d[0]);
      setDue(d[1]);
    }
  };
  const weightNum = Number(weight);
  const valid =
    title.trim() &&
    owner &&
    start &&
    due &&
    due >= start &&
    weightNum >= 0 &&
    weightNum <= 100 &&
    (target.trim() || metrics.some((m) => m.name.trim() && m.target.trim()));

  const submit = () => {
    if (!owner) return;
    const reviewer = reviewerId ? findEmployee(reviewerId) : managerRow;
    const { id, self } = createGoal(
      {
        title: title.trim(),
        description: description.trim(),
        level,
        ownerId: owner.id,
        owner: owner.name,
        start,
        due,
        weight: Number(weight) || 0,
        target:
          target.trim() ||
          metrics
            .filter((m) => m.name.trim())
            .map((m) => `${m.name}: ${m.target}${m.unit === "Percentage" ? " %" : ""}`)
            .join("; ") ||
          "—",
        managerRemarks: mode === "assign" ? managerRemarks.trim() : "",
        documents,
        milestones,
        category,
        priority,
        quarter,
        successCriteria: successCriteria.trim(),
        metrics: metrics.filter((m) => m.name.trim()),
        evaluationParams: params,
        links,
        alignedTo: alignedTo || undefined,
        reviewerId: reviewer?.id,
        reviewer: reviewer?.name,
        ownerNotes: mode === "self" ? ownerNotes.trim() : "",
      },
      me,
    );
    if (self) {
      // Reference the goal id so the approval-engine record can be closed when the reviewer decides in GoalDetail.
      raiseApproval({
        module: "Goals",
        reference: id,
        title: `Goal · ${title.trim()}`,
        requestedBy: owner.id,
        requestedByName: owner.name,
      });
      if (reviewer)
        pushAlert({
          empId: reviewer.id,
          kind: "review",
          to: "/emp/goals",
          title: `Goal to approve — ${owner.name}`,
          body: `${title.trim()} · ${quarter} · due ${due}. Review the metrics and approve it under My Goals (team goals) or Goals Management.`,
        });
      toast.success(`${id} submitted to ${reviewer?.name ?? "your manager"} for approval`);
    } else {
      pushAlert({
        empId: owner.id,
        kind: "review",
        to: "/emp/goals",
        title: `New goal assigned — ${title.trim()}`,
        body: `${quarter} · ${start} → ${due} · weight ${weight} %. Assigned by ${me.name}${managerRemarks ? `: ${managerRemarks}` : ""}.`,
      });
      toast.success(`${id} assigned to ${owner.name} — they have been notified`);
    }
    onDone(id);
  };

  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Person & goal" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Goal owner" required className="sm:col-span-2">
          {mode === "self" || fixedOwner ? (
            <Input value={`${owner?.name ?? ownerId} · ${owner?.role ?? ""}`} disabled />
          ) : (
            <EmployeePicker
              value={ownerId}
              onChange={(id) => setOwnerId(id)}
              exclude={
                restrictTo
                  ? directory.filter((e) => !restrictTo.includes(e.id)).map((e) => e.id)
                  : undefined
              }
            />
          )}
        </Field>
        <Field label="Assigned by">
          <Input
            value={mode === "self" ? `${me.name} (self)` : `${me.name} (${me.role})`}
            disabled
          />
        </Field>
        <Field label="Reviewer / approver">
          <Input
            value={
              reviewerId
                ? (findEmployee(reviewerId)?.name ?? reviewerId)
                : managerRow
                  ? `${managerRow.name} (reporting manager)`
                  : (profile?.job.reportingManager ?? "—")
            }
            readOnly
            className="bg-muted/40"
          />
        </Field>
        {mode === "assign" && (
          <Field label="Change reviewer" className="sm:col-span-4">
            <EmployeePicker value={reviewerId} onChange={(id) => setReviewerId(id)} />
          </Field>
        )}
        <Field label="Goal title" required className="sm:col-span-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reduce API p95 latency to 250 ms"
          />
        </Field>
        <Field label="Description" className="sm:col-span-4">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What, why and scope"
          />
        </Field>
        <Field label="Level">
          <Select value={level} onValueChange={(v) => setLevel(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={category} onValueChange={(v) => setCategory(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={priority} onValueChange={(v) => setPriority(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_PRIORITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Weight (%)" hint="Share of the review score">
          <Input
            type="number"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Aligned to (parent goal)" className="sm:col-span-4">
          <Select
            value={alignedTo || "none"}
            onValueChange={(v) => setAlignedTo(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— none —</SelectItem>
              {parents.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.id} · {g.title} ({g.level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <SectionTitle n={2} title="Time" sub="Quarter presets the date range; adjust if needed" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Quarter / cycle">
          <Select value={quarter} onValueChange={pickQuarter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_QUARTERS.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date" required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Due date" required>
          <Input type="date" value={due} min={start} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>

      <SectionTitle
        n={3}
        title="Metrics & parameters of evaluation"
        sub="How the goal is measured and which evaluation parameters it evidences"
      />
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div
            key={m.id}
            className="border-border grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-12"
          >
            <Field label="Metric" className="sm:col-span-4">
              <Input
                value={m.name}
                onChange={(e) =>
                  setMetrics(metrics.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="e.g. p95 latency"
              />
            </Field>
            <Field label="Unit" className="sm:col-span-2">
              <Select
                value={m.unit}
                onValueChange={(v) =>
                  setMetrics(metrics.map((x, j) => (j === i ? { ...x, unit: v } : x)))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Baseline" className="sm:col-span-2">
              <Input
                value={m.baseline}
                onChange={(e) =>
                  setMetrics(
                    metrics.map((x, j) => (j === i ? { ...x, baseline: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label="Target" className="sm:col-span-2">
              <Input
                value={m.target}
                onChange={(e) =>
                  setMetrics(
                    metrics.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label="Weight" className="sm:col-span-1">
              <Input
                type="number"
                value={m.weight}
                onChange={(e) =>
                  setMetrics(
                    metrics.map((x, j) =>
                      j === i ? { ...x, weight: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
            </Field>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={metrics.length === 1}
                onClick={() => setMetrics(metrics.filter((_, j) => j !== i))}
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setMetrics([
                ...metrics,
                {
                  id: uid("M"),
                  name: "",
                  unit: "Number",
                  baseline: "",
                  target: "",
                  current: "",
                  weight: 0,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Add metric
          </Button>
          <span className="text-muted-foreground text-xs">or a simple target:</span>
          <Input
            className="h-8 w-full sm:w-56"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. Certified by Dec"
          />
        </div>
        <Field label="Success criteria (definition of done)">
          <Textarea
            rows={2}
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
          />
        </Field>
        <div>
          <Label className="text-muted-foreground text-xs">
            Evaluation parameters this goal evidences
          </Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {evalParams.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  params.includes(p.name)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border",
                )}
              >
                <Checkbox
                  checked={params.includes(p.name)}
                  onCheckedChange={(v) =>
                    setParams(v ? [...params, p.name] : params.filter((x) => x !== p.name))
                  }
                />
                {p.name} <span className="text-muted-foreground text-[10px]">{p.weight} %</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle n={4} title="Milestones, links & documents" />
      <div className="space-y-2">
        {milestones.map((m, i) => (
          <div key={m.id} className="flex gap-2">
            <Input
              value={m.title}
              onChange={(e) =>
                setMilestones(
                  milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                )
              }
              placeholder="Milestone"
            />
            <Input
              type="date"
              className="w-full sm:w-40"
              value={m.due}
              onChange={(e) =>
                setMilestones(
                  milestones.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)),
                )
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setMilestones([...milestones, { id: uid("MS"), title: "", due: due, done: false }])
          }
        >
          <MilestoneIcon className="h-4 w-4" /> Add milestone
        </Button>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Link label">
            <Input
              className="w-full sm:w-48"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Jira epic / dashboard"
            />
          </Field>
          <Field label="URL">
            <Input
              className="w-full sm:w-72"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!linkUrl.trim() || links.some((l) => l.url === linkUrl.trim())}
            onClick={() => {
              if (!isWebUrl(linkUrl))
                return toast.error("Enter a full link starting with https://");
              setLinks([
                ...links,
                { label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() },
              ]);
              setLinkLabel("");
              setLinkUrl("");
            }}
          >
            <Link2 className="h-4 w-4" /> Add link
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <Badge key={l.url} variant="outline" className="gap-1 font-normal">
              <Link2 className="h-3 w-3" />
              {l.label}
              <button type="button" onClick={() => setLinks(links.filter((x) => x.url !== l.url))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <AttachmentsInput
          value={documents}
          onChange={setDocuments}
          label="Documents"
          hint="Plans, baselines, references"
        />
      </div>

      <SectionTitle n={5} title={mode === "assign" ? "Manager / HR remarks" : "Your notes"} />
      {mode === "assign" ? (
        <Textarea
          rows={3}
          value={managerRemarks}
          onChange={(e) => setManagerRemarks(e.target.value)}
          placeholder="Expectations, context, support offered — the owner sees this"
        />
      ) : (
        <Textarea
          rows={3}
          value={ownerNotes}
          onChange={(e) => setOwnerNotes(e.target.value)}
          placeholder="Why this goal, how you plan to achieve it"
        />
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone("")}>
          Cancel
        </Button>
        <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
          <Flag className="h-4 w-4" />{" "}
          {mode === "assign" ? "Assign goal" : "Submit goal for approval"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------------- Detail ---------------- */
export function GoalDetail({ goal, mode }) {
  const me = useCurrentUser();
  const [note, setNote] = useState(goal.managerRemarks);
  const [hrNote, setHrNote] = useState(goal.hrRemarks ?? "");
  const [just, setJust] = useState(goal.selfJustification ?? "");
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");
  const isOwner = goal.ownerId === me.id;
  // Manage mode on your own goal (e.g. a manager / HR opening their goal from Goals Management) must not let you
  // approve, rate or close it yourself.
  const canManage = mode === "manage" && !isOwner;
  const parent = useGoals().find((g) => g.id === goal.alignedTo);
  /** Keep the approval-engine record (raised when the employee self-added the goal) in step with the decision taken here. */
  const settleApproval = (decision) => {
    const rec = approvalStore
      .get()
      .find((r) => r.module === "Goals" && r.reference === goal.id && r.status === "Pending");
    if (rec)
      actOnApproval(
        rec.id,
        decision,
        me,
        decision === "Approved" ? "Approved from Goals" : note || "Rejected from Goals",
      );
  };
  const pill = (n, v, on) => (
    <button
      key={n}
      type="button"
      disabled={!on}
      onClick={on}
      className={
        (v ?? 0) >= n
          ? "border-primary bg-gradient-emerald h-6 w-6 rounded border text-xs font-semibold text-white"
          : "border-border h-6 w-6 rounded border text-xs"
      }
    >
      {n}
    </button>
  );
  const pdf = () =>
    exportReportPdf({
      title: `Goal ${goal.id} — ${goal.title}`,
      subtitle: `${goal.level} · ${goal.owner} · ${goal.quarter ?? ""} · ${goal.start} → ${goal.due} · ${goal.status} · ${goal.progress} %`,
      columns: ["Item", "Detail"],
      rows: [
        ["Description", goal.description],
        ["Category / priority", `${goal.category ?? "—"} · ${goal.priority ?? "—"}`],
        ["Target", goal.target],
        ["Success criteria", goal.successCriteria ?? "—"],
        ...(goal.metrics ?? []).map((m) => [
          `Metric: ${m.name}`,
          `${m.baseline} → target ${m.target} (${m.unit}) · current ${m.current || "—"} · weight ${m.weight} %`,
        ]),
        ["Evaluation parameters", (goal.evaluationParams ?? []).join(", ") || "—"],
        ...goal.milestones.map((m) => [`Milestone${m.done ? " ✓" : ""}`, `${m.title} · ${m.due}`]),
        ["Links", (goal.links ?? []).map((l) => `${l.label}: ${l.url}`).join("; ") || "—"],
        ["Documents", goal.documents.join(", ") || "—"],
        ["Assigned by", goal.createdBy],
        ["Reviewer", goal.reviewer ?? "—"],
        [
          "Self rating",
          goal.selfRating ? `${goal.selfRating}/5 — ${goal.selfJustification ?? ""}` : "—",
        ],
        ["Manager rating", goal.managerRating ? `${goal.managerRating}/5 · ${goal.rating}` : "—"],
        ["Manager remarks", goal.managerRemarks || "—"],
        ["HR remarks", goal.hrRemarks || "—"],
      ],
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Target className="text-primary h-5 w-5" /> {goal.title}
        </DialogTitle>
        <DialogDescription>
          {goal.id} · {goal.level} goal · {goal.owner} · created by {goal.createdBy} (
          {goal.createdByRole}){goal.assignedOn ? ` on ${goal.assignedOn}` : ""}
          {goal.reviewer ? ` · reviewer ${goal.reviewer}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={goalTone(goal.status)}>
            {goal.status}
          </Badge>
          {goal.category && <Badge variant="outline">{goal.category}</Badge>}
          {goal.priority && <Badge variant="outline">{goal.priority}</Badge>}
          {goal.quarter && <Badge variant="outline">{goal.quarter}</Badge>}
          <span className="text-muted-foreground ml-auto text-xs">weight {goal.weight} %</span>
        </div>
        <p className="text-sm">{goal.description}</p>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Start", goal.start],
            ["Due", goal.due],
            ["Target", goal.target],
            ["Aligned to", parent ? `${parent.id} · ${parent.title}` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="border-border rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
              <div className="mt-0.5 font-medium break-words">{v}</div>
            </div>
          ))}
        </div>
        {goal.successCriteria && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Success criteria
            </span>
            <div>{goal.successCriteria}</div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wider uppercase">Progress</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={100}
              value={goal.progress}
              className="w-24"
              disabled={
                !(isOwner || canManage) ||
                goal.status === "Completed" ||
                goal.status === "Rejected" ||
                goal.status === "Pending Approval"
              }
              onChange={(e) =>
                updateGoal(goal.id, {
                  progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
            <Progress value={goal.progress} className="flex-1" />
            <span className="w-12 text-right text-sm font-semibold">{goal.progress}%</span>
          </div>
        </div>

        {(goal.metrics?.length ?? 0) > 0 && (
          <div className="border-border overflow-hidden rounded-lg border">
            <div className="bg-muted/40 text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wider uppercase">
              Metrics
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="p-2 text-left">Metric</th>
                    <th className="p-2 text-left">Baseline</th>
                    <th className="p-2 text-left">Target</th>
                    <th className="p-2 text-left">Current</th>
                    <th className="p-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {(goal.metrics ?? []).map((m) => (
                    <tr key={m.id} className="border-border border-t">
                      <td className="p-2 font-medium">
                        {m.name} <span className="text-muted-foreground">({m.unit})</span>
                      </td>
                      <td className="p-2">{m.baseline || "—"}</td>
                      <td className="p-2">{m.target}</td>
                      <td className="p-1">
                        {isOwner || canManage ? (
                          <Input
                            className="h-7 w-28"
                            value={m.current}
                            onChange={(e) => updateMetric(goal.id, m.id, e.target.value)}
                            placeholder="update"
                          />
                        ) : (
                          m.current || "—"
                        )}
                      </td>
                      <td className="p-2 text-center">{m.weight} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {(goal.evaluationParams?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-muted-foreground self-center text-xs">Evidences:</span>
            {(goal.evaluationParams ?? []).map((p) => (
              <Badge key={p} variant="outline" className="font-normal">
                {p}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wider uppercase">
            Milestones
          </Label>
          {goal.milestones.map((m) => (
            <div key={m.id} className="border-border flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={m.done}
                disabled={!(isOwner || canManage)}
                onCheckedChange={() => {
                  toggleMilestone(goal.id, m.id);
                  logGoal(
                    goal.id,
                    me.name,
                    `Milestone '${m.title}' ${m.done ? "reopened" : "completed"}`,
                  );
                }}
              />
              <div className="flex-1">
                <div className={"text-sm " + (m.done ? "text-muted-foreground line-through" : "")}>
                  {m.title}
                </div>
                <div className="text-muted-foreground text-xs">Due {m.due}</div>
              </div>
            </div>
          ))}
          {goal.milestones.length === 0 && (
            <div className="text-muted-foreground text-xs">No milestones yet.</div>
          )}
          {(isOwner || canManage) && (
            <div className="flex gap-2">
              <Input
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                placeholder="New milestone"
              />
              <Input
                type="date"
                className="w-full sm:w-40"
                value={msDue}
                onChange={(e) => setMsDue(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!msTitle.trim() || !msDue}
                onClick={() => {
                  addMilestone(goal.id, msTitle.trim(), msDue);
                  setMsTitle("");
                  setMsDue("");
                  toast.success("Milestone added");
                }}
              >
                <MilestoneIcon className="h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </div>

        {((goal.links?.length ?? 0) > 0 || goal.documents.length > 0) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(goal.links?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs tracking-wider uppercase">
                  Links
                </Label>
                {(goal.links ?? []).map((l) => (
                  <a
                    key={l.url}
                    href={isWebUrl(l.url) ? l.url : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary flex items-center gap-2 text-sm underline"
                  >
                    <Link2 className="h-3.5 w-3.5" /> {l.label}
                  </a>
                ))}
              </div>
            )}
            {goal.documents.length > 0 && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs tracking-wider uppercase">
                  Documents
                </Label>
                {goal.documents.map((d) => (
                  <div key={d} className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Paperclip className="h-3.5 w-3.5" /> {d}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-border grid grid-cols-1 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
              Self rating
            </Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) =>
                pill(
                  n,
                  goal.selfRating,
                  isOwner ? () => updateGoal(goal.id, { selfRating: n }) : undefined,
                ),
              )}
            </div>
            {isOwner ? (
              <Input
                className="h-7 text-xs"
                placeholder="Justification"
                value={just}
                onChange={(e) => setJust(e.target.value)}
                onBlur={() => updateGoal(goal.id, { selfJustification: just })}
              />
            ) : (
              <div className="text-muted-foreground">{goal.selfJustification || "—"}</div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
              Manager rating
            </Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) =>
                pill(
                  n,
                  goal.managerRating,
                  canManage ? () => updateGoal(goal.id, { managerRating: n }) : undefined,
                ),
              )}
            </div>
            {canManage ? (
              <Select value={goal.rating} onValueChange={(v) => updateGoal(goal.id, { rating: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-muted-foreground">
                {goal.managerRating
                  ? `${goal.managerRating}/5 · ${goal.rating}`
                  : "Awaiting manager"}
              </div>
            )}
          </div>
        </div>

        {canManage ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Manager remarks (visible to the owner)">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field label="HR remarks">
              <Textarea rows={3} value={hrNote} onChange={(e) => setHrNote(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateGoal(goal.id, { managerRemarks: note, hrRemarks: hrNote });
                  logGoal(goal.id, me.name, "Remarks updated");
                  toast.success("Remarks saved");
                }}
              >
                Save remarks
              </Button>
              {goal.ownerNotes && (
                <span className="text-muted-foreground text-xs">
                  Owner's notes: “{goal.ownerNotes}”
                </span>
              )}
            </div>
          </div>
        ) : (
          <KV
            items={[
              ["Manager remarks", goal.managerRemarks || "—"],
              ["HR remarks", goal.hrRemarks || "—"],
              ["My notes", goal.ownerNotes || "—"],
            ]}
          />
        )}
        {(goal.history?.length ?? 0) > 0 && (
          <div className="text-muted-foreground space-y-0.5 text-xs">
            {(goal.history ?? []).map((h, i) => (
              <div key={i}>
                {h.at} · {h.by} — {h.action}
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={pdf}>
          <FileDown className="h-4 w-4" /> Goal PDF
        </Button>
        {canManage && goal.status === "Pending Approval" && (
          <>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                updateGoal(goal.id, { status: "Rejected", managerRemarks: note });
                logGoal(goal.id, me.name, "Rejected");
                settleApproval("Rejected");
                pushAlert({
                  empId: goal.ownerId,
                  kind: "review",
                  to: "/emp/goals",
                  title: `Goal rejected — ${goal.title}`,
                  body: `${me.name} rejected the goal.${note ? ` ${note}` : ""}`,
                });
                toast.success("Goal rejected");
              }}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => {
                updateGoal(goal.id, { status: "Approved", managerRemarks: note });
                logGoal(goal.id, me.name, "Approved");
                settleApproval("Approved");
                pushAlert({
                  empId: goal.ownerId,
                  kind: "review",
                  to: "/emp/goals",
                  title: `Goal approved — ${goal.title}`,
                  body: `${me.name} approved the goal. Track progress on My Goals.`,
                });
                toast.success("Goal approved");
              }}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
          </>
        )}
        {canManage && (goal.status === "Approved" || goal.status === "In Progress") && (
          <Button
            variant="outline"
            onClick={() => {
              updateGoal(goal.id, { status: "Completed", progress: 100 });
              logGoal(goal.id, me.name, "Marked complete");
              toast.success("Goal marked complete");
            }}
          >
            Mark complete
          </Button>
        )}
        {isOwner && goal.status === "Approved" && (
          <Button
            variant="outline"
            onClick={() => {
              updateGoal(goal.id, { status: "In Progress" });
              logGoal(goal.id, me.name, "Started");
              toast.success("Goal started");
            }}
          >
            Start goal
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
