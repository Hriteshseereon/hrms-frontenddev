// ---------------------------------------------------------------------------
// Shift-aware timing: compares a punch's actual in/out time against the
// employee's assigned shift (via their Work Order, falling back to their
// attendance-record shift name) rather than a flat 8-hour assumption.
// Also computes the effective per-day wage used across attendance, penalty
// configuration and payslip screens, so it's one number everywhere.
// ---------------------------------------------------------------------------
import { allShifts } from "@/features/attendance/data/attendance-data";
import { effectiveShiftId } from "@/features/employees/data/work-order-data";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";

/** Grace window before a punch is flagged late-in / early-out. */
export const SHIFT_GRACE_MINUTES = 10;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Resolves the Shift that actually applies to an employee right now. */
export function resolveShiftForEmployee(employeeId, fallbackShiftName) {
  const shiftId = effectiveShiftId(employeeId, fallbackShiftName);
  return allShifts().find((s) => s.id === shiftId) ?? null;
}

/**
 * @typedef {"On Time" | "Late In" | "Early Out" | "Late In & Early Out" | "No Shift Assigned"} ShiftTimingFlag
 */

/** Compares a punch's in/out timestamps against the employee's shift boundaries. */
export function shiftTimingFlag(punch, shift) {
  if (!shift) return { flag: "No Shift Assigned", lateMins: 0, earlyOutMins: 0 };

  const shiftStart = toMinutes(shift.start);
  const shiftEnd = toMinutes(shift.end);
  const inMin = punch.inAt ? toMinutes(punch.inAt) : null;
  const outMin = punch.outAt ? toMinutes(punch.outAt) : null;

  const lateMins = inMin !== null ? Math.max(0, inMin - shiftStart - SHIFT_GRACE_MINUTES) : 0;
  // Night shifts cross midnight (e.g. 22:00 -> 06:00); only compare early-out
  // when the shift doesn't wrap, since a same-day comparison would be wrong.
  const wraps = shiftEnd < shiftStart;
  const earlyOutMins =
    !wraps && outMin !== null ? Math.max(0, shiftEnd - outMin - SHIFT_GRACE_MINUTES) : 0;

  const late = lateMins > 0;
  const early = earlyOutMins > 0;
  const flag =
    late && early ? "Late In & Early Out" : late ? "Late In" : early ? "Early Out" : "On Time";
  return { flag, lateMins, earlyOutMins };
}

export const shiftTimingTone = {
  "On Time": "border-primary/30 bg-primary/10 text-primary",
  "Late In": "border-gold/40 bg-gold/15 text-gold",
  "Early Out": "border-gold/40 bg-gold/15 text-gold",
  "Late In & Early Out": "border-destructive/30 bg-destructive/10 text-destructive",
  "No Shift Assigned": "border-border bg-muted text-muted-foreground",
};

/* ------------------------------- Wages ----------------------------------- */

/** Standard working days used for the per-day wage basis across the product. */
export const STANDARD_WORKING_DAYS_PER_MONTH = 26;

/** Effective daily wage for an employee, derived from their CTC. Same number everywhere it's shown. */
export function dailyWageOf(employeeId, workingDaysPerMonth = STANDARD_WORKING_DAYS_PER_MONTH) {
  const profile = getEmployeeProfile(employeeId);
  const grossMonthly = profile.payroll.ctc / 12;
  return Math.round((grossMonthly / workingDaysPerMonth) * 100) / 100;
}

export function formatDailyWage(employeeId) {
  return `₹\u00A0${dailyWageOf(employeeId).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
