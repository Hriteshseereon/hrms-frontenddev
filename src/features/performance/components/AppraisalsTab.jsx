// Performance → Appraisals: HR-initiated appraisals modelled on the self-appraisal form (why it happened, purpose,
// cycle & timeline, goals with ratings, evaluation parameters, linked reviews, value & justification, pay outcome),
// list with click-to-detail popup, approve → compensation applied + letter.
import { useMemo, useState } from "react";
import { Plus, BadgeIndianRupee, ArrowRight, Eye, Check, X, FileDown, Star } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { usePerformanceScope } from "@/features/performance/components/scope";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { useSalaryStructures } from "@/features/payroll/data/salary-engine";
import { REVIEW_CYCLE_ROWS } from "@/features/performance/data/performance-data";
import { exportReportPdf } from "@/lib/export-utils";
import {
  APPRAISAL_METHODS,
  APPRAISAL_PURPOSES_HR,
  APPRAISAL_TRIGGERS,
  LETTER_TYPES,
  appraisalScore,
  appraisalSeed,
  appraisalStatusTone,
  approveHrAppraisal,
  bandOf,
  rejectHrAppraisal,
  renderHrAppraisalLetter,
  saveHrAppraisal,
  useHrAppraisals,
} from "@/features/performance/data/appraisal-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import { Stars } from "@/features/performance/components/TeamReviewForm";
import { clickableRow } from "@/components/common/RecordDetail";

const inr = (n) => `₹\u00A0${Math.round(n).toLocaleString("en-IN")}`;

