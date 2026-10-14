// -----------------------------------------------------------------------------
// Attendance patterns & pay-as-you-go payroll linkage (UI-only).
//
// A pattern says how many days a month an employee is expected to work and how
// many of their absences are paid before Loss of Pay kicks in. Payroll reads
// the attendance for the period, applies the pattern and turns the result into
// an LOP line on the payslip — which is the link the gap analysis said did not
// exist. This file also owns the per-employee workday override (Priority 2):
// working days, hours/day and the timesheet requirement layered on top of the
// branch default.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { ATTENDANCE, ATTENDANCE_MONTH } from "@/features/attendance/data/attendance-data";
import { leaveApplicationStore } from "@/features/leave/data/leave-data";
import { compOffRedemptionStore } from "@/features/travel/data/compoff-data";
import { tourStore } from "@/features/travel/data/tour-data";
import { activeOrgStore, useActiveOrgId } from "@/features/organization/data/group-data";
import { punchStore, punchHours, halfDayHours } from "@/features/attendance/data/attendance-self";
import {
  EMPLOYEES,
  findEmployee,
  getEmployeeProfile,
} from "@/features/employees/data/employee-directory";

/**
 * @typedef {Object} AttendancePattern
 * @property {string} id
 * @property {string} name
 * @property {number} workingDays - Payable working days in the month the salary is divided over.
 * @property {number} paidLeaveDays - Absences per month that are still paid (built-in paid leave in the pattern).
 * @property {boolean} lopEnabled - Whether absences beyond the paid allowance deduct pay.
 * @property {number} weeklyOffs - Weekly offs are paid; used to explain the calendar → working-days mapping.
 * @property {string} description
 * @property {"Active" | "Draft"} status
 */

export const ATTENDANCE_PATTERNS = [
  {
    id: "PAT-01",
    name: "Staff — 26 days, 4 paid",
    workingDays: 26,
    paidLeaveDays: 4,
    lopEnabled: true,
    weeklyOffs: 4,
    description:
      "Corporate staff: 26 working days with 4 paid absences a month before LOP applies.",
    status: "Active",
  },
  {
    id: "PAT-02",
    name: "Onsite support — 26 days, no paid leave",
    workingDays: 26,
    paidLeaveDays: 0,
    lopEnabled: true,
    weeklyOffs: 4,
    description: "Pay-as-you-go onsite/support staff: every missed working day is a deduction.",
    status: "Active",
  },
  {
    id: "PAT-03",
    name: "Shift — 24 days, 2 paid",
    workingDays: 24,
    paidLeaveDays: 2,
    lopEnabled: true,
    weeklyOffs: 6,
    description: "Rotational plant shifts with 2 paid absences.",
    status: "Active",
  },
  {
    id: "PAT-04",
    name: "Salaried — no LOP",
    workingDays: 22,
    paidLeaveDays: 22,
    lopEnabled: false,
    weeklyOffs: 8,
    description: "Fixed monthly salary; attendance tracked but never deducted.",
    status: "Active",
  },
];

export const patternStore = createPersistentStore("seereon.payroll.patterns", ATTENDANCE_PATTERNS);
export const usePatterns = () => patternStore.use();
export const patternById = (id) =>
  patternStore.get().find((p) => p.id === id) ?? patternStore.get()[0];

export function savePattern(p) {
  patternStore.set((list) =>
    list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p],
  );
}

/* ------------------------------------------------------------------ */
/* Per-employee employment configuration                               */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} WorkdayOverride
 * @property {number} daysPerWeek - Working days per week (branch default is 5).
 * @property {number} hoursPerDay
 * @property {boolean} timesheetRequired
 * @property {string[]} weekOffs
 * @property {string} note
 */

/**
 * @typedef {Object} EmployeeWorkConfig
 * @property {string} empId
 * @property {string} patternId
 * @property {WorkdayOverride | null} workday - null = inherit the branch default.
 * @property {string} updatedOn
 * @property {string} updatedBy
 */

