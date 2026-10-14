// Live attendance register shared by the Attendance tab, the Attendance Report and payroll:
// seeded PAL grid as baseline + employee punches (Present) + approved leave (Leave / LOP) — per tenant.
import { useMemo } from "react";
import {
  ATTENDANCE,
  ATTENDANCE_MONTH,
  WORK_RECORDS,
} from "@/features/attendance/data/attendance-data";
import { usePunches, punchHours, halfDayHours } from "@/features/attendance/data/attendance-self";
import { useLeaveApplications } from "@/features/leave/data/leave-engine";
import { useCompOffRedemptions } from "@/features/travel/data/compoff-data";
import { useTours } from "@/features/travel/data/tour-data";
import { useDirectory, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useManagerMap } from "@/features/organization/data/manager-data";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/**
 * @typedef {AttendanceRow & { dept: string, orgId: string }} LiveAttendanceRow
 */

export const isoFor = (day, month = ATTENDANCE_MONTH) => `${month}-${String(day).padStart(2, "0")}`;
export const daysInMonth = (month) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
export const isWeekend = (iso) => {
  const d = new Date(iso + "T00:00:00").getDay();
  return d === 0 || d === 6;
};
/** Local today / current month (YYYY-MM-DD / YYYY-MM). */
export const todayLocalIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const currentMonth = () => todayLocalIso().slice(0, 7);
/**
 * Months the register can show: the seeded month (kept visible for the demo data) through the current month, newest
 * first. Screens default to the current month instead of the frozen seed month.
 */
