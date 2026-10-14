// ---------------------------------------------------------------------------
// Probation tracking — computes each employee's probation end date and
// surfaces upcoming completions to their HOD as an action item, per the
// client's MoM: "Before completion of probation, a trigger email to be sent
// to the concerned HOD." This prototype surfaces it as a dashboard/HOD action
// item (an actual outbound email needs a real mail integration, which is out
// of scope for a UI-only build), but the underlying tracking and
// HOD-targeting logic is real, not mocked.
//
// Only new hires (hiring-data.ts) carry a tracked probationMonths + doj —
// the static rosters (SEEREON_USERS/EMPLOYEES) don't have per-employee
// probation data, so this only tracks people hired through the new Hire
// flow (Priority 8).
// ---------------------------------------------------------------------------
import { allUsers } from "@/features/auth/data/auth-session";
import { useNewHires } from "@/features/recruitment/data/hiring-data";
import { hodOfDepartment, useDepartments } from "@/features/organization/data/dept-data";

/**
 * @typedef {Object} ProbationStatus
 * @property {string} employeeId
 * @property {string} name
 * @property {string} dept
 * @property {string} orgId
 * @property {string} doj
 * @property {number} probationMonths
 * @property {string} probationEndDate
 * @property {number} daysRemaining
 * @property {string} hodName
 * @property {string | null} hodId
 */

/** Calendar-month add clamped to the month end (31 Jan + 1 month = 28/29 Feb, not 3 Mar); null for an invalid date. */
const addMonths = (dateStr, months) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  if (!m) return null;
  const y = +m[1],
    mo = +m[2] - 1 + months,
    day = +m[3];
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mo, Math.min(day, last))).toISOString().slice(0, 10);
};

const daysBetween = (from, to) => Math.round((+new Date(to) - +new Date(from)) / 86_400_000);

/** HOD from the department master first (what every approval routes to), falling back to an HOD-role user of the department. */
function hodForNewHire(h) {
  return (
    hodOfDepartment(h.dept, h.orgId) ??
    allUsers().find((u) => u.orgId === h.orgId && u.dept === h.dept && u.role === "HOD") ??
    null
  );
}

/** Probation status for every tracked new hire still within (or just past) their probation window. */
export function computeProbationStatuses(hires, orgId) {
  const today = new Date().toISOString().slice(0, 10);
  return hires
    .filter(
      (h) =>
        h.probationMonths > 0 &&
        (!orgId || h.orgId === orgId) &&
        addMonths(h.doj, h.probationMonths) !== null,
    )
    .map((h) => {
      // A hire with a malformed joining date used to throw RangeError (toISOString on Invalid Date) and break the dashboard.
      const probationEndDate = addMonths(h.doj, h.probationMonths);
      const hod = hodForNewHire(h);
      return {
        employeeId: h.id,
        name: `${h.firstName} ${h.lastName}`,
        dept: h.dept,
        orgId: h.orgId,
        doj: h.doj,
        probationMonths: h.probationMonths,
        probationEndDate,
        daysRemaining: daysBetween(today, probationEndDate),
        hodName: hod?.name ?? "No HOD assigned",
        hodId: hod?.id ?? null,
      };
    })
    .filter((p) => p.daysRemaining >= -30) // keep recently-lapsed ones visible so nothing silently disappears
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** Reactive hook — every tracked probation for an organisation. */
export function useProbationStatuses(orgId) {
  const hires = useNewHires();
  useDepartments(); // re-evaluate when an HOD is reassigned
  return computeProbationStatuses(hires, orgId);
}

/** Probations completing within N days for an organisation — the dashboard action-item threshold. */
export function useUpcomingProbations(orgId, withinDays = 30) {
  return useProbationStatuses(orgId).filter((p) => p.daysRemaining <= withinDays);
}

/** Probations awaiting a specific HOD's attention, across their organisation. */
export function useProbationsForHod(hodId, withinDays = 30) {
  const hires = useNewHires();
  useDepartments();
  return computeProbationStatuses(hires).filter(
    (p) => p.hodId === hodId && p.daysRemaining <= withinDays,
  );
}