export const BRANCH_WORKDAY_DEFAULT = {
  daysPerWeek: 5,
  hoursPerDay: 8,
  timesheetRequired: true,
  weekOffs: ["Sat", "Sun"],
  note: "Branch default",
};

/** Default pattern by department so onsite/support staff default to pay-as-you-go. */
const defaultPatternFor = (dept) =>
  /support|onsite|field/i.test(dept) ? "PAT-02" : /executive/i.test(dept) ? "PAT-04" : "PAT-01";

const seedConfigs = EMPLOYEES.map((e) => ({
  empId: e.id,
  patternId: defaultPatternFor(e.dept),
  workday: /night|shift/i.test(e.role)
    ? {
        daysPerWeek: 6,
        hoursPerDay: 8,
        timesheetRequired: false,
        weekOffs: ["Sun"],
        note: "Rotational shift roster",
      }
    : null,
  updatedOn: "2026-04-01",
  updatedBy: "HR Setup",
}));

export const workConfigStore = createPersistentStore("seereon.payroll.workconfig", seedConfigs);
export const useWorkConfigs = () => workConfigStore.use();

export function workConfigOf(empId) {
  const list = workConfigStore.get();
  const dept = EMPLOYEES.find((e) => e.id === empId)?.dept ?? "";
  return (
    list.find((c) => c.empId === empId) ?? {
      empId,
      patternId: defaultPatternFor(dept),
      workday: null,
      updatedOn: "—",
      updatedBy: "—",
    }
  );
}

/** Local calendar date (YYYY-MM-DD) — `toISOString()` is UTC and returns yesterday before 05:30 IST. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function saveWorkConfig(next) {
  const stamped = { ...next, updatedOn: localToday() };
  workConfigStore.set((list) =>
    list.some((c) => c.empId === next.empId)
      ? list.map((c) => (c.empId === next.empId ? stamped : c))
      : [...list, stamped],
  );
}

export const effectiveWorkday = (empId) => workConfigOf(empId).workday ?? BRANCH_WORKDAY_DEFAULT;

/* ------------------------------------------------------------------ */
/* Attendance for a pay period → LOP                                     */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} PeriodAttendance
 * @property {string} period
 * @property {number} daysInMonth
 * @property {number} present
 * @property {number} paidLeave
 * @property {number} absent
 * @property {number} weeklyOffs
 * @property {number} holidays
 * @property {"Attendance register" | "Profile summary"} source
 * @property {boolean} locked - Attendance must be locked by HR before payroll can read it as final.
 */

