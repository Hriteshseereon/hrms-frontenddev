// Detailed manager → team-member performance review: basis, goals set vs achieved, parameter ratings,
// descriptive feedback, suggestions, development plan, recommendation, document uploads. Shared with HR
// (Performance module) and, when the manager chooses, with the employee (My Reviews → acknowledge).
import { useMemo, useState } from "react";
import { Star, Save, Send, FileDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  SectionTitle,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import { useGoals } from "@/features/performance/data/goals-data";
import { useEvalParams } from "@/features/performance/data/performance-config";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { exportReportPdf } from "@/lib/export-utils";
import {
  REVIEW_BASES,
  addTeamReview,
  updateTeamReview,
} from "@/features/organization/data/manager-data";
import { cn } from "@/lib/utils";

const SCALE = [1, 2, 3, 4, 5];
const ratingLabel = (n) =>
  ["", "Below expectations", "Partially meets", "Meets", "Exceeds", "Outstanding"][n] ?? "";
const bandFor = (s) =>
  s >= 4.5
    ? "5 — Outstanding"
    : s >= 3.75
      ? "4 — Exceeds"
      : s >= 2.75
        ? "3 — Meets"
        : s >= 1.75
          ? "2 — Partially Meets"
          : "1 — Below";

export function Stars({ value, onChange, size = "h-5 w-5" }) {
  return (
    <div className="inline-flex gap-0.5">
      {SCALE.map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          title={ratingLabel(n)}
          className={cn(
            size,
            "transition",
            value && n <= value ? "text-gold" : "text-muted-foreground/40",
            onChange && "hover:text-gold",
          )}
        >
          <Star className="h-full w-full" fill={value && n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export function weightedScore(params, goals) {
  const pw = params.filter((p) => p.rating).reduce((s, p) => s + p.weight, 0);
  const ps = pw
    ? params.filter((p) => p.rating).reduce((s, p) => s + (p.rating ?? 0) * p.weight, 0) / pw
    : 0;
  const gw = goals.filter((g) => g.rating).reduce((s, g) => s + g.weight, 0);
  const gs = gw
    ? goals.filter((g) => g.rating).reduce((s, g) => s + (g.rating ?? 0) * g.weight, 0) / gw
    : 0;
  if (!pw && !gw) return null;
  if (!pw) return +gs.toFixed(2);
  if (!gw) return +ps.toFixed(2);
  return +(ps * 0.5 + gs * 0.5).toFixed(2);
}

export function TeamReviewForm({
  empId,
  employee,
  managerId,
  manager,
  existing,
  onDone,
  teamOptions,
}) {
  const allGoals = useGoals();
  const evalParams = useEvalParams();
  const [target, setTarget] = useState(existing?.empId ?? empId ?? "");
  const targetName =
    existing?.employee ?? teamOptions?.find((t) => t.id === target)?.name ?? employee ?? "";
  const [basis, setBasis] = useState(existing?.basis ?? REVIEW_BASES[0]);
  const [cycle, setCycle] = useState(existing?.cycle ?? "Q2 FY27 Review");
  const [from, setFrom] = useState(existing?.period?.from ?? "2026-07-01");
  const [to, setTo] = useState(existing?.period?.to ?? "2026-09-30");
  const seededGoals = useMemo(
    () =>
      existing?.goals ??
      allGoals
        .filter((g) => g.ownerId === target)
        .map((g) => ({
          goalId: g.id,
          title: g.title,
          target: g.target,
          achieved: g.progress ? `${g.progress} % complete · ${g.status}` : "",
          weight: g.weight || 25,
          rating: null,
        })),
    [existing, allGoals, target],
  );
  const [goals, setGoals] = useState(seededGoals);
  const [goalsKey, setGoalsKey] = useState(target);
  if (goalsKey !== target) {
    setGoalsKey(target);
    setGoals(seededGoals);
  }
  const [params, setParams] = useState(
    existing?.params ??
      evalParams
        .filter((p) => p.active)
        .map((p) => ({ paramId: p.id, name: p.name, weight: p.weight, rating: null, note: "" })),
  );
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [improvements, setImprovements] = useState(existing?.improvements ?? "");
  const [suggestions, setSuggestions] = useState(existing?.suggestions ?? "");
  const [developmentPlan, setDevelopmentPlan] = useState(existing?.developmentPlan ?? "");
  const [recommendation, setRecommendation] = useState(
    existing?.recommendation ?? "Continue in role",
  );
  const [attachments, setAttachments] = useState(existing?.attachments ?? []);
  const [share, setShare] = useState(existing?.sharedWithEmployee ?? true);
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");
  const score = weightedScore(params, goals);

  const save = (complete) => {
    if (!target) return toast.error("Choose a team member.");
    if (target === managerId) return toast.error("You cannot review yourself.");
    if (from && to && to < from)
      return toast.error("Review period end must not be before its start.");
    if (!cycle.trim()) return toast.error("Enter the cycle / title.");
    if (complete && (!feedback.trim() || params.every((p) => !p.rating)))
      return toast.error(
        "Descriptive feedback and at least one parameter rating are required to complete the review.",
      );
    const payload = {
      empId: target,
      employee: targetName,
      managerId,
      manager,
      cycle,
      date: new Date().toISOString().slice(0, 10),
      rating: score ? bandFor(score) : "",
      status: complete ? "Completed" : "In Progress",
      strengths,
      improvements,
      remarks,
      basis,
      period: { from, to },
      goals,
      params,
      feedback,
      suggestions,
      developmentPlan,
      overallScore: score,
      recommendation,
      attachments,
      sharedWithEmployee: share,
      employeeAck: existing?.employeeAck ?? null,
    };
    if (existing) updateTeamReview(existing.id, payload);
    else addTeamReview(payload);
    if (complete && share)
      pushAlert({
        empId: target,
        kind: "review",
        to: "/emp/appraisals",
        title: `${cycle} — review shared by ${manager}`,
        body: `Overall ${score ?? "—"}/5 (${score ? bandFor(score) : "unrated"}) · ${recommendation}. Read the feedback and acknowledge on My Appraisals.`,
      });
    toast.success(
      complete
        ? `Review for ${targetName} completed — visible to HR${share ? " and shared with the employee" : ""}.`
        : "Draft saved.",
    );
    onDone();
  };
  const addGoal = () =>
    setGoals([
      ...goals,
      {
        goalId: `ADHOC-${goals.length + 1}`,
        title: "",
        target: "",
        achieved: "",
        weight: 20,
        rating: null,
      },
    ]);

  return (
    <div className="space-y-4">
      <SectionTitle
        n={1}
        title="Basis of review"
        sub="Why this review is being done and which period it covers"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {teamOptions && !existing ? (
          <Field label="Team member" required>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {teamOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Team member">
            <Input value={targetName} disabled />
          </Field>
        )}
        <Field label="Basis" required>
          <Select value={basis} onValueChange={setBasis}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_BASES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cycle / title" required>
          <Input value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </Field>
        <Field label="Review period">
          <div className="flex gap-1">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </Field>
      </div>

      <SectionTitle
        n={2}
        title="Goals set vs achieved"
        sub="Pulled from the Goals module for this employee; add ad-hoc goals if needed"
      />
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Goal</th>
                <th className="p-2 text-left">Target set</th>
                <th className="p-2 text-left">Achieved / evidence</th>
                <th className="w-16 p-2">Weight</th>
                <th className="w-32 p-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {goals.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-3 text-center">
                    No goals on record for this period — add one below.
                  </td>
                </tr>
              )}
              {goals.map((g, i) => (
                <tr key={g.goalId} className="border-border border-t align-top">
                  <td className="p-1">
                    <Input
                      className="h-8"
                      value={g.title}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                        )
                      }
                      placeholder="Goal"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8"
                      value={g.target}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)),
                        )
                      }
                      placeholder="Target"
                    />
                  </td>
                  <td className="p-1">
                    <Textarea
                      rows={1}
                      className="min-h-8"
                      value={g.achieved}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) => (j === i ? { ...x, achieved: e.target.value } : x)),
                        )
                      }
                      placeholder="What was delivered"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8"
                      type="number"
                      value={g.weight}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) =>
                            j === i ? { ...x, weight: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Stars
                      value={g.rating}
                      onChange={(n) =>
                        setGoals(goals.map((x, j) => (j === i ? { ...x, rating: n } : x)))
                      }
                      size="h-4 w-4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={addGoal}>
        + Add ad-hoc goal
      </Button>

      <SectionTitle
        n={3}
        title="Ratings on evaluation parameters"
        sub="Parameters and weights come from Master Data → Evaluation Parameters"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {params.map((p, i) => (
          <div key={p.paramId} className="border-border space-y-1 rounded-lg border p-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {p.weight} %
              </Badge>
              <span className="ml-auto">
                <Stars
                  value={p.rating}
                  onChange={(n) =>
                    setParams(params.map((x, j) => (j === i ? { ...x, rating: n } : x)))
                  }
                />
              </span>
            </div>
            <Input
              className="h-8 text-xs"
              value={p.note}
              onChange={(e) =>
                setParams(params.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
              }
              placeholder="Evidence / note"
            />
          </div>
        ))}
      </div>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="font-semibold">Overall score</span>
        <span className="text-2xl font-bold tabular-nums">{score ?? "—"}</span>
        <span className="text-muted-foreground">
          / 5 · {score ? bandFor(score) : "rate goals and parameters"}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          50 % goals · 50 % parameters (weighted)
        </span>
      </div>

      <SectionTitle n={4} title="Feedback, suggestions & development" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Descriptive feedback"
          required
          className="sm:col-span-2"
          hint="Specific, evidence-based; this is what the employee reads"
        >
          <Textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
        <Field label="Strengths">
          <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        </Field>
        <Field label="Areas to improve">
          <Textarea
            rows={2}
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
          />
        </Field>
        <Field label="Suggestions / actions for next period">
          <Textarea rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
        </Field>
        <Field label="Development plan (training, mentoring, stretch assignments)">
          <Textarea
            rows={3}
            value={developmentPlan}
            onChange={(e) => setDevelopmentPlan(e.target.value)}
          />
        </Field>
        <Field label="Recommendation" required>
          <Select value={recommendation} onValueChange={(v) => setRecommendation(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Continue in role",
                "Ready for promotion",
                "Increment recommended",
                "Needs improvement plan",
                "Extend probation",
                "Confirm employment",
              ].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Documents (project closure, client feedback, certificates)"
        />
        <Field label="Private remarks (HR only)" className="sm:col-span-2">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox id="share" checked={share} onCheckedChange={(v) => setShare(!!v)} />
          <Label htmlFor="share" className="font-normal">
            Share the completed review with the employee (they acknowledge it on My Reviews)
          </Label>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => save(false)}>
          <Save className="h-4 w-4" /> Save draft
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={() => save(true)}>
          <Send className="h-4 w-4" /> Complete review
        </Button>
      </DialogFooter>
    </div>
  );
}

