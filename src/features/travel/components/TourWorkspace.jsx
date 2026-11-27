// Org-side Tours workspace: every tour request for this organisation, with a
// employee request (HR → Finance) / HR assignment (Finance → HR dispatch) trail. One shared record set with the
// employee "My Tours" view — approving/rejecting here updates the same
// record the employee sees.
import { TourOutcomesCard } from "@/features/travel/components/TourOutcomes";
import { useState } from "react";
import { Plane, Download, CheckCircle2, XCircle, Search, FileCheck2, Receipt, Wallet, CircleDollarSign, ArrowRight, Check, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { exportReportPdf } from "@/lib/export-utils";
import { chainSummary, currentStep } from "@/features/administration/data/approval-chain";
import { useTours, decideTour, closeTour, canDecideTour, dispatchTourToEmployee, tourExpenseTotals } from "@/features/travel/data/tour-data";
import {
  CreateTourDialog,
  TourExpensePanel,
  TourAuditButtons,
} from "@/features/travel/components/TourAdminPieces";
import { Plus } from "lucide-react";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { useScreenActions } from "@/features/auth/data/module-access";

const statusTone = {
  "Pending Approval": "bg-gold/15 text-gold border-gold/30",
  "Pending HR Dispatch": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-primary/10 text-primary border-primary/20",
  Closed: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
  Pending: "bg-gold/15 text-gold border-gold/30",
};
const paymentModeName = (value) => ({
  company_direct: "Company pays directly",
  advance: "Company advance",
  employee_reimbursement: "Employee reimbursement",
}[value] ?? "Employee reimbursement");
const isReadyToClose = (tour) => {
  const totals = tourExpenseTotals(tour);
  const reviewsComplete = (tour.expenses ?? []).every((expense) => expense.approved || expense.rejected);
  return reviewsComplete && (tour.settlement || tour.encashment || (totals.encashable === 0 && totals.refundable === 0));
};

export function TourWorkspace({ audience = "admin" }) {
  const me = useCurrentUser();
  const tourAccess = useScreenActions("tours.tours.all-tours");
  const inScope = useScopeMatch();
  const allTours = useTours();
  // Roles without `tour.viewAll` (Managers) only see their own tours and the ones routed to them — the list used to
  // expose every tour and its cost in the entity.
  const viewAll = tourAccess.can("View");
  const tours = allTours.filter(
    (t) =>
      inScope(t.orgId, t.employeeId) &&
      (viewAll ||
        t.employeeId === me.id ||
        t.chain.some((s) => s.approverId === me.id) ||
        canDecideTour(t, me)),
  );
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [create, setCreate] = useState(false);
  const [createMethod, setCreateMethod] = useState("company_direct");
  const canCreateTour = tourAccess.can("Create");
  const canApproveTour = tourAccess.can("Approve");
  const canRejectTour = tourAccess.can("Reject");
  const canExportTours = tourAccess.can("Export");
  const canDispatchTour = tourAccess.can("Dispatch");
  const canSettle = tourAccess.can("Settle");
  const canCloseTour = tourAccess.can("Close");

  const filtered = tours.filter((t) => {
    const matchesQ = [t.id, t.employeeName, t.destination, t.purpose]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesStage = stageFilter === "all" || t.status === stageFilter;
    return matchesQ && matchesStage;
  });

  const pendingMine = tours.filter((t) => canDecideTour(t, me)).length;
  const employeeRequestsForHr = audience === "hr"
    ? tours.filter((tour) => tour.status === "Pending Approval" && ["HR", "HR Manager"].includes(currentStep(tour.chain)?.role) && canDecideTour(tour, me))
    : [];
  const employeeRequestsForFinance = audience === "finance"
    ? tours.filter((tour) => tour.status === "Pending Approval" && ["CFO", "Finance Manager"].includes(currentStep(tour.chain)?.role) && canDecideTour(tour, me))
    : [];
  const spend = tours.reduce((s, t) => s + t.estimatedCost, 0);
  const expenseLines = tours.flatMap((tour) => (tour.expenses ?? []).map((expense) => ({ tour, expense })));
  const pendingExpenses = expenseLines.filter(({ expense }) => !expense.approved && !expense.rejected);
  const hrQueueCount = pendingExpenses.filter(({ expense }) => !expense.hrVerified).length;
  const financeQueueCount = pendingExpenses.filter(({ expense }) => expense.hrVerified).length;
  const pendingSettlement = tours.filter((tour) => tour.status === "Completed" && !tour.encashment && !tour.settlement && (tourExpenseTotals(tour).encashable > 0 || tourExpenseTotals(tour).refundable > 0));
  const companyPaid = (tour) => tourExpenseTotals(tour).companyPaid;
  const employeeClaims = (tour) => (tour.expenses ?? []).filter((expense) => expense.paidBy === "Employee").reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return (
    <div className="space-y-6">
      {audience === "admin" && canCreateTour && (
        <Card className="overflow-hidden border-border shadow-card">
          <CardContent className="p-4 sm:p-5">
            <Tabs defaultValue="employee_reimbursement">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl bg-muted/70 p-1.5 sm:grid-cols-3">
                <TabsTrigger value="employee_reimbursement" className="w-full rounded-lg py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Employee pays personally <span className="text-xs opacity-80">({tours.filter((t) => t.paymentMethod === "employee_reimbursement" && !t.assignedBy).length})</span></TabsTrigger>
                <TabsTrigger value="company_direct" className="w-full rounded-lg py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Company pays directly <span className="text-xs opacity-80">({tours.filter((t) => t.paymentMethod === "company_direct").length})</span></TabsTrigger>
                <TabsTrigger value="advance" className="w-full rounded-lg py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Company gives advance <span className="text-xs opacity-80">({tours.filter((t) => t.paymentMethod === "advance").length})</span></TabsTrigger>
              </TabsList>
              {[
                { key: "employee_reimbursement", label: "Employee pays personally", createLabel: null },
                { key: "company_direct", label: "Company pays directly", createLabel: "Create company booking" },
                { key: "advance", label: "Company gives advance", createLabel: "Issue travel advance" },
              ].map((mode) => {
                const rows = tours.filter((tour) => tour.paymentMethod === mode.key && (mode.key !== "employee_reimbursement" || !tour.assignedBy));
                return <TabsContent key={mode.key} value={mode.key} className="mt-4 rounded-lg border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{mode.label}</h2>
                    {mode.createLabel && <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setCreateMethod(mode.key); setCreate(true); }}><Plus className="h-4 w-4" />{mode.createLabel}</Button>}
                  </div>
                  {mode.key === "employee_reimbursement" ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Employee request</th><th className="p-3 text-left">Travel dates</th><th className="p-3 text-right">Estimate</th><th className="p-3 text-left">Approval status</th></tr></thead><tbody className="divide-y">
                        {rows.length ? rows.map((tour) => <tr key={tour.id}><td className="p-3"><div className="font-medium">{tour.employeeName}</div><div className="text-xs text-muted-foreground">{tour.id} · {tour.destination}</div><div className="mt-1 text-xs">{tour.purpose}</div></td><td className="p-3">{tour.startDate} → {tour.endDate}</td><td className="p-3 text-right tabular-nums">{inr(tour.estimatedCost)}</td><td className="p-3"><Badge variant="outline" className={statusTone[tour.status] ?? ""}>{tour.status}</Badge></td></tr>) : <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No employee requests yet.</td></tr>}
                      </tbody></table>
                    </div>
                  ) : <div className="divide-y rounded-lg border">
                    {rows.length ? rows.map((tour) => <div key={tour.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div><span className="font-medium">{tour.employeeName}</span><span className="ml-2 text-muted-foreground">{tour.id} · {tour.destination} · {tour.startDate} → {tour.endDate}</span></div><Badge variant="outline" className={statusTone[tour.status] ?? ""}>{tour.status}</Badge></div>) : <div className="p-4 text-sm text-muted-foreground">No assignments yet.</div>}
                  </div>}
                </TabsContent>;
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}
      {audience === "hr" && (
        <Card className="border-primary/20 shadow-card">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-base font-semibold"><Receipt className="h-5 w-5 text-primary" />Employee requests awaiting HR</div>
              <Badge variant="outline">{employeeRequestsForHr.length} pending</Badge>
            </div>
            {employeeRequestsForHr.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No employee tour requests are waiting for HR.</div> : <div className="space-y-3">
              {employeeRequestsForHr.map((tour) => <div key={tour.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                <div className="min-w-0"><div className="font-semibold">{tour.employeeName} · {tour.destination}</div><div className="mt-1 text-xs text-muted-foreground">{tour.id} · {tour.startDate} → {tour.endDate} · {tour.mode} · Estimate {inr(tour.estimatedCost)}</div><div className="mt-2 text-sm">{tour.purpose}</div><Badge variant="outline" className="mt-2">{paymentModeName(tour.paymentMethod)}</Badge>
                  {(tour.expenses ?? []).length > 0 && <div className="mt-3 rounded-lg border p-3"><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="font-semibold">Attached bills ({tour.expenses.length})</span><span>Total {inr(tour.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0))}</span></div><div className="space-y-2">{tour.expenses.map((expense) => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{expense.head} · {expense.vendor} · {expense.date} · {inr(expense.amount)}</span>{expense.receipt && <AttachmentChips names={[expense.receipt]} context={`Tour ${tour.id} receipt`} size="sm" />}</div>)}</div></div>}
                </div>
                <div className="flex gap-2">{canApproveTour && <Button size="sm" className="bg-gradient-emerald text-white" onClick={() => { const result = decideTour(tour.id, me.id, "Approved"); toast[result.ok ? "success" : "error"](result.message); }}><CheckCircle2 className="h-4 w-4" />Approve &amp; send to Finance</Button>}{canRejectTour && <Button size="sm" variant="outline" className="text-destructive" onClick={() => { const reason = window.prompt("Reason for rejecting this tour request?")?.trim(); if (!reason) return; const result = decideTour(tour.id, me.id, "Rejected", reason); toast[result.ok ? "success" : "error"](result.message); }}>Reject</Button>}</div>
              </div>)}
            </div>}
          </CardContent>
        </Card>
      )}
      {audience === "finance" && (
        <Card className="border-primary/20 shadow-card">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-base font-semibold"><CircleDollarSign className="h-5 w-5 text-primary" />Employee requests forwarded by HR</div>
              <Badge variant="outline">{employeeRequestsForFinance.length} pending</Badge>
            </div>
            {employeeRequestsForFinance.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No employee requests are waiting for Finance.</div> : <div className="space-y-3">
              {employeeRequestsForFinance.map((tour) => <div key={tour.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                <div className="min-w-0"><div className="font-semibold">{tour.employeeName} · {tour.destination}</div><div className="mt-1 text-xs text-muted-foreground">{tour.id} · {tour.startDate} → {tour.endDate} · {tour.mode}</div><div className="mt-2 text-sm">{tour.purpose}</div><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">Requested budget {inr(tour.estimatedCost)}</Badge><Badge variant="outline">{paymentModeName(tour.paymentMethod)}</Badge></div></div>
                <div className="flex gap-2">{canApproveTour && <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { const result = decideTour(tour.id, me.id, "Approved"); toast[result.ok ? "success" : "error"](result.message); }}><CheckCircle2 className="h-4 w-4" />Approve request</Button>}{canRejectTour && <Button size="sm" variant="outline" className="text-destructive" onClick={() => { const reason = window.prompt("Reason for rejecting this tour request?")?.trim(); if (!reason) return; const result = decideTour(tour.id, me.id, "Rejected", reason); toast[result.ok ? "success" : "error"](result.message); }}>Reject</Button>}</div>
              </div>)}
            </div>}
          </CardContent>
        </Card>
      )}
      {audience !== "admin" && <Card className="overflow-hidden shadow-card">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold"><Wallet className="text-primary h-5 w-5" />{audience === "hr" ? "HR expense verification queue" : audience === "finance" ? "Finance approval & settlement queue" : "Travel administration overview"}</div>
              <p className="text-muted-foreground mt-1 text-sm">{audience === "hr" ? "Open a tour below, verify each receipt, or reject with a reason. Verified claims move to Finance." : audience === "finance" ? "Only HR-verified claims can be approved. Reconcile advances, then record payroll or bank settlement." : "Create and assign tours, follow review progress, and monitor company costs and employee settlements."}</p>
            </div>
            <Badge variant="outline" className="px-2.5 py-1">{tours.length} tours in scope</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              audience === "hr"
                ? { label: "Claims to verify", value: String(hrQueueCount), note: "Waiting for HR receipt verification", icon: Receipt }
                : audience === "finance"
                  ? { label: "Claims to approve", value: String(financeQueueCount), note: "HR verified; awaiting Finance", icon: Receipt }
                  : { label: "Claims in review", value: String(pendingExpenses.length), note: "Waiting for HR or Finance", icon: Receipt },
              audience === "hr"
                ? { label: "With Finance", value: String(financeQueueCount), note: "HR review is complete", icon: Check }
                : audience === "finance"
                  ? { label: "Reimbursement due", value: inr(pendingSettlement.reduce((sum, tour) => sum + tourExpenseTotals(tour).encashable, 0)), note: "Approved employee expenses less unused advance", icon: CircleDollarSign }
                  : { label: "Approved expenses", value: inr(tours.reduce((sum, tour) => sum + tourExpenseTotals(tour).approved, 0)), note: "Approved across visible tours", icon: Check },
              audience === "finance"
                ? { label: "Advance refunds", value: inr(pendingSettlement.reduce((sum, tour) => sum + tourExpenseTotals(tour).refundable, 0)), note: "Unused advance to recover", icon: Banknote }
                : { label: "Settlement due", value: inr(pendingSettlement.reduce((sum, tour) => sum + tourExpenseTotals(tour).encashable + tourExpenseTotals(tour).refundable, 0)), note: `${pendingSettlement.length} tour(s) with balance due`, icon: CircleDollarSign },
              { label: "Company paid", value: inr(tours.reduce((sum, tour) => sum + companyPaid(tour), 0)), note: "Company card and vendor paid", icon: Wallet },
            ].map(({ label, value, note, icon: Icon }) => (
              <div key={label} className="border-border bg-muted/20 rounded-xl border p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
                <div className="mt-2 text-lg font-bold tabular-nums">{value}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{note}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <div className="border-b bg-muted/30 px-4 py-3 text-sm font-semibold">Tour cost and settlement snapshot</div>
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Tour / employee</th><th className="p-3 text-right">Estimated</th><th className="p-3 text-right">Company paid</th><th className="p-3 text-right">Employee claims</th><th className="p-3 text-right">Approved</th><th className="p-3 text-right">Advance</th><th className="p-3 text-right">Balance due</th><th className="p-3 text-left">Payment status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tours.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No tours available in your scope.</td></tr> : tours.slice(0, 8).map((tour) => {
                  const totals = tourExpenseTotals(tour);
                  const settlementStatus = tour.settlement || tour.encashment ? "Settled" : tour.status !== "Completed" ? "Travel not completed" : totals.encashable > 0 ? "Awaiting settlement" : totals.refundable > 0 ? "Refund due" : "No balance due";
                  return <tr key={tour.id}>
                    <td className="p-3"><div className="font-medium">{tour.destination}</div><div className="text-xs text-muted-foreground">{tour.id} · {tour.employeeName} · {tour.startDate} → {tour.endDate}</div><div className="mt-1 text-[10px] text-muted-foreground">{paymentModeName(tour.paymentMethod)}</div></td>
                    <td className="p-3 text-right tabular-nums">{inr(tour.estimatedCost)}</td><td className="p-3 text-right tabular-nums">{inr(companyPaid(tour))}</td><td className="p-3 text-right tabular-nums">{inr(employeeClaims(tour))}</td><td className="p-3 text-right tabular-nums">{inr(totals.approved)}</td><td className="p-3 text-right tabular-nums">{inr(totals.advance)}</td><td className="p-3 text-right font-semibold tabular-nums">{inr(totals.encashable || totals.refundable)}</td>
                    <td className="p-3"><Badge variant="outline" className={tour.encashment ? "border-primary/30 bg-primary/10 text-primary" : ""}>{settlementStatus}</Badge></td>
                  </tr>;
                })}
              </tbody>
            </table>
            {tours.length > 8 && <div className="border-t px-4 py-2 text-xs text-muted-foreground">Showing 8 of {tours.length}. Use the tour register below to search and filter the full list.</div>}
          </div>
        </CardContent>
      </Card>}

      {audience !== "admin" && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total tours", v: String(tours.length) },
          { l: "Pending my approval", v: String(pendingMine) },
          {
            l: "Completed",
            v: String(
              tours.filter((t) => t.status === "Completed" || t.status === "Closed").length,
            ),
          },
          { l: "Total estimated spend", v: inr(spend) },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                {s.l}
              </div>
              <div className="mt-1 text-xl font-bold">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>}

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Plane className="text-primary h-4 w-4" /> All Tours
              <span className="text-muted-foreground font-normal">
                — every request across the organisation, filterable by stage.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateTour && audience !== "admin" && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald shadow-premium text-white"
                  onClick={() => setCreate(true)}
                >
                  <Plus className="h-4 w-4" /> Create &amp; assign tour
                </Button>
              )}
              {canExportTours && <TourAuditButtons tours={tours} />}
              {canExportTours && <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportReportPdf({
                    title: "Tour Requests",
                    subtitle: "All tours and current approval stage",
                    columns: [
                      "Tour",
                      "Employee",
                      "Destination",
                      "Dates",
                      "Estimated",
                      "Expenses",
                      "Stage",
                      "Status",
                    ],
                    rows: tours.map((t) => [
                      t.id,
                      t.employeeName,
                      t.destination,
                      `${t.startDate} to ${t.endDate}`,
                      inr(t.estimatedCost),
                      inr((t.expenses ?? []).reduce((s, x) => s + x.amount, 0)),
                      chainSummary(t.chain),
                      t.status,
                    ]),
                  })
                }
              >
                <Download className="h-4 w-4" /> Tours PDF
              </Button>}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employee, destination, purpose…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                <SelectItem value="Pending HR Dispatch">Pending HR Dispatch</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No tours match this filter.
              </div>
            )}
            {filtered.map((t) => (
              <div key={t.id} className="border-border rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.destination}</span>
                      <Badge variant="outline" className={statusTone[t.status] ?? ""}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {t.id} · {t.employeeName} · raised{" "}
                      <span className="whitespace-nowrap">{t.raisedOn}</span> ·{" "}
                      <span className="whitespace-nowrap">{t.startDate}</span> →{" "}
                      <span className="whitespace-nowrap">{t.endDate}</span> ·{" "}
                      {inr(t.estimatedCost)} · {t.costCentre}
                    </div>
                    <div className="mt-2 text-sm">{t.purpose}</div>
                    {(t.assignedBy || t.client || t.travellers?.length) && (
                      <div className="text-muted-foreground mt-1 text-xs">
                          {t.assignedBy
                          ? `Created by ${t.assignedBy.name} on ${t.assignedBy.on}`
                          : ""}
                        {t.client ? ` · client ${t.client}` : ""}
                        {t.project ? ` · ${t.project}` : ""}
                        {t.travellers?.length
                          ? ` · with ${t.travellers.map((x) => x.name).join(", ")}`
                          : ""}
                        {t.accommodation ? ` · ${t.accommodation}` : ""}
                        {t.bookingRefs ? ` · ${t.bookingRefs}` : ""}
                      </div>
                    )}
                    {t.dispatchedOn && <div className="mt-1 text-xs text-muted-foreground">Sent to employee by {t.dispatchedBy} on {t.dispatchedOn}</div>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {t.status === "Pending HR Dispatch" && canDispatchTour && (
                      <Button size="sm" className="bg-gradient-emerald text-white" onClick={() => { const result = dispatchTourToEmployee(t.id, me); toast[result.ok ? "success" : "error"](result.message); }}>
                        <ArrowRight className="h-4 w-4" /> Send to employee
                      </Button>
                    )}
                    {canDecideTour(t, me) && (canApproveTour || canRejectTour) && (
                      <>
                        {canApproveTour && <Button
                          size="sm"
                          className="bg-gradient-emerald text-white"
                          onClick={() => {
                            const r = decideTour(t.id, me.id, "Approved");
                            toast[r.ok ? "success" : "error"](r.message);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>}
                        {canRejectTour && <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            const note = window
                              .prompt("Reason for rejecting this tour request?")
                              ?.trim();
                            if (!note) {
                              toast.error("A reason is required to reject a tour.");
                              return;
                            }
                            const r = decideTour(t.id, me.id, "Rejected", note);
                            toast[r.ok ? "success" : "error"](r.message);
                          }}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>}
                      </>
                    )}
                    {t.status === "Completed" && canCloseTour && isReadyToClose(t) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          closeTour(t.id);
                          toast.success("Tour closed");
                        }}
                      >
                        <FileCheck2 className="h-4 w-4" /> Close
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {t.chain.map((s, i) => (
                    <Badge key={i} variant="outline" className={statusTone[s.status] ?? ""}>
                      {s.label} · {s.status}
                    </Badge>
                  ))}
                </div>

                {(t.status === "Approved" || t.status === "Completed" || t.status === "Closed") && (
                  <TourOutcomesCard
                    tour={t}
                    canEdit={false}
                    canApprove={canApproveTour && t.employeeId !== me.id}
                    hideExpenseTable
                  />
                )}
                {t.status !== "Rejected" && t.status !== "Pending Approval" && t.status !== "Pending HR Dispatch" && (
                  <TourExpensePanel
                    tour={t}
                    canApprove={canApproveTour && t.employeeId !== me.id}
                    canSettle={canSettle}
                    canManageAdvance={canSettle}
                  />
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <CreateTourDialog key={createMethod} open={create} onClose={() => setCreate(false)} initialPaymentMethod={createMethod} />
    </div>
  );
}