const daysIn = (period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * Attendance lock per entity and period — HR locks the month before payroll picks it up. Keys are `${orgId}:${period}`
 * so one entity locking July no longer locks every other entity in the group; un-prefixed keys are legacy (group-wide).
 */
export const attendanceLockStore = createPersistentStore("seereon.attendance.locks", {
  "ORG-SEEREON:2026-06": { by: "Varen Mishra", on: "2026-07-01" },
  "ORG-SEEREON:2026-05": { by: "Varen Mishra", on: "2026-06-01" },
});
const lockKey = (period, orgId) => `${orgId}:${period}`;
/** The lock map projected onto one entity, keyed by period (the shape the payroll / patterns screens read). */
const locksFor = (all, orgId) => {
  const out = {};
  for (const [k, v] of Object.entries(all)) {
    if (!k.includes(":")) out[k] ??= v;
    else if (k.startsWith(`${orgId}:`)) out[k.slice(orgId.length + 1)] = v;
  }
  return out;
};
export const useAttendanceLocks = () => {
  const all = attendanceLockStore.use();
  const orgId = useActiveOrgId();
  return locksFor(all, orgId);
};
export const isAttendanceLocked = (period, orgId = activeOrgStore.get()) =>
  Boolean(locksFor(attendanceLockStore.get(), orgId)[period]);
export const lockAttendance = (period, by, orgId = activeOrgStore.get()) =>
  attendanceLockStore.set((p) => ({
    ...p,
    [lockKey(period, orgId)]: { by, on: localToday() },
  }));
export const unlockAttendance = (period, orgId = activeOrgStore.get()) =>
  attendanceLockStore.set((p) => {
    const n = { ...p };
    delete n[lockKey(period, orgId)];
    delete n[period];
    return n;
  });
/** Every month (YYYY-MM) a date range touches — a lock check on only the first and last month missed the middle. */
export function monthsBetween(from, to) {
  if (!from || !to || to < from) return [];
  const out = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 240; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= end) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
/** Locked months inside a date range for an entity. */
export const lockedMonthsIn = (from, to, orgId = activeOrgStore.get()) =>
  monthsBetween(from, to).filter((p) => isAttendanceLocked(p, orgId));

/** Org of an employee (for lock checks from employee-side actions). */
export const orgOfEmployee = (empId) => findEmployee(empId)?.orgId ?? activeOrgStore.get();

const liveLeave = () => leaveApplicationStore.get();
/** Approved leave working days (Mon–Fri) that fall inside `period` — a request spanning two months is split between
 *  them instead of being charged entirely to the month it starts in. Half-day requests keep their 0.5. */
const leaveDays = (empId, period, lop) =>
  liveLeave()
    .filter(
      (l) =>
        l.empId === empId &&
        l.status === "Approved" &&
        l.from.slice(0, 7) <= period &&
        l.to.slice(0, 7) >= period &&
        (l.leaveType === "Loss of Pay (LOP)") === lop,
    )
    .reduce((s, l) => {
      if (l.days < 1) return s + (l.from.startsWith(period) ? l.days : 0);
      let n = 0;
      const end = new Date(l.to + "T00:00:00");
      for (const d = new Date(l.from + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (iso.startsWith(period) && d.getDay() !== 0 && d.getDay() !== 6) n++;
      }
      return s + Math.min(n, l.days);
    }, 0);
/** Approved paid leave from the shared list (employee portal / org approvals). */
const approvedLeaveDays = (empId, period) => leaveDays(empId, period, false);
/** Approved Loss-of-Pay requests are unpaid absences by definition. */
const approvedLopDays = (empId, period) => leaveDays(empId, period, true);

export function attendanceForPeriod(empId, period) {
  const dim = daysIn(period);
  const [y, m] = period.split("-").map(Number);
  let weeklyOffs = 0;
  for (let d = 1; d <= dim; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    if (wd === 0 || wd === 6) weeklyOffs++;
  }
  const holidays = m === 8 ? 1 : m === 10 ? 2 : m === 1 ? 1 : 0;
  const locked = isAttendanceLocked(period, orgOfEmployee(empId));

  const reg = ATTENDANCE.find((a) => a.empId === empId);
  if (reg && period === ATTENDANCE_MONTH) {
    let present = 0,
      leave = 0,
      absent = 0;
    // Approved leave is overlaid on the register day-by-day (same rule as the live attendance grid) instead of being
    // added on top of the seeded P/A/L — otherwise a day already marked "P" was counted as present AND as leave/LOP.
    const approved = liveLeave().filter((l) => l.empId === empId && l.status === "Approved");
    for (let d = 1; d <= dim; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      if (wd === 0 || wd === 6) continue;
      const iso = `${period}-${String(d).padStart(2, "0")}`;
      const punched = punchStore
        .get()
        .some(
          (p) =>
            p.empId === empId &&
            p.date === iso &&
            (p.outAt === "" || punchHours(p) >= halfDayHours()),
        );
      const app = approved.find((l) => l.from <= iso && iso <= l.to);
      // Approved tours are on-duty days.
      const onTour = tourStore
        .get()
        .some(
          (t) =>
            (t.status === "Approved" || t.status === "Completed" || t.status === "Closed") &&
            (t.employeeId === empId || (t.travellers ?? []).some((x) => x.id === empId)) &&
            t.startDate <= iso &&
            iso <= t.endDate,
        );
      // A half-day request counts half: the other half is present (or the punch, if any, stands).
      if (app && app.dayPart && app.dayPart !== "Full day") {
        present += 0.5;
        if (app.leaveType === "Loss of Pay (LOP)") absent += 0.5;
        else leave += 0.5;
        continue;
      }
      // An approved comp-off redemption is a paid day off, not an absence (it was read as the seeded mark → LOP risk).
      const compOff = compOffRedemptionStore
        .get()
        .some(
          (c) =>
            c.employeeId === empId &&
            c.status === "Approved" &&
            c.fromDate <= iso &&
            iso <= c.toDate,
        );
      const s = app
        ? app.leaveType === "Loss of Pay (LOP)"
          ? "A"
          : "L"
        : compOff
          ? "L"
          : punched || onTour
            ? "P"
            : reg.days[iso];
      if (s === "P") present++;
      else if (s === "L") leave++;
      else if (s === "A") absent++;
    }
    return {
      period,
      daysInMonth: dim,
      present,
      paidLeave: leave,
      absent,
      weeklyOffs,
      holidays,
      source: "Attendance register",
      locked,
    };
  }

  const prof = getEmployeeProfile(empId).attendance;
  const label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" }) + " " + y;
  const row = prof.monthly.find((r) => r.month === label) ?? prof.monthly.at(-1);
  return {
    period,
    daysInMonth: dim,
    present: row?.present ?? 0,
    paidLeave: (row?.leave ?? 0) + approvedLeaveDays(empId, period),
    absent: (row?.absent ?? 0) + approvedLopDays(empId, period),
    weeklyOffs,
    holidays,
    source: "Profile summary",
    locked,
  };
}

/**
 * @typedef {Object} LopResult
 * @property {AttendancePattern} pattern
 * @property {PeriodAttendance} attendance
 * @property {number} paidAbsences - Absences the pattern pays for.
 * @property {number} lopDays - Absences beyond the pattern → deducted.
 * @property {number} payableDays
 * @property {number} perDayRate
 * @property {number} lopAmount
 * @property {string} explanation
 */

/** Apply the employee's pattern to the period attendance. */
export function computeLop(empId, period, monthlyGross) {
  const pattern = patternById(workConfigOf(empId).patternId);
  const attendance = attendanceForPeriod(empId, period);
  // Approved paid leave (EL / CL / SL, Outdoor Duty, Travel Leave, comp-off) is already charged to its leave balance —
  // it is not an absence. Only unpaid absences (marked absent, approved LOP) are measured against the pattern's paid
  // allowance; adding paidLeave here deducted salary for approved paid leave as well.
  const totalAbsences = attendance.absent;
  const paidAbsences = Math.min(totalAbsences, pattern.paidLeaveDays);
  const lopDays = pattern.lopEnabled ? Math.max(totalAbsences - pattern.paidLeaveDays, 0) : 0;
  const perDayRate = Math.round(monthlyGross / pattern.workingDays);
  const lopAmount = Math.min(lopDays * perDayRate, monthlyGross);
  const payableDays = Math.max(pattern.workingDays - lopDays, 0);
  const explanation = !pattern.lopEnabled
    ? `${pattern.name}: salary is fixed, ${totalAbsences} absence(s) recorded but not deducted.`
    : lopDays === 0
      ? `${totalAbsences} absence(s) within the ${pattern.paidLeaveDays} paid day(s) of "${pattern.name}" — no deduction.`
      : `${totalAbsences} absence(s) − ${pattern.paidLeaveDays} paid = ${lopDays} LOP day(s) × ₹${perDayRate.toLocaleString("en-IN")}/day (gross ÷ ${pattern.workingDays}).`;
  return {
    pattern,
    attendance,
    paidAbsences,
    lopDays,
    payableDays,
    perDayRate,
    lopAmount,
    explanation,
  };
}
