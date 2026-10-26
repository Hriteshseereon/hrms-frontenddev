import { useState } from "react";
import Link from "@/lib/router";
import { Info, Search, Check, X, Paperclip, Download, FileText } from "lucide-react";
import { leaveApi } from "@/api/leaveApi";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMemo } from "react";
import {
  balanceFor,
  canDecideLeave,
  decideLeaveApplication,
  leaveOrgOf,
  leaveStepOf,
  useLeaveApplications,
} from "@/features/leave/data/leave-engine";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useTeamScope } from "@/features/attendance/data/attendance-live";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/**
 * @typedef {{ row: LeaveApplication, action: "Approved" | "Rejected" } | null} Decision
 */

const leaveStatusTone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Cancelled"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/30 bg-gold/10 text-gold";

export function LeaveApplicationsTab() {
  const [allRows] = useLeaveApplications();
  const me = useCurrentUser();
  const inScope = useScopeMatch();
  const team = useTeamScope();
  // Tenant scope (active entity, or the whole group in group view) and, for Managers / HODs, their reporting line plus
  // anything that is currently waiting on them — the queue used to list every entity's requests to every role.
  const rows = useMemo(
    () =>
      allRows.filter(
        (a) =>
          inScope(leaveOrgOf(a), a.empId) &&
          (!team || team.has(a.empId) || canDecideLeave(a, me).ok),
      ),
    [allRows, inScope, team, me],
  );
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const commit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      const action = decision.action === "Approved" ? "APPROVE" : "REJECT";
      await leaveApi.decideApplication(decision.row.id, {
        action,
        remarks: reason.trim(),
      });
      // also update local engine store for consistency
      decideLeaveApplication(decision.row.id, me, decision.action, reason);
      toast.success(`Leave request ${decision.action.toLowerCase()}`);
      setDecision(null);
      setReason("");
    } catch (err) {
      console.warn("Backend decideApplication failed, falling back to local engine:", err);
      const r = decideLeaveApplication(decision.row.id, me, decision.action, reason);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      setDecision(null);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((a) =>
        [a.id, a.employee, a.empId, a.leaveType, a.status, a.description].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(term),
        ),
      )
    : rows;

  const columns = [
    "Reference",
    "Employee",
    "Emp ID",
    "Leave Type",
    "From",
    "To",
    "Days",
    "Description",
    "Attachment",
    "Status",
    "Note",
  ];
  const reportRows = filtered.map((a) => [
    a.id,
    a.employee,
    a.empId,
    a.leaveType,
    a.from,
    a.to,
    a.days,
    a.description,
    a.attachment || "—",
    a.status,
    a.decisionReason || "—",
  ]);

  function downloadPdf() {
    const ok = exportReportPdf({
      title: "Leave Applications Register",
      subtitle: "Leave requests with approval decisions and notes",
      filters: [{ label: "Search", value: q.trim() || "—" }],
      summary: [
        { label: "Applications", value: String(filtered.length) },
        { label: "Pending", value: String(filtered.filter((a) => a.status === "Pending").length) },
        {
          label: "Approved",
          value: String(filtered.filter((a) => a.status === "Approved").length),
        },
        {
          label: "Rejected",
          value: String(filtered.filter((a) => a.status === "Rejected").length),
        },
      ],
      columns,
      rows: reportRows,
    });
    if (ok) toast.success("Leave register PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leave applications…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="text-muted-foreground text-xs">
            {rows.filter((r) => r.status === "Pending").length} pending approval
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              exportCsv("leave-applications", columns, reportRows);
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
            <Info className="h-3.5 w-3.5" />
            <span className="min-w-0">
              {" "}
              Employees apply from their portal; HR applies on behalf from{" "}
              <Link href="/emp/leave" className="text-primary underline-offset-2 hover:underline">
                My Workspace → My Leave
              </Link>
              .
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Leave Type</th>
                <th className="p-3 text-left">Date Range</th>
                <th className="p-3 text-left">Days</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Attachment</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((a) => (
                <tr key={a.id} className={`${clickableRow} align-top`} onClick={() => setDetail(a)}>
                  <td className="p-3 font-medium">{a.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{a.employee}</div>
                    <div className="text-muted-foreground text-xs">{a.empId}</div>
                  </td>
                  <td className="p-3">{a.leaveType}</td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {a.from} → {a.to}
                  </td>
                  <td className="p-3">
                    {a.days}
                    {a.status === "Pending" &&
                      (() => {
                        // The full ledger, not the scoped queue — an HOD sees only the rows waiting on them, which left the
                        // employee's other pending requests out of the hold and overstated the balance.
                        const b = balanceFor(a.empId, a.leaveType, allRows);
                        return b && Number.isFinite(b.available) ? (
                          <div
                            className={`text-[11px] ${a.days > b.available + Math.min(a.days, b.pending) ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {b.available + Math.min(a.days, b.pending)} avail.
                          </div>
                        ) : null;
                      })()}
                  </td>
                  <td className="max-w-[220px] p-3">
                    <div>{a.description}</div>
                    {a.decisionReason && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        Note: {a.decisionReason}
                        {a.decidedBy ? ` — ${a.decidedBy}, ${a.decidedOn}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {a.attachment ? (
                      <span className="text-primary inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {a.attachment}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={leaveStatusTone(a.status)}>
                      {a.status}
                    </Badge>
                    {a.status === "Pending" && (
                      <div className="text-muted-foreground mt-1 text-[11px] whitespace-nowrap">
                        Awaiting {leaveStepOf(a).current}
                        {leaveStepOf(a).steps.length > 1
                          ? ` (${leaveStepOf(a).index + 1}/${leaveStepOf(a).steps.length})`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {a.status === "Pending" && !canDecideLeave(a, me).ok ? (
                      <span
                        className="text-muted-foreground text-xs"
                        title={canDecideLeave(a, me).reason}
                      >
                        {canDecideLeave(a, me).reason}
                      </span>
                    ) : a.status === "Pending" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-emerald shadow-premium text-white"
                          onClick={() => {
                            setReason("");
                            setDecision({ row: a, action: "Approved" });
                          }}
                        >
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => {
                            setReason("");
                            setDecision({ row: a, action: "Rejected" });
                          }}
                        >
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-10 text-center text-sm">
                    No leave applications match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision?.action === "Rejected" ? "Reject" : "Approve"} Leave
            </DialogTitle>
            <DialogDescription>
              {decision?.row.employee} · {decision?.row.leaveType} · {decision?.row.from} →{" "}
              {decision?.row.to}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-muted-foreground text-xs font-medium">
              Reason{" "}
              {decision?.action === "Rejected" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision?.action === "Rejected"
                  ? "Why is this leave request being rejected?"
                  : "Optional note for the approval record."
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              disabled={(decision?.action === "Rejected" && !reason.trim()) || submitting}
              className={
                decision?.action === "Rejected"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-gradient-emerald shadow-premium text-white"
              }
              onClick={commit}
            >
              {submitting
                ? "Processing..."
                : `Confirm ${decision?.action === "Rejected" ? "Rejection" : "Approval"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.employee}`}
          subtitle={`${detail.leaveType} · ${detail.from} → ${detail.to} · ${detail.days} day(s)`}
          badges={
            <Badge variant="outline" className={leaveStatusTone(detail.status)}>
              {detail.status}
            </Badge>
          }
          record={detail}
          labels={{
            empId: "Employee ID",
            from: "From date",
            to: "To date",
            dayPart: "Day part",
            reasonCategory: "Reason category",
            contactDuringLeave: "Contact during leave",
            locationDuringLeave: "Location during leave",
            handoverTo: "Handover to",
            handoverNotes: "Handover notes",
            approvalChain: "Approval chain",
            chainStep: "Current step",
            chainLog: "Approval log",
            decisionReason: "Decision note",
            decidedBy: "Decided by",
            decidedOn: "Decided on",
          }}
          sections={[
            {
              title: "Application",
              keys: [
                "id",
                "employee",
                "empId",
                "leaveType",
                "from",
                "to",
                "days",
                "dayPart",
                "appliedOn",
                "appliedBy",
                "status",
              ],
            },
            {
              title: "Reason & details",
              keys: [
                "reasonCategory",
                "description",
                "contactDuringLeave",
                "locationDuringLeave",
                "attachment",
                "documents",
              ],
            },
            { title: "Handover", keys: ["handoverTo", "handoverNotes"] },
            {
              title: "Approval",
              keys: [
                "approvalChain",
                "chainStep",
                "decisionReason",
                "decidedBy",
                "decidedOn",
                "chainLog",
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
