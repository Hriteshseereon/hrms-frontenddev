import { useEffect, useState } from "react";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";

const hasScreenView = (assignedModules, permissions, screenKey) => {
  const screen = (assignedModules ?? [])
    .flatMap((module) => module.submodules ?? [])
    .flatMap((submodule) => submodule.screens ?? [])
    .find((item) => (item.key ?? item.screen_code?.split(".").pop()) === screenKey);
  const permissionSuffix = `.${screenKey}.view`;
  return (
    Boolean(screen?.view) ||
    (permissions ?? []).some((permission) =>
      String(permission).toLowerCase().endsWith(permissionSuffix),
    )
  );
};

function AttendancePage() {
  // Shift and penalty configuration is platform administration — Managers only
  // ever see the attendance register for their own reporting line.
  const user = useCurrentUser();
  // Work orders carry billing / PO data — only entity administrators, operations and HR maintain them
  // (HOD, CTO and CFO used to get the full work-order console because the check only excluded Managers).
  const canConfigure = ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR"].includes(user.role);
  // A real login always reads attendance from the API (a role without access gets the server's 403 message, not
  // sample data); the local team register is only for the signed-out preview.
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const assignedModules = useSessionStore((s) => s.assignedModules);
  const permissions = useSessionStore((s) => s.permissions);
  const isAdminLogin = apiSession;
  const canView = (screenKey) =>
    !apiSession || canConfigure || hasScreenView(assignedModules, permissions, screenKey);
  const canViewLog = canView("attendance-log");
  const canViewReport = canView("attendance-report");
  const canViewHours = canView("work-hours-overtime");
  const canViewWages = canView("daily-wages");
  const canViewPayrollLock = canView("attendance-payroll-lock");
  const canViewWorkOrders =
    !apiSession || canConfigure || hasScreenView(assignedModules, permissions, "attendance-work-orders");
  const allowedTabs = [
    canViewLog && "log",
    canViewReport && "report",
    canViewHours && "hours",
    canViewWages && "wages",
    canViewPayrollLock && "payroll-lock",
    canViewWorkOrders && "workorders",
  ].filter(Boolean);
  const firstAllowedTab = allowedTabs[0];
  const [activeTab, setActiveTab] = useState(firstAllowedTab ?? "log");
  const activeTabAllowed = allowedTabs.includes(activeTab);
  useEffect(() => {
    if (!activeTabAllowed) setActiveTab(firstAllowedTab ?? "log");
  }, [activeTabAllowed, firstAllowedTab]);
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollTabsList>
          {canViewLog && <TabsTrigger value="log">Attendance</TabsTrigger>}
          {canViewReport && <TabsTrigger value="report">Attendance Report</TabsTrigger>}
          {canViewHours && <TabsTrigger value="hours">Work Hours & Overtime</TabsTrigger>}
          {canViewWages && <TabsTrigger value="wages">Daily Wages</TabsTrigger>}
          {canViewPayrollLock && (
            <TabsTrigger value="payroll-lock">Payroll Attendance Lock</TabsTrigger>
          )}
          {canViewWorkOrders && <TabsTrigger value="workorders">Work Orders</TabsTrigger>}
        </ScrollTabsList>
        {canViewLog && (
          <TabsContent value="log" className="pt-4">
            {isAdminLogin ? <EmployeeAttendanceTab canManage={canConfigure} /> : <AttendanceLogTab />}
          </TabsContent>
        )}
        {canViewReport && (
          <TabsContent value="report" className="pt-4">
            {apiSession ? <AttendanceReportApiTab /> : <AttendanceReportTab />}
          </TabsContent>
        )}
        {canViewHours && (
          <TabsContent value="hours" className="pt-4">
            {apiSession ? <WorkHoursApiTab /> : <WorkHoursTab />}
          </TabsContent>
        )}
        {canViewWages && (
          <TabsContent value="wages" className="pt-4">
            <DailyWagesTab />
          </TabsContent>
        )}
        {canViewPayrollLock && (
          <TabsContent value="payroll-lock" className="pt-4">
            <AttendancePayrollLockTab />
          </TabsContent>
        )}
        {canViewWorkOrders && (
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
