import {
  listMyLeaveRequests,
  getMyLeaveRequest,
  loadEmployeeLeaveTypes,
  withdrawLeaveRequest,
} from "@/features/leave/data/leaveRequestAdapter";
import { useState, useEffect, useCallback } from "react";
import { Plane, Plus, Paperclip, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LOP_TYPE,
} from "@/features/leave/data/leave-engine";
import { toast } from "sonner";
import {
  RecordDetailDialog,
  clickableRow,
} from "@/components/common/RecordDetail";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { LeaveApplyForm } from "@/features/leave/components/LeavePieces";
import { CompOffCard } from "@/features/attendance/components/CompOffCard";
import { leaveApi } from "@/api/leaveApi";

const tone = {
  Pending: "border-gold/40 bg-gold/10 text-gold",
  Approved: "border-primary/30 bg-primary/10 text-primary",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-border bg-muted text-muted-foreground",
};

function EmpLeave() {
  const me = useCurrentEmployee();

  // Existing backend leave data.
  const [liveBalances, setLiveBalances] = useState(null);
  const [liveRows, setLiveRows] = useState(null);

  // New: leave types configured in Super Admin.
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveTypesError, setLeaveTypesError] = useState(false);

  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [openBehalf, setOpenBehalf] = useState(false);
  const [detail, setDetail] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawRemark, setWithdrawRemark] = useState("");

  const user = useCurrentUser();
  const isHr = ["HR", "CHRO", "Admin", "SuperAdmin"].includes(user.role);

  // const handleOpenDetail = async (r) => {
  //   setDetail(r);

  //   try {
  //     const res = await leaveApi.getApplicationDetail(r.id);

  //     if (res && res.data) {
  //       const a = res.data;

  //       setDetail((prev) => ({
  //         ...prev,
  //         ...a,
  //         id: a.application_code || a.id || prev?.id,
  //         leaveType: a.leave_type || a.leaveType || prev?.leaveType,
  //         from: a.from_date || a.from || prev?.from,
  //         to: a.to_date || a.to || prev?.to,
  //         dayPart: a.day_part || a.dayPart || prev?.dayPart,
  //         reasonCategory:
  //           a.reason_category || a.reasonCategory || prev?.reasonCategory,
  //         contactDuringLeave:
  //           a.contact_during_leave ||
  //           a.contactDuringLeave ||
  //           prev?.contactDuringLeave,
  //         locationDuringLeave:
  //           a.location_during_leave ||
  //           a.locationDuringLeave ||
  //           prev?.locationDuringLeave,
  //         handoverTo: a.handover_to || a.handoverTo || prev?.handoverTo,
  //         handoverNotes:
  //           a.handover_notes || a.handoverNotes || prev?.handoverNotes,
  //         decisionReason:
  //           a.decision_reason || a.decisionReason || prev?.decisionReason,
  //         decidedBy: a.decided_by || a.decidedBy || prev?.decidedBy,
  //         decidedOn: a.decided_on || a.decidedOn || prev?.decidedOn,
  //         chainLog: a.chain_log || a.chainLog || prev?.chainLog,
  //         attachment:
  //           (a.documents && a.documents[0]) ||
  //           a.attachment ||
  //           prev?.attachment,
  //       }));
  //     }
  //   } catch {
  //     // Keep the existing data if the detail API fails.
  //   }
  // };

  // Withdraw a pending request / cancel an upcoming approved one (after the confirm dialog).
  const confirmWithdraw = async () => {
    const r = withdrawTarget;
    if (!r) return;
    const remark = withdrawRemark.trim();
    if (!remark) {
      toast.error("Please enter a remark for withdrawing this leave.");
      return;
    }
    setWithdrawing(true);

    try {
      // POST /leave-requests/{id}/withdraw with the remark (only a Pending request can be withdrawn).
      await withdrawLeaveRequest(r._apiId ?? r.id, remark);
      toast.success(`Leave request ${r.id} withdrawn.`);
    } catch (err) {
      const d = err?.response?.data?.detail;
      const message =
        (typeof d === "string" && d) ||
        (Array.isArray(d) && d[0]?.msg) ||
        err?.userMessage ||
        "Could not withdraw this request.";
      if (err?.response?.status === 409) {
        // Already decided (or already withdrawn) since this page was loaded.
        toast.info(`${message}. Refreshing your requests.`);
      } else {
        toast.error(message);
      }
    } finally {
      setWithdrawing(false);
      setWithdrawTarget(null);
      setWithdrawRemark("");
      fetchLeaveData();
    }
  };

  const handleOpenDetail = async (r) => {
  setDetail(r);

  try {
    const a = await getMyLeaveRequest(r._apiId || r.id);

    setDetail((prev) => ({
      ...prev,
      ...a,
      id: a.id || prev?.id,
      leaveType: a.leaveType || prev?.leaveType,
      from: a.from || prev?.from,
      to: a.to || prev?.to,
      dayPart: a.dayPart || prev?.dayPart,
      reasonCategory: a.reasonCategory || prev?.reasonCategory,
      contactDuringLeave:
        a.contactDuringLeave || prev?.contactDuringLeave,
      locationDuringLeave:
        a.locationDuringLeave || prev?.locationDuringLeave,
      handoverTo: a.handoverTo || prev?.handoverTo,
      handoverNotes: a.handoverNotes || prev?.handoverNotes,
      decisionReason: a.decisionReason || prev?.decisionReason,
      decidedBy: a.decidedBy || prev?.decidedBy,
      decidedOn: a.decidedOn || prev?.decidedOn,
      attachment: a.attachment || prev?.attachment,
      documents: a.documents || prev?.documents,
    }));
  } catch (err) {
    console.error("Could not fetch leave request details:", err);
    toast.error("Could not load leave request details.");
  }
};
  const fetchLeaveData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch the existing employee leave data and Super Admin leave types.
      // Promise.allSettled allows one failed endpoint not to stop the others.
      // const [balRes, appsRes, typesRes] = await Promise.allSettled([
      //   leaveApi.getMyBalances(),
      //   leaveApi.getMyApplications(),
      //   getEmployeeLeaveTypes(),
      // ]);
      const [balRes, appsRes, typesRes] = await Promise.allSettled([
  leaveApi.getMyBalances(),
  listMyLeaveRequests(),
  loadEmployeeLeaveTypes(),
]);

      // Existing balances API.
      if (balRes.status === "fulfilled" && balRes.value) {
        const d = balRes.value.data || balRes.value;

        if (Array.isArray(d)) {
          setLiveBalances(d);
        } else if (Array.isArray(d?.items)) {
          setLiveBalances(d.items);
        }
      }

      // Existing employee applications API.
      // if (appsRes.status === "fulfilled" && appsRes.value) {
      //   const d = appsRes.value.data || appsRes.value;
      //   const list = Array.isArray(d)
      //     ? d
      //     : d?.items || d?.applications || [];

      //   if (Array.isArray(list)) {
      //     const normalized = list.map((a) => ({
      //       ...a,
      //       id: a.application_code || a.id,
      //       leaveType: a.leave_type || a.leaveType,
      //       from: a.from_date || a.from,
      //       to: a.to_date || a.to,
      //       dayPart: a.day_part || a.dayPart || "Full day",
      //       reasonCategory: a.reason_category || a.reasonCategory,
      //       contactDuringLeave:
      //         a.contact_during_leave || a.contactDuringLeave,
      //       locationDuringLeave:
      //         a.location_during_leave || a.locationDuringLeave,
      //       handoverTo: a.handover_to || a.handoverTo,
      //       handoverNotes: a.handover_notes || a.handoverNotes,
      //       decisionReason: a.decision_reason || a.decisionReason,
      //       decidedBy: a.decided_by || a.decidedBy,
      //       decidedOn: a.decided_on || a.decidedOn,
      //       attachment: (a.documents && a.documents[0]) || a.attachment,
      //     }));

      //     setLiveRows(normalized);
      //   }
      // }
      if (appsRes.status === "fulfilled") {
  setLiveRows(appsRes.value);
} else {
  console.warn(
    "Could not fetch employee leave requests:",
    appsRes.reason
  );
}

      // New Super Admin leave types API.
      if (typesRes.status === "fulfilled") {
        setLeaveTypes(typesRes.value || []);
        setLeaveTypesError(false);
      } else {
        console.warn(
          "Could not fetch leave types created in Super Admin:",
          typesRes.reason,
        );
        setLeaveTypesError(true);
      }
    } catch (err) {
      console.warn("Could not fetch leave data from backend:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveData();
  }, [fetchLeaveData]);

  // One balance card per Super Admin leave type (LOP excluded), starting at 0.
  // Used / on hold are counted from the employee's own applications (GET /leave/applications/mine),
  // so they go up as leave is applied and approved. If GET /leave/balances/me returns a line for
  // the type, its figures are used instead. No fallback to the local demo profile.
  const sameKey = (a, b) =>
    String(a ?? "").trim().toLowerCase() !== "" &&
    String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  const isType = (value, t) => sameKey(value, t.name) || sameKey(value, t.code);
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const balances = leaveTypes
    .filter((t) => t.name !== LOP_TYPE && t.code !== "LOP")
    .map((t) => {
      const live = (liveBalances ?? []).find((b) =>
        [b.type, b.leave_type, b.code, b.leave_type_code].some((v) => isType(v, t)),
      );
      const mine = (liveRows ?? []).filter((a) => isType(a.leaveType, t));
      const daysWith = (status) =>
        mine.filter((a) => a.status === status).reduce((s, a) => s + toNum(a.days), 0);

      const used = live ? toNum(live.used) : daysWith("Approved");
      const pending = live ? toNum(live.pending) : daysWith("Pending");
      // Shown exactly as the server has it (the server enforces this balance when applying).
      // Without a live line, use the balance the admin granted (leave_balance), else the yearly days.
      const entitled = live
        ? toNum(live.entitled ?? live.total)
        : toNum(t.leaveBalance ?? t.annual);
      const available =
        live && live.available != null
          ? toNum(live.available)
          : Math.max(0, entitled - used - pending);

      return { type: t.name, key: t.id, used, pending, entitled, available };
    });

  // Only the employee's real requests from GET /leave-requests (no local demo rows).
  const rows = liveRows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Plane className="text-primary h-6 w-6" /> My Leave
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Apply for leave, attach documents and track approvals and remaining
            balance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={fetchLeaveData}
            title="Refresh leave balances, requests, and leave types"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline ml-1.5">Refresh</span>
          </Button>

          {isHr && (
            <Dialog open={openBehalf} onOpenChange={setOpenBehalf}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Apply on behalf of an employee
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    Apply for leave on behalf of an employee
                  </DialogTitle>
                  <DialogDescription>
                    HR raises the request; it follows the leave type&apos;s
                    approval chain and appears in the employee&apos;s ledger.
                  </DialogDescription>
                </DialogHeader>

                <LeaveApplyForm
                  onDone={() => {
                    setOpenBehalf(false);
                    fetchLeaveData();
                  }}
                />
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
                  Submitted as {me.name} — leave type, dates &amp; day
                  part, number of days, reason, supporting documents, contact
                  and handover.
                </DialogDescription>
              </DialogHeader>

              <LeaveApplyForm
                empId={me.id}
                onDone={() => {
                  setOpen(false);
                  fetchLeaveData();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Employee balance cards — one per leave type, starting at 0. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {balances.map((l) => {
          const unlimited = l.available >= 999;
          const pct = l.entitled
            ? Math.min(100, ((l.used + l.pending) / l.entitled) * 100)
            : 0;
          const usedPct = l.entitled
            ? Math.min(100, (l.used / l.entitled) * 100)
            : 0;
          const exhausted = !unlimited && l.available <= 0;
          return (
            <Card
              key={l.key}
              className="shadow-card hover:border-primary/30 transition-colors"
            >
              <CardContent className="space-y-1.5 px-3 py-2.5">
                <div className="text-xs font-semibold">{l.type}</div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-1">
                    <span
                      className={`text-xl leading-none font-bold ${exhausted ? "text-destructive" : "text-foreground"}`}
                    >
                      {unlimited ? "∞" : l.available}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {unlimited ? "no limit" : `of ${l.entitled} left`}
                    </span>
                  </span>
                </div>

                {!unlimited && (
                  <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-gold/60 absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${exhausted ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                )}

                <div className="text-muted-foreground text-[10px]">
                  {l.used} used · {l.pending} on hold
                </div>
              </CardContent>
            </Card>
          );
        })}

        <div className="col-span-full">
          <CompOffCard employeeId={me.id} />
        </div>
      </div>

      {/* Existing employee leave request table — unchanged. */}
      <Card className="shadow-card overflow-hidden">
        <div className="border-border flex items-center justify-between border-b p-4">
          <span className="text-sm font-semibold">My leave requests</span>
          <span className="text-muted-foreground text-xs">
            {rows.length} {rows.length === 1 ? "request" : "requests"}
          </span>
        </div>

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
                <tr
                  key={r.id}
                  className={clickableRow}
                  onClick={() => handleOpenDetail(r)}
                >
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
                        {r.status === "Cancelled" ? "Withdrawal remark" : "Reason"}: {r.decisionReason}
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    <Badge variant="outline" className={tone[r.status]}>
                      {r.status}
                    </Badge>
                    {r.status === "Cancelled" && (
                      <div className="text-muted-foreground mt-1 text-[11px]">Withdrawn by you</div>
                    )}
                  </td>

                  <td
                    className="p-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Only a pending request can be withdrawn. Once it is Approved (or Rejected / Cancelled)
                        the employee just sees the status, with no Cancel option. */}
                    {r.status === "Pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          setWithdrawRemark("");
                          setWithdrawTarget(r);
                        }}
                      >
                        Withdraw
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Closed</span>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground p-8 text-center text-sm"
                  >
                    You have no leave requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => {
          if (!open && !withdrawing) setWithdrawTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw leave request?</DialogTitle>
            <DialogDescription>
              {withdrawTarget
                ? `${withdrawTarget.leaveType} · ${withdrawTarget.from} → ${withdrawTarget.to} (${withdrawTarget.days} day${Number(withdrawTarget.days) === 1 ? "" : "s"}). The request will be closed and the days return to your balance.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-muted-foreground text-xs font-medium">
              Remark <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={4}
              value={withdrawRemark}
              onChange={(e) => setWithdrawRemark(e.target.value)}
              placeholder="Why are you withdrawing this leave?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={withdrawing} onClick={() => setWithdrawTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!withdrawRemark.trim() || withdrawing}
              onClick={confirmWithdraw}
            >
              {withdrawing ? "Withdrawing..." : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing leave request detail dialog — unchanged. */}
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
            {
              title: "Handover",
              keys: ["handoverTo", "handoverNotes"],
            },
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