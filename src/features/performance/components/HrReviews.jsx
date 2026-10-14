// Performance → Employee Review: HR's detailed employee review (skills, evaluation parameters, goals considered
// with ratings, attendance / discipline / training context, manager-review reference, assessment, recommendation),
// the list with click-to-detail popup, and the read-only detail used by HR and the employee portal.
import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Eye,
  FileDown,
  Save,
  Send,
  Trash2,
  CheckCircle2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { findEmployee, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useLiveAttendance, summarise } from "@/features/attendance/data/attendance-live";
import { useWarnings } from "@/features/employees/data/people-cases";
import { teamReviewStore } from "@/features/organization/data/manager-data";
import { exportReportPdf } from "@/lib/export-utils";
import { REVIEW_CYCLE_ROWS } from "@/features/performance/data/performance-data";
import {
  PROFICIENCY,
  RECOMMENDATIONS,
  REVIEW_TYPES,
  SKILL_CATALOGUE,
  SKILL_CATEGORIES,
  ackHrReview,
  bandFor,
  hrOverall,
  hrReviewTone,
  saveHrReview,
  seedForEmployee,
  shareHrReview,
  useHrReviews,
} from "@/features/performance/data/hr-review-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import { Stars } from "@/features/performance/components/TeamReviewForm";
import { usePerformanceScope } from "@/features/performance/components/scope";
import { clickableRow } from "@/components/common/RecordDetail";

