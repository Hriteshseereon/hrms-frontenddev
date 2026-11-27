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
import { useScreenAccess, useVisibleTabs } from "@/features/auth/data/module-access";

// Every tab is one screen of the "attendance" module in RBAC_MODULES; it is shown when the login grants View on it
// (admin roles and the signed-out demo are handled by the permission layer).
const ATTENDANCE_TABS = [
  { value: "log", label: "Attendance", screen: "attendance.daily.attendance-log" },
  { value: "report", label: "Attendance Report", screen: "attendance.daily.attendance-report" },
  { value: "hours", label: "Work Hours & Overtime", screen: "attendance.daily.work-hours-overtime" },
  { value: "wages", label: "Daily Wages", screen: "attendance.daily.daily-wages" },
  { value: "payroll-lock", label: "Payroll Attendance Lock", screen: "attendance.daily.attendance-payroll-lock" },
  { value: "workorders", label: "Work Orders", screen: "attendance.daily.attendance-work-orders" },
];

function AttendancePage() {
  // A real login always reads attendance from the API (a role without access gets the server's 403 message, not
  // sample data); the local team register is only for the signed-out preview.
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const tabs = useVisibleTabs(ATTENDANCE_TABS);
  // Punch corrections on the register are an Edit grant on the Attendance screen.
  const canCorrectPunches = useScreenAccess("attendance.daily.attendance-log").can("Edit");
  const [selectedTab, setActiveTab] = useState(tabs.first ?? "log");
  const activeTab = tabs.pick(selectedTab) ?? "log";
  useEffect(() => {
    if (tabs.first && selectedTab !== activeTab) setActiveTab(activeTab);
  }, [selectedTab, activeTab, tabs.first]);

  const content = {
    log: apiSession ? <EmployeeAttendanceTab canManage={canCorrectPunches} /> : <AttendanceLogTab />,
    report: apiSession ? <AttendanceReportApiTab /> : <AttendanceReportTab />,
    hours: apiSession ? <WorkHoursApiTab /> : <WorkHoursTab />,
    wages: <DailyWagesTab />,
    "payroll-lock": <AttendancePayrollLockTab />,
    workorders: <WorkOrdersTab />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clock className="text-primary h-6 w-6" /> Attendance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Day, week and month-wise P/A/L register for the employees in your scope.
        </p>
      </div>

      {tabs.list.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-10 text-center text-sm">
          You do not have access to any Attendance screen. Ask your administrator for permission.
        </div>
      ) : (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollTabsList>
          {tabs.list.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </ScrollTabsList>
        {/* Only the active, permitted tab is mounted, so hidden tabs never fetch or render. */}
        {tabs.has(activeTab) && (
          <TabsContent value={activeTab} className="pt-4">
            {content[activeTab]}
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
      )}
    </div>
  );
}

export default AttendancePage;
