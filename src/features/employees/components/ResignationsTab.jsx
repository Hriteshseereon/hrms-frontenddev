import { useMemo, useState } from "react";
import { Search, Check, X, UserMinus, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { ResignationFormDialog } from "@/features/employees/components/ResignationFormDialog";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { can, useCurrentUser, userById } from "@/features/auth/data/auth-session";
import { useScopedIds } from "@/features/employees/components/CasePieces";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { managerStore } from "@/features/organization/data/manager-data";
import {
  useExitRequests,
  submitResignation,
  managerDecide,
  hrApprove,
  hrReject,
  ACTIVE_STAGES,
  stageTone,
  fmtDate,
  daysBetween,
  todayISO,
  NOTICE_PRESETS,
} from "@/features/exit/data/exit-data";

/**
 * @typedef {{ row: ExitRequest, action: "Approved" | "Rejected" } | null} Decision
 */

/**
 * Org-admin resignations screen. Reads and writes the SAME store as the
 * employee self-service screen (`exit-data.ts`), so a submission on either
 * side is instantly visible on the other.
 */
export function ResignationsTab() {
  // Only the entity in scope — every entity's resignations were listed (and actionable) here.
  const scopedIds = useScopedIds();
  const rows = useExitRequests().filter((r) => scopedIds.has(r.empId));
  const me = useCurrentUser();
  // Manager-stage decisions need exit.manager.decide, HR-stage decisions exit.hr.approve; nobody decides their own exit.
  const canDecide = (r) =>
    r.empId !== me.id &&
    (r.stage === "Manager Review"
      ? // The recorded reporting manager decides; SuperAdmin / Admin / CHRO may act on their behalf.
        can(me.role, "exit.manager.decide") &&
        (r.managerId === me.id || ["SuperAdmin", "Admin", "CHRO"].includes(me.role))
      : r.stage === "HR Review"
        ? // Maker-checker: the HR acceptance comes from someone other than the manager-stage decider.
          can(me.role, "exit.hr.approve") && r.managerDecision?.by !== me.name
        : false);
  const [q, setQ] = useState("");
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("30");
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.id, r.empName, r.empId, r.designation, r.branch, r.reason, r.stage]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [rows, q]);

  const pending = rows.filter(
    (r) => r.stage === "Manager Review" || r.stage === "HR Review",
  ).length;

  const openDecision = (row, action) => {
    setReason("");
    const days = Math.max(15, daysBetween(todayISO(), row.requestedLwd) || 30);
    setNotice(
      String(
        NOTICE_PRESETS.reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a), 30),
      ),
    );
    setDecision({ row, action });
  };

  const commit = () => {
    if (!decision) return;
    const { row, action } = decision;
    const done =
      row.stage === "Manager Review"
        ? managerDecide(row.id, action, me, reason)
        : action === "Approved"
          ? hrApprove(row.id, me, Number(notice), reason)
          : hrReject(row.id, me, reason);
    // The exit engine refuses stale / out-of-stage / own-request decisions — say so instead of claiming success.
    if (done === false) {
      toast.error(
        `Could not record this decision — ${row.empName}'s resignation is no longer at this stage, or it is your own request.`,
      );
      setDecision(null);
      return;
    }
    toast.success(`${row.empName}'s resignation ${action.toLowerCase()}`);
    setDecision(null);
    setReason("");
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search resignations…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <UserMinus className="h-3.5 w-3.5" />
            {pending} pending approval
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Resignation
              </Button>
            </DialogTrigger>
            <ResignationFormDialog
              onSubmit={(r) => {
                if (rows.some((x) => x.empId === r.empId && ACTIVE_STAGES.includes(x.stage))) {
                  toast.error(`${r.employee} already has a resignation in progress.`);
                  return;
                }
                const dir = findEmployee(r.empId);
                const employee = userById(r.empId) ?? {
                  id: r.empId,
                  name: r.employee,
                  email: dir?.email ?? `${r.empId.toLowerCase()}@seereon.co.in`,
                  role: "Employee",
                  designation: r.designation,
                  dept: dir?.dept ?? "—",
                  branch: r.office,
                  phone: dir?.phone ?? "",
                  // No manager on record → the exit engine routes to the company administrator. Falling back to the
                  // person recording it made HR the "manager" of the request they then also decide.
                  managerId: managerStore.get()[r.empId] ?? null,
                  hrPartnerId: null,
                  doj: "",
                  orgId: dir?.orgId ?? me.orgId,
                  portal: "emp",
                };
                submitResignation({
                  employee,
                  reason: r.reason,
                  description: r.description ?? "",
                  requestedLwd: r.lastWorkingDay,
                  document: r.document ?? "",
                });
                setOpenNew(false);
                toast.success(`Resignation recorded for ${r.employee}`);
              }}
            />
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Designation</th>
                <th className="p-3 text-left">Office</th>
                <th className="p-3 text-left">Applied On</th>
                <th className="p-3 text-left">Last Working Day</th>
                <th className="p-3 text-left">Reason</th>
                <th className="p-3 text-left">Stage</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className={`${clickableRow} align-top`} onClick={() => setDetail(r)}>
                  <td className="p-3 font-medium">{r.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">{r.empName}</div>
                    <div className="text-muted-foreground text-xs">{r.empId}</div>
                  </td>
                  <td className="p-3">{r.designation}</td>
                  <td className="text-muted-foreground p-3">{r.branch}</td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">{fmtDate(r.appliedOn)}</span>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    <span className="whitespace-nowrap">
                      {fmtDate(r.noticeEnd ?? r.requestedLwd)}
                    </span>
                  </td>
                  <td className="max-w-[220px] p-3">
                    <div>{r.reason}</div>
                    {r.description && (
                      <div className="text-muted-foreground mt-1 text-xs">{r.description}</div>
                    )}
                    {r.document && <div className="text-primary mt-1 text-xs">{r.document}</div>}
                    {r.managerDecision && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        Manager {r.managerDecision.action.toLowerCase()}:{" "}
                        {r.managerDecision.note || "—"}
                      </div>
                    )}
                    {r.hrDecision && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        HR {r.hrDecision.action.toLowerCase()}: {r.hrDecision.note || "—"}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={stageTone(r.stage)}>
                      {r.stage}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {(r.stage === "Manager Review" || r.stage === "HR Review") && canDecide(r) ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-emerald shadow-premium text-white"
                          onClick={() => openDecision(r, "Approved")}
                        >
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => openDecision(r, "Rejected")}
                        >
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {r.stage === "Manager Review" || r.stage === "HR Review"
                          ? `Awaiting ${r.stage === "Manager Review" ? "manager" : "HR"}`
                          : "No action pending"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-8 text-center text-sm">
                    No resignations found.
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
              {decision?.row.stage === "Manager Review" ? "Manager" : "HR"}{" "}
              {decision?.action === "Rejected" ? "Rejection" : "Approval"}
            </DialogTitle>
            <DialogDescription>
              {decision?.row.empName} · {decision?.row.id} · requested last working day{" "}
              {decision ? fmtDate(decision.row.requestedLwd) : "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {decision?.action === "Approved" && decision.row.stage === "HR Review" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  Notice period (days)
                </Label>
                <Select value={notice} onValueChange={setNotice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTICE_PRESETS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder={
                  decision?.action === "Rejected"
                    ? "Why is this resignation being rejected?"
                    : "Add an approval note for the exit record."
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              className={
                decision?.action === "Rejected"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-gradient-emerald shadow-premium text-white"
              }
              onClick={commit}
            >
              Confirm {decision?.action === "Rejected" ? "Rejection" : "Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.empName}`}
          subtitle={`${detail.designation} · ${detail.dept} · ${detail.branch}`}
          badges={
            <Badge variant="outline" className={stageTone(detail.stage)}>
              {detail.stage}
            </Badge>
          }
          record={detail}
          hide={["managerId"]}
          labels={{
            empId: "Employee ID",
            empName: "Employee",
            dept: "Department",
            branch: "Office",
            requestedLwd: "Requested last working day",
            fnfSettled: "F&F settled",
            fnfRef: "F&F reference",
            exitInterviewDone: "Exit interview done",
            clearanceStartedOn: "Clearance started",
            clearanceCompletedOn: "Clearance completed",
          }}
          sections={[
            {
              title: "Employee",
              keys: ["empId", "empName", "email", "designation", "dept", "branch", "managerName"],
            },
            {
              title: "Resignation",
              keys: [
                "id",
                "appliedOn",
                "reason",
                "description",
                "requestedLwd",
                "document",
                "stage",
              ],
            },
            {
              title: "Decisions",
              keys: ["managerDecision", "hrDecision", "retainedOn", "completedOn"],
            },
            {
              title: "Notice & clearance",
              keys: [
                "noticeDays",
                "noticeStart",
                "noticeEnd",
                "clearanceStartedOn",
                "clearanceCompletedOn",
                "clearances",
                "exitInterviewDone",
                "exitInterview",
                "fnfSettled",
                "fnfRef",
              ],
            },
            { title: "Timeline", keys: ["timeline"] },
          ]}
        />
      )}
    </div>
  );
}
