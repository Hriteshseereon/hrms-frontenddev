import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Clock } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { AttendanceLogTab } from "@/features/attendance/components/AttendanceLogTab";
import { WorkOrdersTab } from "@/features/attendance/components/WorkOrdersTab";
import { WorkHoursTab } from "@/features/attendance/components/WorkHoursTab";
import { DailyWagesTab } from "@/features/attendance/components/DailyWagesTab";
import { AttendanceReportTab } from "@/features/attendance/components/AttendanceReportTab";
import { AttendancePayrollLockTab } from "@/features/attendance/components/AttendancePayrollLockTab";
import {
  AttendanceReportApiTab,
  WorkHoursApiTab,
} from "@/features/attendance/components/AttendanceReportApiTabs";
import { EmployeeAttendanceTab } from "@/features/attendance/components/EmployeeAttendanceTab";
import { useSessionStore } from "@/features/auth/data/session-store";
import { can, canOpen, useCurrentUser } from "@/features/auth/data/auth-session";

function AttendancePage() {
  // Shift and penalty configuration is platform administration — Managers only
  // ever see the attendance register for their own reporting line.
  const user = useCurrentUser();
  // Work orders carry billing / PO data — only entity administrators, operations and HR maintain them
  // (HOD, CTO and CFO used to get the full work-order console because the check only excluded Managers).
  const canConfigure = ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR"].includes(user.role);
  // A role granted attendance.lock through the API (e.g. HR Manager on an employee login) counts too.
  const apiLock = useSessionStore(
    (s) => s.isAuthenticated && (s.permissions ?? []).includes("attendance.lock"),
  );
  const canLockAttendance = can(user.role, "attendance.lock") || apiLock;
  // The Master Data link is only useful to roles that can open /org/masters (HOD / CTO cannot — they would hit Access Denied).
  const canOpenMasters = canOpen(user.role, "/org/masters");
  // A real login always reads attendance from the API (a role without access gets the server's 403 message, not
  // sample data); the local team register is only for the signed-out preview.
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const isAdminLogin = apiSession;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clock className="text-primary h-6 w-6" /> Attendance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {canConfigure
            ? "Day, week and month-wise P/A/L register with shift configuration."
            : "Day, week and month-wise P/A/L register for your reporting line."}
        </p>
      </div>

      <Tabs defaultValue="log">
        <ScrollTabsList>
          <TabsTrigger value="log">Attendance</TabsTrigger>
          <TabsTrigger value="report">Attendance Report</TabsTrigger>
          <TabsTrigger value="hours">Work Hours & Overtime</TabsTrigger>
          <TabsTrigger value="wages">Daily Wages</TabsTrigger>
          {canLockAttendance && (
            <TabsTrigger value="payroll-lock">Payroll Attendance Lock</TabsTrigger>
          )}
          {canConfigure && <TabsTrigger value="workorders">Work Orders</TabsTrigger>}
        </ScrollTabsList>
        <TabsContent value="log" className="pt-4">
          {isAdminLogin ? <EmployeeAttendanceTab /> : <AttendanceLogTab />}
        </TabsContent>
        <TabsContent value="report" className="pt-4">
          {apiSession ? <AttendanceReportApiTab /> : <AttendanceReportTab />}
        </TabsContent>
        <TabsContent value="hours" className="pt-4">
          {apiSession ? <WorkHoursApiTab /> : <WorkHoursTab />}
        </TabsContent>
        <TabsContent value="wages" className="pt-4">
          <DailyWagesTab />
        </TabsContent>
        {canLockAttendance && (
          <TabsContent value="payroll-lock" className="pt-4">
            <AttendancePayrollLockTab />
          </TabsContent>
        )}
        {canConfigure && (
          <TabsContent value="workorders" className="pt-4">
            <WorkOrdersTab />
          </TabsContent>
        )}
        {/* {canOpenMasters && (
          <div className="text-muted-foreground pt-3 text-xs">
            Shift management and penalty / overtime rules are configured under{" "}
            <Link
              href={buildHref({ to: "/org/masters", hash: "shifts" })}
              className="text-primary underline"
            >
              Master Data → Attendance &amp; time
            </Link>
            .
          </div>
        )} */}
      </Tabs>
    </div>
  );
}

export default AttendancePage;
