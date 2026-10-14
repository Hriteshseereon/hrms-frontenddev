// ---------------------------------------------------------------------------
// Dashboard notifications — upcoming birthdays, work anniversaries, and
// employees approaching retirement, computed from existing DOB/joining-date
// data. No new data entry needed; this is pure computation over what's
// already on each employee's record.
//
// Retirement age is a fixed default here (58, the common Indian statutory
// norm) rather than a per-organisation setting, since that configuration
// doesn't exist yet — Priority 9 (Retirement Handling) is where a real
// configurable age belongs. When that's built, swap DEFAULT_RETIREMENT_AGE
// for the org's actual setting; every function here already takes it as a
// parameter so that swap won't need touching this file's logic again.
// ---------------------------------------------------------------------------
import { allUsers } from "@/features/auth/data/auth-session";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useNewHires } from "@/features/recruitment/data/hiring-data";

export const DEFAULT_RETIREMENT_AGE = 58;

/**
 * @typedef {Object} PersonBase
 * @property {string} id
 * @property {string} name
 * @property {string} dept
 * @property {string} orgId
 * @property {string} dob
 * @property {string} doj
 */

function fromRoster(u) {
  return {
    id: u.id,
    name: u.name,
    dept: u.dept,
    orgId: u.orgId,
    dob: getEmployeeProfile(u.id).personal.dob,
    doj: u.doj,
  };
}

function fromNewHire(h) {
  return {
    id: h.id,
    name: `${h.firstName} ${h.lastName}`,
    dept: h.dept,
    orgId: h.orgId,
    dob: h.dob || getEmployeeProfile(h.id).personal.dob,
    doj: h.doj,
  };
}

/** Days until the next occurrence of a given month/day, from today. */
function daysUntilNextAnniversary(monthDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), monthDay.month, monthDay.day);
  if (next < today) next = new Date(today.getFullYear() + 1, monthDay.month, monthDay.day);
  return Math.round((+next - +today) / 86_400_000);
}

// "YYYY-MM-DD" parsed as a local calendar date — `new Date("YYYY-MM-DD")` is UTC midnight and lands on the previous
// day in timezones west of UTC; the matching formatter avoids `toISOString()` which does the reverse in IST.
const monthDayOf = (dateStr) => {
  const [, m, d] = dateStr.split("-").map(Number);
  return { month: (m || 1) - 1, day: d || 1 };
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * @typedef {Object} UpcomingBirthday
 * @property {string} id
 * @property {string} name
 * @property {string} dept
 * @property {string} orgId
 * @property {string} date
 * @property {number} daysAway
 * @property {number} turningAge
 */
/**
 * @typedef {Object} UpcomingAnniversary
 * @property {string} id
 * @property {string} name
 * @property {string} dept
 * @property {string} orgId
 * @property {string} date
 * @property {number} daysAway
 * @property {number} years
 */
/**
 * @typedef {Object} UpcomingRetirement
 * @property {string} id
 * @property {string} name
 * @property {string} dept
 * @property {string} orgId
 * @property {string} dob
 * @property {string} retirementDate
 * @property {number} daysAway
 * @property {number} age
 */

/** "YYYY-MM-DD" as a local calendar date (see monthDayOf) — `new Date(dob)` is UTC midnight, a day early west of UTC. */
const localDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

function ageOn(dob, onDate) {
  const birth = localDate(dob);
  let age = onDate.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    onDate.getMonth() > birth.getMonth() ||
    (onDate.getMonth() === birth.getMonth() && onDate.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function allPeople(newHires, orgId) {
  // Every account of the organisation (seeded, issued and invited), not only the Seereon seed roster.
  const accounts = allUsers();
  const rosterIds = new Set(accounts.map((u) => u.id));
  const roster = accounts.filter((u) => !orgId || u.orgId === orgId).map(fromRoster);
  const hires = newHires
    .filter((h) => !rosterIds.has(h.id) && (!orgId || h.orgId === orgId))
    .map(fromNewHire);
  return [...roster, ...hires];
}

export function upcomingBirthdays(people, withinDays = 7) {
  const today = new Date();
  return people
    .map((p) => {
      const daysAway = daysUntilNextAnniversary(monthDayOf(p.dob));
      const birthdayDate = new Date(today);
      birthdayDate.setDate(birthdayDate.getDate() + daysAway);
      return {
        id: p.id,
        name: p.name,
        dept: p.dept,
        orgId: p.orgId,
        date: ymd(birthdayDate),
        daysAway,
        turningAge: ageOn(p.dob, birthdayDate),
      };
    })
    .filter((b) => b.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function upcomingAnniversaries(people, withinDays = 7) {
  const today = new Date();
  return people
    .map((p) => {
      const daysAway = daysUntilNextAnniversary(monthDayOf(p.doj));
      const anniversaryDate = new Date(today);
      anniversaryDate.setDate(anniversaryDate.getDate() + daysAway);
      const years = anniversaryDate.getFullYear() - localDate(p.doj).getFullYear();
      return {
        id: p.id,
        name: p.name,
        dept: p.dept,
        orgId: p.orgId,
        date: ymd(anniversaryDate),
        daysAway,
        years,
      };
    })
    .filter((a) => a.daysAway <= withinDays && a.years > 0)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function upcomingRetirements(
  people,
  retirementAge = DEFAULT_RETIREMENT_AGE,
  withinDays = 90,
) {
  const today = new Date();
  return people
    .map((p) => {
      const birth = localDate(p.dob);
      const retirementDate = new Date(
        birth.getFullYear() + retirementAge,
        birth.getMonth(),
        birth.getDate(),
      );
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const daysAway = Math.round((+retirementDate - +start) / 86_400_000);
      return {
        id: p.id,
        name: p.name,
        dept: p.dept,
        orgId: p.orgId,
        dob: p.dob,
        retirementDate: ymd(retirementDate),
        daysAway,
        age: ageOn(p.dob, today),
      };
    })
    .filter((r) => r.daysAway >= 0 && r.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

/* ------------------------------- Hooks ------------------------------------ */

export function useUpcomingBirthdays(orgId, withinDays = 7) {
  const hires = useNewHires();
  return upcomingBirthdays(allPeople(hires, orgId), withinDays);
}

export function useUpcomingAnniversaries(orgId, withinDays = 7) {
  const hires = useNewHires();
  return upcomingAnniversaries(allPeople(hires, orgId), withinDays);
}

export function useUpcomingRetirements(
  orgId,
  retirementAge = DEFAULT_RETIREMENT_AGE,
  withinDays = 90,
) {
  const hires = useNewHires();
  return upcomingRetirements(allPeople(hires, orgId), retirementAge, withinDays);
}
