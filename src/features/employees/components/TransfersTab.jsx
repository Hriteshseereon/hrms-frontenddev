import { useState } from "react";
import {
  Plus,
  ArrowRightLeft,
  Building2,
  Eye,
  FileDown,
  CheckCircle2,
  XCircle,
  Rocket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { OFFICES, useDesignationNames } from "@/features/employees/data/hr-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import { useActiveOrgId, getOrg, useOrgs } from "@/features/organization/data/group-data";
import { useDepartments } from "@/features/organization/data/dept-data";
import {
  getEmployeeProfile,
  findEmployee,
  useDirectory,
} from "@/features/employees/data/employee-directory";
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
import {
  TRANSFER_TYPES,
  useTransfers,
  createTransfer,
  decideTransfer,
  effectTransfer,
  renderTransferLetter,
} from "@/features/employees/data/people-cases";
import {
  useGroupTransfers,
  raiseGroupTransfer,
  confirmGroupTransfer,
  rejectGroupTransfer,
  transferDestinations,
  transferableEmployees,
  carryForwardSnapshot,
  assetsNeedingDisposition,
} from "@/features/platform/data/group-transfer-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const APPROVER_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO", "COO"];
const STEPS = ["Requested", "HR approval", "Approved · letter issued", "Effective"];
const stepIndex = (c) =>
  c.status === "Pending approval"
    ? 1
    : c.status === "Approved"
      ? 2
      : c.status === "Effective"
        ? 3
        : 1;

export function TransfersTab() {
  return (
    <Tabs defaultValue="branch" className="space-y-4">
      {/* Scrollable on phones — the two long labels overflowed the 390 px viewport. */}
      <ScrollTabsList>
        <TabsTrigger value="branch">Branch / Department / Manager / Project Transfers</TabsTrigger>
        <TabsTrigger value="group">Transfer to Group Company</TabsTrigger>
      </ScrollTabsList>
      <TabsContent value="branch">
        <EnterpriseTransfers />
      </TabsContent>
      <TabsContent value="group">
        <GroupCompanyTransfers />
      </TabsContent>
    </Tabs>
  );
}

