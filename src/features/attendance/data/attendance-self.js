// ---------------------------------------------------------------------------
// Self-service attendance marking: manual punches (timestamped in the browser)
// and simulated biometric / geofenced device punches. UI-only.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { isAttendanceLocked, orgOfEmployee } from "@/features/attendance/data/attendance-pattern";
import { leaveApplicationStore } from "@/features/leave/data/leave-data";
import { halfDayPolicyStore } from "@/features/attendance/data/attendance-data";

/**
 * @typedef {"Manual" | "Biometric" | "Geofence"} PunchSource
 */

/**
 * @typedef {Object} Punch
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} date
 * @property {string} inAt
 * @property {string} outAt
 * @property {PunchSource} source
 * @property {string} location
 * @property {string} note
 */

export const SHIFT_HOURS = 8;
export const HALF_DAY_HOURS = 4;
/** Thresholds from Master Data → Work hour policy (the saved policy used to be ignored by every calculation). */
export const halfDayHours = () =>
  Number(halfDayPolicyStore.get()?.minHoursHalfDay) || HALF_DAY_HOURS;
export const fullDayHours = () =>
  Number(halfDayPolicyStore.get()?.minHoursFullDay) || SHIFT_HOURS - 0.5;

export const punchStore = createPersistentStore("seereon.attendance.punches", []);
export const usePunches = () => punchStore.use();

const stamp = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// Local calendar date — `toISOString()` is UTC and dated punches made before 05:30 IST on the previous day,
// while `stamp()` above records the local clock time.
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const punchesOf = (rows, empId) =>
  rows.filter((r) => r.empId === empId).sort((a, b) => b.date.localeCompare(a.date));

/** Longest a punch may stay open across midnight and still be closed by the employee (night shifts). */
export const MAX_OPEN_HOURS = 16;

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const dayDiff = (a, b) =>
  Math.round((+new Date(b + "T00:00:00") - +new Date(a + "T00:00:00")) / 86400000);

/** Minutes a still-open punch has been running (date-aware). */
export const openMinutes = (p, now = new Date()) =>
  dayDiff(p.date, todayIso()) * 1440 + now.getHours() * 60 + now.getMinutes() - minutesOf(p.inAt);

/**
 * An open punch the employee can still close themselves: today's, or a night-shift punch from yesterday that has been
 * open for at most MAX_OPEN_HOURS. Anything older is a missed punch-out that only HR can regularise — it no longer
 * blocks the next punch-in (it used to block it forever, and closing it stamped today's clock on the old date).
 */
export const isClosableOpen = (p, now = new Date()) =>
  !p.outAt && (p.date === todayIso() || openMinutes(p, now) <= MAX_OPEN_HOURS * 60);

export const openPunch = (rows, empId) =>
  rows.find((r) => r.empId === empId && !r.outAt && isClosableOpen(r)) ?? null;
/** Open punches from earlier days that were never closed (missed punch-out) — for HR regularisation. */
export const missedPunchOuts = (rows) => rows.filter((r) => !r.outAt && !isClosableOpen(r));

/** Why a punch cannot be recorded today (locked payroll month / approved full-day leave), or null. */
export function punchBlockReason(empId, date = todayIso()) {
  const month = date.slice(0, 7);
  if (isAttendanceLocked(month, orgOfEmployee(empId)))
    return `Attendance for ${month} is locked for payroll — ask HR to regularise the punch.`;
  const leave = leaveApplicationStore
    .get()
    .find(
      (l) =>
        l.empId === empId &&
        l.status === "Approved" &&
        (!l.dayPart || l.dayPart === "Full day") &&
        l.from <= date &&
        date <= l.to,
    );
  if (leave)
    return `You are on approved ${leave.leaveType} (${leave.id}) today — cancel the leave or ask HR before punching in.`;
  return null;
}

export function markIn(input) {
  if (openPunch(punchStore.get(), input.empId)) return null;
  if (punchBlockReason(input.empId)) return null;
  const rec = {
    id: `PCH-${Date.now().toString(36).toUpperCase()}`,
    empId: input.empId,
    employee: input.employee,
    date: todayIso(),
    inAt: stamp(),
    outAt: "",
    source: input.source,
    location: input.location,
    note: input.note ?? "",
  };
  punchStore.set((p) => [rec, ...p]);
  return rec;
}

export function markOut(empId) {
  const open = openPunch(punchStore.get(), empId);
  if (!open) return null;
  if (isAttendanceLocked(open.date.slice(0, 7), orgOfEmployee(empId))) return null;
  const today = todayIso();
  // Closed on a later day (night shift): keep the out-date so the hours are counted across midnight.
  const closed = { ...open, outAt: stamp(), ...(open.date !== today ? { outDate: today } : {}) };
  punchStore.set((p) => p.map((r) => (r.id === open.id ? closed : r)));
  return closed;
}

export const deletePunch = (id) => punchStore.set((p) => p.filter((r) => r.id !== id));

