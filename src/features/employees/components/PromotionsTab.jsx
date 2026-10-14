import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Plus, TrendingUp, FileDown, Eye, CheckCircle2, XCircle, Rocket, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  Field,
  SectionTitle,
  StatusBadge,
  EmployeePicker,
  AttachmentsInput,
  ApprovalTrail,
  HistoryTrail,
  KV,
  Toolbar,
  EmptyRow,
  useScopedIds,
} from "@/features/employees/components/CasePieces";
import { OFFICES } from "@/features/employees/data/hr-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  getEmployeeProfile,
  findEmployee,
  useDirectory,
} from "@/features/employees/data/employee-directory";
import { useSalaryStructures, computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
import { useSelfAppraisals } from "@/features/performance/data/self-appraisal";
import { useDesignationNames } from "@/features/employees/data/hr-data";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import {
  PROMOTION_PURPOSES,
  PROMOTION_STEP_ROLES,
  usePromotions,
  createPromotion,
  approvePromotion,
  effectPromotion,
  submitPromotionDraft,
  renderPromotionLetter,
  promotionTemplate,
  promotionLetterValues,
  previewLetterBody,
} from "@/features/employees/data/people-cases";

const inr = (n) => Math.round(n).toLocaleString("en-IN");
const APPROVER_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO", "COO", "CFO"];
const STEPS = ["Draft", "HR approval", "Unit Head approval", "Approved", "Effective"];
const stepIndex = (c) =>
  c.status === "Draft"
    ? 0
    : c.status === "Pending approval"
      ? 1 + c.approvals.filter((a) => a.decision === "Approved").length
      : c.status === "Approved"
        ? 3
        : c.status === "Effective"
          ? 4
          : 1;

export function PromotionsTab() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const rows = usePromotions().filter((c) => scopedIds.has(c.empId));
  useDirectory();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const list = rows.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      (!q ||
        [c.id, c.employee, c.empId, c.toDesignation, c.purpose]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const canApprove = APPROVER_ROLES.includes(me.role);
  const live = detail ? (rows.find((c) => c.id === detail.id) ?? detail) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Pending approval", rows.filter((c) => c.status === "Pending approval").length],
          ["Approved — to be made effective", rows.filter((c) => c.status === "Approved").length],
          ["Effective this FY", rows.filter((c) => c.status === "Effective").length],
          [
            "Avg. hike",
            `${(rows.filter((c) => c.status === "Effective").reduce((s, c) => s + c.hikePct, 0) / Math.max(1, rows.filter((c) => c.status === "Effective").length)).toFixed(1)} %`,
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Toolbar q={q} setQ={setQ} placeholder="Search by employee, reference, designation…">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Draft", "Pending approval", "Approved", "Effective", "Rejected"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Toolbar>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium ml-auto text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> New promotion / appraisal outcome
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Purpose</th>
                <th className="p-3 text-left">Designation</th>
                <th className="p-3 text-left">Grade</th>
                <th className="p-3 text-right">CTC (₹)</th>
                <th className="p-3 text-right">Hike</th>
                <th className="p-3 text-left">Effective</th>
                <th className="p-3 text-left">Letter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={11} text="No promotions match." />}
              {list.map((c) => (
                <tr key={c.id} className="border-border hover:bg-muted/30 border-t">
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.empId} · {c.dept}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {c.purpose}
                    <div className="text-muted-foreground">{c.appraisalRef}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {c.fromDesignation} → <b>{c.toDesignation}</b>
                  </td>
                  <td className="p-3 text-xs">
                    {c.fromGrade} → <b>{c.toGrade}</b>
                  </td>
                  <td className="p-3 text-right text-xs tabular-nums">
                    {inr(c.fromCtc)} → <b>{inr(c.toCtc)}</b>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.hikePct} %</td>
                  <td className="p-3 text-xs">{c.effectiveFrom}</td>
                  <td className="p-3 text-xs">
                    {c.letterRef ? (
                      <button
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline"
                        onClick={() => renderPromotionLetter(c)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        {c.letterType}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">
                        {c.letterType} ·{" "}
                        {c.letterMode === "Attach signed letter" ? "attached" : "on effect"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>
                      <Eye className="h-4 w-4" /> View
                    </Button>
                    {c.status === "Approved" && canApprove && (
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        onClick={() => {
                          const r = effectPromotion(c.id, me);
                          r.ok ? toast.success(r.message) : toast.error(r.message);
                        }}
                      >
                        <Rocket className="h-4 w-4" /> Make effective
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New promotion / appraisal outcome</DialogTitle>
            <DialogDescription>
              Purpose → new pay grade &amp; structure → effective date → letter (generated from
              Document Master or attached). Approval: HR → Unit Head → HR makes it effective
              (profile, salary structure, payroll and employee portal update automatically).
            </DialogDescription>
          </DialogHeader>
          <PromotionForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {live && (
            <PromotionDetail c={live} canApprove={canApprove} onClose={() => setDetail(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromotionForm({ onDone }) {
  const me = useCurrentUser();
  const structures = useSalaryStructures();
  const appraisals = useSelfAppraisals();
  const orgId = useActiveOrgId();
  const designationOptions = useDesignationNames(orgId);
  const branchOptions = (useOrgs().find((o) => o.id === orgId)?.branches ?? []).map((b) => b.name);
  const [empId, setEmpId] = useState("");
  const [purpose, setPurpose] = useState(PROMOTION_PURPOSES[0]);
  const [appraisalRef, setAppraisalRef] = useState("");
  const [basis, setBasis] = useState("");
  const [recommendedBy, setRecommendedBy] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [toDesignation, setToDesignation] = useState("");
  const [customDesignation, setCustomDesignation] = useState("");
  const [toGrade, setToGrade] = useState("");
  const [toCtc, setToCtc] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [newManager, setNewManager] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [probationMonths, setProbationMonths] = useState("0");
  const [letterType, setLetterType] = useState("Promotion Letter");
  const [letterMode, setLetterMode] = useState("Generate from template");
  const [letterBody, setLetterBody] = useState("");
  const [letterFile, setLetterFile] = useState("");
  const [remarks, setRemarks] = useState("");

  const emp = empId ? findEmployee(empId) : undefined;
  const profile = empId ? getEmployeeProfile(empId) : null;
  const myAppraisals = appraisals.filter((a) => a.empId === empId);
  const ctcNum = Number(toCtc) || 0;
  const hike =
    profile && profile.payroll.ctc && ctcNum
      ? +(((ctcNum - profile.payroll.ctc) / profile.payroll.ctc) * 100).toFixed(1)
      : 0;
  const finalDesignation = toDesignation === "__custom" ? customDesignation : toDesignation;
  const breakup = useMemo(
    () => (ctcNum && toGrade ? computeSalaryBreakup(ctcNum, toGrade) : null),
    [ctcNum, toGrade],
  );
  const tpl = promotionTemplate(letterType, empId);
  const draftValues =
    emp && profile
      ? promotionLetterValues({
          employee: emp.name,
          empId,
          toDesignation: finalDesignation,
          dept: emp.dept,
          toGrade,
          fromGrade: profile.job.grade,
          toCtc: ctcNum,
          fromCtc: profile.payroll.ctc,
          hikePct: hike,
          effectiveFrom,
          newManager,
          newBranch,
        })
      : {};
  const generated = tpl ? previewLetterBody(tpl.body, draftValues) : "";

  const pickEmployee = (id) => {
    setEmpId(id);
    const p = getEmployeeProfile(id);
    setToGrade(p.job.grade);
    setNewManager(p.job.reportingManager);
    setNewBranch(findEmployee(id)?.branch ?? "");
    const latest = appraisals.filter((a) => a.empId === id)[0];
    if (latest) setAppraisalRef(latest.id);
  };
  const submit = (send) => {
    if (!empId) return toast.error("Choose an employee.");
    const r = createPromotion(
      {
        empId,
        purpose,
        appraisalRef,
        basis,
        toDesignation: finalDesignation,
        toGrade,
        toCtc: ctcNum,
        effectiveFrom,
        newManager,
        newBranch,
        probationMonths: Number(probationMonths) || 0,
        recommendedBy,
        letterType,
        letterMode,
        letterBody: letterMode === "Generate from template" ? letterBody || generated : undefined,
        letterFile: letterMode === "Attach signed letter" ? letterFile : undefined,
        attachments,
        remarks,
      },
      me,
      send,
    );
    r.ok ? (toast.success(r.message), onDone()) : toast.error(r.message);
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        n={1}
        title="Employee & purpose of promotion"
        sub="Why this promotion / appraisal outcome is being raised, and the evidence behind it"
      />
      <EmployeePicker value={empId} onChange={pickEmployee} />
      {profile && (
        <div className="border-primary/20 bg-primary/5 grid grid-cols-1 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Current designation</div>
            <b>{emp?.role}</b>
          </div>
          <div>
            <div className="text-muted-foreground">Current grade</div>
            <b>{profile.job.grade}</b>
          </div>
          <div>
            <div className="text-muted-foreground">Current CTC</div>
            <b>₹{inr(profile.payroll.ctc)}</b>
          </div>
          <div>
            <div className="text-muted-foreground">Reporting manager</div>
            <b>{profile.job.reportingManager}</b>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Purpose of promotion" required>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMOTION_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Linked appraisal / review"
          hint="Self-appraisals submitted by this employee (Performance module)"
        >
          <Select value={appraisalRef} onValueChange={setAppraisalRef}>
            <SelectTrigger>
              <SelectValue
                placeholder={myAppraisals.length ? "Select appraisal" : "No appraisal on record"}
              />
            </SelectTrigger>
            <SelectContent>
              {myAppraisals.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.id} · {a.quarter} · {a.stage}
                </SelectItem>
              ))}
              <SelectItem value="__manual">Manual reference</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Basis / justification" required className="sm:col-span-2">
          <Textarea
            rows={3}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="Appraisal rating, goals achieved, value created, manager recommendation, calibration notes…"
          />
        </Field>
        <Field label="Recommended by">
          <Input
            value={recommendedBy}
            onChange={(e) => setRecommendedBy(e.target.value)}
            placeholder="Reporting manager / unit head"
          />
        </Field>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Supporting documents"
        />
      </div>

      <SectionTitle
        n={2}
        title="New position, pay grade & salary structure"
        sub="The new grade drives the salary structure; payroll and the profile are updated when HR makes it effective"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="New designation" required>
          <Select value={toDesignation} onValueChange={setToDesignation}>
            <SelectTrigger>
              <SelectValue placeholder="Select designation" />
            </SelectTrigger>
            <SelectContent>
              {designationOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
              <SelectItem value="__custom">Other (type below)</SelectItem>
            </SelectContent>
          </Select>
          {toDesignation === "__custom" && (
            <Input
              className="mt-1"
              value={customDesignation}
              onChange={(e) => setCustomDesignation(e.target.value)}
              placeholder="New designation"
            />
          )}
        </Field>
        <Field label="New pay grade" required>
          <Select value={toGrade} onValueChange={setToGrade}>
            <SelectTrigger>
              <SelectValue placeholder="Grade" />
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
        <Field label="New annual CTC (₹)" required>
          <Input
            type="number"
            value={toCtc}
            onChange={(e) => setToCtc(e.target.value)}
            placeholder="e.g. 1500000"
          />
          {profile && ctcNum > 0 && (
            <p className={`text-[11px] ${hike < 0 ? "text-destructive" : "text-primary"}`}>
              Hike {hike} % on ₹{inr(profile.payroll.ctc)}
            </p>
          )}
        </Field>
        <Field label="Effective start date" required>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field label="Reporting manager (after promotion)">
          <Input value={newManager} onChange={(e) => setNewManager(e.target.value)} />
        </Field>
        <Field label="Branch / location">
          <Select value={newBranch} onValueChange={setNewBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                new Set([
                  ...(newBranch ? [newBranch] : []),
                  ...(branchOptions.length ? branchOptions : OFFICES),
                ]),
              ).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Probation in new role (months)" hint="0 = none">
          <Input
            type="number"
            min={0}
            value={probationMonths}
            onChange={(e) => setProbationMonths(e.target.value)}
          />
        </Field>
      </div>
      {breakup && (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Salary structure — grade {toGrade}</th>
                <th className="p-2 text-right">Monthly (₹)</th>
                <th className="p-2 text-right">Annual (₹)</th>
              </tr>
            </thead>
            <tbody>
              {breakup.earnings.map((e) => (
                <tr key={e.label} className="border-border border-t">
                  <td className="p-2">{e.label}</td>
                  <td className="p-2 text-right tabular-nums">{inr(e.monthly)}</td>
                  <td className="p-2 text-right tabular-nums">{inr(e.annual)}</td>
                </tr>
              ))}
              <tr className="border-border border-t font-semibold">
                <td className="p-2">Gross</td>
                <td className="p-2 text-right tabular-nums">{inr(breakup.monthlyGross)}</td>
                <td className="p-2 text-right tabular-nums">{inr(breakup.monthlyGross * 12)}</td>
              </tr>
              <tr className="border-border bg-primary/5 border-t font-semibold">
                <td className="p-2">Cost to company</td>
                <td className="p-2 text-right tabular-nums">{inr(Math.round(ctcNum / 12))}</td>
                <td className="p-2 text-right tabular-nums">{inr(ctcNum)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle
        n={3}
        title="Appraisal / promotion letter"
        sub="Generate from the Document Master template (HR can edit the text) or attach the signed letter"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Letter type">
          <Select
            value={letterType}
            onValueChange={(v) => {
              setLetterType(v);
              setLetterBody("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Promotion Letter", "Increment Letter", "Appointment Letter"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Letter source">
          <RadioGroup
            value={letterMode}
            onValueChange={(v) => setLetterMode(v)}
            className="flex gap-4 pt-1"
          >
            {["Generate from template", "Attach signed letter"].map((m) => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} id={`lm-${m}`} />
                <Label htmlFor={`lm-${m}`} className="text-sm font-normal">
                  {m}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
      </div>
      {letterMode === "Generate from template" ? (
        <Field
          label={`Letter body — ${tpl?.name ?? "no active template"}`}
          hint="Tokens are filled from this form; edit freely. The salary annexure table is appended automatically."
        >
          <Textarea
            rows={8}
            value={letterBody || generated}
            onChange={(e) => setLetterBody(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setLetterBody("")}>
              Reset to template
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!emp || !ctcNum}
              onClick={() => {
                if (!emp || !profile) return;
                renderPromotionLetter({
                  id: "PREVIEW",
                  empId,
                  employee: emp.name,
                  dept: emp.dept,
                  purpose,
                  appraisalRef,
                  basis,
                  fromDesignation: emp.role,
                  toDesignation: finalDesignation,
                  fromGrade: profile.job.grade,
                  toGrade,
                  fromCtc: profile.payroll.ctc,
                  toCtc: ctcNum,
                  hikePct: hike,
                  effectiveFrom,
                  newManager,
                  newBranch,
                  probationMonths: 0,
                  recommendedBy,
                  letterType,
                  letterMode,
                  letterBody: letterBody || generated,
                  attachments,
                  status: "Draft",
                  approvals: [],
                  history: [],
                  createdOn: "",
                  createdBy: "",
                  remarks,
                });
              }}
            >
              <FileDown className="h-4 w-4" /> Preview PDF
            </Button>
          </div>
        </Field>
      ) : (
        <Field label="Signed letter (PDF)" required>
          <div className="flex items-center gap-2">
            <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
              Choose file
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  captureFiles(e.target.files);
                  setLetterFile(e.target.files?.[0]?.name ?? "");
                }}
              />
            </label>
            {letterFile && <Badge variant="outline">{letterFile}</Badge>}
          </div>
        </Field>
      )}
      <Field label="Remarks (internal)">
        <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => submit(false)}>
          Save draft
        </Button>
        <Button className="bg-gradient-emerald text-white" onClick={() => submit(true)}>
          <Send className="h-4 w-4" /> Submit for approval
        </Button>
      </DialogFooter>
    </div>
  );
}

function PromotionDetail({ c, canApprove, onClose }) {
  const me = useCurrentUser();
  const [note, setNote] = useState("");
  const nextStep =
    c.status === "Pending approval"
      ? c.approvals.some((a) => a.step === "HR")
        ? "Unit Head"
        : "HR"
      : null;
  const decide = (d) => {
    const r = approvePromotion(c.id, nextStep, d, note, me);
    if (r.ok) {
      toast.success(r.message);
      setNote("");
    } else toast.error(r.message);
  };
  // Only the roles that own the pending step (and never the employee themself) see the decision panel.
  const canDecide =
    canApprove &&
    !!nextStep &&
    (PROMOTION_STEP_ROLES[nextStep] ?? []).includes(me.role) &&
    c.empId !== me.id;
  const bk = computeSalaryBreakup(c.toCtc, c.toGrade);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <TrendingUp className="text-primary h-5 w-5" /> {c.id} · {c.employee}
        </DialogTitle>
        <DialogDescription>
          {c.purpose} · raised <span className="whitespace-nowrap">{c.createdOn}</span> by{" "}
          {c.createdBy}
        </DialogDescription>
      </DialogHeader>
      <WorkflowStepper
        steps={STEPS}
        active={stepIndex(c)}
        failed={c.status === "Rejected"}
        badge={<StatusBadge status={c.status} />}
      />
      <KV
        items={[
          ["Employee", `${c.employee} (${c.empId}) · ${c.dept}`],
          ["Linked appraisal", c.appraisalRef],
          ["Basis", c.basis],
          ["Recommended by", c.recommendedBy],
          ["Designation", `${c.fromDesignation} → ${c.toDesignation}`],
          ["Pay grade", `${c.fromGrade} → ${c.toGrade}`],
          ["Annual CTC", `₹${inr(c.fromCtc)} → ₹${inr(c.toCtc)} (${c.hikePct} %)`],
          ["Effective from", c.effectiveFrom],
          ["Reporting manager", c.newManager],
          ["Branch", c.newBranch],
          ["Probation in new role", c.probationMonths ? `${c.probationMonths} months` : "None"],
          [
            "Letter",
            `${c.letterType} · ${c.letterMode}${c.letterRef ? ` · ${c.letterRef}` : ""}${c.letterFile ? ` · ${c.letterFile}` : ""}`,
          ],
          ["Attachments", c.attachments.join(", ")],
          ["Remarks", c.remarks],
        ]}
      />
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 text-left">New salary structure — grade {c.toGrade}</th>
              <th className="p-2 text-right">Monthly (₹)</th>
              <th className="p-2 text-right">Annual (₹)</th>
            </tr>
          </thead>
          <tbody>
            {bk.earnings.map((e) => (
              <tr key={e.label} className="border-border border-t">
                <td className="p-2">{e.label}</td>
                <td className="p-2 text-right tabular-nums">{inr(e.monthly)}</td>
                <td className="p-2 text-right tabular-nums">{inr(e.annual)}</td>
              </tr>
            ))}
            <tr className="border-border border-t font-semibold">
              <td className="p-2">Gross</td>
              <td className="p-2 text-right tabular-nums">{inr(bk.monthlyGross)}</td>
              <td className="p-2 text-right tabular-nums">{inr(bk.monthlyGross * 12)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ApprovalTrail approvals={c.approvals} steps={["HR", "Unit Head"]} />
      {c.letterBody && (
        <details className="border-border rounded-lg border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Letter text (HR-edited)</summary>
          <pre className="mt-2 font-sans whitespace-pre-wrap">
            {previewLetterBody(c.letterBody, promotionLetterValues(c))}
          </pre>
        </details>
      )}
      <HistoryTrail history={c.history} />
      {nextStep && canDecide && (
        <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">{nextStep} decision</div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comments (band check, budget, calibration…)"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => decide("Approved")}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve as {nextStep}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide("Rejected")}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}
      <DialogFooter className="flex-wrap gap-2">
        {c.status === "Draft" && (
          <Button
            variant="outline"
            onClick={() => {
              const r = submitPromotionDraft(c.id, me);
              toast[r.ok ? "success" : "error"](r.message);
            }}
          >
            <Send className="h-4 w-4" /> Submit for approval
          </Button>
        )}
        {(c.letterRef || c.status === "Approved") && c.letterMode !== "Attach signed letter" && (
          <Button variant="outline" onClick={() => renderPromotionLetter(c)}>
            <FileDown className="h-4 w-4" /> {c.letterType} PDF
          </Button>
        )}
        {c.status === "Approved" && canApprove && (
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => {
              const r = effectPromotion(c.id, me);
              r.ok ? toast.success(r.message) : toast.error(r.message);
            }}
          >
            <Rocket className="h-4 w-4" /> Make effective — update pay grade &amp; issue letter
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}
