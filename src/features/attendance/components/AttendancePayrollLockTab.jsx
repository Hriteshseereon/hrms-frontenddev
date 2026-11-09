import { useEffect, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { getEmployees } from "@/api/employeeApi";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { useSessionStore } from "@/features/auth/data/session-store";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { PayrollAttendanceLockPanel } from "@/features/payroll/components/PayrollAttendanceLockPanel";

const allEmployeeRows = (response) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  return (
    payload?.items ??
    payload?.results ??
    (Array.isArray(payload?.data) ? payload.data : payload?.data?.items) ??
    []
  );
};

const currentPeriod = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function AttendancePayrollLockTab() {
  const user = useCurrentUser();
  const orgId = useActiveOrgId();
  const [period, setPeriod] = useState(currentPeriod);
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState("");
  const apiLock = useSessionStore(
    (s) => s.isAuthenticated && (s.permissions ?? []).includes("attendance.lock"),
  );
  const canLock = can(user.role, "attendance.lock") || apiLock;

  useEffect(() => {
    let cancelled = false;
    async function loadAllEmployees() {
      try {
        const all = [];
        let page = 1;
        let total = Infinity;
        while (all.length < total) {
          const response = await getEmployees({ page, limit: 100 });
          const payload = response?.data ?? response;
          const items = allEmployeeRows(response);
          if (!items.length) break;
          all.push(...items);
          const reportedTotal = Number(payload?.total ?? payload?.total_count);
          if (Number.isFinite(reportedTotal) && reportedTotal >= 0) total = reportedTotal;
          if (items.length < 100) break;
          page += 1;
        }
        if (!cancelled) setEmployees(all);
      } catch (error) {
        if (!cancelled)
          setEmployeeError(
            error?.response?.data?.detail ??
              error?.message ??
              "Could not load employees from the API.",
          );
      }
    }
    loadAllEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole className="text-primary h-4 w-4" /> Attendance month
            </div>
            <p className="text-muted-foreground mb-2 text-xs">
              Select the month to review and lock for payroll.
            </p>
            <Input
              type="month"
              value={period}
              onChange={(event) => event.target.value && setPeriod(event.target.value)}
              aria-label="Attendance month for payroll lock"
            />
          </div>
          <div className="text-muted-foreground text-xs">
            {employees.length} employee(s) loaded from the employee API
            {employeeError && <div className="text-destructive mt-1">{employeeError}</div>}
          </div>
        </CardContent>
      </Card>
      <PayrollAttendanceLockPanel
        period={period}
        payrollOrgId={orgId}
        canLock={canLock}
        actorName={user.name}
        employees={employees}
      />
    </div>
  );
}
