import { useState } from "react";
import { Plane, Plus, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelLeaveApplication,
  leaveBalances,
  todayLocal,
  useLeaveApplications,
  LOP_TYPE,
} from "@/features/leave/data/leave-engine";
import { toast } from "sonner";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { LeaveApplyForm } from "@/features/leave/components/LeavePieces";
import { CompOffCard } from "@/features/attendance/components/CompOffCard";

const tone = {
  Pending: "border-gold/40 bg-gold/10 text-gold",
  Approved: "border-primary/30 bg-primary/10 text-primary",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-border bg-muted text-muted-foreground",
};

function EmpLeave() {
  const me = useCurrentEmployee();
  // Shared with the Org Admin Leave module so admin approvals and employee
  // applications always reflect the same list.
  const [allRows] = useLeaveApplications();
  const rows = allRows.filter((a) => a.empId === me.id);
  const balances = leaveBalances(me.id, allRows);
  const [open, setOpen] = useState(false);
  const [openBehalf, setOpenBehalf] = useState(false);
  const [detail, setDetail] = useState(null);
  const user = useCurrentUser();
  const isHr = ["HR", "CHRO", "Admin", "SuperAdmin"].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Plane className="text-primary h-6 w-6" /> My Leave
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Apply for leave, attach documents and track approvals and remaining balance.
          </p>
        </div>
        <div className="flex gap-2">
          {isHr && (
            <Dialog open={openBehalf} onOpenChange={setOpenBehalf}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Apply on behalf of an employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Apply for leave on behalf of an employee</DialogTitle>
                  <DialogDescription>
                    HR raises the request; it follows the leave type's approval chain and appears in
                    the employee's ledger.
                  </DialogDescription>
                </DialogHeader>
                <LeaveApplyForm onDone={() => setOpenBehalf(false)} />
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                <Plus className="h-4 w-4" /> Apply for leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Apply for leave</DialogTitle>
                <DialogDescription>
                  Submitted as {me.name} ({me.id}) — leave type, dates & day part, number of days,
                  reason, supporting documents, contact and handover.
                </DialogDescription>
              </DialogHeader>
              <LeaveApplyForm empId={me.id} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances
          .filter((l) => l.type !== LOP_TYPE)
          .map((l) => (
            <Card key={l.type} className="shadow-card">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{l.type}</span>
                  <Badge variant="outline">{l.available} available</Badge>
                </div>
                <Progress
                  value={l.entitled ? ((l.used + l.pending) / l.entitled) * 100 : 0}
                  className="h-2"
                />

                <div className="text-muted-foreground text-xs">
                  {l.used} used · {l.pending} on hold · {l.entitled} entitled
                </div>
              </CardContent>
            </Card>
          ))}
        <CompOffCard employeeId={me.id} />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="border-border border-b p-4 text-sm font-semibold">My leave requests</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Request</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Dates</th>
                <th className="p-3 text-left">Days</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={clickableRow} onClick={() => setDetail(r)}>
                  <td className="p-3 font-medium">{r.id}</td>
                  <td className="p-3">{r.leaveType}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.from} → {r.to}
                  </td>
                  <td className="p-3">{r.days}</td>
                  <td className="max-w-[280px] p-3">
                    <div className="truncate">{r.description}</div>
                    {r.attachment && (
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Paperclip className="h-3 w-3" />
                        {r.attachment}
                      </div>
                    )}
                    {r.decisionReason && (
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        Reason: {r.decisionReason}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={tone[r.status]}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {/* Pending requests can be withdrawn; approved ones cancelled before they start. */}
                    {r.status === "Pending" ||
                    (r.status === "Approved" && r.from > todayLocal()) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          const verb = r.status === "Pending" ? "Withdraw" : "Cancel";
                          if (!window.confirm(`${verb} leave request ${r.id}?`)) return;
                          const res = cancelLeaveApplication(r.id, user);
                          toast[res.ok ? "success" : "error"](res.message);
                        }}
                      >
                        {r.status === "Pending" ? "Withdraw" : "Cancel"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-8 text-center text-sm">
                    You have no leave requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.leaveType}`}
          subtitle={`${detail.from} → ${detail.to} · ${detail.days} day(s)`}
          badges={
            <Badge variant="outline" className={tone[detail.status]}>
              {detail.status}
            </Badge>
          }
          record={detail}
          hide={["employee", "empId"]}
          labels={{
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
              title: "Request",
              keys: [
                "id",
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

export default EmpLeave;
