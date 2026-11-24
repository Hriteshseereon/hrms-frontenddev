// Self-service Tours: my tour requests, HR → Finance approvals and assignment dispatch
// approval trail, and outcome/proof-of-visit submission once completed.
import { useState } from "react";
import { Plane, Plus, Upload, FileCheck2, Download, Receipt, CircleDollarSign, CheckCircle2, Paperclip, Trash2 } from "lucide-react";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { departmentByName } from "@/features/organization/data/dept-data";
import { exportReportPdf } from "@/lib/export-utils";
import { inr } from "@/lib/store";
import { captureFiles } from "@/lib/attachments";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { TourOutcomesCard } from "@/features/travel/components/TourOutcomes";
import { TourExpensePanel } from "@/features/travel/components/TourAdminPieces";
import {
  useMyTours,
  submitTour,
  submitTourOutcome,
  withdrawTour,
  validateTourInput,
  TOUR_MODES,
  tourExpenseTotals,
} from "@/features/travel/data/tour-data";

const paymentMethodLabel = (value) => ({
  company_direct: "Company pays directly",
  advance: "Company advance",
  employee_reimbursement: "You pay & claim",
}[value] ?? "You pay & claim");

const tone = {
  "Pending Approval": "bg-gold/15 text-gold border-gold/30",
  "Pending HR Dispatch": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-primary/10 text-primary border-primary/20",
  Closed: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const blankTourBill = () => ({
  head: "Travel",
  date: "",
  vendor: "",
  amount: "",
  receipt: "",
  note: "",
});

/** Compact card for the employee profile / dashboard. */
export function MyToursCard({ employeeId }) {
  const tours = useMyTours(employeeId);
  const active = tours.filter((t) => ["Pending Approval", "Pending HR Dispatch", "Approved"].includes(t.status));
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Plane className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">My Tours</span>
          <Badge variant="outline" className="ml-auto">
            {active.length} active
          </Badge>
        </div>
        {tours.length === 0 ? (
          <div className="text-muted-foreground text-sm">No tours raised yet.</div>
        ) : (
          <div className="space-y-2">
            {tours.slice(0, 3).map((t) => (
              <div
                key={t.id}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{t.destination}</div>
                  <div className="text-muted-foreground text-xs">
                    <span className="whitespace-nowrap">{t.startDate}</span> →{" "}
                    <span className="whitespace-nowrap">{t.endDate}</span>
                  </div>
                </div>
                <Badge variant="outline" className={tone[t.status] ?? ""}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MyToursScreen() {
  const me = useCurrentUser();
  const tours = useMyTours(me.id);
  const pendingBills = tours.reduce((count, tour) => count + (tour.expenses ?? []).filter((expense) => !expense.approved && !expense.rejected).length, 0);
  const reimbursementDue = tours.reduce((sum, tour) => sum + tourExpenseTotals(tour).encashable, 0);
  const settledTours = tours.filter((tour) => tour.settlement || tour.encashment).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Tours</h1>
          <p className="text-muted-foreground text-sm">
            Business tour requests and their approval status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportReportPdf({
                title: "My Tours",
                subtitle: `${me.name} · ${me.designation}`,
                columns: ["Tour", "Destination", "Dates", "Est. Cost", "Status"],
                rows: tours.map((t) => [
                  t.id,
                  t.destination,
                  `${t.startDate} to ${t.endDate}`,
                  inr(t.estimatedCost),
                  t.status,
                ]),
              })
            }
          >
            <Download className="h-4 w-4" /> Download
          </Button>
          <RequestTourDialog />
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="text-sm font-semibold">Your travel and claims</div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Assigned tours", tours.length, Plane],
              ["Bills in review", pendingBills, Receipt],
              ["Reimbursement due", inr(reimbursementDue), CircleDollarSign],
              ["Settled tours", settledTours, CheckCircle2],
            ].map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-lg font-bold">{value}</div></div>)}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {tours.length === 0 && <Card className="shadow-card"><CardContent className="text-muted-foreground p-8 text-center text-sm">No tour requests yet.</CardContent></Card>}
        {tours.map((t) => (
          <Card key={t.id} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.destination}</span>
                    <Badge variant="outline" className={tone[t.status] ?? ""}>
                      {t.status}
                    </Badge>
                    <Badge variant="outline">{paymentMethodLabel(t.paymentMethod)}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {t.id} · <span className="whitespace-nowrap">{t.startDate}</span> →{" "}
                    <span className="whitespace-nowrap">{t.endDate}</span> · {t.mode} ·{" "}
                    {inr(t.estimatedCost)}
                  </div>
                  <div className="mt-2 text-sm">{t.purpose}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {t.employeeId !== me.id && (
                    <Badge variant="outline" className="text-[11px]">
                      Co-traveller · requested by {t.employeeName}
                    </Badge>
                  )}
                  {t.employeeId === me.id &&
                    t.status === "Pending Approval" &&
                    !t.chain.some((s) => s.status === "Approved" || s.status === "Rejected") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          withdrawTour(t.id);
                          toast.success("Tour request withdrawn");
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                  {t.employeeId === me.id && t.status === "Approved" && (
                    <OutcomeDialog tourId={t.id} startDate={t.startDate} />
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {t.chain.map((s, i) => (
                  <Badge key={i} variant="outline" className={tone[s.status] ?? ""}>
                    {s.label} · {s.status}
                  </Badge>
                ))}
              </div>

              {(t.expenses ?? []).length > 0 && (
                <div className="mt-3 rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold">Attached bills ({t.expenses.length})</span>
                    <span className="text-muted-foreground">Total {inr(t.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0))}</span>
                  </div>
                  <div className="space-y-2">
                    {t.expenses.map((expense) => (
                      <div key={expense.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>{expense.head} · {expense.vendor} · {expense.date} · {inr(expense.amount)}</span>
                        {expense.receipt && <AttachmentChips names={[expense.receipt]} context={`Tour ${t.id} receipt`} size="sm" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(t.status === "Approved" || t.status === "Completed" || t.status === "Closed") &&
                (t.employeeId === me.id || t.travellers?.some((traveller) => traveller.id === me.id)) && (
                  <>
                    <TourOutcomesCard
                      tour={t}
                      canEdit={t.status !== "Closed"}
                      canApprove={false}
                      hideExpenseTable
                    />
                    <TourExpensePanel tour={t} canApprove={false} />
                  </>
                )}
              {t.outcome && (
                <div className="bg-muted/50 mt-3 rounded-lg p-3 text-sm">
                  <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold">
                    <FileCheck2 className="h-3.5 w-3.5" /> Outcome of visit — submitted{" "}
                    <span className="whitespace-nowrap">{t.outcomeSubmittedOn}</span>
                  </div>
                  {t.outcome}
                  {t.proofDocuments && t.proofDocuments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.proofDocuments.map((d, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-[11px]">
                          {d.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RequestTourDialog() {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mode, setMode] = useState("Road");
  const [bills, setBills] = useState([blankTourBill()]);
  const setBill = (index, patch) =>
    setBills((current) => current.map((bill, i) => (i === index ? { ...bill, ...patch } : bill)));
  const billRows = bills.filter((bill) =>
    [bill.date, bill.vendor, bill.amount, bill.receipt, bill.note].some((value) => String(value ?? "").trim()),
  );
  const invalidBill = billRows.some((bill) => !bill.date || !bill.vendor.trim() || !(Number(bill.amount) > 0) || !bill.receipt);
  const billTotal = billRows.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const problem = validateTourInput({
    purpose,
    destination,
    startDate,
    endDate,
    mode,
    estimatedCost: billTotal,
    costCentre: departmentByName(me.dept, me.orgId)?.costCentre ?? "",
  });
  const valid = !problem && billRows.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
          <Plus className="h-4 w-4" /> Request Tour
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request a business tour</DialogTitle>
          <DialogDescription>Attach train, flight, hotel, or other travel bills now, or add them later from your tour.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Purpose of visit</Label>
            <Textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Why is this tour needed?"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Destination</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Site / city, state"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">End date</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Mode of travel</Label>
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
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div>
              <div className="text-sm font-semibold">Bills and receipts</div>
              <p className="text-muted-foreground text-xs">Add one row per ticket or bill and attach its receipt.</p>
            </div>
            {bills.map((bill, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Expense type</Label>
                  <Select value={bill.head} onValueChange={(value) => setBill(index, { head: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Travel", "Lodging", "Food", "Local conveyance", "Other"].map((head) => <SelectItem key={head} value={head}>{head}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Bill date</Label>
                  <Input type="date" value={bill.date} onChange={(e) => setBill(index, { date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Vendor / description</Label>
                  <Input value={bill.vendor} onChange={(e) => setBill(index, { vendor: e.target.value })} placeholder="e.g. IRCTC train ticket" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Amount (₹)</Label>
                  <Input type="number" min="0" value={bill.amount} onChange={(e) => setBill(index, { amount: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Receipt / ticket</Label>
                  <label className="border-input hover:bg-muted flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm">
                    <Paperclip className="h-4 w-4" />
                    <span className="truncate">{bill.receipt || "Attach bill (PDF or image)"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const [name] = await captureFiles([file]);
                        setBill(index, { receipt: name });
                      }
                      e.target.value = "";
                    }} />
                  </label>
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <span className="text-muted-foreground text-xs">{bill.receipt ? "Receipt attached" : "Receipt required when this row is filled"}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={bills.length === 1} onClick={() => setBills((current) => current.filter((_, i) => i !== index))}>
                    <Trash2 className="text-destructive h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setBills((current) => [...current, blankTourBill()])}>
                <Plus className="h-4 w-4" /> Add bill
              </Button>
              <div className="text-sm">Tour estimated cost <b>{inr(billTotal)}</b></div>
            </div>
            {billRows.length === 0 && <p className="text-muted-foreground text-xs">Add at least one bill to set the tour cost.</p>}
            {invalidBill && <p className="text-destructive text-xs">Complete each started bill row and attach its receipt.</p>}
          </div>
        </div>
        {problem && (purpose || destination || startDate || endDate || billRows.length > 0) && (
          <div className="text-destructive text-xs">{problem}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || invalidBill}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              try {
                submitTour({
                  employeeId: me.id,
                  purpose: purpose.trim(),
                  destination: destination.trim(),
                  startDate,
                  endDate,
                  mode,
                  estimatedCost: billTotal,
                  costCentre: departmentByName(me.dept, me.orgId)?.costCentre ?? "—",
                  expenses: billRows.map((bill) => ({
                    head: bill.head,
                    date: bill.date,
                    vendor: bill.vendor.trim(),
                    amount: Number(bill.amount),
                    receipt: bill.receipt,
                    paidBy: "Employee",
                    note: bill.note.trim(),
                  })),
                });
              } catch (err) {
                toast.error(err.message);
                return;
              }
              toast.success("Tour request submitted — tracking approvals now");
              setOpen(false);
              setPurpose("");
              setDestination("");
              setStartDate("");
              setEndDate("");
              setBills([blankTourBill()]);
            }}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeDialog({ tourId, startDate }) {
  const [open, setOpen] = useState(false);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const started = today >= startDate;
  const [outcome, setOutcome] = useState("");
  const [fileName, setFileName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-gradient-emerald text-white"
          disabled={!started}
          title={started ? undefined : `Available once the tour starts on ${startDate}`}
        >
          <Upload className="h-4 w-4" /> Submit Outcome
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Outcome of visit</DialogTitle>
          <DialogDescription>
            Summarise the visit and attach proof of document (receipts, visit report).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Outcome</Label>
            <Textarea
              rows={4}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What was achieved during this tour?"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Proof of document (file name — upload is presentation-only in this prototype)
            </Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. hotel-receipt.pdf"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!outcome.trim()}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              submitTourOutcome(
                tourId,
                outcome.trim(),
                fileName.trim() ? [{ name: fileName.trim(), url: "#" }] : [],
              );
              toast.success("Outcome submitted");
              setOpen(false);
              setOutcome("");
              setFileName("");
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
