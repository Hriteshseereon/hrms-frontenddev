import { useState } from "react";
import { Plus, UserX, Eye, FileDown, CheckCircle2, XCircle, Gavel } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useSharedList } from "@/lib/shared-list";
import { TERMINATION_TYPE_MASTER } from "@/features/organization/data/master-data";
import {
  TERMINATION_TYPES,
  TERMINATION_STEPS,
  TERMINATION_STEP_ROLES,
  useTerminations,
  createTermination,
  decideTermination,
  executeTermination,
  renderTerminationLetter,
  updateTerminationChecklist,
} from "@/features/employees/data/people-cases";

const APPROVER_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO", "COO"];
const STEPS = ["Case opened", "HR Head", "Unit Head", "Legal", "Approved", "Letter issued"];
const stepIndex = (c) =>
  c.status === "Pending approval"
    ? 1 + c.approvals.filter((a) => a.decision === "Approved").length
    : c.status === "Approved"
      ? 4
      : c.status === "Effective"
        ? 5
        : 1;
const addDays = (iso, n) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function TerminationsTab() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const rows = useTerminations().filter((c) => scopedIds.has(c.empId));
  useDirectory();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const canApprove = APPROVER_ROLES.includes(me.role);
  const list = rows.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      (!q ||
        [c.id, c.employee, c.empId, c.type, c.reason]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const live = detail ? (rows.find((c) => c.id === detail.id) ?? detail) : null;
  return (
    <div className="space-y-4">
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs">
        Terminations require a show-cause notice, the employee's response, a hearing (for cause),
        and HR Head → Unit Head → Legal approval before the letter is issued. Executing a case moves
        the employee to notice, schedules access revocation and opens F&amp;F in Exit Management.
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Toolbar q={q} setQ={setQ} placeholder="Search employee, type, reason…">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Pending approval", "Approved", "Effective", "Rejected"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Toolbar>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Open termination case
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
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Reason</th>
                <th className="p-3 text-left">Notice</th>
                <th className="p-3 text-left">Last working day</th>
                <th className="p-3 text-left">Approvals</th>
                <th className="p-3 text-left">Letter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={10} text="No termination cases." />}
              {list.map((c) => (
                <tr key={c.id} className="border-border hover:bg-muted/30 border-t">
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.empId} · {c.dept}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="border-destructive/30 text-destructive">
                      {c.type}
                    </Badge>
                  </td>
                  <td className="max-w-[260px] truncate p-3 text-xs" title={c.reason}>
                    {c.reason}
                  </td>
                  <td className="p-3 text-xs">
                    {c.noticeMode}
                    {c.noticeDays ? ` · ${c.noticeDays}d` : ""}
                  </td>
                  <td className="p-3 text-xs">{c.lastWorkingDay}</td>
                  <td className="p-3 text-xs">
                    {c.approvals.filter((a) => a.decision === "Approved").length}/
                    {TERMINATION_STEPS.length}
                  </td>
                  <td className="p-3 text-xs">
                    {c.letterRef ? (
                      <button
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                        onClick={() => renderTerminationLetter(c)}
                      >
                        <FileDown className="h-3.5 w-3.5" /> {c.letterRef}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">After approvals</span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>
                      <Eye className="h-4 w-4" /> View
                    </Button>
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
            <DialogTitle>Open termination case</DialogTitle>
            <DialogDescription>
              Grounds, due process (show-cause, response, hearing), notice mode and separation
              checklist. Approvals: HR Head → Unit Head → Legal.
            </DialogDescription>
          </DialogHeader>
          <TerminationForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {live && (
            <TerminationDetail c={live} canApprove={canApprove} onClose={() => setDetail(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TerminationForm({ onDone }) {
  const me = useCurrentUser();
  // Master Data → Termination types ("used in the employee termination form") now actually drives the list.
  const [masterTypes] = useSharedList("master-TTY", TERMINATION_TYPE_MASTER);
  const typeOptions = Array.from(
    new Set([...masterTypes.map((t) => t.name), ...TERMINATION_TYPES]),
  );
  const [empId, setEmpId] = useState("");
  const [type, setType] = useState(TERMINATION_TYPES[0]);
  const [reason, setReason] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [showCauseIssued, setShowCauseIssued] = useState(false);
  const [employeeResponse, setEmployeeResponse] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [legalReview, setLegalReview] = useState(true);
  const [noticeMode, setNoticeMode] = useState("Serve notice");
  const [noticeDays, setNoticeDays] = useState("30");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [fnfRequired, setFnfRequired] = useState(true);
  const [gratuityForfeited, setGratuityForfeited] = useState(false);
  const [assetsRecovered, setAssetsRecovered] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const profile = empId ? getEmployeeProfile(empId) : null;
  const pick = (id) => {
    setEmpId(id);
    const p = getEmployeeProfile(id);
    setNoticeDays(String(p.job.noticePeriodDays));
  };
  const submit = () => {
    const r = createTermination(
      {
        empId,
        type,
        reason,
        incidentDate,
        description,
        evidence,
        noticeMode,
        noticeDays: noticeMode === "Immediate (misconduct)" ? 0 : Number(noticeDays) || 0,
        lastWorkingDay,
        fnfRequired,
        gratuityForfeited,
        assetsRecovered,
        accessRevoked,
        hearingDate,
        showCauseIssued,
        employeeResponse,
        legalReview,
        initiatedBy: me.name,
      },
      me,
    );
    r.ok ? (toast.success(r.message), onDone()) : toast.error(r.message);
  };
  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee & grounds" />
      <EmployeePicker value={empId} onChange={pick} />
      {profile && (
        <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Date of joining</div>
            <b>{profile.job.dateOfJoining}</b>
          </div>
          <div>
            <div className="text-muted-foreground">Employment type</div>
            <b>{profile.job.employmentType}</b>
          </div>
          <div>
            <div className="text-muted-foreground">Notice period</div>
            <b>{profile.job.noticePeriodDays} days</b>
          </div>
          <div>
            <div className="text-muted-foreground">Reporting manager</div>
            <b>{profile.job.reportingManager}</b>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Termination type" required>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Incident / trigger date">
          <Input
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
          />
        </Field>
        <Field label="Reason (appears in the letter)" required className="sm:col-span-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Repeated breach of IT security policy after final warning WRN-2026-004"
          />
        </Field>
        <Field label="Detailed description" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Chronology, prior warnings / PIP, committee findings…"
          />
        </Field>
        <AttachmentsInput
          value={evidence}
          onChange={setEvidence}
          label="Evidence (warnings, PIP, IC report, audit logs)"
        />
      </div>
      <SectionTitle
        n={2}
        title="Due process"
        sub="Principles of natural justice — required before a for-cause termination"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="sc"
            checked={showCauseIssued}
            onCheckedChange={(v) => setShowCauseIssued(!!v)}
          />
          <Label htmlFor="sc" className="font-normal">
            Show-cause notice issued
          </Label>
        </div>
        <Field label="Hearing / inquiry date">
          <Input type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} />
        </Field>
        <Field label="Employee's written response (summary)" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={employeeResponse}
            onChange={(e) => setEmployeeResponse(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id="lr" checked={legalReview} onCheckedChange={(v) => setLegalReview(!!v)} />
          <Label htmlFor="lr" className="font-normal">
            Legal review required before the letter is issued
          </Label>
        </div>
      </div>
      <SectionTitle n={3} title="Notice & separation" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Notice mode" className="sm:col-span-3">
          <RadioGroup
            value={noticeMode}
            onValueChange={(v) => setNoticeMode(v)}
            className="flex flex-wrap gap-4 pt-1"
          >
            {["Serve notice", "Pay in lieu", "Immediate (misconduct)"].map((m) => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} id={`nm-${m}`} />
                <Label htmlFor={`nm-${m}`} className="text-sm font-normal">
                  {m}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
        <Field label="Notice days">
          <Input
            type="number"
            min={0}
            value={noticeMode === "Immediate (misconduct)" ? "0" : noticeDays}
            disabled={noticeMode === "Immediate (misconduct)"}
            onChange={(e) => setNoticeDays(e.target.value)}
          />
        </Field>
        <Field label="Last working day" required>
          <Input
            type="date"
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() =>
              setLastWorkingDay(
                addDays(
                  new Date().toISOString().slice(0, 10),
                  noticeMode === "Serve notice" ? Number(noticeDays) || 0 : 0,
                ),
              )
            }
          >
            Compute from today
          </Button>
        </Field>
        <div className="space-y-2 pt-5 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox id="fnf" checked={fnfRequired} onCheckedChange={(v) => setFnfRequired(!!v)} />
            <Label htmlFor="fnf" className="font-normal">
              Full &amp; final settlement required
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="grat"
              checked={gratuityForfeited}
              onCheckedChange={(v) => setGratuityForfeited(!!v)}
            />
            <Label htmlFor="grat" className="font-normal">
              Gratuity forfeited (Sec 4(6) — misconduct only)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ast"
              checked={assetsRecovered}
              onCheckedChange={(v) => setAssetsRecovered(!!v)}
            />
            <Label htmlFor="ast" className="font-normal">
              Assets already recovered
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="acc"
              checked={accessRevoked}
              onCheckedChange={(v) => setAccessRevoked(!!v)}
            />
            <Label htmlFor="acc" className="font-normal">
              System access already revoked
            </Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="destructive" onClick={submit}>
          <Gavel className="h-4 w-4" /> Open case &amp; route for approvals
        </Button>
      </DialogFooter>
    </div>
  );
}

function TerminationDetail({ c, canApprove, onClose }) {
  const me = useCurrentUser();
  const [note, setNote] = useState("");
  const nextStep =
    c.status === "Pending approval"
      ? TERMINATION_STEPS[c.approvals.filter((a) => a.decision === "Approved").length]
      : null;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserX className="text-destructive h-5 w-5" /> {c.id} · {c.employee}
        </DialogTitle>
        <DialogDescription>
          {c.type} · initiated by {c.initiatedBy} on{" "}
          <span className="whitespace-nowrap">{c.createdOn}</span>
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
          ["Reason", c.reason],
          ["Incident date", c.incidentDate],
          ["Description", c.description],
          ["Evidence", c.evidence.join(", ")],
          ["Show-cause issued", c.showCauseIssued ? "Yes" : "No"],
          ["Hearing date", c.hearingDate],
          ["Employee response", c.employeeResponse],
          ["Legal review", c.legalReview ? "Required" : "Not required"],
          ["Notice", `${c.noticeMode}${c.noticeDays ? ` · ${c.noticeDays} days` : ""}`],
          ["Last working day", c.lastWorkingDay],
          ["F&F", c.fnfRequired ? "Required" : "Not required"],
          ["Gratuity", c.gratuityForfeited ? "Forfeited" : "Payable as per Act"],
          ["Letter", c.letterRef ?? "After approvals"],
        ]}
      />
      <ApprovalTrail approvals={c.approvals} steps={TERMINATION_STEPS} />
      <div className="border-border rounded-lg border p-3">
        <div className="mb-2 text-xs font-semibold">Separation checklist</div>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {[
            ["assetsRecovered", "Assets recovered"],
            ["accessRevoked", "System access revoked"],
            ["fnfRequired", "F&F required"],
            ["gratuityForfeited", "Gratuity forfeited"],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center gap-2">
              <Checkbox
                id={`chk-${k}`}
                checked={c[k]}
                disabled={!canApprove}
                onCheckedChange={(v) => {
                  updateTerminationChecklist(c.id, { [k]: !!v }, me);
                }}
              />
              <Label htmlFor={`chk-${k}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <HistoryTrail history={c.history} />
      {nextStep && canApprove && (TERMINATION_STEP_ROLES[nextStep] ?? []).includes(me.role) && (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">{nextStep} decision</div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comments / conditions"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => {
                const r = decideTermination(c.id, nextStep, "Approved", note, me);
                toast[r.ok ? "success" : "error"](r.message);
                if (r.ok) setNote("");
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve as {nextStep}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                const r = decideTermination(c.id, nextStep, "Rejected", note, me);
                toast[r.ok ? "success" : "error"](r.message);
              }}
            >
              <XCircle className="h-4 w-4" /> Reject case
            </Button>
          </div>
        </div>
      )}
      <DialogFooter className="flex-wrap gap-2">
        {c.letterRef && (
          <Button variant="outline" onClick={() => renderTerminationLetter(c)}>
            <FileDown className="h-4 w-4" /> Termination letter PDF
          </Button>
        )}
        {c.status === "Approved" && canApprove && (
          <Button
            variant="destructive"
            onClick={() => {
              const r = executeTermination(c.id, me);
              r.ok ? toast.success(r.message) : toast.error(r.message);
            }}
          >
            <Gavel className="h-4 w-4" /> Issue termination letter &amp; start exit
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}
