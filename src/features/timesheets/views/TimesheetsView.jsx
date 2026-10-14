import { useMemo, useState } from "react";
import { Clock3, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { timesheetStore, setTimesheetStatus } from "@/features/timesheets/data/timesheet-data";
import { useScopedEmployees, useScopedIds } from "@/features/employees/components/CasePieces";
import { EmployeeTimesheetView, YtdReport } from "@/features/timesheets/components/TimesheetViews";
import { exportReportPdf } from "@/lib/export-utils";
import { CalendarRange, BarChart3, Download } from "lucide-react";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useTeamScope } from "@/features/attendance/data/attendance-live";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";

const badgeFor = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/30 bg-gold/10 text-gold";

function OrgTimesheets() {
  const allRows = timesheetStore.use();
  // Tenant scope (as on Claims): only entries of the active entity's employees are listed and approvable.
  const scopedIds = useScopedIds();
  const me = useCurrentUser();
  // Managers / HODs review their own reporting line only (they used to see and approve the whole entity).
  const team = useTeamScope();
  const EMPLOYEES = useScopedEmployees().filter((e) => !team || team.has(e.id));
  const rows = useMemo(
    () => allRows.filter((r) => scopedIds.has(r.empId) && (!team || team.has(r.empId))),
    [allRows, scopedIds, team],
  );
  const [emp, setEmp] = useState("all");
  const [status, setStatus] = useState("Submitted");
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) => (emp === "all" || r.empId === emp) && (status === "all" || r.status === status),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [rows, emp, status],
  );
  // Totals and exports use every matching entry; only the on-screen table is capped (it used to cap the data too,
  // so "Total hours" and the PDF silently covered only the latest 300 entries).
  const ROW_CAP = 300;
  const shown = filtered.slice(0, ROW_CAP);

  const totals = filtered.reduce((s, r) => s + r.hours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clock3 className="text-primary h-6 w-6" /> Timesheets
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Approve or reject submitted entries, review any employee's timesheets by day / week /
          month, and pull the year-to-date report.
        </p>
      </div>

      <Tabs defaultValue="entries">
        <ScrollTabsList>
          <TabsTrigger value="entries">
            <Clock3 className="h-4 w-4" /> Submitted Timesheets
          </TabsTrigger>
          <TabsTrigger value="employee">
            <CalendarRange className="h-4 w-4" /> Employee Timesheets (day / week / month)
          </TabsTrigger>
          <TabsTrigger value="ytd">
            <BarChart3 className="h-4 w-4" /> YTD Report
          </TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="employee" className="pt-4">
          <EmployeeTimesheetView />
        </TabsContent>
        <TabsContent value="ytd" className="pt-4">
          <YtdReport />
        </TabsContent>

        <TabsContent value="entries" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
                <Label className="text-muted-foreground text-xs">Employee</Label>
                <Select value={emp} onValueChange={setEmp}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {EMPLOYEES.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["Draft", "Submitted", "Approved", "Rejected"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="border-border bg-muted/40 rounded-lg border px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Total hours</span>{" "}
                  <span className="font-semibold">{totals.toFixed(2)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!filtered.length}
                  onClick={() => {
                    const ok = exportReportPdf({
                      title: "Submitted timesheets",
                      subtitle: `${filtered.length} entries · ${status === "all" ? "all statuses" : status}`,
                      summary: [
                        { label: "Hours", value: totals.toFixed(1) },
                        {
                          label: "Pending approval",
                          value: String(filtered.filter((r) => r.status === "Submitted").length),
                        },
                      ],
                      columns: [
                        "Employee",
                        "Date",
                        "Project",
                        "Task",
                        "Time",
                        "Hours",
                        "Task status",
                        "Status",
                      ],
                      rows: filtered.map((r) => [
                        r.employee,
                        r.date,
                        r.project ?? "—",
                        r.task,
                        r.start && r.end ? `${r.start}–${r.end}` : "—",
                        r.hours,
                        r.taskStatus,
                        r.status,
                      ]),
                    });
                    toast[ok ? "success" : "error"](
                      ok ? "Report ready — save as PDF" : "Allow pop-ups to download",
                    );
                  }}
                >
                  <Download className="h-4 w-4" /> Report PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Task</th>
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-right">Hours</th>
                    <th className="p-3 text-left">Task status</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {shown.map((r) => (
                    <tr
                      key={r.id}
                      className={`${clickableRow} align-top`}
                      onClick={() => setDetail(r)}
                    >
                      <td className="p-3 font-medium">
                        {r.employee}
                        <div className="text-muted-foreground text-xs font-normal">{r.format}</div>
                      </td>
                      <td className="text-muted-foreground p-3">
                        <span className="whitespace-nowrap">{r.date}</span>
                      </td>
                      <td className="p-3">
                        {r.task}
                        <div className="text-muted-foreground text-xs">{r.description}</div>
                      </td>
                      <td className="text-muted-foreground p-3">
                        {r.start && r.end ? `${r.start} – ${r.end}` : "—"}
                      </td>
                      <td className="p-3 text-right font-semibold">{r.hours}</td>
                      <td className="text-muted-foreground p-3">{r.taskStatus}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={badgeFor(r.status)}>
                          {r.status}
                        </Badge>
                        {r.remarks && (
                          <div className="text-muted-foreground mt-1 text-xs">{r.remarks}</div>
                        )}
                      </td>
                      <td
                        className="p-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === "Submitted" && r.empId === me.id ? (
                          <span className="text-muted-foreground text-xs">
                            Your own entry — approved by your manager
                          </span>
                        ) : r.status === "Submitted" ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setTimesheetStatus(r.id, "Approved");
                                toast.success("Timesheet approved");
                              }}
                            >
                              <Check className="text-primary h-4 w-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setReject(r);
                                setReason("");
                              }}
                            >
                              <X className="text-destructive h-4 w-4" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-muted-foreground p-10 text-center">
                        No timesheets match these filters.
                      </td>
                    </tr>
                  )}
                  {filtered.length > ROW_CAP && (
                    <tr>
                      <td colSpan={8} className="text-muted-foreground p-3 text-center text-xs">
                        Showing the latest {ROW_CAP} of {filtered.length} entries — narrow the
                        employee / status filter to see the rest. Totals and the PDF include all{" "}
                        {filtered.length}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject timesheet</DialogTitle>
            <DialogDescription>
              A reason is required and will be visible to {reject?.employee}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              variant="destructive"
              onClick={() => {
                setTimesheetStatus(reject.id, "Rejected", reason.trim());
                pushAlert({
                  empId: reject.empId,
                  kind: "general",
                  to: "/emp/timesheets",
                  title: `Timesheet for ${reject.date} rejected`,
                  body: `${reject.task} — ${reason.trim()}. Correct and resubmit from My Timesheets.`,
                });
                setReject(null);
                toast.success("Timesheet rejected");
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.employee} · ${detail.date}`}
          subtitle={`${detail.format} · ${detail.task}`}
          badges={
            <Badge variant="outline" className={badgeFor(detail.status)}>
              {detail.status}
            </Badge>
          }
          record={{
            ...detail,
            time: detail.start && detail.end ? `${detail.start} – ${detail.end}` : "—",
          }}
          hide={["start", "end"]}
          labels={{ empId: "Employee ID", taskStatus: "Task status", remarks: "Approver remarks" }}
          sections={[
            {
              title: "Entry",
              keys: ["id", "employee", "empId", "format", "date", "project", "billable"],
            },
            { title: "Work", keys: ["task", "description", "time", "hours", "taskStatus"] },
            { title: "Approval", keys: ["status", "remarks"] },
          ]}
        />
      )}
    </div>
  );
}

export default OrgTimesheets;