/* ---------------- Tab ---------------- */
export function HrReviewsTab() {
  const me = useCurrentUser();
  const perf = usePerformanceScope();
  // Active entity only; managers / HODs see the HR reviews of their own people, read-only and without HR's confidential notes.
  const reviews = useHrReviews().filter((r) => perf.canSee(r.empId));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [edit, setEdit] = useState(null);
  const rows = useMemo(
    () =>
      reviews.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (!q ||
            `${r.employee} ${r.reviewer} ${r.cycle} ${r.type} ${r.id}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [reviews, q, status],
  );
  const open = reviews.find((r) => r.id === openId) ?? null;

  const pdf = () => {
    const ok = exportReportPdf({
      title: "Employee Reviews (HR)",
      subtitle: "Detailed HR reviews — skills, parameters, goals, recommendation",
      columns: [
        "Ref",
        "Employee",
        "Reviewer",
        "Type",
        "Cycle",
        "Date",
        "Overall",
        "Rating",
        "Recommendation",
        "Status",
      ],
      rows: rows.map((r) => [
        r.id,
        r.employee,
        r.reviewer,
        r.type,
        r.cycle,
        r.date,
        r.overallScore ?? "—",
        r.rating || "—",
        r.recommendation,
        r.status,
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "Review register ready" : "Allow pop-ups to generate the PDF",
    );
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Employee Reviews</div>
              <div className="text-muted-foreground text-xs">
                HR-run reviews — skills, evaluation parameters, goals considered, context and
                recommendation. Click a review to open it.
              </div>
            </div>
          </div>
          <div className="ml-auto flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employee, reviewer, cycle…"
              className="w-full sm:w-[240px]"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Scheduled", "In Progress", "Completed"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={pdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            {perf.isHr && (
              <Button
                size="sm"
                className="bg-gradient-emerald shadow-premium text-white"
                onClick={() => setEdit("new")}
              >
                <Plus className="h-4 w-4" /> Add Employee Review
              </Button>
            )}
          </div>
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
                  "Reviewer",
                  "Type · cycle",
                  "Period",
                  "Goals",
                  "Skills",
                  "Overall",
                  "Recommendation",
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
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(clickableRow, "align-top")}
                  onClick={() => setOpenId(r.id)}
                >
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{r.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.empId} · {r.designation}
                    </div>
                  </td>
                  <td className="p-3">{r.reviewer}</td>
                  <td className="p-3">
                    {r.type}
                    <div className="text-muted-foreground text-xs">
                      {r.cycle} · <span className="whitespace-nowrap">{r.date}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs whitespace-nowrap">
                    {r.period.from} → {r.period.to}
                  </td>
                  <td className="p-3 text-xs">
                    {r.goals.filter((g) => g.considered).length} considered
                    <div className="text-muted-foreground">
                      {r.goals.filter((g) => g.status === "Completed").length} completed
                    </div>
                  </td>
                  <td className="p-3 text-xs">{r.skills.length} assessed</td>
                  <td className="p-3">
                    {r.overallScore ? (
                      <span className="font-semibold">
                        {r.overallScore}{" "}
                        <span className="text-muted-foreground text-xs font-normal">/ 5</span>
                        <div className="text-muted-foreground text-xs">{r.rating}</div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-xs">{r.recommendation}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={hrReviewTone(r.status)}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Eye className="text-muted-foreground h-4 w-4" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-muted-foreground p-10 text-center">
                    No reviews match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <HrReviewDetail r={open} mode={perf.isHr ? "hr" : "self"} readOnly={!perf.isHr} />
            {perf.isHr && open.status !== "Completed" && (
              <DialogFooter>
                <Button
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    setEdit(open);
                    setOpenId(null);
                  }}
                >
                  Continue review
                </Button>
              </DialogFooter>
            )}
            {perf.isHr && open.status === "Completed" && !open.sharedWithEmployee && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const r = shareHrReview(open.id, me);
                    toast[r.ok ? "success" : "error"](r.message);
                  }}
                >
                  <Send className="h-4 w-4" /> Share with employee
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {edit === "new" ? "Add employee review" : `Continue review · ${edit.id}`}
              </DialogTitle>
              <DialogDescription>
                HR assessment of skills, evaluation parameters and goals, with attendance,
                discipline, training and the manager's review as context.
              </DialogDescription>
            </DialogHeader>
            <HrReviewForm
              existing={edit === "new" ? undefined : edit}
              onDone={() => setEdit(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Form ---------------- */
export function HrReviewForm({ existing, onDone, fixedEmpId }) {
  const me = useCurrentUser();
  const attendance = useLiveAttendance();
  const warnings = useWarnings();
  const [empId, setEmpId] = useState(existing?.empId ?? fixedEmpId ?? "");
  const emp = findEmployee(empId);
  const seed = useMemo(() => (empId ? seedForEmployee(empId) : null), [empId]);
  const [type, setType] = useState(existing?.type ?? "Quarterly review");
  const [cycle, setCycle] = useState(
    existing?.cycle ?? REVIEW_CYCLE_ROWS[0]?.name ?? "Q3 FY26 Review",
  );
  const [from, setFrom] = useState(existing?.period.from ?? "2026-07-01");
  const [to, setTo] = useState(existing?.period.to ?? "2026-09-30");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [goals, setGoals] = useState(existing?.goals ?? []);
  const [params, setParams] = useState(existing?.params ?? []);
  const [skills, setSkills] = useState(existing?.skills ?? []);
  const [context, setContext] = useState(
    existing?.context ?? {
      attendancePct: null,
      lateMarks: null,
      warnings: 0,
      trainingsCompleted: 0,
      managerReviewId: "",
      managerRating: "",
      clientFeedback: "",
    },
  );
  const [achievements, setAchievements] = useState(existing?.achievements ?? "");
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [improvements, setImprovements] = useState(existing?.improvements ?? "");
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");
  const [hrNotes, setHrNotes] = useState(existing?.hrNotes ?? "");
  const [recommendation, setRecommendation] = useState(
    existing?.recommendation ?? "Continue in role",
  );
  const [developmentPlan, setDevelopmentPlan] = useState(existing?.developmentPlan ?? "");
  const [nextReviewOn, setNextReviewOn] = useState(existing?.nextReviewOn ?? "");
  const [attachments, setAttachments] = useState(existing?.attachments ?? []);
  const [share, setShare] = useState(existing?.sharedWithEmployee ?? true);
  const [newSkillCat, setNewSkillCat] = useState("Technical");
  const [newSkill, setNewSkill] = useState("");
  const [seededFor, setSeededFor] = useState(existing?.empId ?? "");

  // When HR picks an employee, pull goals / parameters / manager review / attendance / warnings.
  if (empId && seededFor !== empId && seed && !existing) {
    setSeededFor(empId);
    setGoals(seed.goals);
    setParams(seed.params);
    const att = attendance.find((a) => a.empId === empId);
    const s = att ? summarise(att) : null;
    setContext({
      attendancePct: s ? s.pct : null,
      lateMarks: s ? s.late : null,
      warnings: warnings.filter((w) => w.empId === empId).length,
      trainingsCompleted: seed.trainingsCompleted,
      managerReviewId: seed.managerReviewId,
      managerRating: seed.managerRating,
      clientFeedback: "",
    });
  }
  const managerReview = teamReviewStore.get().find((r) => r.id === context.managerReviewId);
  const overall = hrOverall(goals, params, skills);
  const profile = emp ? getEmployeeProfile(emp.id) : null;

  const submit = (complete) => {
    if (!emp) return toast.error("Choose the employee.");
    if (emp.id === me.id) return toast.error("You cannot review yourself.");
    const r = saveHrReview(
      {
        id: existing?.id,
        empId: emp.id,
        employee: emp.name,
        designation: emp.role,
        department: emp.dept,
        reviewerId: me.id,
        reviewer: me.name,
        type,
        cycle,
        period: { from, to },
        date,
        status: existing?.status ?? "In Progress",
        goals,
        skills,
        params,
        context,
        strengths,
        improvements,
        achievements,
        remarks,
        hrNotes,
        recommendation,
        developmentPlan,
        nextReviewOn,
        overallScore: overall,
        rating: overall ? bandFor(overall) : "",
        attachments,
        sharedWithEmployee: share,
        employeeAck: existing?.employeeAck ?? null,
      },
      me,
      complete,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onDone();
  };
  const addSkill = () => {
    const name = newSkill.trim();
    if (!name) return;
    if (skills.some((s) => s.skill === name)) return toast.error("Skill already added");
    setSkills([...skills, { category: newSkillCat, skill: name, level: null, evidence: "" }]);
    setNewSkill("");
  };

  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee, review type & period" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Employee" required className="sm:col-span-2">
          {existing || fixedEmpId ? (
            <Input value={`${emp?.name ?? empId} · ${emp?.role ?? ""}`} disabled />
          ) : (
            <EmployeePicker value={empId} onChange={(id) => setEmpId(id)} />
          )}
        </Field>
        <Field label="Review type" required>
          <Select value={type} onValueChange={(v) => setType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Review cycle" required>
          <Select value={cycle} onValueChange={setCycle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_CYCLE_ROWS.map((c) => (
                <SelectItem key={c.id} value={String(c.name)}>
                  {String(c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Period from">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Period to">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Review date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reviewer">
          <Input value={`${me.name} (${me.role})`} disabled />
        </Field>
        {profile && (
          <div className="bg-muted/40 flex flex-wrap gap-x-6 gap-y-1 rounded-lg p-3 text-xs sm:col-span-4">
            <span>
              Grade <b>{profile.job.grade}</b>
            </span>
            <span>
              Reporting to <b>{profile.job.reportingManager}</b>
            </span>
            <span>
              DOJ <b>{profile.job.dateOfJoining}</b>
            </span>
            <span>
              Branch <b>{emp?.branch}</b>
            </span>
            <span>
              Dept <b>{emp?.dept}</b>
            </span>
          </div>
        )}
      </div>

      <SectionTitle
        n={2}
        title="Context considered"
        sub="Pulled from attendance, disciplinary cases, training and the manager's review — editable"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Field label="Attendance %">
          <Input
            type="number"
            value={context.attendancePct ?? ""}
            onChange={(e) =>
              setContext({
                ...context,
                attendancePct: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Late marks">
          <Input
            type="number"
            value={context.lateMarks ?? ""}
            onChange={(e) =>
              setContext({
                ...context,
                lateMarks: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Warnings on file">
          <Input
            type="number"
            value={context.warnings}
            onChange={(e) => setContext({ ...context, warnings: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Trainings completed">
          <Input
            type="number"
            value={context.trainingsCompleted}
            onChange={(e) =>
              setContext({ ...context, trainingsCompleted: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Manager review" className="sm:col-span-2">
          <Input
            value={
              managerReview
                ? `${managerReview.id} · ${managerReview.manager} · ${managerReview.rating || managerReview.status}`
                : context.managerRating || "No completed manager review"
            }
            readOnly
            className="bg-muted/40"
          />
        </Field>
        <Field label="Client / stakeholder feedback" className="sm:col-span-6">
          <Textarea
            rows={2}
            value={context.clientFeedback}
            onChange={(e) => setContext({ ...context, clientFeedback: e.target.value })}
            placeholder="Survey scores, escalations, appreciation mails…"
          />
        </Field>
      </div>

      <SectionTitle
        n={3}
        title="Goals considered"
        sub="Employee's goals with status; tick the ones considered, record what was achieved and rate each"
      />
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-8 p-2" />
                <th className="p-2 text-left">Goal</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Target</th>
                <th className="p-2 text-left">Achieved</th>
                <th className="w-16 p-2">Weight</th>
                <th className="w-32 p-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {goals.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-3 text-center">
                    {empId
                      ? "No goals on record — add one below."
                      : "Select an employee to load goals."}
                  </td>
                </tr>
              )}
              {goals.map((g, i) => (
                <tr
                  key={g.goalId}
                  className={cn("border-border border-t align-top", !g.considered && "opacity-50")}
                >
                  <td className="p-2">
                    <Checkbox
                      checked={g.considered}
                      onCheckedChange={(v) =>
                        setGoals(goals.map((x, j) => (j === i ? { ...x, considered: !!v } : x)))
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8"
                      value={g.title}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                        )
                      }
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={
                        g.status === "Completed"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : ""
                      }
                    >
                      {g.status}
                    </Badge>
                    <div className="text-muted-foreground">{g.progress} %</div>
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
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8"
                      value={g.achieved}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) => (j === i ? { ...x, achieved: e.target.value } : x)),
                        )
                      }
                      placeholder="Evidence"
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
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          setGoals([
            ...goals,
            {
              goalId: `ADHOC-${goals.length + 1}`,
              title: "",
              status: "Ad-hoc",
              progress: 0,
              target: "",
              achieved: "",
              weight: 20,
              rating: null,
              considered: true,
            },
          ])
        }
      >
        + Add goal / task considered
      </Button>

      <SectionTitle
        n={4}
        title="Skills assessment"
        sub="Technical, functional, behavioural and leadership skills — proficiency 1 (beginner) to 5 (expert) with evidence"
      />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Category">
          <Select value={newSkillCat} onValueChange={(v) => setNewSkillCat(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Skill">
          <Select value={newSkill} onValueChange={setNewSkill}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Pick from catalogue" />
            </SelectTrigger>
            <SelectContent>
              {(SKILL_CATALOGUE.find((c) => c.category === newSkillCat)?.skills ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="or type a skill">
          <Input
            className="w-full sm:w-[200px]"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="e.g. Kafka"
          />
        </Field>
        <Button type="button" size="sm" variant="outline" onClick={addSkill}>
          <Plus className="h-4 w-4" /> Add skill
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {skills.map((s, i) => (
          <div key={s.skill} className="border-border space-y-1 rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="text-[10px]">
                {s.category}
              </Badge>
              <span className="font-medium">{s.skill}</span>
              <span className="ml-auto">
                <Stars
                  value={s.level}
                  onChange={(n) =>
                    setSkills(skills.map((x, j) => (j === i ? { ...x, level: n } : x)))
                  }
                  size="h-4 w-4"
                />
              </span>
              <span className="text-muted-foreground w-16 text-[10px]">
                {PROFICIENCY[s.level ?? 0]}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setSkills(skills.filter((_, j) => j !== i))}
              >
                <Trash2 className="text-destructive h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              className="h-8 text-xs"
              value={s.evidence}
              onChange={(e) =>
                setSkills(skills.map((x, j) => (j === i ? { ...x, evidence: e.target.value } : x)))
              }
              placeholder="Evidence / example"
            />
          </div>
        ))}
        {skills.length === 0 && (
          <div className="text-muted-foreground text-xs sm:col-span-2">No skills added yet.</div>
        )}
      </div>

      <SectionTitle
        n={5}
        title="Ratings on evaluation parameters"
        sub="Parameters and weights from Master Data → Evaluation Parameters"
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
        {params.length === 0 && (
          <div className="text-muted-foreground text-xs sm:col-span-2">
            Select an employee to load the evaluation parameters.
          </div>
        )}
      </div>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="font-semibold">Overall score</span>
        <span className="text-2xl font-bold tabular-nums">{overall ?? "—"}</span>
        <span className="text-muted-foreground">
          / 5 · {overall ? bandFor(overall) : "rate goals, parameters and skills"}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          40 % goals · 40 % parameters · 20 % skills (weighted)
        </span>
      </div>

      <SectionTitle n={6} title="Assessment, remarks & recommendation" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Key achievements in the period" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
          />
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
        <Field label="HR remarks (shared with the employee)" required className="sm:col-span-2">
          <Textarea
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Evidence-based summary of the review…"
          />
        </Field>
        <Field label="Recommendation" required>
          <Select value={recommendation} onValueChange={(v) => setRecommendation(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECOMMENDATIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Next review on">
          <Input
            type="date"
            value={nextReviewOn}
            onChange={(e) => setNextReviewOn(e.target.value)}
          />
        </Field>
        <Field
          label="Development plan (training, mentoring, stretch assignments)"
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={developmentPlan}
            onChange={(e) => setDevelopmentPlan(e.target.value)}
          />
        </Field>
        <Field label="Confidential HR notes (never shared)" className="sm:col-span-2">
          <Textarea rows={2} value={hrNotes} onChange={(e) => setHrNotes(e.target.value)} />
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Documents (appraisal inputs, client mails, certificates)"
        />
        <div className="flex items-center gap-2 self-end text-sm">
          <Checkbox id="share-hr" checked={share} onCheckedChange={(v) => setShare(!!v)} />
          <Label htmlFor="share-hr" className="font-normal">
            Share the completed review with the employee (they acknowledge on My Reviews)
          </Label>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => submit(false)}>
          <Save className="h-4 w-4" /> Save
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={() => submit(true)}>
          <Send className="h-4 w-4" /> Complete review
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------------- Detail ---------------- */
export function HrReviewDetail({ r, mode, readOnly }) {
  const [comment, setComment] = useState("");
  const pdf = () =>
    exportReportPdf({
      title: `${r.type} — ${r.employee}`,
      subtitle: `${r.cycle} · ${r.period.from} → ${r.period.to} · by ${r.reviewer} on ${r.date} · overall ${r.overallScore ?? "—"}/5 (${r.rating || "unrated"})`,
      columns: ["Item", "Detail", "Rating"],
      rows: [
        ...r.goals
          .filter((g) => g.considered)
          .map((g) => [
            `Goal: ${g.title} (${g.status})`,
            `Target ${g.target} · Achieved ${g.achieved}`,
            g.rating ?? "—",
          ]),
        ...r.skills.map((s) => [
          `Skill: ${s.skill} (${s.category})`,
          s.evidence || "—",
          s.level ? `${s.level} — ${PROFICIENCY[s.level]}` : "—",
        ]),
        ...r.params.map((p) => [
          `Parameter: ${p.name} (${p.weight} %)`,
          p.note || "—",
          p.rating ?? "—",
        ]),
        [
          "Context",
          `Attendance ${r.context.attendancePct ?? "—"} % · late ${r.context.lateMarks ?? "—"} · warnings ${r.context.warnings} · trainings ${r.context.trainingsCompleted} · manager review ${r.context.managerReviewId || "—"} ${r.context.managerRating}`,
          "",
        ],
        ["Achievements", r.achievements, ""],
        ["Strengths", r.strengths, ""],
        ["Improvements", r.improvements, ""],
        ["HR remarks", r.remarks, ""],
        ["Recommendation", r.recommendation, ""],
        ["Development plan", r.developmentPlan, ""],
        ["Next review", r.nextReviewOn || "—", ""],
      ],
    });
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Star className="text-gold h-5 w-5" /> {r.type} · {r.employee}
        </DialogTitle>
        <DialogDescription>
          {r.id} · {r.cycle} · {r.period.from} → {r.period.to} · reviewed by {r.reviewer} on{" "}
          <span className="whitespace-nowrap">{r.date}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="font-semibold">Overall</span>
        <span className="text-2xl font-bold tabular-nums">{r.overallScore ?? "—"}</span>
        <span className="text-muted-foreground">/ 5 · {r.rating || "—"}</span>
        <Badge variant="outline" className="ml-auto">
          {r.recommendation}
        </Badge>
        <Badge variant="outline" className={hrReviewTone(r.status)}>
          {r.status}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-5">
        {[
          ["Attendance", r.context.attendancePct !== null ? `${r.context.attendancePct} %` : "—"],
          ["Late marks", r.context.lateMarks ?? "—"],
          ["Warnings", r.context.warnings],
          ["Trainings", r.context.trainingsCompleted],
          [
            "Manager review",
            r.context.managerReviewId
              ? `${r.context.managerReviewId} · ${r.context.managerRating}`
              : "—",
          ],
        ].map(([k, v]) => (
          <div key={String(k)} className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
            <div className="font-medium">{v}</div>
          </div>
        ))}
      </div>
      {r.goals.filter((g) => g.considered).length > 0 && (
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="bg-muted/40 text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wider uppercase">
            Goals considered
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-muted/20">
                <tr>
                  <th className="p-2 text-left">Goal</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Target</th>
                  <th className="p-2 text-left">Achieved</th>
                  <th className="p-2">Weight</th>
                  <th className="p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {r.goals
                  .filter((g) => g.considered)
                  .map((g) => (
                    <tr key={g.goalId} className="border-border border-t">
                      <td className="p-2">{g.title}</td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={
                            g.status === "Completed"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : ""
                          }
                        >
                          {g.status}
                        </Badge>{" "}
                        <span className="text-muted-foreground">{g.progress} %</span>
                      </td>
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
      {r.skills.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wider uppercase">
            Skills
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {r.skills.map((s) => (
              <div key={s.skill} className="border-border rounded-lg border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {s.category}
                  </Badge>
                  <span className="font-medium">{s.skill}</span>
                  <span className="ml-auto">
                    <Stars value={s.level} size="h-4 w-4" />
                  </span>
                  <span className="text-muted-foreground w-16 text-[10px]">
                    {PROFICIENCY[s.level ?? 0]}
                  </span>
                </div>
                {s.evidence && (
                  <div className="text-muted-foreground mt-0.5 text-xs">{s.evidence}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {r.params.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wider uppercase">
            Evaluation parameters
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {r.params.map((p) => (
              <div
                key={p.paramId}
                className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <span>{p.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {p.weight} %
                </Badge>
                <span className="ml-auto">
                  <Stars value={p.rating} size="h-4 w-4" />
                </span>
                {p.note && (
                  <span className="text-muted-foreground basis-full text-xs">{p.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <KV
        items={[
          ["Achievements", r.achievements],
          ["Strengths", r.strengths],
          ["Areas to improve", r.improvements],
          ["HR remarks", r.remarks],
          ["Development plan", r.developmentPlan],
          ["Client / stakeholder feedback", r.context.clientFeedback],
          ["Next review", r.nextReviewOn],
          ["Documents", r.attachments.join(", ")],
          ...(mode === "hr" ? [["Confidential HR notes", r.hrNotes]] : []),
          ["Shared with employee", r.sharedWithEmployee ? "Yes" : "No"],
          [
            "Employee acknowledgement",
            r.employeeAck ? `${r.employeeAck.on} — "${r.employeeAck.comment}"` : "Pending",
          ],
        ]}
      />
      {mode === "self" && !readOnly && r.status === "Completed" && !r.employeeAck && (
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
            onClick={() => {
              ackHrReview(r.id, comment);
              toast.success("Review acknowledged");
            }}
          >
            <CheckCircle2 className="h-4 w-4" /> Acknowledge review
          </Button>
        </div>
      )}
      {mode === "hr" && r.history.length > 0 && (
        <div className="text-muted-foreground space-y-0.5 text-xs">
          {r.history.map((h, i) => (
            <div key={i}>
              {h.at} · {h.by} — {h.action}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={pdf}>
          <FileDown className="h-4 w-4" /> Review PDF
        </Button>
      </div>
    </div>
  );
}