export function TeamReviewDetail({ r, mode, onAck }) {
  const [comment, setComment] = useState("");
  const pdf = () => {
    exportReportPdf({
      title: `${r.cycle} — ${r.employee}`,
      subtitle: `${r.basis ?? "Performance review"} · by ${r.manager} · ${r.date} · overall ${r.overallScore ?? "—"}/5 (${r.rating || "unrated"})`,
      columns: ["Item", "Detail", "Rating"],
      rows: [
        ...(r.goals ?? []).map((g) => [
          `Goal: ${g.title}`,
          `Target ${g.target} · Achieved ${g.achieved}`,
          g.rating ?? "—",
        ]),
        ...(r.params ?? []).map((p) => [
          `Parameter: ${p.name} (${p.weight} %)`,
          p.note || "—",
          p.rating ?? "—",
        ]),
        ["Feedback", r.feedback ?? "", ""],
        ["Suggestions", r.suggestions ?? "", ""],
        ["Development plan", r.developmentPlan ?? "", ""],
        ["Recommendation", r.recommendation ?? "", ""],
      ],
    });
  };
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Star className="text-gold h-5 w-5" /> {r.cycle} · {r.employee}
        </DialogTitle>
        <DialogDescription>
          {r.basis ?? "Performance review"} ·{" "}
          {r.period ? `${r.period.from} → ${r.period.to} · ` : ""}by {r.manager} on{" "}
          <span className="whitespace-nowrap">{r.date}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="font-semibold">Overall</span>
        <span className="text-2xl font-bold tabular-nums">{r.overallScore ?? "—"}</span>
        <span className="text-muted-foreground">/ 5 · {r.rating || "—"}</span>
        {r.recommendation && (
          <Badge variant="outline" className="ml-auto">
            {r.recommendation}
          </Badge>
        )}
        <Badge variant="outline">{r.status}</Badge>
      </div>
      {r.goals && r.goals.length > 0 && (
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-left">Goal</th>
                  <th className="p-2 text-left">Target</th>
                  <th className="p-2 text-left">Achieved</th>
                  <th className="p-2">Weight</th>
                  <th className="p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {r.goals.map((g) => (
                  <tr key={g.goalId} className="border-border border-t">
                    <td className="p-2">{g.title}</td>
                    <td className="p-2">{g.target}</td>
                    <td className="p-2">{g.achieved}</td>
                    <td className="p-2 text-center">{g.weight} %</td>
                    <td className="p-2 text-center">
                      <Stars value={g.rating} size="h-3.5 w-3.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {r.params && r.params.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {r.params.map((p) => (
            <div
              key={p.paramId}
              className="border-border flex items-center gap-2 rounded-lg border p-2 text-sm"
            >
              <span>{p.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {p.weight} %
              </Badge>
              <span className="ml-auto">
                <Stars value={p.rating} size="h-4 w-4" />
              </span>
              {p.note && (
                <span className="text-muted-foreground w-full basis-full text-xs">{p.note}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <KV
        items={[
          ["Feedback", r.feedback ?? "—"],
          ["Strengths", r.strengths],
          ["Areas to improve", r.improvements],
          ["Suggestions", r.suggestions ?? ""],
          ["Development plan", r.developmentPlan ?? ""],
          ["Documents", (r.attachments ?? []).join(", ")],
          ...(mode !== "self" ? [["Private remarks", r.remarks]] : []),
          ["Shared with employee", r.sharedWithEmployee ? "Yes" : "No"],
          [
            "Employee acknowledgement",
            r.employeeAck ? `${r.employeeAck.on} — "${r.employeeAck.comment}"` : "Pending",
          ],
        ]}
      />
      {mode === "self" && r.status === "Completed" && !r.employeeAck && onAck && (
        <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-3">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your comment (optional)"
          />
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            onClick={() => onAck(comment)}
          >
            <CheckCircle2 className="h-4 w-4" /> Acknowledge review
          </Button>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={pdf}>
          <FileDown className="h-4 w-4" /> Review PDF
        </Button>
      </DialogFooter>
    </div>
  );
}
