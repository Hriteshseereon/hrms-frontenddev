// Work orders — client sites / engagements with purpose, demand & approval, scope, locations, payment terms and shift plan;
// employees and wage workers assigned to a work order follow its shift.
import { useState } from "react";
import {
  Plus,
  Briefcase,
  Users,
  Clock,
  MapPin,
  IndianRupee,
  Download,
  Eye,
  X,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { OFFICES } from "@/features/employees/data/hr-data";
import { useShifts } from "@/features/attendance/data/attendance-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { exportReportPdf } from "@/lib/export-utils";
import {
  Field,
  SectionTitle,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import {
  WO_PURPOSES,
  useWorkOrders,
  addWorkOrder,
  updateWorkOrder,
  useWorkOrderAssignments,
  assignWorkOrder,
  unassignWorkOrder,
} from "@/features/employees/data/work-order-data";
import { useWageWorkers } from "@/features/employees/data/wage-workers";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const statusTone = {
  Active: "border-primary/30 bg-primary/10 text-primary",
  "On Hold": "border-gold/40 bg-gold/15 text-gold",
  Completed: "border-border bg-muted text-muted-foreground",
};
const prioTone = (p) =>
  p === "Critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : p === "High"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border";
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtMoney = (n, c = "INR") =>
  `${c === "INR" ? "₹" : c + " "}${Math.round(n).toLocaleString("en-IN")}`;

export function WorkOrdersTab() {
  const activeOrgId = useActiveOrgId();
  const allWorkOrders = useWorkOrders();
  const inScope = useScopeMatch();
  const workOrders = allWorkOrders.filter((w) => inScope(w.orgId));
  const allAssignments = useWorkOrderAssignments();
  const assignments = allAssignments.filter((a) => workOrders.some((w) => w.id === a.workOrderId));
  const wageWorkers = useWageWorkers();
  const dir = useDirectory();
  const SHIFTS = useShifts();
  // Directory employees of the entity (new hires included), not only the seeded login roster.
  const orgEmployees = dir.filter(
    (e) => e.orgId === activeOrgId && inScope(e.orgId, null, e.branch),
  );
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const live = view ? (allWorkOrders.find((w) => w.id === view.id) ?? view) : null;
  const report = () => {
    const ok = exportReportPdf({
      title: "Work orders register",
      subtitle: `${workOrders.length} work orders · ${new Date().toLocaleDateString("en-IN")}`,
      summary: [
        { label: "Active", value: String(workOrders.filter((w) => w.status === "Active").length) },
        {
          label: "On hold",
          value: String(workOrders.filter((w) => w.status === "On Hold").length),
        },
        { label: "Employees deployed", value: String(assignments.length) },
        {
          label: "Wage workers",
          value: String(
            wageWorkers.filter((x) => workOrders.some((w) => w.id === x.workOrderId)).length,
          ),
        },
      ],
      columns: [
        "ID",
        "Work order",
        "Purpose",
        "Client site",
        "Locations",
        "Demanded by",
        "Approved by",
        "Start",
        "End",
        "Billing",
        "PO",
        "Budget",
        "Shifts",
        "Employees",
        "Workers",
        "Status",
      ],
      rows: workOrders.map((w) => [
        w.id,
        w.name,
        w.purpose ?? "—",
        w.clientSite,
        (w.locations ?? [w.clientSite]).join("; "),
        w.demandedBy ? `${w.demandedBy.name} (${w.demandedBy.role})` : "—",
        w.approvedBy ? `${w.approvedBy.name} · ${w.approvedBy.on}` : "—",
        w.startDate,
        w.endDate ?? "Open",
        w.payment?.billingType ?? "—",
        w.payment?.poNumber ?? "—",
        w.payment ? fmtMoney(w.payment.budget, w.payment.currency) : "—",
        (w.shifts ?? [{ shiftId: w.shiftId, headcount: 0, days: "" }])
          .map(
            (s) =>
              `${SHIFTS.find((x) => x.id === s.shiftId)?.name ?? s.shiftId}${s.headcount ? ` ×${s.headcount}` : ""}`,
          )
          .join(", "),
        assignments.filter((a) => a.workOrderId === w.id).length,
        wageWorkers.filter((x) => x.workOrderId === w.id).length,
        w.status,
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "Work orders register ready — save as PDF" : "Allow pop-ups to download",
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="text-primary h-4 w-4" /> Work orders
            </div>
            <div className="text-muted-foreground text-xs">
              Client sites and engagements with their purpose, approvals, locations, payment terms
              and shift plan. Assigned employees and wage workers follow the work order's shift.
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!workOrders.length} onClick={report}>
              <Download className="h-4 w-4" /> Work orders report
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                  <Plus className="h-4 w-4" /> New work order
                </Button>
              </DialogTrigger>
              <NewWorkOrderDialog orgId={activeOrgId} onDone={() => setOpen(false)} />
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workOrders.length === 0 && (
          <Card className="shadow-card md:col-span-3">
            <CardContent className="text-muted-foreground p-10 text-center">
              No work orders for this entity yet.
            </CardContent>
          </Card>
        )}
        {workOrders.map((wo) => {
          const shifts = wo.shifts?.length
            ? wo.shifts
            : [{ shiftId: wo.shiftId, headcount: wo.headcount ?? 0, days: "" }];
          const assigned = assignments.filter((a) => a.workOrderId === wo.id);
          const workers = wageWorkers.filter((x) => x.workOrderId === wo.id);
          return (
            <Card key={wo.id} className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{wo.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {wo.id} · {wo.office}
                      {wo.purpose ? ` · ${wo.purpose}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={statusTone[wo.status]}>
                      {wo.status}
                    </Badge>
                    {wo.priority && (
                      <Badge variant="outline" className={prioTone(wo.priority)}>
                        {wo.priority}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="text-primary h-4 w-4 shrink-0" />
                  <span>{wo.clientSite}</span>
                </div>
                {wo.locations && wo.locations.length > 1 && (
                  <div className="text-muted-foreground flex items-start gap-2 text-xs">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{wo.locations.join(" · ")}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {shifts.map((s, si) => {
                    const sh = SHIFTS.find((x) => x.id === s.shiftId);
                    return (
                      <div
                        key={`${s.shiftId}-${si}`}
                        className="text-muted-foreground flex items-center gap-2 text-xs"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {sh ? `${sh.name} · ${sh.start}–${sh.end}` : s.shiftId}
                        {s.headcount ? ` · ${s.headcount} heads` : ""}
                        {s.days ? ` · ${s.days}` : ""}
                      </div>
                    );
                  })}
                </div>
                {wo.demandedBy && (
                  <div className="text-muted-foreground text-xs">
                    Demanded by <b className="text-foreground">{wo.demandedBy.name}</b> (
                    {wo.demandedBy.role})
                    {wo.approvedBy ? (
                      <>
                        {" "}
                        · approved by <b className="text-foreground">
                          {wo.approvedBy.name}
                        </b> on {wo.approvedBy.on}
                      </>
                    ) : (
                      " · approval pending"
                    )}
                  </div>
                )}
                {wo.payment && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                    {wo.payment.billingType} · PO {wo.payment.poNumber || "—"} · budget{" "}
                    {fmtMoney(wo.payment.budget, wo.payment.currency)} · {wo.payment.invoicingCycle}
                  </div>
                )}
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 shrink-0" /> {assigned.length} employee
                  {assigned.length === 1 ? "" : "s"} · {workers.length} wage worker
                  {workers.length === 1 ? "" : "s"} ·{" "}
                  <span className="whitespace-nowrap">{wo.startDate}</span> →{" "}
                  <span className="whitespace-nowrap">{wo.endDate ?? "open"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {wo.status !== "Completed" && (
                    <AssignEmployeeDialog workOrderId={wo.id} employees={orgEmployees} />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setView(wo)}>
                    <Eye className="h-4 w-4" /> Details
                  </Button>
                  {wo.status === "Active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        updateWorkOrder(wo.id, { status: "On Hold" });
                        toast.success("Work order put on hold");
                      }}
                    >
                      Put on hold
                    </Button>
                  ) : wo.status === "On Hold" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        updateWorkOrder(wo.id, { status: "Active" });
                        toast.success("Work order reactivated");
                      }}
                    >
                      Reactivate
                    </Button>
                  ) : null}
                  {wo.status !== "Completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        updateWorkOrder(wo.id, {
                          status: "Completed",
                          endDate:
                            wo.endDate ??
                            (() => {
                              const d = new Date();
                              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                            })(),
                        });
                        toast.success("Work order completed");
                      }}
                    >
                      Complete
                    </Button>
                  )}
                </div>
                {assigned.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {assigned.map((a) => {
                      const emp = dir.find((e) => e.id === a.employeeId);
                      return (
                        <Badge key={a.employeeId} variant="outline" className="text-[11px]">
                          {emp?.name ?? a.employeeId}
                          <button
                            className="text-muted-foreground hover:text-destructive ml-1.5"
                            onClick={() => {
                              unassignWorkOrder(a.employeeId);
                              toast.success("Unassigned");
                            }}
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!live} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {live && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="text-primary h-5 w-5" /> {live.name}{" "}
                  <Badge variant="outline" className={statusTone[live.status]}>
                    {live.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {live.id} · {live.clientSite} · created{" "}
                  <span className="whitespace-nowrap">{live.createdOn ?? "—"}</span> by{" "}
                  {live.createdBy ?? "—"}
                </DialogDescription>
              </DialogHeader>
              <KV
                items={[
                  ["Purpose", live.purpose],
                  ["Details / scope", live.details],
                  [
                    "Demanded by",
                    live.demandedBy ? `${live.demandedBy.name} (${live.demandedBy.role})` : "—",
                  ],
                  [
                    "Approved by",
                    live.approvedBy
                      ? `${live.approvedBy.name} (${live.approvedBy.role}) · ${live.approvedBy.on}`
                      : "Pending",
                  ],
                  ["Locations", (live.locations ?? [live.clientSite]).join("; ")],
                  ["Home office", live.office],
                  ["Timeline", `${live.startDate} → ${live.endDate ?? "open-ended"}`],
                  ["Headcount required", live.headcount ? String(live.headcount) : "—"],
                  ["Priority", live.priority],
                  ["Client contact", live.clientContact],
                  [
                    "Billing",
                    live.payment ? `${live.payment.billingType} · ${live.payment.rateBasis}` : "—",
                  ],
                  [
                    "PO / budget",
                    live.payment
                      ? `${live.payment.poNumber || "—"} · ${fmtMoney(live.payment.budget, live.payment.currency)}`
                      : "—",
                  ],
                  [
                    "Payment terms",
                    live.payment
                      ? `${live.payment.paymentTerms} · invoiced ${live.payment.invoicingCycle} · cost centre ${live.payment.costCentre}`
                      : "—",
                  ],
                  [
                    "Shifts",
                    (live.shifts ?? [])
                      .map(
                        (s) =>
                          `${SHIFTS.find((x) => x.id === s.shiftId)?.name ?? s.shiftId} × ${s.headcount} (${s.days})`,
                      )
                      .join("; ") || SHIFTS.find((x) => x.id === live.shiftId)?.name,
                  ],
                  ["Attachments", (live.attachments ?? []).join(", ")],
                  ["Notes", live.notes],
                ]}
              />
              <div className="text-muted-foreground text-xs">
                <b>Deployed:</b>{" "}
                {assignments
                  .filter((a) => a.workOrderId === live.id)
                  .map((a) => dir.find((e) => e.id === a.employeeId)?.name ?? a.employeeId)
                  .join(", ") || "no employees"}{" "}
                · wage workers:{" "}
                {wageWorkers
                  .filter((x) => x.workOrderId === live.id)
                  .map((x) => x.name)
                  .join(", ") || "none"}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportReportPdf({
                      title: `Work order ${live.id}`,
                      subtitle: live.name,
                      columns: ["Item", "Detail"],
                      rows: [
                        ["Purpose", live.purpose ?? "—"],
                        ["Client site", live.clientSite],
                        ["Locations", (live.locations ?? []).join("; ")],
                        [
                          "Demanded by",
                          live.demandedBy
                            ? `${live.demandedBy.name} (${live.demandedBy.role})`
                            : "—",
                        ],
                        [
                          "Approved by",
                          live.approvedBy
                            ? `${live.approvedBy.name} · ${live.approvedBy.on}`
                            : "Pending",
                        ],
                        ["Timeline", `${live.startDate} → ${live.endDate ?? "open"}`],
                        [
                          "Billing",
                          live.payment
                            ? `${live.payment.billingType} · PO ${live.payment.poNumber} · ${fmtMoney(live.payment.budget, live.payment.currency)} · ${live.payment.paymentTerms} · ${live.payment.invoicingCycle}`
                            : "—",
                        ],
                        [
                          "Shifts",
                          (live.shifts ?? [])
                            .map(
                              (s) =>
                                `${SHIFTS.find((x) => x.id === s.shiftId)?.name ?? s.shiftId} × ${s.headcount} (${s.days})`,
                            )
                            .join("; "),
                        ],
                        ["Details", live.details ?? "—"],
                      ],
                    })
                  }
                >
                  <Download className="h-4 w-4" /> Work order PDF
                </Button>
                <Button onClick={() => setView(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewWorkOrderDialog({ orgId, onDone }) {
  const me = useCurrentUser();
  const SHIFTS = useShifts();
  const dir = useDirectory();
  const people = dir.filter((e) => e.orgId === orgId);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState(WO_PURPOSES[0]);
  const [clientSite, setClientSite] = useState("");
  const [office, setOffice] = useState("");
  const [details, setDetails] = useState("");
  const [demandedByName, setDemandedByName] = useState("");
  const [demandedByRole, setDemandedByRole] = useState("Project Manager");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvedByRole, setApprovedByRole] = useState("CEO");
  const [approvedOn, setApprovedOn] = useState("");
  const [locations, setLocations] = useState([""]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [headcount, setHeadcount] = useState("4");
  const [priority, setPriority] = useState("Normal");
  const [clientContact, setClientContact] = useState("");
  const [billingType, setBillingType] = useState("Time & material");
  const [poNumber, setPoNumber] = useState("");
  const [rateBasis, setRateBasis] = useState("Per engineer-day");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [invoicingCycle, setInvoicingCycle] = useState("Monthly");
  const [costCentre, setCostCentre] = useState("");
  const [shifts, setShifts] = useState([
    { shiftId: SHIFTS[0]?.id ?? "SHF-01", headcount: 4, days: "Mon–Sat" },
  ]);
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState("");
  const dateError =
    endDate && startDate && endDate < startDate ? "End date cannot be before the start date." : "";
  const numError =
    Number(budget) < 0 || Number(headcount) < 0 || shifts.some((x) => x.headcount < 0)
      ? "Budget and headcounts cannot be negative."
      : "";
  const valid =
    name.trim() &&
    clientSite.trim() &&
    office &&
    startDate &&
    shifts.length > 0 &&
    demandedByName &&
    !dateError &&
    !numError;
  const submit = () => {
    addWorkOrder({
      orgId,
      name: name.trim(),
      clientSite: clientSite.trim(),
      office,
      shiftId: shifts[0].shiftId,
      startDate,
      endDate: endDate || null,
      status: approvedByName ? "Active" : "On Hold",
      notes: notes.trim() || undefined,
      purpose,
      demandedBy: { name: demandedByName, role: demandedByRole },
      approvedBy: approvedByName
        ? { name: approvedByName, role: approvedByRole, on: approvedOn || todayIso() }
        : undefined,
      details,
      locations: [clientSite.trim(), ...locations.map((l) => l.trim()).filter(Boolean)],
      headcount: Number(headcount) || 0,
      priority,
      clientContact,
      payment: {
        billingType,
        poNumber,
        rateBasis,
        budget: Number(budget) || 0,
        currency,
        paymentTerms,
        invoicingCycle,
        costCentre,
      },
      shifts,
      attachments,
      createdBy: me.name,
      createdOn: todayIso(),
    });
    toast.success(
      approvedByName
        ? "Work order created (Active)"
        : "Work order created — on hold until approved",
    );
    onDone();
  };
  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Create work order</DialogTitle>
        <DialogDescription>
          Purpose, who demanded and approved it, scope, locations, payment terms and the shift plan.
          Employees and wage workers deployed to it follow its shifts.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <SectionTitle n={1} title="Work order & purpose" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Work order name" required className="sm:col-span-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Seereon Cloud Services — Night Crew"
            />
          </Field>
          <Field label="Purpose" required>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WO_PURPOSES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Details / scope of work" className="sm:col-span-3">
            <Textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Deliverables, SLAs, deployment plan…"
            />
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={(v) => setPriority(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Low", "Normal", "High", "Critical"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Headcount required">
            <Input type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </Field>
          <Field label="Client contact">
            <Input
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
              placeholder="Name · phone / e-mail"
            />
          </Field>
        </div>
        <SectionTitle
          n={2}
          title="Demand & approval"
          sub="Who asked for this work order and who approved it"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Demanded by" required>
            <Select value={demandedByName} onValueChange={setDemandedByName}>
              <SelectTrigger>
                <SelectValue placeholder="Person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((e) => (
                  <SelectItem key={e.id} value={e.name}>
                    {e.name} · {e.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Role">
            <Select value={demandedByRole} onValueChange={setDemandedByRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Project Manager",
                  "Delivery Head",
                  "Account Manager",
                  "Department Head",
                  "Client",
                  "Management",
                ].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Approved by" hint="Leave blank → work order stays on hold">
            <Select value={approvedByName} onValueChange={setApprovedByName}>
              <SelectTrigger>
                <SelectValue placeholder="Approver" />
              </SelectTrigger>
              <SelectContent>
                {people
                  .filter((e) => /Chief|Head|Director|Manager|CEO|COO|CFO/i.test(e.role))
                  .map((e) => (
                    <SelectItem key={e.id} value={e.name}>
                      {e.name} · {e.role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Role">
              <Select value={approvedByRole} onValueChange={setApprovedByRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["CEO", "COO", "CFO", "Delivery Head", "Department Head"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="On">
              <Input
                type="date"
                value={approvedOn}
                onChange={(e) => setApprovedOn(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <SectionTitle n={3} title="Locations & timeline" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Primary client site" required className="sm:col-span-2">
            <Input
              value={clientSite}
              onChange={(e) => setClientSite(e.target.value)}
              placeholder="Site name and city"
            />
          </Field>
          <Field label="Home office" required>
            <Select value={office} onValueChange={setOffice}>
              <SelectTrigger>
                <SelectValue placeholder="Office" />
              </SelectTrigger>
              <SelectContent>
                {OFFICES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start" required>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label className="text-muted-foreground text-xs">Additional locations</Label>
            {locations.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={l}
                  onChange={(e) =>
                    setLocations(locations.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder="Warehouse / secondary site / remote"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setLocations(locations.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLocations([...locations, ""])}
            >
              <MapPin className="h-4 w-4" /> Add location
            </Button>
          </div>
        </div>
        <SectionTitle n={4} title="Payment" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Billing type">
            <Select value={billingType} onValueChange={(v) => setBillingType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Fixed price", "Time & material", "Per day / per shift", "Milestone"].map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rate basis">
            <Input
              value={rateBasis}
              onChange={(e) => setRateBasis(e.target.value)}
              placeholder="Per engineer-day / per shift / lump sum"
            />
          </Field>
          <Field label="PO number">
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
          </Field>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <Field label="Budget">
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </Field>
            <Field label="Currency">
              <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["INR", "USD", "EUR", "SAR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Payment terms">
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Advance", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Invoicing cycle">
            <Select value={invoicingCycle} onValueChange={(v) => setInvoicingCycle(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Weekly", "Fortnightly", "Monthly", "On milestone"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cost centre">
            <Input
              value={costCentre}
              onChange={(e) => setCostCentre(e.target.value)}
              placeholder="CC-…"
            />
          </Field>
        </div>
        <SectionTitle
          n={5}
          title="Shift plan"
          sub="One or more shifts with headcount and working days"
        />
        <div className="space-y-2">
          {shifts.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_120px_160px_40px]"
            >
              <Field label="Shift">
                <Select
                  value={s.shiftId}
                  onValueChange={(v) =>
                    setShifts(shifts.map((x, j) => (j === i ? { ...x, shiftId: v } : x)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((sh) => (
                      <SelectItem key={sh.id} value={sh.id}>
                        {sh.name} ({sh.start}–{sh.end})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Headcount">
                <Input
                  type="number"
                  value={s.headcount}
                  onChange={(e) =>
                    setShifts(
                      shifts.map((x, j) =>
                        j === i ? { ...x, headcount: Number(e.target.value) || 0 } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Days">
                <Input
                  value={s.days}
                  onChange={(e) =>
                    setShifts(shifts.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))
                  }
                  placeholder="Mon–Sat"
                />
              </Field>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={shifts.length === 1}
                onClick={() => setShifts(shifts.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setShifts([
                ...shifts,
                { shiftId: SHIFTS[1]?.id ?? "SHF-02", headcount: 2, days: "All days" },
              ])
            }
          >
            <Clock className="h-4 w-4" /> Add shift
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AttachmentsInput
            value={attachments}
            onChange={setAttachments}
            label="Attachments (PO, SOW, client e-mail)"
          />
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
      {(dateError || numError) && (
        <div className="text-destructive text-xs">{dateError || numError}</div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={submit}
        >
          <ShieldCheck className="h-4 w-4" /> Create work order
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AssignEmployeeDialog({ workOrderId, employees }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" /> Assign employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign employee to work order</DialogTitle>
          <DialogDescription>
            Their attendance timing will follow this work order's shift.
          </DialogDescription>
        </DialogHeader>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            disabled={!employeeId}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              assignWorkOrder(employeeId, workOrderId);
              toast.success("Employee assigned");
              setEmployeeId("");
              setOpen(false);
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