export function AppraisalsTab() {
  const me = useCurrentUser();
  const perf = usePerformanceScope();
  // Pay outcomes are compensation data: the active entity only, and a manager / HOD sees just their own people.
  const rows = useHrAppraisals().filter((a) => perf.canSee(a.empId));
  const canCreate = can(me.role, "payroll.manage") || perf.isHr;
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [edit, setEdit] = useState(null);
  const detail = rows.find((a) => a.id === detailId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-semibold">Appraisals</div>
            <div className="text-muted-foreground text-xs">
              HR-initiated appraisals — why it happened, goals & ratings, linked reviews,
              justification and the pay outcome. Approving applies the new CTC / grade and generates
              the letter. Click a row for details.
            </div>
          </div>
          {canCreate && (
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white"
              onClick={() => {
                setEdit(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Appraisal
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Reference",
                  "Employee",
                  "Why · purpose",
                  "Cycle",
                  "Overall",
                  "Method",
                  "Hike",
                  "Annual CTC",
                  "Grade",
                  "Effective",
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
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className={cn(clickableRow, "align-top")}
                  onClick={() => setDetailId(a.id)}
                >
                  <td className="text-muted-foreground p-3 font-mono text-xs">{a.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{a.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.empId} · {a.designation}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    <Badge variant="outline">{a.trigger}</Badge>
                    <div className="text-muted-foreground mt-0.5">{a.purpose}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {a.cycle}
                    <div className="text-muted-foreground">
                      {a.timeline.from} → {a.timeline.to}
                    </div>
                  </td>
                  <td className="p-3">
                    {a.overallScore ? (
                      <span className="font-semibold">
                        {a.overallScore}
                        <span className="text-muted-foreground text-xs font-normal"> / 5</span>
                      </span>
                    ) : (
                      "—"
                    )}
                    <div className="text-muted-foreground text-xs">{a.rating || "—"}</div>
                  </td>
                  <td className="p-3 text-xs">{a.method}</td>
                  <td className="text-primary p-3 font-medium">+{a.percentage}%</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    <span className="text-muted-foreground">{inr(a.currentCtc)}</span>
                    <ArrowRight className="text-muted-foreground mx-1 inline h-3 w-3" />
                    <span className="font-semibold">{inr(a.newCtc)}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {a.grade}
                    {a.newGrade !== a.grade ? ` → ${a.newGrade}` : ""}
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">{a.effectiveFrom}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={appraisalStatusTone(a.status)}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Eye className="text-muted-foreground h-4 w-4" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-muted-foreground p-10 text-center text-sm">
                    No appraisals yet.
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
              <DialogTitle>
                {edit ? `Edit appraisal · ${edit.id}` : "New Appraisal (HR)"}
              </DialogTitle>
              <DialogDescription>
                Same structure as the employee self-appraisal — purpose, goals, ratings, value —
                with HR recording why the appraisal is happening and the pay outcome.
              </DialogDescription>
            </DialogHeader>
            <HrAppraisalForm existing={edit ?? undefined} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
      {detail && (
        <AppraisalDetailDialog
          a={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEdit(detail);
            setDetailId(null);
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Form ---------------- */
function HrAppraisalForm({ existing, onDone }) {
  const me = useCurrentUser();
  const structures = useSalaryStructures().filter((s) => s.active);
  const [empId, setEmpId] = useState(existing?.empId ?? "");
  const emp = findEmployee(empId);
  const seed = useMemo(() => (empId ? appraisalSeed(empId) : null), [empId]);
  const [seededFor, setSeededFor] = useState(existing?.empId ?? "");
  const [trigger, setTrigger] = useState(existing?.trigger ?? "Annual appraisal cycle");
  const [purpose, setPurpose] = useState(existing?.purpose ?? "Annual increment");
  const [whyHappened, setWhy] = useState(existing?.whyHappened ?? "");
  const [cycle, setCycle] = useState(existing?.cycle ?? String(REVIEW_CYCLE_ROWS[0]?.name ?? ""));
  const [from, setFrom] = useState(existing?.timeline.from ?? "2026-04-01");
  const [to, setTo] = useState(existing?.timeline.to ?? "2026-09-30");
  const [goals, setGoals] = useState(existing?.goals ?? []);
  const [params, setParams] = useState(existing?.params ?? []);
  const [linked, setLinked] = useState(existing?.linkedReviews ?? []);
  const [value, setValue] = useState(
    existing?.value ?? { achievements: "", valueCreated: "", justification: "" },
  );
  const [method, setMethod] = useState(existing?.method ?? APPRAISAL_METHODS[0]);
  const [pct, setPct] = useState(existing ? String(existing.percentage) : "");
  const [newCtcInput, setNewCtcInput] = useState(existing ? String(existing.newCtc) : "");
  const [newGrade, setNewGrade] = useState(existing?.newGrade ?? "");
  const [newDesignation, setNewDesignation] = useState(existing?.newDesignation ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(existing?.effectiveFrom ?? "");
  const [letterType, setLetterType] = useState(existing?.letterType ?? "Increment Letter");
  const [bonus, setBonus] = useState(existing ? String(existing.bonusAmount) : "0");
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");
  const [attachments, setAttachments] = useState(existing?.attachments ?? []);

  if (empId && seed && seededFor !== empId && !existing) {
    setSeededFor(empId);
    setGoals(seed.goals);
    setParams(seed.params);
    setLinked(seed.linked);
    setNewGrade(seed.grade);
    setNewDesignation(emp?.role ?? "");
  }
  const currentCtc = existing?.currentCtc ?? seed?.ctc ?? 0;
  const grade = existing?.grade ?? seed?.grade ?? "";
  const percentage = Number(pct) || 0;
  const newCtc = newCtcInput
    ? Number(newCtcInput)
    : Math.round(currentCtc * (1 + percentage / 100));
  const effPct = currentCtc ? +(((newCtc - currentCtc) / currentCtc) * 100).toFixed(1) : percentage;
  const score = appraisalScore(goals, params);
  const monthlyGross = seed?.monthlyGross ?? 0;
  const valid =
    emp &&
    whyHappened.trim() &&
    effectiveFrom &&
    newCtc > 0 &&
    percentage >= 0 &&
    (!from || !to || to >= from);

  const save = () => {
    if (!emp) return;
    const r = saveHrAppraisal(
      {
        id: existing?.id,
        empId: emp.id,
        employee: emp.name,
        designation: emp.role,
        department: emp.dept,
        grade,
        cycle,
        trigger,
        purpose,
        whyHappened: whyHappened.trim(),
        timeline: { from, to },
        goals,
        params,
        linkedReviews: linked,
        value,
        overallScore: score,
        rating: score ? bandOf(score) : "",
        method,
        currentCtc,
        newCtc,
        percentage: effPct,
        newGrade: newGrade || grade,
        newDesignation: newDesignation || emp.role,
        effectiveFrom,
        letterType,
        bonusAmount: Number(bonus) || 0,
        remarks: remarks.trim(),
        attachments,
      },
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onDone();
  };

  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee, why & purpose" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Employee" required className="sm:col-span-2">
          {existing ? (
            <Input value={`${existing.employee} · ${existing.designation}`} disabled />
          ) : (
            <EmployeePicker value={empId} onChange={(id) => setEmpId(id)} />
          )}
        </Field>
        {emp && (
          <div className="bg-muted/40 flex flex-wrap gap-x-6 gap-y-1 rounded-lg p-3 text-xs sm:col-span-2">
            <span>
              {emp.role} · {emp.dept} · {emp.branch}
            </span>
            <span>
              Grade <b>{grade}</b>
            </span>
            <span>
              Current CTC <b>{inr(currentCtc)}</b>
            </span>
            <span>
              Monthly gross <b>{inr(monthlyGross)}</b>
            </span>
          </div>
        )}
        <Field label="Why is this appraisal happening (trigger)" required>
          <Select value={trigger} onValueChange={(v) => setTrigger(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPRAISAL_TRIGGERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purpose" required>
          <Select value={purpose} onValueChange={(v) => setPurpose(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPRAISAL_PURPOSES_HR.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Explain why (context, reviews, decisions that led here)"
          required
          className="sm:col-span-2"
        >
          <Textarea rows={3} value={whyHappened} onChange={(e) => setWhy(e.target.value)} />
        </Field>
        <Field label="Review cycle">
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
        <div className="grid grid-cols-2 gap-2">
          <Field label="Timeline from">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Timeline to">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>

      <SectionTitle
        n={2}
        title="Goals considered"
        sub="From the Goals module with live status — achievement and HR rating per goal"
      />
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Goal</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Target</th>
                <th className="p-2 text-left">Achievement</th>
                <th className="w-16 p-2">Weight</th>
                <th className="w-32 p-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {goals.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-3 text-center">
                    {empId
                      ? "No goals on record — add one below."
                      : "Select an employee to load goals."}
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
                      value={g.achievement}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x, j) =>
                            j === i ? { ...x, achievement: e.target.value } : x,
                          ),
                        )
                      }
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
              achievement: "",
              rating: null,
              weight: 20,
            },
          ])
        }
      >
        + Add goal
      </Button>

      <SectionTitle n={3} title="Ratings on evaluation parameters" />
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
            Select an employee to load parameters.
          </div>
        )}
      </div>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="font-semibold">Overall</span>
        <span className="text-2xl font-bold tabular-nums">{score ?? "—"}</span>
        <span className="text-muted-foreground">
          / 5 · {score ? bandOf(score) : "rate goals and parameters"}
        </span>
        {linked.length > 0 && (
          <span className="text-muted-foreground ml-auto text-xs">
            Linked:{" "}
            {linked.map((l) => `${l.kind} ${l.id} (${l.score ?? (l.rating || "—")})`).join(" · ")}
          </span>
        )}
      </div>

      <SectionTitle n={4} title="Value & justification" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Key achievements">
          <Textarea
            rows={3}
            value={value.achievements}
            onChange={(e) => setValue({ ...value, achievements: e.target.value })}
          />
        </Field>
        <Field label="Value created (revenue, savings, client impact)">
          <Textarea
            rows={3}
            value={value.valueCreated}
            onChange={(e) => setValue({ ...value, valueCreated: e.target.value })}
          />
        </Field>
        <Field label="Justification for the outcome" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={value.justification}
            onChange={(e) => setValue({ ...value, justification: e.target.value })}
          />
        </Field>
      </div>

      <SectionTitle
        n={5}
        title="Pay outcome"
        sub="New payroll is auto-calculated from the current CTC and the percentage; override the CTC if needed"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Method" required>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPRAISAL_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hike %">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              setNewCtcInput("");
            }}
          />
        </Field>
        <Field label="New annual CTC (₹)">
          <Input
            type="number"
            value={newCtcInput || (percentage ? newCtc : "")}
            onChange={(e) => setNewCtcInput(e.target.value)}
            placeholder={String(newCtc)}
          />
        </Field>
        <Field label="Effective from" required>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field label="New grade">
          <Select value={newGrade || grade} onValueChange={setNewGrade}>
            <SelectTrigger>
              <SelectValue placeholder={grade} />
            </SelectTrigger>
            <SelectContent>
              {structures.map((s) => (
                <SelectItem key={s.grade} value={s.grade}>
                  {s.grade} · {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="New designation">
          <Input
            value={newDesignation}
            onChange={(e) => setNewDesignation(e.target.value)}
            placeholder={emp?.role}
          />
        </Field>
        <Field label="Letter">
          <Select value={letterType} onValueChange={(v) => setLetterType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTER_TYPES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="One-time bonus (₹)">
          <Input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </Field>
        <div className="border-border bg-muted/30 rounded-xl border p-4 sm:col-span-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BadgeIndianRupee className="text-primary h-4 w-4" /> Auto-calculated payroll
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground text-xs">Current CTC</div>
              <div className="font-medium">{inr(currentCtc)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Increment</div>
              <div className="text-primary font-medium">
                {newCtc && currentCtc ? `+${inr(newCtc - currentCtc)} (${effPct}%)` : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">New CTC</div>
              <div className="font-semibold">{newCtc ? inr(newCtc) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Revised monthly gross</div>
              <div className="font-semibold">
                {monthlyGross && currentCtc
                  ? inr(Math.round(monthlyGross * (newCtc / currentCtc)))
                  : "—"}
              </div>
            </div>
          </div>
        </div>
        <Field label="Remarks" className="sm:col-span-2">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Supporting documents"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={save}>
          Save appraisal (draft)
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------------- Detail ---------------- */
function AppraisalDetailDialog({ a, onClose, onEdit }) {
  const me = useCurrentUser();
  const [remarks, setRemarks] = useState("");
  const [rejecting, setRejecting] = useState(false);
  // Approving applies the pay change — never for your own record, and not by the person who drafted it (maker-checker).
  const canApprove =
    ["Admin", "SuperAdmin", "CEO", "COO", "CFO", "CHRO", "HR"].includes(me.role) &&
    a.empId !== me.id;
  const pdf = () =>
    exportReportPdf({
      title: `Appraisal ${a.id} — ${a.employee}`,
      subtitle: `${a.purpose} · ${a.trigger} · ${a.cycle} · ${a.status}`,
      columns: ["Item", "Detail", "Rating"],
      rows: [
        ["Why", a.whyHappened, ""],
        ...a.goals.map((g) => [
          `Goal: ${g.title} (${g.status})`,
          `Target ${g.target} · ${g.achievement}`,
          g.rating ?? "—",
        ]),
        ...a.params.map((p) => [
          `Parameter: ${p.name} (${p.weight} %)`,
          p.note || "—",
          p.rating ?? "—",
        ]),
        ...a.linkedReviews.map((l) => [
          `${l.kind} ${l.id}`,
          `by ${l.by} · ${l.rating}`,
          l.score ?? "—",
        ]),
        ["Achievements", a.value.achievements, ""],
        ["Value created", a.value.valueCreated, ""],
        ["Justification", a.value.justification, ""],
        [
          "Outcome",
          `${a.method} · ${a.percentage} % · ${inr(a.currentCtc)} → ${inr(a.newCtc)} · ${a.grade} → ${a.newGrade} · effective ${a.effectiveFrom} · ${a.letterType}${a.letterRef ? ` ${a.letterRef}` : ""}`,
          a.overallScore ?? "—",
        ],
      ],
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="text-gold h-5 w-5" /> {a.id} · {a.employee}
          </DialogTitle>
          <DialogDescription>
            {a.designation} · {a.department} · {a.purpose} · {a.cycle} · {a.timeline.from} →{" "}
            {a.timeline.to} · drafted by {a.createdBy} on{" "}
            <span className="whitespace-nowrap">{a.createdOn}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <span className="font-semibold">Overall</span>
          <span className="text-2xl font-bold tabular-nums">{a.overallScore ?? "—"}</span>
          <span className="text-muted-foreground">/ 5 · {a.rating || "—"}</span>
          <Badge variant="outline">{a.trigger}</Badge>
          <Badge variant="outline" className={cn("ml-auto", appraisalStatusTone(a.status))}>
            {a.status}
          </Badge>
        </div>
        <div className="border-border rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Why this appraisal happened
          </div>
          <p className="mt-1 text-sm">{a.whyHappened}</p>
        </div>
        {a.goals.length > 0 && (
          <div className="border-border overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left">Goal</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Target</th>
                    <th className="p-2 text-left">Achievement</th>
                    <th className="p-2">Weight</th>
                    <th className="p-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {a.goals.map((g) => (
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
                        {g.progress} %
                      </td>
                      <td className="p-2">{g.target}</td>
                      <td className="p-2">{g.achievement}</td>
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
        {a.params.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {a.params.map((p) => (
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
        )}
        {a.linkedReviews.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-muted-foreground self-center text-xs">Linked reviews:</span>
            {a.linkedReviews.map((l) => (
              <Badge key={l.id} variant="outline" className="font-normal">
                {l.kind} {l.id} · {l.by} · {l.score ?? l.rating}
              </Badge>
            ))}
          </div>
        )}
        <KV
          items={[
            ["Achievements", a.value.achievements],
            ["Value created", a.value.valueCreated],
            ["Justification", a.value.justification],
            ["Method", a.method],
            ["Hike", `${a.percentage} %`],
            ["CTC", `${inr(a.currentCtc)} → ${inr(a.newCtc)}`],
            ["Grade / designation", `${a.grade} → ${a.newGrade} · ${a.newDesignation}`],
            ["Effective from", a.effectiveFrom],
            ["Letter", `${a.letterType}${a.letterRef ? ` · ${a.letterRef}` : ""}`],
            ["One-time bonus", a.bonusAmount ? inr(a.bonusAmount) : "—"],
            ["Remarks", a.remarks],
            ["Documents", a.attachments.join(", ")],
            ["Approved by", a.approvedBy ? `${a.approvedBy} on ${a.approvedOn}` : "—"],
          ]}
        />
        <div className="text-muted-foreground space-y-0.5 text-xs">
          {a.history.map((h, i) => (
            <div key={i}>
              {h.at} · {h.by} — {h.action}
            </div>
          ))}
        </div>
        {a.status === "Draft" && canApprove && (
          <div className="border-primary/30 bg-primary/5 space-y-2 rounded-xl border p-4">
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                rejecting ? "Reason for rejection (required)" : "Approval remarks (optional)"
              }
            />
            <div className="flex flex-wrap justify-end gap-2">
              {!rejecting ? (
                <>
                  <Button variant="outline" onClick={onEdit}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive"
                    onClick={() => setRejecting(true)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    className="bg-gradient-emerald text-white"
                    onClick={() => {
                      const r = approveHrAppraisal(a.id, me, remarks.trim());
                      toast[r.ok ? "success" : "error"](r.message);
                      if (r.ok) onClose();
                    }}
                  >
                    <Check className="h-4 w-4" /> Approve & apply pay
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setRejecting(false)}>
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!remarks.trim()}
                    onClick={() => {
                      const r = rejectHrAppraisal(a.id, me, remarks.trim());
                      toast[r.ok ? "success" : "error"](r.message);
                      if (r.ok) onClose();
                    }}
                  >
                    Confirm rejection
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          {a.status === "Applied" && a.letterRef && (
            <Button
              variant="outline"
              onClick={() => {
                if (!renderHrAppraisalLetter(a))
                  toast.error(`No active ${a.letterType} template in Doc Master`);
              }}
            >
              <FileDown className="h-4 w-4" /> {a.letterType}
            </Button>
          )}
          <Button variant="outline" onClick={pdf}>
            <FileDown className="h-4 w-4" /> Appraisal PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
