import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/router";
import { Info, Search, Check, X, Paperclip, Download, FileText, RefreshCw } from "lucide-react";
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
import { listLeaveApprovals, decideLeaveApproval } from "@/features/leave/data/leaveApprovalAdapter";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { useScreenActions } from "@/features/auth/data/module-access";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

/**
 * Leave Applications (approver view), two steps:
 *  1. Manager  — GET /leave-approvals,    POST /leave-approvals/{id}/approve | reject
 *  2. HR       — GET /hr-leave-approvals, POST /hr-leave-approvals/{id}/approve | reject
 * A manager's approval passes the request to the HR Manager ("Approved by Manager, Pending at HR Manager");
 * a manager's rejection ends it and HR never sees it. Which buttons show comes from the server
 * (`actions.can_approve` / `can_reject`), so a person only acts on the step that belongs to them.
 */

const leaveStatusTone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Cancelled"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/30 bg-gold/10 text-gold";

const errorText = (err, fallback) => {
  const d = err?.response?.data?.detail;
  if (typeof d === "string" && d) return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return err?.userMessage || fallback;
};

export function LeaveApplicationsTab() {
  const leaveAccess = useScreenActions("leave.leave.leave-requests");
  const canApproveLeave = leaveAccess.can("Approve");
  const canRejectLeave = leaveAccess.can("Reject");
  const canExportLeave = leaveAccess.can("Export");
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | failed
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadState((s) => (s === "ready" ? s : "loading"));
    try {
      const { items } = await listLeaveApprovals();
      setRows(items);
      setLoadState("ready");
    } catch (err) {
      console.error("Could not load leave approvals:", err);
      setLoadState("failed");
      toast.error(errorText(err, "Unable to load leave applications."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      const saved = await decideLeaveApproval(decision.row, decision.action, reason);
      setRows((list) => list.map((r) => (r._apiId === saved._apiId ? saved : r)));
      toast.success(
        decision.action === "Approved"
          ? saved.stage === "hr"
            ? `Leave request ${decision.row.id} approved and sent to the HR Manager`
            : `Leave request ${decision.row.id} approved`
          : `Leave request ${decision.row.id} rejected`,
      );
      setDecision(null);
      setReason("");
    } catch (err) {
      toast.error(errorText(err, "Could not save the decision."));
      // 409 / 404: someone else already decided it — show the real state.
      if ([404, 409].includes(err?.response?.status)) {
        setDecision(null);
        setReason("");
      }
    } finally {
      setSubmitting(false);
      load();
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
            {rows.filter((r) => r.status === "Pending" && r.canApprove).length} awaiting your decision
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={loadState === "loading"}
            onClick={load}
            title="Reload leave applications"
          >
            <RefreshCw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} />
          </Button>
          {canExportLeave && <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportCsv("leave-applications", columns, reportRows);
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>}
          {canExportLeave && <Button size="sm" variant="outline" onClick={downloadPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>}
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
                <tr
                  key={a._apiId ?? a.id}
                  className={`${clickableRow} align-top`}
                  onClick={() => setDetail(a)}
                >
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
                    {a.status === "Pending" && a.available != null && (
                      <div
                        className={`text-[11px] ${a.days > a.available ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {a.available} avail.
                      </div>
                    )}
                  </td>
                  <td className="max-w-[220px] p-3">
                    <div>{a.description}</div>
                    {a.decisionReason && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {a.status === "Cancelled" ? "Withdrawal remark" : "Note"}: {a.decisionReason}
                        {a.decidedOn ? ` — ${a.decidedOn}` : ""}
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
                    {a.status === "Cancelled" && (
                      <div className="text-muted-foreground mt-1 text-[11px] font-medium">
                        Withdrawn by employee
                      </div>
                    )}
                    {a.status !== "Pending" && a.status !== "Cancelled" && a.statusLabel && a.statusLabel !== a.status && (
                      // e.g. "Rejected by Manager", "Approved by HR Manager"
                      <div className="text-muted-foreground mt-1 text-[11px] font-medium">
                        {a.statusLabel}
                      </div>
                    )}
                    {a.status === "Pending" && (a.statusLabel || a.statusNote) && (
                      <div
                        className={`mt-1 text-[11px] ${
                          a.stage === "hr" ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {a.statusLabel || a.statusNote}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {a.status === "Pending" && ((a.canApprove && canApproveLeave) || (a.canReject && canRejectLeave)) ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {a.canApprove && canApproveLeave && (
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
                        )}
                        {a.canReject && canRejectLeave && (
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
                        )}
                      </div>
                    ) : a.status === "Pending" ? (
                      <span className="text-muted-foreground text-xs">
                        {a.actionMessage || "You can't decide this request."}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-10 text-center text-sm">
                    {loadState === "loading"
                      ? "Loading leave applications…"
                      : loadState === "failed"
                        ? "Could not load leave applications. Use the reload button to try again."
                        : term
                          ? "No leave applications match your search."
                          : "No leave applications to review yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!decision} onOpenChange={(o) => !o && !submitting && setDecision(null)}>
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
            <Button variant="outline" disabled={submitting} onClick={() => setDecision(null)}>
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
            appliedOn: "Applied on",
            statusNote: "Current step",
            statusLabel: "Stage",
            decisionReason: "Decision note",
            decidedOn: "Decided on",
            available: "Balance available",
          }}
          sections={[
            {
              title: "Application",
              keys: [
                "id",
                "employee",
                "empId",
                "department",
                "designation",
                "leaveType",
                "from",
                "to",
                "days",
                "available",
                "appliedOn",
                "status",
              ],
            },
            {
              title: "Reason & details",
              keys: ["description", "attachment", "documents"],
            },
            {
              title: "Approval",
              keys: ["statusLabel", "decisionReason", "decidedOn"],
            },
          ]}
        />
      )}
    </div>
  );
}
