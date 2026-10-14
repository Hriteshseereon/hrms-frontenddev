// Self-service Tours: my tour requests, their live HOD → HR → Finance
// approval trail, and outcome/proof-of-visit submission once completed.
import { useState } from "react";
import { Plane, Plus, Upload, FileCheck2, Download } from "lucide-react";
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
import { TourOutcomesCard } from "@/features/travel/components/TourOutcomes";
import { TourExpensePanel } from "@/features/travel/components/TourAdminPieces";
import {
  useMyTours,
  submitTour,
  submitTourOutcome,
  withdrawTour,
  validateTourInput,
  TOUR_MODES,
} from "@/features/travel/data/tour-data";

const tone = {
  "Pending Approval": "bg-gold/15 text-gold border-gold/30",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-primary/10 text-primary border-primary/20",
  Closed: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

/** Compact card for the employee profile / dashboard. */
export function MyToursCard({ employeeId }) {
  const tours = useMyTours(employeeId);
  const active = tours.filter((t) => t.status === "Pending Approval" || t.status === "Approved");
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

      <div className="space-y-3">
        {tours.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="text-muted-foreground p-8 text-center text-sm">
              No tours raised yet. Requests route to your HOD, then HR, then Finance.
            </CardContent>
          </Card>
        )}
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
                    {s.label}: {s.approverName} · {s.status}
                  </Badge>
                ))}
              </div>

              {(t.status === "Approved" || t.status === "Completed" || t.status === "Closed") &&
                t.employeeId === me.id && (
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
  const [estimatedCost, setEstimatedCost] = useState("");
  const [costCentre, setCostCentre] = useState(
    departmentByName(me.dept, me.orgId)?.costCentre ?? "",
  );

  const problem = validateTourInput({
    purpose,
    destination,
    startDate,
    endDate,
    mode,
    estimatedCost: Number(estimatedCost),
    costCentre,
  });
  const valid = !problem;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
          <Plus className="h-4 w-4" /> Request Tour
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a business tour</DialogTitle>
          <DialogDescription>
            Routed to your HOD, then HR, then Finance for approval.
          </DialogDescription>
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
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Estimated cost (₹)</Label>
              <Input
                type="number"
                min={1}
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Project / cost centre</Label>
            <Input
              value={costCentre}
              onChange={(e) => setCostCentre(e.target.value)}
              placeholder="CC-1001"
            />
          </div>
        </div>
        {problem && (purpose || destination || startDate || endDate || estimatedCost) && (
          <div className="text-destructive text-xs">{problem}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
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
                  estimatedCost: Number(estimatedCost),
                  costCentre: costCentre.trim() || "—",
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
              setEstimatedCost("");
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
