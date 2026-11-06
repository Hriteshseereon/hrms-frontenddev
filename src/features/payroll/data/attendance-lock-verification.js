import { attendanceApi } from "@/api/attendanceApi";
import {
  attendanceLockStore,
  setPayrollAttendanceSnapshot,
  unlockAttendance,
} from "@/features/attendance/data/attendance-pattern";

const listOf = (response) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  return (
    payload?.items ??
    payload?.results ??
    (Array.isArray(payload?.data) ? payload.data : payload?.data?.items) ??
    []
  );
};

const lockForPeriod = (response, period) => {
  const source = response?.locks ?? response?.data?.locks ?? response?.data ?? response ?? {};
  if (Array.isArray(source)) return source.find((item) => item.period === period) ?? null;
  return source?.[period] ?? null;
};

const coveredEmployeeCount = (lock, rows) => {
  const declared = Number(
    lock?.employees_covered ??
      lock?.employeesCovered ??
      lock?.employee_count ??
      lock?.employeeCount,
  );
  if (Number.isFinite(declared)) return declared;
  const ids = new Set(
    rows
      .map(
        (row) =>
          row.employee_id ??
          row.employeeId ??
          row.emp_id ??
          row.empId ??
          row.employee_code ??
          row.id,
      )
      .filter(Boolean)
      .map(String),
  );
  return ids.size || null;
};

/** Read the selected month's authoritative lock and attendance summary from the backend. */
export async function verifyPayrollAttendanceLock({
  period,
  companyId,
  payrollOrgId,
  employees = [],
}) {
  const [locksResult, summaryResult] = await Promise.allSettled([
    attendanceApi.getLocks(companyId),
    attendanceApi.getPayrollSummary(period),
  ]);

  if (summaryResult.status === "fulfilled") {
    setPayrollAttendanceSnapshot(period, listOf(summaryResult.value), employees);
  } else {
    setPayrollAttendanceSnapshot(period, [], employees);
  }

  if (locksResult.status !== "fulfilled") {
    unlockAttendance(period, payrollOrgId);
    throw locksResult.reason;
  }

  const lock = lockForPeriod(locksResult.value, period);
  if (lock) {
    attendanceLockStore.set((current) => ({
      ...current,
      [`${payrollOrgId}:${period}`]: {
        by: lock.by ?? lock.locked_by ?? lock.lockedBy ?? "—",
        on: lock.on ?? lock.locked_at ?? lock.lockedAt ?? "",
      },
    }));
  } else {
    unlockAttendance(period, payrollOrgId);
  }

  const reportRows = summaryResult.status === "fulfilled" ? listOf(summaryResult.value) : [];
  return {
    verified: true,
    locked: Boolean(lock),
    by: lock?.by ?? lock?.locked_by ?? lock?.lockedBy ?? "—",
    on: lock?.on ?? lock?.locked_at ?? lock?.lockedAt ?? "",
    employeesCovered: coveredEmployeeCount(lock, reportRows),
    summaryLoaded: summaryResult.status === "fulfilled",
    summaryError: summaryResult.status === "rejected" ? summaryResult.reason : null,
  };
}

export function formatLockTimestamp(value) {
  if (!value) return "—";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return new Date(`${raw}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" });
  const date = new Date(raw);
  return Number.isNaN(date.valueOf())
    ? raw
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