export function punchHours(p) {
  if (!p.inAt || !p.outAt) return 0;
  let mins = minutesOf(p.outAt) - minutesOf(p.inAt);
  if (p.outDate) mins += dayDiff(p.date, p.outDate) * 1440;
  else if (mins < 0) mins += 24 * 60; // legacy overnight punch without an out-date
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

/* ------------------------------------------------------------------ */
/* HR regularisation (missed punch-out / missed punch / wrong times)    */
/* ------------------------------------------------------------------ */

const validTime = (t) => /^\d{2}:\d{2}$/.test(t ?? "");

/**
 * HR corrects a punch: sets the in / out times (out may fall on the next day for night shifts), records who
 * regularised it and why. Refused in a locked payroll month.
 */
export function regularisePunch(id, { inAt, outAt, nextDay = false, reason }, by) {
  const p = punchStore.get().find((x) => x.id === id);
  if (!p) return { ok: false, message: "Punch not found." };
  if (!reason?.trim()) return { ok: false, message: "A reason is required to regularise a punch." };
  if (!validTime(inAt) || !validTime(outAt))
    return { ok: false, message: "Enter both in and out times (HH:MM)." };
  if (isAttendanceLocked(p.date.slice(0, 7), orgOfEmployee(p.empId)))
    return {
      ok: false,
      message: `Attendance for ${p.date.slice(0, 7)} is locked — unlock it first.`,
    };
  const out = new Date(p.date + "T00:00:00");
  if (nextDay) out.setDate(out.getDate() + 1);
  const outDate = `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, "0")}-${String(out.getDate()).padStart(2, "0")}`;
  const next = { ...p, inAt, outAt, outDate: nextDay ? outDate : undefined };
  const h = punchHours(next);
  if (!(h > 0) || h > 24)
    return { ok: false, message: "Out time must be after in time and within 24 hours." };
  const row = {
    ...next,
    regularisedBy: by.name,
    regularisedOn: todayIso(),
    note: `${p.note ? `${p.note} · ` : ""}[Regularised by ${by.name}: ${reason.trim()}]`,
  };
  punchStore.set((list) => list.map((x) => (x.id === id ? row : x)));
  return { ok: true, message: `Punch ${id} regularised · ${h} h.` };
}

/** HR adds a punch the employee missed entirely (forgot to punch in / device down). */
export function addRegularisedPunch({ empId, employee, date, inAt, outAt, reason }, by) {
  if (!empId || !date) return { ok: false, message: "Choose the employee and the date." };
  if (date > todayIso())
    return { ok: false, message: "A punch cannot be added for a future date." };
  if (!reason?.trim()) return { ok: false, message: "A reason is required." };
  if (!validTime(inAt) || !validTime(outAt))
    return { ok: false, message: "Enter both in and out times (HH:MM)." };
  if (isAttendanceLocked(date.slice(0, 7), orgOfEmployee(empId)))
    return {
      ok: false,
      message: `Attendance for ${date.slice(0, 7)} is locked — unlock it first.`,
    };
  const rec = {
    id: `PCH-${Date.now().toString(36).toUpperCase()}`,
    empId,
    employee,
    date,
    inAt,
    outAt,
    source: "Manual",
    location: "HR regularisation",
    note: `[Added by ${by.name}: ${reason.trim()}]`,
    regularisedBy: by.name,
    regularisedOn: todayIso(),
  };
  const h = punchHours(rec);
  if (!(h > 0)) return { ok: false, message: "Out time must be after in time." };
  punchStore.set((list) => [rec, ...list]);
  return { ok: true, message: `Punch added for ${employee} on ${date} · ${h} h.` };
}

/**
 * @typedef {"In progress" | "Overtime" | "Full Day" | "Short Hours" | "Half Day"} PunchVerdict
 */

export function punchVerdict(p) {
  if (!p.outAt) return "In progress";
  const h = punchHours(p);
  if (h >= Math.max(SHIFT_HOURS, fullDayHours()) + 0.5) return "Overtime";
  if (h >= fullDayHours()) return "Full Day";
  if (h >= halfDayHours()) return "Short Hours";
  return "Half Day";
}

/** Totals for a set of punches — worked, overtime and short hours. */
export function punchTotals(rows) {
  const done = rows.filter((r) => r.outAt);
  const worked = done.reduce((s, r) => s + punchHours(r), 0);
  const overtime = done.reduce((s, r) => s + Math.max(0, punchHours(r) - SHIFT_HOURS), 0);
  const short = done.reduce((s, r) => s + Math.max(0, SHIFT_HOURS - punchHours(r)), 0);
  return {
    days: done.length,
    worked: Math.round(worked * 100) / 100,
    overtime: Math.round(overtime * 100) / 100,
    short: Math.round(short * 100) / 100,
    avg: done.length ? Math.round((worked / done.length) * 100) / 100 : 0,
  };
}

export const BIOMETRIC_DEVICES = [
  { id: "BIO-BLR-01", name: "Bhubaneswar HQ — Main Turnstile", location: "Bhubaneswar HQ · Lobby" },
  {
    id: "BIO-BLR-02",
    name: "Bhubaneswar HQ — 4th Floor",
    location: "Bhubaneswar HQ · Engineering Bay",
  },
  { id: "BIO-MUM-01", name: "Mumbai BKC — Reception", location: "Mumbai BKC" },
  { id: "BIO-PUN-01", name: "Pune Delivery Centre", location: "Pune" },
];
