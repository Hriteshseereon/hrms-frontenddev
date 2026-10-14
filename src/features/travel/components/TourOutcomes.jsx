// Item 32 — Tour Outcomes (revenue generated / saved vs target & cost) and item 24 — petty-cash encashment from tour expenses.
import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { TrendingUp, Receipt, Plus, Banknote, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { addReimbursement, reimbursementStore } from "@/features/finance/data/claims-data";
import {
  addTourExpense,
  approveTourExpense,
  markEncashed,
  submitTourOutcomes,
  tourExpenseTotals,
  tourRoi,
  useTours,
} from "@/features/travel/data/tour-data";
import { BarsChart, ChartCard } from "@/features/dashboard/components/Charts";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const HEADS = ["Travel", "Lodging", "Food", "Local conveyance", "Client entertainment", "Other"];

export function TourOutcomesCard({ tour, canEdit, canApprove, hideExpenseTable }) {
  const [open, setOpen] = useState(false);
  const [o, setO] = useState(
    tour.outcomes ?? {
      revenueGenerated: 0,
      revenueSaved: 0,
      targetRevenue: 0,
      targetSavings: 0,
      dealsClosed: 0,
      leads: 0,
      notes: "",
    },
  );
  const [exp, setExp] = useState(false);
  const [e, setE] = useState({ head: "Travel", amount: 0, date: tour.endDate, receipt: "" });
  const t = tourExpenseTotals(tour);
  const roi = tourRoi(tour);
  const cmp = (label, actual, target) => {
    const d = actual - target;
    return (
      <div className="border-border rounded-lg border p-2">
        <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
          <div>
            <div className="text-muted-foreground">Target</div>
            <div className="font-medium">{inr(target)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Actual</div>
            <div className="font-bold">{inr(actual)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Variance</div>
            <div className={cn("font-semibold", d >= 0 ? "text-primary" : "text-destructive")}>
              {d >= 0 ? "+" : "−"}
              {inr(Math.abs(d))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="mt-3 space-y-3">
      <Card className="border-primary/20">
        <CardHeader className="px-3 py-2">
          <CardTitle className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="text-primary h-3.5 w-3.5" /> Tour outcomes — revenue generated
              / saved
            </span>
            {canEdit &&
              (tour.status === "Completed" ||
                tour.status === "Closed" ||
                tour.status === "Approved") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    setO(
                      tour.outcomes ?? {
                        revenueGenerated: 0,
                        revenueSaved: 0,
                        targetRevenue: 0,
                        targetSavings: 0,
                        dealsClosed: 0,
                        leads: 0,
                        notes: "",
                      },
                    );
                    setOpen(true);
                  }}
                >
                  {tour.outcomes ? "Update" : "Record outcomes"}
                </Button>
              )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 text-sm">
          {tour.outcomes ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cmp(
                  "Revenue generated",
                  tour.outcomes.revenueGenerated,
                  tour.outcomes.targetRevenue,
                )}
                {cmp(
                  "Revenue / cost saved",
                  tour.outcomes.revenueSaved,
                  tour.outcomes.targetSavings,
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
                {[
                  ["Tour cost (approved)", inr(roi.cost)],
                  ["Total gain", inr(roi.gain)],
                  ["ROI", `${roi.roi} %`],
                  ["Deals / leads", `${tour.outcomes.dealsClosed} / ${tour.outcomes.leads}`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-muted/40 rounded-lg p-2">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              {tour.outcomes.notes && (
                <div className="text-muted-foreground text-xs">{tour.outcomes.notes}</div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">No outcomes recorded yet.</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="px-3 py-2">
          <CardTitle className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <Receipt className="text-primary h-3.5 w-3.5" /> Travel &amp; tour expenses → petty
              cash encashment
            </span>
            {canEdit && !tour.encashment && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setExp(true)}>
                <Plus className="h-3.5 w-3.5" /> Expense
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3 text-xs">
          {!hideExpenseTable && (tour.expenses ?? []).length > 0 && (
            <table className="w-full">
              <thead className="text-muted-foreground tracking-wider uppercase">
                <tr>
                  <th className="p-1 text-left">Head</th>
                  <th className="p-1 text-left">Date</th>
                  <th className="p-1 text-left">Receipt</th>
                  <th className="p-1 text-right">Amount</th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {tour.expenses.map((x) => (
                  <tr key={x.id}>
                    <td className="p-1">{x.head}</td>
                    <td className="p-1">
                      <span className="whitespace-nowrap">{x.date}</span>
                    </td>
                    <td className="p-1 font-mono">{x.receipt || "—"}</td>
                    <td className="p-1 text-right">{inr(x.amount)}</td>
                    <td className="p-1 text-right">
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
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-6 px-1"
                            onClick={() => approveTourExpense(tour.id, x.id, false)}
                          >
                            <X className="h-3 w-3" />
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {[
              ["Claimed", inr(t.all)],
              ["Approved", inr(t.approved)],
              ["Advance paid", inr(t.advance)],
              ["Encashable (petty cash)", inr(t.encashable)],
              ["Refund to company", inr(t.refundable)],
            ].map(([k, v]) => (
              <div key={k} className="bg-muted/40 rounded-lg p-2">
                <div className="text-muted-foreground">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>
          {tour.encashment ? (
            <div className="text-primary flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5" /> Encashed {inr(tour.encashment.amount)} via petty
              cash claim {tour.encashment.claimId} on {tour.encashment.on}.
            </div>
          ) : (
            canEdit &&
            t.encashable > 0 && (
              <Button
                size="sm"
                className="bg-gradient-emerald h-7 text-white"
                onClick={() => {
                  addReimbursement({
                    empId: tour.employeeId,
                    employee: tour.employeeName,
                    name: `Tour ${tour.id} expenses`,
                    type: "Petty Cash",
                    category: "Travel",
                    amount: t.encashable,
                    date: (() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    })(),
                    document: (tour.expenses ?? [])
                      .map((x) => x.receipt)
                      .filter(Boolean)
                      .join(", "),
                    description: `Petty cash encashment for ${tour.destination} (${tour.startDate} → ${tour.endDate}); approved expenses ${inr(t.approved)} less advance ${inr(t.advance)}.`,
                  }); // Record the id of the claim that was actually raised (a made-up "RMB-TUR-xxx" matched no reimbursement).
                  const claimId = reimbursementStore.get()[0]?.id ?? "—";
                  markEncashed(tour.id, t.encashable, claimId);
                  toast.success(
                    `Petty cash claim raised for ${inr(t.encashable)} — routed Manager → HR → Accounts`,
                  );
                }}
              >
                <Banknote className="h-3.5 w-3.5" /> Encash {inr(t.encashable)} as petty cash
              </Button>
            )
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tour outcomes</DialogTitle>
            <DialogDescription>
              Revenue generated / saved against the target set at approval. Feeds the tour ROI
              report.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["targetRevenue", "Target revenue (₹)"],
              ["revenueGenerated", "Revenue generated (₹)"],
              ["targetSavings", "Target savings (₹)"],
              ["revenueSaved", "Revenue / cost saved (₹)"],
              ["dealsClosed", "Deals closed"],
              ["leads", "Leads"],
            ].map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input
                  type="number"
                  min={0}
                  value={o[k]}
                  onChange={(e) => setO({ ...o, [k]: Math.max(0, +e.target.value || 0) })}
                />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                value={o.notes}
                onChange={(e) => setO({ ...o, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => {
                submitTourOutcomes(tour.id, o);
                setOpen(false);
                toast.success("Outcomes recorded");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={exp} onOpenChange={setExp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add tour expense</DialogTitle>
            <DialogDescription>
              Attach the receipt; approved expenses less any advance become the petty-cash
              encashment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Head</Label>
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                value={e.amount}
                onChange={(x) => setE({ ...e, amount: +x.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={e.date}
                onChange={(x) => setE({ ...e, date: x.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Receipt</Label>
              <Input
                type="file"
                className="text-xs"
                onChange={(x) => {
                  captureFiles(x.target.files);
                  setE({ ...e, receipt: x.target.files?.[0]?.name ?? "" });
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExp(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!(e.amount > 0)}
              onClick={() => {
                addTourExpense(tour.id, e);
                setExp(false);
                toast.success("Expense added");
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Org-level Tour ROI report (item 32) — revenue generated / saved vs cost per tour. */
export function TourRoiReport() {
  const inScope = useScopeMatch();
  // Tenant-scoped like the tour list above it (it used to aggregate every entity's tours).
  const tours = useTours().filter((t) => t.outcomes && inScope(t.orgId, t.employeeId));
  const [detail, setDetail] = useState(null);
  const data = tours.map((t) => {
    const r = tourRoi(t);
    return {
      name: `${t.id} · ${t.employeeName.split(" ")[0]}`,
      Cost: r.cost,
      "Revenue generated": t.outcomes.revenueGenerated,
      "Revenue saved": t.outcomes.revenueSaved,
    };
  });
  const tot = tours.reduce(
    (a, t) => {
      const r = tourRoi(t);
      a.cost += r.cost;
      a.gain += r.gain;
      return a;
    },
    { cost: 0, gain: 0 },
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          ["Tours with outcomes", tours.length],
          ["Total cost", inr(tot.cost)],
          ["Revenue generated + saved", inr(tot.gain)],
          [
            "Portfolio ROI",
            tot.cost ? `${Math.round(((tot.gain - tot.cost) / tot.cost) * 100)} %` : "—",
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ChartCard
        title="Tour outcomes — cost vs revenue generated / saved"
        subtitle="Comparison per tour"
      >
        <BarsChart
          data={data}
          keys={[
            { key: "Cost", label: "Cost" },
            { key: "Revenue generated", label: "Revenue generated" },
            { key: "Revenue saved", label: "Revenue saved" },
          ]}
          height={260}
        />
      </ChartCard>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Tour",
                  "Employee",
                  "Destination",
                  "Cost",
                  "Target revenue",
                  "Revenue generated",
                  "Target savings",
                  "Revenue saved",
                  "ROI",
                  "Petty cash",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {tours.map((t) => {
                const r = tourRoi(t);
                const o = t.outcomes;
                return (
                  <tr key={t.id} className={clickableRow} onClick={() => setDetail(t)}>
                    <td className="p-3 font-mono text-xs">{t.id}</td>
                    <td className="p-3">{t.employeeName}</td>
                    <td className="p-3">{t.destination}</td>
                    <td className="p-3">{inr(r.cost)}</td>
                    <td className="p-3">{inr(o.targetRevenue)}</td>
                    <td
                      className={cn(
                        "p-3 font-semibold",
                        o.revenueGenerated >= o.targetRevenue ? "text-primary" : "text-destructive",
                      )}
                    >
                      {inr(o.revenueGenerated)}
                    </td>
                    <td className="p-3">{inr(o.targetSavings)}</td>
                    <td
                      className={cn(
                        "p-3 font-semibold",
                        o.revenueSaved >= o.targetSavings ? "text-primary" : "text-destructive",
                      )}
                    >
                      {inr(o.revenueSaved)}
                    </td>
                    <td className="p-3 font-bold">{r.roi} %</td>
                    <td className="p-3 text-xs">
                      {t.encashment ? `${inr(t.encashment.amount)} · ${t.encashment.claimId}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {detail &&
        (() => {
          const r = tourRoi(detail);
          const o = detail.outcomes;
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={`${detail.id} · ${detail.employeeName}`}
              subtitle={`${detail.destination} · ${detail.startDate} → ${detail.endDate} · ${detail.purpose}`}
              badges={
                <>
                  <Badge variant="outline">{detail.status}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      r.roi >= 0
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }
                  >
                    ROI {r.roi} %
                  </Badge>
                </>
              }
              record={{
                tour: detail.id,
                employee: detail.employeeName,
                destination: detail.destination,
                dates: `${detail.startDate} → ${detail.endDate}`,
                purpose: detail.purpose,
                costCentre: detail.costCentre,
                status: detail.status,
                cost: r.cost,
                gain: r.gain,
                roi: `${r.roi} %`,
                targetRevenue: o.targetRevenue,
                revenueGenerated: o.revenueGenerated,
                revenueVariance: o.revenueGenerated - o.targetRevenue,
                targetSavings: o.targetSavings,
                revenueSaved: o.revenueSaved,
                savingsVariance: o.revenueSaved - o.targetSavings,
                dealsClosed: o.dealsClosed,
                leads: o.leads,
                notes: o.notes,
                pettyCash: detail.encashment
                  ? `${inr(detail.encashment.amount)} · ${detail.encashment.claimId} · ${detail.encashment.on}`
                  : "—",
              }}
              labels={{
                costCentre: "Cost centre",
                cost: "Tour cost (approved)",
                gain: "Total gain",
                roi: "ROI",
                revenueVariance: "Revenue variance",
                savingsVariance: "Savings variance",
                pettyCash: "Petty cash encashment",
              }}
              sections={[
                {
                  title: "Tour",
                  keys: [
                    "tour",
                    "employee",
                    "destination",
                    "dates",
                    "purpose",
                    "costCentre",
                    "status",
                  ],
                },
                { title: "Return on investment", keys: ["cost", "gain", "roi", "pettyCash"] },
                {
                  title: "Revenue generated",
                  keys: ["targetRevenue", "revenueGenerated", "revenueVariance"],
                },
                {
                  title: "Revenue / cost saved",
                  keys: [
                    "targetSavings",
                    "revenueSaved",
                    "savingsVariance",
                    "dealsClosed",
                    "leads",
                    "notes",
                  ],
                },
              ]}
            />
          );
        })()}
    </div>
  );
}