function EnterpriseTransfers() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const rows = useTransfers().filter((c) => scopedIds.has(c.empId));
  useDirectory();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const canApprove = APPROVER_ROLES.includes(me.role);
  const list = rows.filter(
    (c) =>
      (type === "all" || c.type === type) &&
      (status === "all" || c.status === status) &&
      (!q ||
        [c.id, c.employee, c.empId, c.toBranch, c.toDept, c.toManager, c.reason]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const live = detail ? (rows.find((c) => c.id === detail.id) ?? detail) : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Pending HR approval", rows.filter((c) => c.status === "Pending approval").length],
          [
            "Approved — awaiting effective date",
            rows.filter((c) => c.status === "Approved").length,
          ],
          ["Effective", rows.filter((c) => c.status === "Effective").length],
          [
            "Relocation allowance (₹)",
            rows
              .filter((c) => c.status !== "Rejected")
              .reduce((s, c) => s + c.relocationAllowance, 0)
              .toLocaleString("en-IN"),
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
          <Toolbar q={q} setQ={setQ} placeholder="Search employee, destination, reason…">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TRANSFER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium ml-auto text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> New transfer
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
                <th className="p-3 text-left">From</th>
                <th className="p-3 text-left">To</th>
                <th className="p-3 text-left">Effective</th>
                <th className="p-3 text-left">Requested by</th>
                <th className="p-3 text-left">Letter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={10} text="No transfers match." />}
              {list.map((c) => (
                <tr key={c.id} className="border-border hover:bg-muted/30 border-t">
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.employee}</div>
                    <div className="text-muted-foreground text-xs">{c.empId}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{c.type}</Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {c.fromDept} · {c.fromBranch}
                    <div className="text-muted-foreground">{c.fromManager}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <b>
                      {c.toDept} · {c.toBranch}
                    </b>
                    <div className="text-muted-foreground">
                      {c.toManager}
                      {c.newDesignation ? ` · ${c.newDesignation}` : ""}
                    </div>
                  </td>
                  <td className="p-3 text-xs">{c.effectiveFrom}</td>
                  <td className="p-3 text-xs">{c.requestedBy}</td>
                  <td className="p-3 text-xs">
                    {c.letterRef ? (
                      <button
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                        onClick={() => renderTransferLetter(c)}
                      >
                        <FileDown className="h-3.5 w-3.5" /> {c.letterRef}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">On approval</span>
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
                          const r = effectTransfer(c.id, me);
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
            <DialogTitle>New transfer</DialogTitle>
            <DialogDescription>
              Branch, department, entity, reporting-manager, project or role transfer. HR approval
              issues the transfer letter; on the effective date the employee record, reporting line
              and payroll cost centre are updated.
            </DialogDescription>
          </DialogHeader>
          <TransferForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {live && (
            <TransferDetail c={live} canApprove={canApprove} onClose={() => setDetail(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferForm({ onDone }) {
  const me = useCurrentUser();
  const depts = useDepartments();
  const orgs = useOrgs();
  const dir = useDirectory();
  const [empId, setEmpId] = useState("");
  const [type, setType] = useState("Branch");
  const [toBranch, setToBranch] = useState("");
  const [toDept, setToDept] = useState("");
  const [toEntity, setToEntity] = useState("");
  const [toManager, setToManager] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [requestedBy, setRequestedBy] = useState("HR");
  const [relocationAllowance, setRelocationAllowance] = useState("0");
  const [joiningTravel, setJoiningTravel] = useState(false);
  const [noticeDays, setNoticeDays] = useState("15");
  const [handoverTo, setHandoverTo] = useState("");
  const [assetsToReturn, setAssetsToReturn] = useState("");
  const [payrollImpact, setPayrollImpact] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [remarks, setRemarks] = useState("");
  const emp = empId ? findEmployee(empId) : undefined;
  const profile = empId ? getEmployeeProfile(empId) : null;
  const entityName = (orgId) => getOrg(orgId)?.name ?? orgId;
  const pick = (id) => {
    setEmpId(id);
    const e = findEmployee(id);
    const p = getEmployeeProfile(id);
    setToBranch(e?.branch ?? "");
    setToDept(e?.dept ?? "");
    setToEntity(e ? entityName(e.orgId) : "");
    setToManager(p.job.reportingManager);
  };
  const submit = () => {
    if (!emp || !profile) return toast.error("Choose an employee.");
    const r = createTransfer(
      {
        empId,
        type,
        fromBranch: emp.branch,
        toBranch,
        fromDept: emp.dept,
        toDept,
        fromEntity: entityName(emp.orgId),
        toEntity,
        fromManager: profile.job.reportingManager,
        toManager,
        newDesignation,
        effectiveFrom,
        reason,
        requestedBy,
        relocationAllowance: Number(relocationAllowance) || 0,
        joiningTravel,
        noticeDays: Number(noticeDays) || 0,
        handoverTo,
        assetsToReturn,
        payrollImpact,
        attachments,
        remarks,
      },
      me,
    );
    r.ok ? (toast.success(r.message), onDone()) : toast.error(r.message);
  };
  // Managers / designations / branches of the employee's own entity (the lists spanned every entity and a fixed title list).
  const empOrg = emp?.orgId ?? orgs[0]?.id ?? "";
  const managers = dir.filter(
    (e) =>
      e.orgId === empOrg &&
      e.id !== empId &&
      /Manager|Head|Lead|Chief|Director|Officer|President/i.test(e.role),
  );
  const designationOptions = useDesignationNames(empOrg);
  const branchNames = (orgs.find((o) => o.id === empOrg)?.branches ?? []).map((b) => b.name);
  const branchOptions = Array.from(
    new Set([...(emp ? [emp.branch] : []), ...(branchNames.length ? branchNames : OFFICES)]),
  );
  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee & transfer type" />
      <EmployeePicker value={empId} onChange={pick} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Transfer type" required>
          <Select value={type} onValueChange={(v) => setType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSFER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Requested by" required>
          <Select value={requestedBy} onValueChange={(v) => setRequestedBy(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Employee", "Manager", "HR", "Management"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Effective from" required>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
      </div>
      <SectionTitle
        n={2}
        title="From → To"
        sub="Current values are pre-filled from the employee record; change only what moves"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-xs">
          <div className="text-muted-foreground font-semibold tracking-wide uppercase">
            From (current)
          </div>
          <div>
            Entity: <b>{emp ? entityName(emp.orgId) : "—"}</b>
          </div>
          <div>
            Branch: <b>{emp?.branch ?? "—"}</b>
          </div>
          <div>
            Department: <b>{emp?.dept ?? "—"}</b>
          </div>
          <div>
            Reporting manager: <b>{profile?.job.reportingManager ?? "—"}</b>
          </div>
          <div>
            Designation: <b>{emp?.role ?? "—"}</b>
          </div>
        </div>
        <div className="grid gap-2">
          <Field label="To entity">
            <Select value={toEntity} onValueChange={setToEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.name}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To branch">
            <Select value={toBranch} onValueChange={setToBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To department">
            <Select value={toDept} onValueChange={setToDept}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set(depts.filter((d) => d.orgId === empOrg).map((d) => d.name))].map(
                  (n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="New reporting manager">
            <Select value={toManager} onValueChange={setToManager}>
              <SelectTrigger>
                <SelectValue placeholder="Manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.name}>
                    {m.name} · {m.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="New designation (role transfer only)">
            <Select value={newDesignation} onValueChange={setNewDesignation}>
              <SelectTrigger>
                <SelectValue placeholder="Unchanged" />
              </SelectTrigger>
              <SelectContent>
                {designationOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <SectionTitle n={3} title="Reason, handover & payroll impact" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Reason / business justification" required className="sm:col-span-2">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Client / project need, role change, employee request, restructuring…"
          />
        </Field>
        <Field label="Relocation allowance (₹)">
          <Input
            type="number"
            min={0}
            value={relocationAllowance}
            onChange={(e) => setRelocationAllowance(e.target.value)}
          />
        </Field>
        <Field label="Notice for handover (days)">
          <Input type="number" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} />
        </Field>
        <Field label="Handover to">
          <Input
            value={handoverTo}
            onChange={(e) => setHandoverTo(e.target.value)}
            placeholder="Colleague taking over current responsibilities"
          />
        </Field>
        <Field label="Assets to return / re-issue">
          <Input
            value={assetsToReturn}
            onChange={(e) => setAssetsToReturn(e.target.value)}
            placeholder="Access card, desk phone, parking…"
          />
        </Field>
        <Field label="Payroll impact" className="sm:col-span-2">
          <Input
            value={payrollImpact}
            onChange={(e) => setPayrollImpact(e.target.value)}
            placeholder="HRA re-computation (metro / non-metro), client allowance, cost centre change…"
          />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={joiningTravel}
            onCheckedChange={(v) => setJoiningTravel(!!v)}
            id="jt"
          />
          <Label htmlFor="jt" className="font-normal">
            Joining travel & 15 days' guest-house stay as per policy
          </Label>
        </div>
        <AttachmentsInput
          value={attachments}
          onChange={setAttachments}
          label="Attachments (approval e-mails, client request, relocation quotes)"
        />
        <Field label="Remarks" className="sm:col-span-2">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button className="bg-gradient-emerald text-white" onClick={submit}>
          Raise transfer for HR approval
        </Button>
      </DialogFooter>
    </div>
  );
}

function TransferDetail({ c, canApprove, onClose }) {
  const me = useCurrentUser();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArrowRightLeft className="text-primary h-5 w-5" /> {c.id} · {c.employee}
        </DialogTitle>
        <DialogDescription>
          {c.type} transfer · requested by {c.requestedBy} · raised{" "}
          <span className="whitespace-nowrap">{c.createdOn}</span> by {c.createdBy}
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
          ["Entity", `${c.fromEntity} → ${c.toEntity}`],
          ["Branch", `${c.fromBranch} → ${c.toBranch}`],
          ["Department", `${c.fromDept} → ${c.toDept}`],
          ["Reporting manager", `${c.fromManager} → ${c.toManager}`],
          ["Designation", c.newDesignation || "Unchanged"],
          ["Effective from", c.effectiveFrom],
          ["Reason", c.reason],
          ["Relocation allowance", `₹${c.relocationAllowance.toLocaleString("en-IN")}`],
          ["Joining travel", c.joiningTravel ? "Yes — as per policy" : "No"],
          ["Handover", `${c.noticeDays} days · to ${c.handoverTo || "—"}`],
          ["Assets to return", c.assetsToReturn],
          ["Payroll impact", c.payrollImpact],
          ["Letter", c.letterRef ?? "Issued on approval"],
          ["Attachments", c.attachments.join(", ")],
          ["Remarks", c.remarks],
        ]}
      />
      <ApprovalTrail approvals={c.approvals} steps={["HR"]} />
      <HistoryTrail history={c.history} />
      {c.status === "Pending approval" && canApprove && (
        <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">HR decision</div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comments"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => {
                const r = decideTransfer(c.id, "Approved", note, me);
                toast[r.ok ? "success" : "error"](r.message);
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve &amp; issue transfer letter
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                const r = decideTransfer(c.id, "Rejected", note, me);
                toast[r.ok ? "success" : "error"](r.message);
              }}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}
      <DialogFooter className="flex-wrap gap-2">
        {c.letterRef && (
          <Button variant="outline" onClick={() => renderTransferLetter(c)}>
            <FileDown className="h-4 w-4" /> Transfer letter PDF
          </Button>
        )}
        {c.status === "Approved" && canApprove && (
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => {
              const r = effectTransfer(c.id, me);
              r.ok ? toast.success(r.message) : toast.error(r.message);
            }}
          >
            <Rocket className="h-4 w-4" /> Make effective — update employee record
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}

function GroupCompanyTransfers() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const scopeMatch = useScopeMatch();
  const all = useGroupTransfers();
  // The group Super Admin confirms these, so they see every company's requests in their scope;
  // everyone else sees the moves that touch their own company.
  const requests =
    me.role === "SuperAdmin"
      ? all.filter((r) => scopeMatch(r.fromOrgId) || scopeMatch(r.toOrgId))
      : all.filter((r) => r.fromOrgId === orgId || r.toOrgId === orgId);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const canConfirm = me.role === "SuperAdmin";
  const decide = (r, ok) => {
    if (ok) {
      confirmGroupTransfer(r.id, me.name, "");
      toast.success(`${r.employeeName} moves to ${getOrg(r.toOrgId)?.name ?? r.toOrgId}`);
      return;
    }
    const note = window.prompt(`Reject ${r.id} — note to the raiser (required):`, "");
    if (!note?.trim()) return;
    rejectGroupTransfer(r.id, me.name, note.trim());
    toast.success(`${r.id} rejected`);
  };
  const groupStatusTone = (s) =>
    s === "Confirmed"
      ? "border-primary/30 bg-primary/10 text-primary"
      : s === "Rejected"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-gold/30 bg-gold/10 text-gold";

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-muted-foreground max-w-xl text-sm">
            Moves an employee to another company within the same group. Gratuity tenure and PF
            details carry forward automatically; the move needs the group Super Admin's confirmation
            since it spans two companies.
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Group Transfer
              </Button>
            </DialogTrigger>
            <NewGroupTransferDialog orgId={orgId} onDone={() => setOpen(false)} />
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">From</th>
                <th className="p-3 text-left">To</th>
                <th className="p-3 text-left">Effective</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-6 text-center text-sm">
                    No inter-company transfers raised yet.
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className={clickableRow} onClick={() => setDetail(r)}>
                  <td className="p-3 font-medium">{r.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{r.employeeName}</div>
                    <div className="text-muted-foreground text-xs">{r.employeeId}</div>
                  </td>
                  <td className="text-muted-foreground p-3">
                    {getOrg(r.fromOrgId)?.name ?? r.fromOrgId}
                  </td>
                  <td className="flex items-center gap-1.5 p-3 font-medium">
                    <ArrowRightLeft className="text-primary h-3.5 w-3.5" />{" "}
                    {getOrg(r.toOrgId)?.name ?? r.toOrgId}
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">{r.effectiveDate}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={groupStatusTone(r.status)}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {canConfirm && r.status === "Pending Confirmation" ? (
                      <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="bg-gradient-emerald h-7 px-2 text-xs text-white"
                          onClick={() => decide(r, true)}
                          data-testid={`gt-confirm-${r.id}`}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive h-7 px-2 text-xs"
                          onClick={() => decide(r, false)}
                        >
                          Reject
                        </Button>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {r.decidedBy ? `by ${r.decidedBy}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.employeeName}`}
          subtitle={`${getOrg(detail.fromOrgId)?.name ?? detail.fromOrgId} → ${getOrg(detail.toOrgId)?.name ?? detail.toOrgId}`}
          badges={
            <Badge variant="outline" className={groupStatusTone(detail.status)}>
              {detail.status}
            </Badge>
          }
          record={{
            ...detail,
            fromOrg: getOrg(detail.fromOrgId)?.name ?? detail.fromOrgId,
            toOrg: getOrg(detail.toOrgId)?.name ?? detail.toOrgId,
          }}
          hide={["fromOrgId", "toOrgId"]}
          labels={{
            employeeId: "Employee ID",
            employeeName: "Employee",
            fromOrg: "From company",
            toOrg: "To company",
            assetDispositions: "Asset dispositions",
          }}
          sections={[
            {
              title: "Transfer",
              keys: [
                "id",
                "employeeName",
                "employeeId",
                "fromOrg",
                "toOrg",
                "effectiveDate",
                "newDesignation",
                "reason",
                "status",
              ],
            },
            {
              title: "Request & decision",
              keys: ["raisedOn", "raisedBy", "decidedOn", "decidedBy", "decisionNote"],
            },
            { title: "Assets", keys: ["assetDispositions"] },
          ]}
        />
      )}
    </div>
  );
}

function NewGroupTransferDialog({ orgId, onDone }) {
  const me = useCurrentUser();
  const [employeeId, setEmployeeId] = useState("");
  const [toOrgId, setToOrgId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [reason, setReason] = useState("");
  const [dispositions, setDispositions] = useState({});

  const destinations = transferDestinations(orgId);
  const employees = transferableEmployees(orgId);
  const snapshot = employeeId ? carryForwardSnapshot(employeeId) : null;
  const assets = employeeId ? assetsNeedingDisposition(employeeId) : [];

  const valid =
    employeeId &&
    toOrgId &&
    effectiveDate &&
    newDesignation.trim() &&
    reason.trim() &&
    assets.every((a) => dispositions[a.id]);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Transfer to another Group company</DialogTitle>
        <DialogDescription>
          Destination must be within the same company group. Routed to the group Super Admin for
          confirmation.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2 pr-1">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Employee <span className="text-destructive">*</span>
          </Label>
          <Select
            value={employeeId}
            onValueChange={(v) => {
              setEmployeeId(v);
              setDispositions({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} · {e.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {snapshot && (
          <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-xs">
            <div className="text-muted-foreground flex items-center gap-1.5 font-semibold tracking-wide uppercase">
              <Building2 className="h-3.5 w-3.5" /> Carried forward unchanged
            </div>
            <div>
              Group Joining Date:{" "}
              <span className="text-foreground font-medium">{snapshot.groupJoiningDate}</span>
            </div>
            <div>
              UAN: <span className="text-foreground font-medium">{snapshot.uan}</span> · PF No.:{" "}
              <span className="text-foreground font-medium">{snapshot.pfNo}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Destination company <span className="text-destructive">*</span>
          </Label>
          <Select value={toOrgId} onValueChange={setToOrgId} disabled={!destinations.length}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  destinations.length ? "Select destination" : "No other companies in this group"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              Effective date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              New designation <span className="text-destructive">*</span>
            </Label>
            <Input
              value={newDesignation}
              onChange={(e) => setNewDesignation(e.target.value)}
              placeholder="e.g. Site Engineer"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Reason for transfer <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this transfer happening?"
          />
        </div>

        {assets.length > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">
              Asset disposition <span className="text-destructive">*</span>
            </Label>
            <p className="text-muted-foreground text-xs">
              Assets are organisation-scoped — decide what happens to each one currently issued to
              this employee.
            </p>
            <div className="border-border bg-muted/30 space-y-2 rounded-lg border p-3">
              {assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{a.name}</span>
                  <Select
                    value={dispositions[a.id] ?? ""}
                    onValueChange={(v) => setDispositions((p) => ({ ...p, [a.id]: v }))}
                  >
                    <SelectTrigger className="h-8 w-full text-xs sm:w-[220px]">
                      <SelectValue placeholder="Choose disposition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Return to source org</SelectItem>
                      <SelectItem value="transfer-request">
                        Release for re-issue at destination
                      </SelectItem>
                      <SelectItem value="retain-pending-decision">Retain — decide later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => {
            raiseGroupTransfer({
              employeeId,
              toOrgId,
              fromOrgId: orgId,
              effectiveDate,
              newDesignation: newDesignation.trim(),
              reason: reason.trim(),
              assetDispositions: assets.map((a) => ({
                assetId: a.id,
                assetName: a.name,
                disposition: dispositions[a.id],
              })),
              raisedBy: me.id,
            });
            toast.success(
              "Transfer request raised — pending the group Super Admin\u2019s confirmation",
            );
            onDone();
          }}
        >
          Submit for confirmation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
