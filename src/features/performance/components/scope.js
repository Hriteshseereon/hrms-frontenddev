// Who may see which employees' performance records (reviews, appraisals, PIPs, training assignments).
//   • People-office / CXO roles see every employee of the active entity (or the group for a Super Admin in group view).
//   • An HOD sees their department plus their reporting tree.
//   • A Manager (or anyone else) sees only their own reporting tree (direct + indirect reports).
import { useMemo } from "react";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { useManagerMap } from "@/features/organization/data/manager-data";
import { allReports, useReporting } from "@/features/reports/data/reporting";
import { allUsers } from "@/features/auth/data/auth-session";

/** Roles that see the whole entity's performance data. */
export const PERF_ORG_ROLES = ["SuperAdmin", "Admin", "CEO", "COO", "CTO", "CHRO", "HR"];
/** Roles that run HR-only steps (HR reviews, calibration, HR appraisals). */
export const PERF_HR_ROLES = ["SuperAdmin", "Admin", "CEO", "CHRO", "HR"];

/** Whole reporting subtree of a manager across the three hierarchy sources (manager map, reporting links, user roster). */
export function teamTreeOf(managerId, map) {
  const out = new Set();
  const walk = (id) => {
    const children = [
      ...Object.entries(map)
        .filter(([, m]) => m === id)
        .map(([e]) => e),
      ...allUsers()
        .filter((u) => u.managerId === id)
        .map((u) => u.id),
    ];
    for (const c of children) {
      if (c === managerId || out.has(c)) continue;
      out.add(c);
      walk(c);
    }
  };
  walk(managerId);
  allReports(managerId).forEach((id) => {
    if (id !== managerId) out.add(id);
  });
  return [...out];
}

export function usePerformanceScope() {
  const me = useCurrentUser();
  const employees = useScopedEmployees();
  const map = useManagerMap();
  useReporting();
  return useMemo(() => {
    const orgIds = new Set(employees.map((e) => e.id));
    const orgWide = PERF_ORG_ROLES.includes(me.role);
    const isHr = PERF_HR_ROLES.includes(me.role);
    let visible;
    // Never your own records — an HR user on a PIP / training could otherwise close or certify it themselves.
    if (orgWide) visible = new Set([...orgIds].filter((id) => id !== me.id));
    else {
      const team = new Set(teamTreeOf(me.id, map));
      if (me.role === "HOD")
        employees.forEach((e) => {
          if (e.dept === me.dept) team.add(e.id);
        });
      team.delete(me.id);
      visible = new Set([...team].filter((id) => orgIds.has(id)));
    }
    return { me, orgWide, isHr, orgIds, visible, canSee: (empId) => visible.has(empId) };
  }, [me, employees, map]);
}
