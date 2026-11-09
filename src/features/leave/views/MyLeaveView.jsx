import {
  listMyLeaveRequests,
  getMyLeaveRequest,
} from "@/features/leave/data/leaveRequestAdapter";
import { useState, useEffect, useCallback } from "react";
import { Plane, Plus, Paperclip, RefreshCw } from "lucide-react";
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
  todayLocal,
  useLeaveApplications,
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
import Employee_leaveRequest from "@/api/leave_request";

// GET /leave-requests/leave-types — the EMPLOYEE leave-type endpoint.
// (GET /leave-types is Super Admin only and returns 403 "Insufficient role" for employees.)
// Works whether the backend returns plain names or full leave-type objects;
// fields the response doesn't include are simply not shown on the cards.
async function loadEmployeeLeaveTypes() {
  const res = await Employee_leaveRequest.getLeaveTypes();

  let d = res?.data ?? res;
  if (d?.data != null) d = d.data;

  const list = Array.isArray(d)
    ? d
    : d?.items ?? d?.results ?? d?.leave_types ?? [];

  const seen = new Set();

  return list
    .map((o) => {
      if (typeof o === "string") {
        return { id: o, name: o.trim(), code: "", paid: null, annual: null };
      }

      const annual = Number(o?.annual_days ?? o?.annual);

      return {
        id: String(o?.id ?? o?.code ?? o?.name ?? o?.value ?? o?.label ?? ""),
        name: String(o?.name ?? o?.label ?? o?.value ?? "").trim(),
        code: o?.code ?? "",
        paid: o?.paid_leave ?? o?.paid ?? null,
        annual: Number.isFinite(annual) ? annual : null,
        creditFrequency: o?.credit ?? o?.credit_frequency ?? "",
        applicableTo: o?.applicable_to ?? "",
        active: o?.active,
      };
    })
    .filter((t) => {
      if (!t.name || t.active === false) return false;
      const key = t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const tone = {
  Pending: "border-gold/40 bg-gold/10 text-gold",
  Approved: "border-primary/30 bg-primary/10 text-primary",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-border bg-muted text-muted-foreground",
};

function EmpLeave() {
  const me = useCurrentEmployee();

  // Existing local leave data.
  const [allRows] = useLeaveApplications();
  const localRows = allRows.filter((a) => a.empId === me.id);

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
      const entitled = live ? toNum(live.entitled ?? live.total) : 0;
      const available =
        live && live.available != null
          ? toNum(live.available)
          : Math.max(0, entitled - used - pending);

      return { type: t.name, key: t.id, used, pending, entitled, available };
    });

  const rows =
    liveRows && liveRows.length > 0
      ? liveRows
      : localRows;

  return (
    <div className="space-y-6">
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

      {/* New section: Leave types configured by Super Admin. */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Leave types</h2>
          <p className="text-muted-foreground text-xs">
            Leave types configured by your organization.
          </p>
        </div>

        {leaveTypesError && leaveTypes.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Could not load leave types. Please refresh or check your employee
            login permissions.
          </p>
        )}

        {!leaveTypesError && leaveTypes.length === 0 && loading && (
          <p className="text-muted-foreground text-sm">
            Loading leave types...
          </p>
        )}

        {!leaveTypesError && leaveTypes.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">
            No active leave types have been configured yet.
          </p>
        )}

        {leaveTypes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leaveTypes.map((leaveType) => (
              <Card key={leaveType.id} className="shadow-card">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {leaveType.name}
                    </span>

                    {leaveType.paid != null && (
                      <Badge variant="outline">
                        {leaveType.paid ? "Paid" : "Unpaid"}
                      </Badge>
                    )}
                  </div>

                  {leaveType.code && (
                    <div className="text-muted-foreground text-xs">
                      Code: {leaveType.code}
                    </div>
                  )}

                  {leaveType.annual != null && (
                    <div className="text-muted-foreground text-xs">
                      Annual entitlement: {leaveType.annual} day(s)
                    </div>
                  )}

                  {leaveType.creditFrequency && (
                    <div className="text-muted-foreground text-xs">
                      Credit: {leaveType.creditFrequency}
                    </div>
                  )}

                  {leaveType.applicableTo && (
                    <div className="text-muted-foreground text-xs">
                      Applicable to: {leaveType.applicableTo}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Employee balance cards — one per leave type, starting at 0. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances
          .map((l) => (
            <Card key={l.key} className="shadow-card">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{l.type}</span>
                  <Badge variant="outline">
                    {l.available} available
                  </Badge>
                </div>

                <Progress
                  value={
                    l.entitled
                      ? ((l.used + l.pending) / l.entitled) * 100
                      : 0
                  }
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

      {/* Existing employee leave request table — unchanged. */}
      <Card className="shadow-card overflow-hidden">
        <div className="border-border border-b p-4 text-sm font-semibold">
          My leave requests
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
                        Reason: {r.decisionReason}
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    <Badge variant="outline" className={tone[r.status]}>
                      {r.status}
                    </Badge>
                  </td>

                  <td
                    className="p-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.status === "Pending" ||
                    (r.status === "Approved" && r.from > todayLocal()) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={async () => {
                          const verb =
                            r.status === "Pending" ? "Withdraw" : "Cancel";

                          if (
                            !window.confirm(
                              `${verb} leave request ${r.id}?`,
                            )
                          ) {
                            return;
                          }

                          try {
                            const res = await leaveApi.cancelApplication(r.id);

                            toast.success(
                              res?.message || `${verb} successful`,
                            );

                            fetchLeaveData();
                          } catch (err) {
                            const res = cancelLeaveApplication(r.id, user);

                            toast[res.ok ? "success" : "error"](res.message);

                            fetchLeaveData();
                          }
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