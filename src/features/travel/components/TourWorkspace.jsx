// Org-side Tours workspace: every tour request for this organisation, with a
// live HOD → HR → Finance approval trail. One shared record set with the
// employee "My Tours" view — approving/rejecting here updates the same
// record the employee sees.
import { TourOutcomesCard } from "@/features/travel/components/TourOutcomes";
import { useState } from "react";
import { Plane, Download, CheckCircle2, XCircle, Search, FileCheck2 } from "lucide-react";
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
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { exportReportPdf } from "@/lib/export-utils";
import { chainSummary } from "@/features/administration/data/approval-chain";
import { useTours, decideTour, closeTour, canDecideTour } from "@/features/travel/data/tour-data";
import {
  CreateTourDialog,
  TourExpensePanel,
  TourAuditButtons,
} from "@/features/travel/components/TourAdminPieces";
import { Plus } from "lucide-react";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const statusTone = {
  "Pending Approval": "bg-gold/15 text-gold border-gold/30",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-primary/10 text-primary border-primary/20",
  Closed: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
  Pending: "bg-gold/15 text-gold border-gold/30",
};

export function TourWorkspace() {
  const me = useCurrentUser();
  const inScope = useScopeMatch();
  const allTours = useTours();
  // Roles without `tour.viewAll` (Managers) only see their own tours and the ones routed to them — the list used to
  // expose every tour and its cost in the entity.
  const viewAll = can(me.role, "tour.viewAll");
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
  const canManage = ["HR", "CHRO", "Admin", "SuperAdmin", "CFO", "CEO", "COO"].includes(me.role);

  const filtered = tours.filter((t) => {
    const matchesQ = [t.id, t.employeeName, t.destination, t.purpose]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesStage = stageFilter === "all" || t.status === stageFilter;
    return matchesQ && matchesStage;
  });

  const pendingMine = tours.filter((t) => canDecideTour(t, me)).length;
  const spend = tours.reduce((s, t) => s + t.estimatedCost, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>

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
              {canManage && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald shadow-premium text-white"
                  onClick={() => setCreate(true)}
                >
                  <Plus className="h-4 w-4" /> Create &amp; assign tour
                </Button>
              )}
              <TourAuditButtons tours={tours} />
              <Button
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
              </Button>
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
                          ? `Assigned by ${t.assignedBy.name} on ${t.assignedBy.on}`
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
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canDecideTour(t, me) && (
                      <>
                        <Button
                          size="sm"
                          className="bg-gradient-emerald text-white"
                          onClick={() => {
                            const r = decideTour(t.id, me.id, "Approved");
                            toast[r.ok ? "success" : "error"](r.message);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                        <Button
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
                        </Button>
                      </>
                    )}
                    {t.status === "Completed" && canManage && (
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
                      {s.label}: {s.approverName} · {s.status}
                    </Badge>
                  ))}
                </div>

                {(t.status === "Approved" || t.status === "Completed" || t.status === "Closed") && (
                  <TourOutcomesCard
                    tour={t}
                    canEdit={false}
                    canApprove={canManage && t.employeeId !== me.id}
                    hideExpenseTable
                  />
                )}
                {t.status !== "Rejected" && t.status !== "Pending Approval" && (
                  <TourExpensePanel tour={t} canApprove={canManage && t.employeeId !== me.id} />
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
      <CreateTourDialog open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