export function registerMonths() {
  const out = [];
  let [y, m] = ATTENDANCE_MONTH.split("-").map(Number);
  const cur = currentMonth();
  for (let guard = 0; guard < 60; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= cur) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  if (!out.includes(cur)) out.push(cur);
  return [...new Set(out)].sort().reverse();
}
/** Short label "Oct 2026" for a YYYY-MM month. */
export const monthTitle = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
/** Day-of-month dates of a range that fall inside `month` (local midnight walk). */
const datesOfRangeIn = (from, to, month) => {
  const out = [];
  const end = new Date(to + "T00:00:00");
  for (const d = new Date(from + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (iso.startsWith(month)) out.push(iso);
  }
  return out;
};

/** Working days in the month (Mon–Fri). */
export const workingDaysOf = (month) =>
  Array.from({ length: daysInMonth(month) }, (_, i) => isoFor(i + 1, month)).filter(
    (iso) => !isWeekend(iso),
  ).length;

/**
 * Register for any month (defaults to the seeded month for callers outside the attendance screens, which pass the
 * month the user picked). The seeded P/A/L grid is the baseline for the seeded month only; other months use the
 * generated demo baseline up to today (future days stay unmarked). Approved tours count as on-duty, then punches,
 * approved leave (half days keep a punched day present) and approved comp-off redemptions are overlaid.
 */
export function useLiveAttendance(month = ATTENDANCE_MONTH) {
  const punches = usePunches();
  const [leaveApps] = useLeaveApplications();
  const compOff = useCompOffRedemptions();
  const tours = useTours();
  const directory = useDirectory();
  const inScope = useScopeMatch();
  return useMemo(() => {
    const today = todayLocalIso();
    const dir = directory.filter((e) => inScope(e.orgId, null, e.branch));
    const meta = new Map(directory.map((e) => [e.id, e]));
    const base = new Map();
    if (month === ATTENDANCE_MONTH)
      ATTENDANCE.forEach((r) => {
        const e = meta.get(r.empId);
        if (!e || !inScope(e.orgId, null, e.branch)) return;
        base.set(r.empId, { ...r, days: { ...r.days }, dept: e.dept, orgId: e.orgId });
      });
    dir
      .filter((e) => !base.has(e.id))
      .forEach((e) => {
        const days = {};
        for (let d = 1; d <= daysInMonth(month); d++) {
          const iso = isoFor(d, month);
          if (iso > today) continue; // not happened yet — no mark
          days[iso] = isWeekend(iso)
            ? "P"
            : (d * 7 + e.id.charCodeAt(e.id.length - 1)) % 23 === 0
              ? "A"
              : (d * 3 + e.id.charCodeAt(e.id.length - 2)) % 17 === 0
                ? "L"
                : "P";
        }
        base.set(e.id, {
          empId: e.id,
          name: e.name,
          designation: e.role,
          office: e.branch,
          shift: getEmployeeProfile(e.id).job.shift,
          days,
          dept: e.dept,
          orgId: e.orgId,
        });
      });
    // Approved / completed tours are on-duty days (they used to stay at the baseline mark — an "A" became LOP).
    tours
      .filter((t) => t.status === "Approved" || t.status === "Completed" || t.status === "Closed")
      .forEach((t) =>
        [t.employeeId, ...(t.travellers ?? []).map((x) => x.id)].forEach((id) => {
          const r = base.get(id);
          if (!r) return;
          datesOfRangeIn(t.startDate, t.endDate, month)
            .filter((iso) => !isWeekend(iso) && iso <= today)
            .forEach((iso) => (r.days[iso] = "P"));
        }),
      );
    const punchedDays = new Set();
    punches
      .filter((p) => p.date.startsWith(month))
      .forEach((p) => {
        const r = base.get(p.empId);
        if (r && (p.outAt === "" || punchHours(p) >= halfDayHours())) {
          r.days[p.date] = "P";
          punchedDays.add(`${p.empId}|${p.date}`);
        }
      });
    leaveApps
      .filter((l) => l.status === "Approved")
      .forEach((l) => {
        const r = base.get(l.empId);
        if (!r) return;
        // Walk the range at local midnight and format locally — `new Date("YYYY-MM-DD")` + `toISOString()` mixed UTC and
        // local time and could skip or repeat a day across a DST change / in negative-offset timezones.
        const end = new Date(l.to + "T00:00:00");
        for (const d = new Date(l.from + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (!iso.startsWith(month) || isWeekend(iso)) continue;
          // A half-day request on a day the employee also punched keeps the day present (it used to wipe the punch).
          const half = l.dayPart && l.dayPart !== "Full day";
          if (half && punchedDays.has(`${l.empId}|${iso}`)) continue;
          r.days[iso] = l.leaveType === "Loss of Pay (LOP)" ? "A" : "L";
        }
      });
    // Approved comp-off redemptions are paid leave days (they used to stay "A" / seeded marks in the register).
    compOff
      .filter((c) => c.status === "Approved")
      .forEach((c) => {
        const r = base.get(c.employeeId);
        if (!r) return;
        const end = new Date(c.toDate + "T00:00:00");
        for (const d = new Date(c.fromDate + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (iso.startsWith(month) && !isWeekend(iso)) r.days[iso] = "L";
        }
      });
    return [...base.values()];
  }, [punches, leaveApps, compOff, tours, directory, inScope, month]);
}

export const OT_AFTER_HOURS = 8.5;

/**
 * Reporting-line scope for people managers: a Manager sees everyone under them (transitively) plus themselves; an HOD
 * sees their own department in their entity. Everyone else (HR, admins, CXOs) gets `null` = no team filter.
 */
export function useTeamScope() {
  const user = useCurrentUser();
  const managerMap = useManagerMap();
  const directory = useDirectory();
  return useMemo(() => {
    if (user.role === "Manager") {
      const ids = new Set([user.id]);
      let grew = true;
      while (grew) {
        grew = false;
        Object.entries(managerMap).forEach(([emp, mgr]) => {
          if (ids.has(mgr) && !ids.has(emp)) {
            ids.add(emp);
            grew = true;
          }
        });
      }
      return ids;
    }
    if (user.role === "HOD") {
      return new Set([
        user.id,
        ...directory.filter((e) => e.orgId === user.orgId && e.dept === user.dept).map((e) => e.id),
      ]);
    }
    return null;
  }, [user.role, user.id, user.orgId, user.dept, managerMap, directory]);
}

/** Per-employee monthly summary with attendance %. */
export function summarise(r, month = ATTENDANCE_MONTH) {
  const c = { P: 0, A: 0, L: 0 };
  let working = 0;
  const today = todayLocalIso();
  for (let d = 1; d <= daysInMonth(month); d++) {
    const iso = isoFor(d, month);
    if (isWeekend(iso)) continue;
    // Days that have not happened yet are not absences.
    if (iso > today && !r.days[iso]) continue;
    working++;
    c[r.days[iso] ?? "A"] += 1;
  }
  const late = WORK_RECORDS.filter(
    (w) => w.empId === r.empId && w.date.startsWith(month) && w.lateMins > 0,
  ).length;
  // Overtime starts after 8.5 h/day (rule OTR-01, same threshold as the Work Hours & Overtime tab) — was 9 h here.
  const ot = WORK_RECORDS.filter((w) => w.empId === r.empId && w.date.startsWith(month)).reduce(
    (s, w) => s + Math.max(0, w.worked - OT_AFTER_HOURS),
    0,
  );
  const pct = working ? Math.round((c.P / working) * 1000) / 10 : 0;
  const pctIncLeave = working ? Math.round(((c.P + c.L) / working) * 1000) / 10 : 0;
  return {
    working,
    present: c.P,
    absent: c.A,
    leave: c.L,
    late,
    overtime: +ot.toFixed(1),
    pct,
    pctIncLeave,
  };
}

export const pctTone = (pct) =>
  pct >= 95 ? "text-primary" : pct >= 85 ? "text-gold" : "text-destructive";
