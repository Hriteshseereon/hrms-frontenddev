// HR / Admin / Super Admin tour pieces — create & assign a tour, maintain expenses and bills per tour, audit export.
import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import {
  Plus,
  Receipt,
  Paperclip,
  Download,
  Trash2,
  Link2,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { inr } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  useScopedEmployees,
  Field,
  SectionTitle,
} from "@/features/employees/components/CasePieces";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import {
  TOUR_MODES,
  addBillAsExpense,
  addTourBill,
  addTourExpense,
  approveTourExpense,
  createAndAssignTour,
  removeTourBill,
  setTourAdvance,
  tourExpenseTotals,
} from "@/features/travel/data/tour-data";

const HEADS = ["Travel", "Lodging", "Food", "Local conveyance", "Client entertainment", "Other"];
const COST_CENTRES = ["CC-SAP-DEL", "CC-CLOUD", "CC-PRODUCTS", "CC-SALES", "CC-HR", "CC-EXEC"];

export function CreateTourDialog({ open, onClose }) {
  const me = useCurrentUser();
  const employees = useScopedEmployees();
  const [employeeId, setEmployeeId] = useState("");
  const [travellers, setTravellers] = useState([]);
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mode, setMode] = useState("Air");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [costCentre, setCostCentre] = useState(COST_CENTRES[0]);
  const [advancePaid, setAdvancePaid] = useState("0");
  const [client, setClient] = useState("");
  const [project, setProject] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [accommodation, setAccommodation] = useState("");
  const [bookingRefs, setBookingRefs] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const submit = () => {
    const r = createAndAssignTour(
      {
        employeeId,
        travellers,
        purpose,
        destination,
        startDate,
        endDate,
        mode,
        estimatedCost: Number(estimatedCost) || 0,
        costCentre,
        advancePaid: Number(advancePaid) || 0,
        client,
        project,
        itinerary,
        accommodation,
        bookingRefs,
        note,
      },
      me,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onClose();
  };
  const list = employees.filter(
    (e) => !q || [e.name, e.dept, e.role].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create &amp; assign a tour</DialogTitle>
          <DialogDescription>
            HR / Admin creates the tour on behalf of the business — it is approved on creation, the
            employee is notified and can log expenses and bills from My Tours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SectionTitle n={1} title="Traveller(s)" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Primary traveller" required>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Co-travellers (${travellers.length})`}>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="mb-1"
              />
              <div className="border-border grid max-h-28 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {list
                  .filter((e) => e.id !== employeeId)
                  .map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={travellers.includes(e.id)}
                        onCheckedChange={(v) =>
                          setTravellers(
                            v ? [...travellers, e.id] : travellers.filter((x) => x !== e.id),
                          )
                        }
                      />
                      {e.name}
                    </label>
                  ))}
              </div>
            </Field>
          </div>
          <SectionTitle n={2} title="Tour details" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Destination" required className="sm:col-span-2">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City / client site"
              />
            </Field>
            <Field label="From" required>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </Field>
            <Field label="To" required>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            <Field label="Purpose" required className="sm:col-span-4">
              <Textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Client visit, go-live support, audit, conference…"
              />
            </Field>
            <Field label="Client">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Semtech / RCU / ZooPlus…"
              />
            </Field>
            <Field label="Project">
              <Input value={project} onChange={(e) => setProject(e.target.value)} />
            </Field>
            <Field label="Mode of travel">
              <Select value={mode} onValueChange={(v) => setMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOUR_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cost centre">
              <Select value={costCentre} onValueChange={setCostCentre}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_CENTRES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Itinerary" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={itinerary}
                onChange={(e) => setItinerary(e.target.value)}
                placeholder="Day-wise plan, meetings, sites"
              />
            </Field>
            <Field label="Accommodation">
              <Input
                value={accommodation}
                onChange={(e) => setAccommodation(e.target.value)}
                placeholder="Hotel / guest house"
              />
            </Field>
            <Field label="Booking references">
              <Input
                value={bookingRefs}
                onChange={(e) => setBookingRefs(e.target.value)}
                placeholder="PNR / hotel booking IDs"
              />
            </Field>
          </div>
          <SectionTitle n={3} title="Budget & advance" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Estimated cost (₹)">
              <Input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </Field>
            <Field
              label="Advance paid (₹)"
              hint="Approved expenses less the advance become the petty-cash encashment"
            >
              <Input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
              />
            </Field>
            <Field label="Note to traveller">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={submit}>
            <Plus className="h-4 w-4" /> Create &amp; assign tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Per-tour expenses & bills ledger for HR / Finance — maintain expenses, attach bills, approve, set advance. */
export function TourExpensePanel({ tour, canApprove }) {
  const me = useCurrentUser();
  const t = tourExpenseTotals(tour);
  const [expOpen, setExpOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [advance, setAdvance] = useState(String(tour.advancePaid ?? 0));
  const [e, setE] = useState({
    head: "Travel",
    amount: 0,
    date: tour.endDate,
    receipt: "",
    vendor: "",
    invoiceNo: "",
    paidBy: "Employee",
    note: "",
  });
  const [b, setB] = useState({
    name: "",
    vendor: "",
    invoiceNo: "",
    category: "Travel",
    amount: 0,
    gst: 0,
    date: tour.endDate,
    paidBy: "Employee",
    file: "",
    note: "",
  });
  const bills = tour.bills ?? [];
  const expenses = tour.expenses ?? [];
  const billTotal = bills.reduce((s, x) => s + x.amount, 0);
  const auditPdf = () =>
    exportReportPdf({
      title: `Tour expense & bill audit — ${tour.id}`,
      subtitle: `${tour.employeeName} · ${tour.destination} · ${tour.startDate} → ${tour.endDate} · cost centre ${tour.costCentre}`,
      summary: [
        { label: "Estimated", value: inr(tour.estimatedCost) },
        { label: "Expenses booked", value: inr(t.all) },
        { label: "Approved", value: inr(t.approved) },
        { label: "Advance", value: inr(t.advance) },
        { label: "Encashable", value: inr(t.encashable) },
        { label: "Bills attached", value: `${bills.length} · ${inr(billTotal)}` },
      ],
      columns: [
        "Kind",
        "Ref",
        "Date",
        "Head",
        "Vendor",
        "Invoice",
        "Paid by",
        "Amount",
        "GST",
        "File",
        "Status",
      ],
      rows: [
        ...expenses.map((x) => [
          "Expense",
          x.id,
          x.date,
          x.head,
          x.vendor ?? "—",
          x.invoiceNo ?? "—",
          x.paidBy ?? "Employee",
          inr(x.amount),
          "—",
          x.receipt || "—",
          x.approved ? "Approved" : "Pending",
        ]),
        ...bills.map((x) => [
          "Bill",
          x.id,
          x.date,
          x.category,
          x.vendor,
          x.invoiceNo,
          x.paidBy,
          inr(x.amount),
          inr(x.gst),
          x.file,
          x.linkedExpenseId ? `Linked ${x.linkedExpenseId}` : "Attached",
        ]),
      ],
    });
  return (
    <div className="border-border mt-3 space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Receipt className="text-primary h-3.5 w-3.5" /> Expenses &amp; bills
        </div>
        <div className="text-muted-foreground text-xs">
          booked {inr(t.all)} · approved {inr(t.approved)} · advance {inr(t.advance)} · encashable{" "}
          <b className="text-foreground">{inr(t.encashable)}</b>
          {t.refundable ? ` · refundable ${inr(t.refundable)}` : ""} · {bills.length} bill(s){" "}
          {inr(billTotal)}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={tour.status === "Closed" || !!tour.encashment}
            title={
              tour.encashment
                ? "Already encashed — raise a separate claim"
                : tour.status === "Closed"
                  ? "Tour is closed"
                  : undefined
            }
            onClick={() => setExpOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Expense
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setBillOpen(true)}>
            <Paperclip className="h-3.5 w-3.5" /> Add bill
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={auditPdf}>
            <Download className="h-3.5 w-3.5" /> Audit PDF
          </Button>
        </div>
      </div>
      {canApprove && (
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-muted-foreground">Advance paid (₹)</Label>
          <Input
            type="number"
            min={0}
            className="h-7 w-full sm:w-32"
            value={advance}
            onChange={(ev) => setAdvance(ev.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={!!tour.encashment}
            onClick={() => {
              const v = Number(advance);
              if (!(v >= 0)) {
                toast.error("Advance cannot be negative.");
                return;
              }
              setTourAdvance(tour.id, v);
              toast.success("Advance updated");
            }}
          >
            <Banknote className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      )}
      {expenses.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground tracking-wider uppercase">
            <tr>
              <th className="p-1 text-left">Head</th>
              <th className="p-1 text-left">Date</th>
              <th className="p-1 text-left">Vendor · invoice</th>
              <th className="p-1 text-left">Paid by</th>
              <th className="p-1 text-left">Receipt</th>
              <th className="p-1 text-right">Amount</th>
              <th className="p-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {expenses.map((x) => (
              <tr key={x.id} className={clickableRow} onClick={() => setDetail(x)}>
                <td className="p-1">
                  {x.head}
                  {x.note ? <div className="text-muted-foreground">{x.note}</div> : null}
                </td>
                <td className="p-1">
                  <span className="whitespace-nowrap">{x.date}</span>
                </td>
                <td className="p-1">
                  {x.vendor || "—"}
                  {x.invoiceNo ? ` · ${x.invoiceNo}` : ""}
                </td>
                <td className="p-1">{x.paidBy ?? "Employee"}</td>
                <td className="p-1 font-mono">{x.receipt || "—"}</td>
                <td className="p-1 text-right">{inr(x.amount)}</td>
                <td className="p-1 text-right" onClick={(ev) => ev.stopPropagation()}>
                  {x.approved ? (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      Approved
                    </Badge>
                  ) : canApprove && !tour.encashment && tour.status !== "Closed" ? (
                    <span className="inline-flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary h-6 px-1"
                        onClick={() => approveTourExpense(tour.id, x.id, true)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-6 px-1"
                        onClick={() => approveTourExpense(tour.id, x.id, false)}
                      >
                        Hold
                      </Button>
                    </span>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {bills.length > 0 && (
        <div className="space-y-1">
          <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
            Bills (audit)
          </div>
          {bills.map((x) => (
            <div
              key={x.id}
              className="border-border flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs"
            >
              <Paperclip className="text-muted-foreground h-3 w-3" />
              <span className="font-mono">{x.file}</span>
              <span>
                {x.vendor} · {x.invoiceNo} · {x.category} ·{" "}
                <span className="whitespace-nowrap">{x.date}</span>
              </span>
              <span className="font-semibold">{inr(x.amount)}</span>
              {x.gst ? <span className="text-muted-foreground">GST {inr(x.gst)}</span> : null}
              <Badge variant="outline" className="text-[10px]">
                {x.paidBy}
              </Badge>
              <span className="text-muted-foreground">by {x.uploadedBy}</span>
              <span className="ml-auto inline-flex gap-1">
                {x.linkedExpenseId ? (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", "border-primary/30 text-primary")}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    {x.linkedExpenseId}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary h-6 px-1"
                    onClick={() => {
                      addBillAsExpense(tour.id, x.id, me.name);
                      toast.success("Bill added as an expense line for reimbursement");
                    }}
                  >
                    <Link2 className="h-3 w-3" /> Claim
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-6 px-1"
                    onClick={() => removeTourBill(tour.id, x.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {expenses.length === 0 && bills.length === 0 && (
        <p className="text-muted-foreground text-xs">No expenses or bills yet.</p>
      )}

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.head}`}
          subtitle={`${tour.id} · ${tour.employeeName} · ${tour.destination}`}
          badges={
            <Badge
              variant="outline"
              className={detail.approved ? "border-primary/30 bg-primary/10 text-primary" : ""}
            >
              {detail.approved ? "Approved" : "Pending"}
            </Badge>
          }
          record={{
            ...detail,
            paidBy: detail.paidBy ?? "Employee",
            tour: tour.id,
            employee: tour.employeeName,
            destination: tour.destination,
            costCentre: tour.costCentre,
          }}
          labels={{
            invoiceNo: "Invoice / ticket no.",
            paidBy: "Paid by",
            receipt: "Receipt file",
            addedBy: "Added by",
            costCentre: "Cost centre",
          }}
          sections={[
            {
              title: "Expense",
              keys: ["id", "head", "date", "amount", "paidBy", "approved", "note"],
            },
            { title: "Vendor & receipt", keys: ["vendor", "invoiceNo", "receipt", "addedBy"] },
            { title: "Tour", keys: ["tour", "employee", "destination", "costCentre"] },
          ]}
        />
      )}

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add tour expense — {tour.id}</DialogTitle>
            <DialogDescription>
              Approved expenses less the advance become the petty-cash encashment for{" "}
              {tour.employeeName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Head">
              <Select value={e.head} onValueChange={(v) => setE({ ...e, head: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={e.date}
                onChange={(ev) => setE({ ...e, date: ev.target.value })}
              />
            </Field>
            <Field label="Amount (₹)" required>
              <Input
                type="number"
                min={0}
                value={e.amount || ""}
                onChange={(ev) => setE({ ...e, amount: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </Field>
            <Field label="Paid by">
              <Select value={e.paidBy} onValueChange={(v) => setE({ ...e, paidBy: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Employee", "Company card", "Advance"].map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vendor">
              <Input value={e.vendor} onChange={(ev) => setE({ ...e, vendor: ev.target.value })} />
            </Field>
            <Field label="Invoice / ticket no.">
              <Input
                value={e.invoiceNo}
                onChange={(ev) => setE({ ...e, invoiceNo: ev.target.value })}
              />
            </Field>
            <Field label="Receipt file" className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5" /> Choose file
                  <input
                    type="file"
                    className="hidden"
                    onChange={(ev) => {
                      captureFiles(ev.target.files);
                      setE({ ...e, receipt: ev.target.files?.[0]?.name ?? "" });
                    }}
                  />
                </label>
                {e.receipt && <Badge variant="outline">{e.receipt}</Badge>}
              </div>
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Input value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!(e.amount > 0) || !e.date}
              onClick={() => {
                addTourExpense(tour.id, { ...e, addedBy: me.name });
                toast.success("Expense added");
                setExpOpen(false);
                setE({ ...e, amount: 0, receipt: "", invoiceNo: "", note: "" });
              }}
            >
              Add expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach bill — {tour.id}</DialogTitle>
            <DialogDescription>
              Bills are kept on the tour for reimbursement (claim it as an expense) and the
              financial audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bill file" required className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5" /> Upload bill
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.png"
                    onChange={(ev) => {
                      captureFiles(ev.target.files);
                      const f = ev.target.files?.[0]?.name ?? "";
                      setB({ ...b, file: f, name: b.name || f });
                    }}
                  />
                </label>
                {b.file && <Badge variant="outline">{b.file}</Badge>}
              </div>
            </Field>
            <Field label="Vendor" required>
              <Input
                value={b.vendor}
                onChange={(ev) => setB({ ...b, vendor: ev.target.value })}
                placeholder="IndiGo / Taj / Uber…"
              />
            </Field>
            <Field label="Invoice no.">
              <Input
                value={b.invoiceNo}
                onChange={(ev) => setB({ ...b, invoiceNo: ev.target.value })}
              />
            </Field>
            <Field label="Category">
              <Select value={b.category} onValueChange={(v) => setB({ ...b, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={b.date}
                onChange={(ev) => setB({ ...b, date: ev.target.value })}
              />
            </Field>
            <Field label="Amount (₹)" required>
              <Input
                type="number"
                value={b.amount || ""}
                onChange={(ev) => setB({ ...b, amount: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </Field>
            <Field label="GST (₹)">
              <Input
                type="number"
                value={b.gst || ""}
                onChange={(ev) => setB({ ...b, gst: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </Field>
            <Field label="Paid by">
              <Select value={b.paidBy} onValueChange={(v) => setB({ ...b, paidBy: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Employee", "Company card", "Advance", "Vendor invoice"].map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note">
              <Input value={b.note} onChange={(ev) => setB({ ...b, note: ev.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!b.file || !(b.amount > 0) || !b.vendor.trim() || b.gst > b.amount}
              onClick={() => {
                addTourBill(tour.id, { ...b, uploadedBy: me.name });
                toast.success("Bill attached to the tour");
                setBillOpen(false);
                setB({ ...b, file: "", name: "", invoiceNo: "", amount: 0, gst: 0, note: "" });
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Attach bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Organisation-wide audit export of every tour's expenses and bills. */
export function TourAuditButtons({ tours }) {
  const rows = tours.flatMap((t) => [
    ...(t.expenses ?? []).map((x) => [
      t.id,
      t.employeeName,
      t.destination,
      `${t.startDate} → ${t.endDate}`,
      t.costCentre,
      "Expense",
      x.id,
      x.date,
      x.head,
      x.vendor ?? "",
      x.invoiceNo ?? "",
      x.paidBy ?? "Employee",
      x.amount,
      0,
      x.receipt || "",
      x.approved ? "Approved" : "Pending",
    ]),
    ...(t.bills ?? []).map((x) => [
      t.id,
      t.employeeName,
      t.destination,
      `${t.startDate} → ${t.endDate}`,
      t.costCentre,
      "Bill",
      x.id,
      x.date,
      x.category,
      x.vendor,
      x.invoiceNo,
      x.paidBy,
      x.amount,
      x.gst,
      x.file,
      x.linkedExpenseId ? `Claimed ${x.linkedExpenseId}` : "Attached",
    ]),
  ]);
  const cols = [
    "Tour",
    "Employee",
    "Destination",
    "Dates",
    "Cost centre",
    "Kind",
    "Ref",
    "Date",
    "Head",
    "Vendor",
    "Invoice",
    "Paid by",
    "Amount",
    "GST",
    "File",
    "Status",
  ];
  const total = tours.reduce((s, t) => s + tourExpenseTotals(t).approved, 0);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!rows.length}
        onClick={() => {
          exportCsv("tour-expense-audit", cols, rows);
          toast.success("Audit CSV exported");
        }}
      >
        <Download className="h-4 w-4" /> Audit CSV
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!rows.length}
        onClick={() => {
          const ok = exportReportPdf({
            title: "Tour expenses & bills — audit register",
            subtitle: `${tours.length} tours · ${rows.length} lines · approved expenses ${inr(total)}`,
            summary: [
              { label: "Tours", value: String(tours.length) },
              { label: "Approved expenses", value: inr(total) },
              {
                label: "Bills on file",
                value: String(tours.reduce((s, t) => s + (t.bills?.length ?? 0), 0)),
              },
              {
                label: "Advances",
                value: inr(tours.reduce((s, t) => s + (t.advancePaid ?? 0), 0)),
              },
            ],
            columns: cols.map((c) => c),
            rows: rows.map((r) => r.map((v, i) => (i === 12 || i === 13 ? inr(Number(v)) : v))),
          });
          toast[ok ? "success" : "error"](
            ok ? "Audit register ready — save as PDF" : "Allow pop-ups to download",
          );
        }}
      >
        <Download className="h-4 w-4" /> Audit register PDF
      </Button>
    </div>
  );
}
