// Shared leave pieces: the detailed apply form (employee self-service / HR on behalf from My Workspace) and the
// employee leave side-sheet (balances, ledger, approvals trail) used by Balance Leave and the Employees list.
import { useMemo, useState } from "react";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { captureFiles } from "@/lib/attachments";
import { Paperclip, CalendarDays, Wallet, History, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LEAVE_REASON_CATEGORIES } from "@/features/leave/data/leave-data";
import {
  LOP_TYPE,
  applicableLeaveTypes,
  chainStepsFor,
  leaveBalances,
  nextLeaveId,
  submitLeaveApplication,
  todayLocal,
  useLeaveApplications,
  useLeaveTypes,
  validateLeaveApplication,
} from "@/features/leave/data/leave-engine";
import { useCompOffBalance, useCompOffLedgerOf } from "@/features/travel/data/compoff-data";
import {
  findEmployee,
  getEmployeeProfile,
  useDirectory,
} from "@/features/employees/data/employee-directory";
import { useCurrentUser, userById } from "@/features/auth/data/auth-session";
import { exportReportPdf } from "@/lib/export-utils";
import {
  Field,
  SectionTitle,
  useScopedEmployees,
} from "@/features/employees/components/CasePieces";

const statusTone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Cancelled"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";

/** Detailed leave application form. `empId` fixes the applicant (self-service); otherwise HR picks the employee. */
export function LeaveApplyForm({ empId: fixedEmpId, onDone }) {
  const me = useCurrentUser();
  const [allRows] = useLeaveApplications();
  const [leaveTypes] = useLeaveTypes();
  const allDir = useDirectory();
  // HR files on behalf of employees of the active entity only (the picker listed every entity in the group).
  const scoped = useScopedEmployees();
  const dir = fixedEmpId ? allDir : scoped;
  const [empId, setEmpId] = useState(fixedEmpId ?? "");
  // Signed-in users without a seeded directory row (tenant admins, invited users) can still apply for themselves.
  const user = userById(empId);
  const emp =
    findEmployee(empId) ?? (user ? { id: user.id, name: user.name, orgId: user.orgId } : undefined);
  const [leaveType, setLeaveType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dayPart, setDayPart] = useState("Full day");
  const [reasonCategory, setReasonCategory] = useState(LEAVE_REASON_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [documents, setDocuments] = useState([]);
  const balances = useMemo(() => (empId ? leaveBalances(empId, allRows) : []), [empId, allRows]);
  // Half days are validated as half days (balance, limits) — the check used to count the full working days while the
  // saved request carried 0.5, and holidays were excluded in the label but not in the count.
  const check = empId
    ? validateLeaveApplication(
        empId,
        { leaveType, from, to, attachment: documents[0], dayPart },
        allRows,
        leaveTypes,
      )
    : { ok: false, errors: [], warnings: [], days: 0 };
  const days = check.days;
  const needsDoc = /sick|medical/i.test(leaveType) && days > 2 && documents.length === 0;
  const valid =
    Boolean(empId && leaveType && from && to && description.trim()) && check.ok && !needsDoc;
  const submit = () => {
    if (!check.ok) return toast.error(check.errors[0] ?? "Check the application.");
    if (needsDoc) return toast.error("Attach a medical certificate for sick leave beyond 2 days.");
    if (!emp) return toast.error("Choose the employee.");
    const e = emp;
    const app = {
      id: nextLeaveId(allRows),
      employee: e.name,
      empId: e.id,
      leaveType,
      from,
      to,
      days,
      description: description.trim(),
      attachment: documents[0],
      documents,
      status: "Pending",
      approvalChain: chainStepsFor(leaveType).join(" → "),
      chainStep: 0,
      appliedOn: todayLocal(),
      dayPart,
      reasonCategory,
      contactDuringLeave: contact,
      locationDuringLeave: location,
      handoverTo,
      handoverNotes,
      appliedBy: me.id === e.id ? undefined : me.name,
    };
    submitLeaveApplication(app);
    toast.success(
      `Leave request ${app.id} submitted for approval (${days} day${days === 1 ? "" : "s"})`,
    );
    onDone();
  };
  const team = dir.filter((d) => d.orgId === (emp?.orgId ?? "") && d.id !== empId);
  return (
    <div className="space-y-4">
      {!fixedEmpId && (
        <>
          <SectionTitle n={1} title="Employee" />
          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {dir.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} · {d.id} · {d.dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {empId && balances.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {balances
            .filter((b) => Number.isFinite(b.available))
            .map((b) => (
              <Badge
                key={b.type}
                variant="outline"
                className={cn(
                  "font-normal",
                  b.available <= 0 && "border-destructive/40 text-destructive",
                )}
              >
                {b.type}: <b className="ml-1">{b.available}</b>&nbsp;left
              </Badge>
            ))}
        </div>
      )}
      <SectionTitle n={fixedEmpId ? 1 : 2} title="Leave & dates" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Leave type" required className="sm:col-span-2">
          <Select value={leaveType} onValueChange={setLeaveType}>
            <SelectTrigger>
              <SelectValue placeholder="Select leave type" />
            </SelectTrigger>
            <SelectContent>
              {applicableLeaveTypes(leaveTypes)
                .filter((t) => t.status === "Active")
                .map((t) => {
                  const b = balances.find((x) => x.type === t.name);
                  return (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name} ·{" "}
                      {b && Number.isFinite(b.available)
                        ? `${b.available} available`
                        : t.name === LOP_TYPE
                          ? "unpaid"
                          : `max ${t.maxDays} days`}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </Field>
        <Field label="From" required>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (!to || to < e.target.value || dayPart !== "Full day") setTo(e.target.value);
            }}
          />
        </Field>
        <Field label="To" required>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Day part" className="sm:col-span-2">
          <RadioGroup
            value={dayPart}
            onValueChange={(v) => {
              setDayPart(v);
              // A half day is a single date.
              if (v !== "Full day" && from) setTo(from);
            }}
            className="flex flex-wrap gap-4 pt-1"
          >
            {["Full day", "First half", "Second half"].map((d) => (
              <div key={d} className="flex items-center gap-2">
                <RadioGroupItem value={d} id={`dp-${d}`} />
                <Label htmlFor={`dp-${d}`} className="text-sm font-normal">
                  {d}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
        <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm sm:col-span-2">
          <div className="text-muted-foreground text-xs">Number of days</div>
          <div className="text-2xl font-bold">
            {days || 0}{" "}
            <span className="text-muted-foreground text-xs font-normal">
              working day(s) · weekly offs & holidays excluded
              {dayPart !== "Full day" ? " · half day" : ""}
            </span>
          </div>
        </div>
      </div>
      {(check.errors.length > 0 || check.warnings.length > 0) && (leaveType || from || to) && (
        <div className="space-y-1">
          {check.errors.map((e) => (
            <div
              key={e}
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-1.5 text-xs"
            >
              {e}
            </div>
          ))}
          {check.warnings.map((w) => (
            <div
              key={w}
              className="border-gold/40 bg-gold/10 rounded-md border px-3 py-1.5 text-xs"
            >
              {w}
            </div>
          ))}
        </div>
      )}
      <SectionTitle n={fixedEmpId ? 2 : 3} title="Reason & supporting documents" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Reason category" required>
          <Select value={reasonCategory} onValueChange={setReasonCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_REASON_CATEGORIES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description" required className="sm:col-span-2">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Reason for the leave"
          />
        </Field>
        <Field
          label="Supporting documents"
          hint={
            needsDoc
              ? "Medical certificate required for sick leave beyond 2 days"
              : "Medical certificate, invitation, travel proof…"
          }
          className="sm:col-span-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs",
                needsDoc ? "border-destructive/50 text-destructive" : "border-border",
              )}
            >
              <Paperclip className="h-3.5 w-3.5" /> Add document
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  captureFiles(e.target.files);
                  const names = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (names.length) setDocuments([...new Set([...documents, ...names])]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {documents.map((d) => (
              <Badge key={d} variant="outline" className="gap-1 font-normal">
                {d}
                <button
                  type="button"
                  onClick={() => setDocuments(documents.filter((x) => x !== d))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Field>
      </div>
      <SectionTitle n={fixedEmpId ? 3 : 4} title="Availability & handover" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Contact during leave">
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone / e-mail reachable during leave"
          />
        </Field>
        <Field label="Location during leave">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City / out of station"
          />
        </Field>
        <Field label="Handover to">
          <Select value={handoverTo} onValueChange={setHandoverTo}>
            <SelectTrigger>
              <SelectValue placeholder="Team member" />
            </SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name} · {t.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Handover notes">
          <Input
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Open tickets, client calls, deliverables"
          />
        </Field>
      </div>
      <div className="text-muted-foreground text-[11px]">
        Approval chain:{" "}
        {leaveType ? chainStepsFor(leaveType).join(" → ") : "per leave type (Leave Master)"}
        {emp ? ` · reporting manager ${getEmployeeProfile(emp.id).job.reportingManager}` : ""}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button className="bg-gradient-emerald text-white" disabled={!valid} onClick={submit}>
          Submit leave request
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Side sheet with an employee's balances, leave ledger and approval trail. */
export function EmployeeLeaveSheet({ empId, onClose }) {
  const [apps] = useLeaveApplications();
  const compOff = useCompOffLedgerOf(empId ?? "");
  // Same balance rule as the employee's comp-off card (expired credits excluded) instead of a raw credit − debit sum.
  const compOffBal = useCompOffBalance(empId ?? "");
  const emp = empId ? findEmployee(empId) : undefined;
  const balances = useMemo(() => (empId ? leaveBalances(empId, apps) : []), [empId, apps]);
  const mine = useMemo(
    () => apps.filter((a) => a.empId === empId).sort((a, b) => (a.from < b.from ? 1 : -1)),
    [apps, empId],
  );
  const [filter, setFilter] = useState("all");
  const rows = mine.filter((a) => filter === "all" || a.status === filter);
  const taken = mine.filter((a) => a.status === "Approved").reduce((s, a) => s + a.days, 0);
  return (
    <Sheet open={!!empId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {emp && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <CalendarDays className="text-primary h-5 w-5" /> {emp.name} — leave record
              </SheetTitle>
              <SheetDescription>
                {emp.id} · {emp.role} · {emp.dept} · {emp.branch}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 p-4 pt-0">
              <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-4">
                {[
                  ["Days taken (approved)", taken],
                  ["Pending requests", mine.filter((a) => a.status === "Pending").length],
                  ["Rejected", mine.filter((a) => a.status === "Rejected").length],
                  ["Comp-off balance", compOffBal.available],
                ].map(([k, v]) => (
                  <div key={String(k)} className="border-border rounded-lg border p-2">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="text-xl font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <Card className="shadow-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="text-primary h-4 w-4" /> Balances (leave year, credited to
                    date)
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {balances.map((b) => {
                      const fin = Number.isFinite(b.entitled) && b.entitled > 0;
                      return (
                        <div key={b.type} className="border-border rounded-lg border p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{b.type}</span>
                            <span className="text-muted-foreground">
                              {fin ? `${b.available} of ${b.entitled} left` : `${b.used} used`}
                            </span>
                          </div>
                          {fin && (
                            <Progress
                              value={Math.min(100, (b.used / b.entitled) * 100)}
                              className="mt-2 h-1.5"
                            />
                          )}
                          <div className="text-muted-foreground mt-1 text-[11px]">
                            {b.used} used · {b.pending} pending
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <History className="text-primary h-4 w-4" /> Leave ledger
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="ml-auto h-8 w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        exportReportPdf({
                          title: `Leave record — ${emp.name}`,
                          subtitle: `${emp.id} · ${emp.dept} · ${new Date().toLocaleDateString("en-IN")}`,
                          summary: balances
                            .filter((b) => Number.isFinite(b.entitled) && b.entitled > 0)
                            .map((b) => ({
                              label: b.type,
                              value: `${b.available} / ${b.entitled}`,
                            })),
                          columns: [
                            "Ref",
                            "Type",
                            "From",
                            "To",
                            "Days",
                            "Day part",
                            "Reason",
                            "Status",
                            "Decided by",
                            "Documents",
                          ],
                          rows: mine.map((a) => [
                            a.id,
                            a.leaveType,
                            a.from,
                            a.to,
                            a.days,
                            a.dayPart ?? "Full day",
                            a.description,
                            a.status,
                            a.decidedBy ?? "—",
                            (a.documents ?? (a.attachment ? [a.attachment] : [])).join(", ") || "—",
                          ]),
                        })
                      }
                    >
                      <FileDown className="h-4 w-4" /> PDF
                    </Button>
                  </div>
                  {rows.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      No leave applications raised in Seereon HRMS yet.
                      {balances.some((b) => b.used > 0)
                        ? ` Migrated usage before go-live: ${balances
                            .filter((b) => b.used > 0)
                            .map((b) => `${b.type} ${b.used}`)
                            .join(", ")}.`
                        : ""}
                    </p>
                  )}
                  <ol className="border-border relative space-y-4 border-l pl-5">
                    {rows.map((a) => (
                      <li key={a.id} className="relative">
                        <span
                          className={cn(
                            "bg-background absolute top-1 -left-[26px] grid h-3 w-3 place-items-center rounded-full border-2",
                            a.status === "Approved"
                              ? "border-primary"
                              : a.status === "Rejected"
                                ? "border-destructive"
                                : "border-gold",
                          )}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{a.leaveType}</span>
                          <Badge variant="outline" className={statusTone(a.status)}>
                            {a.status}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{a.id}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {a.from} → {a.to} · {a.days} day{a.days === 1 ? "" : "s"}
                          {a.dayPart && a.dayPart !== "Full day" ? ` (${a.dayPart})` : ""}
                          {a.appliedOn ? ` · applied ${a.appliedOn}` : ""}
                          {a.appliedBy ? ` by ${a.appliedBy}` : ""}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {a.reasonCategory ? `${a.reasonCategory} — ` : ""}
                          {a.description}
                        </div>
                        {(a.documents?.length || a.attachment) && (
                          <div className="mt-1">
                            <AttachmentChips
                              names={a.documents ?? [a.attachment]}
                              context={`${a.leaveType} · ${a.id}`}
                              size="xs"
                            />
                          </div>
                        )}
                        {a.handoverTo && (
                          <div className="text-muted-foreground text-[11px]">
                            Handover to {a.handoverTo}
                            {a.handoverNotes ? ` — ${a.handoverNotes}` : ""}
                          </div>
                        )}
                        {a.approvalChain && (
                          <div className="text-muted-foreground text-[11px]">
                            Chain {a.approvalChain}
                            {a.status === "Pending" ? ` · at step ${(a.chainStep ?? 0) + 1}` : ""}
                          </div>
                        )}
                        {a.chainLog?.map((l, i) => (
                          <div key={i} className="text-muted-foreground text-[11px]">
                            ✓ {l.step} · {l.by} · {l.on}
                            {l.note ? ` — ${l.note}` : ""}
                          </div>
                        ))}
                        {a.decidedBy && !a.chainLog?.length && (
                          <div className="text-muted-foreground text-[11px]">
                            {a.status} by {a.decidedBy}
                            {a.decidedOn ? ` on ${a.decidedOn}` : ""}
                            {a.decisionReason ? ` — ${a.decisionReason}` : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              {compOff.length > 0 && (
                <Card className="shadow-card">
                  <CardContent className="p-4">
                    <div className="mb-2 text-sm font-semibold">Comp-off ledger</div>
                    <div className="space-y-1 text-xs">
                      {compOff.map((c) => (
                        <div key={c.id} className="flex flex-wrap gap-2">
                          <span className="w-24 shrink-0 tabular-nums">{c.createdOn}</span>
                          <span className="flex-1">{c.reason}</span>
                          <Badge variant="outline">
                            {c.type} {c.days} d{c.expiresOn ? ` · expires ${c.expiresOn}` : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
