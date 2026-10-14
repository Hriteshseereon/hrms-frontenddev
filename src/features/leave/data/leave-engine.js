// -----------------------------------------------------------------------------
// Leave engine (UI-only). One place for the rules that used to be scattered:
//   • balances are DERIVED: entitlement − opening usage − approved requests in
//     the shared list, with pending requests shown as "on hold";
//   • an application is validated before it is submitted (dates, overlap,
//     balance, per-type limits, attachments);
//   • approvals re-check the balance and record who decided and when;
//   • payroll (attendance-pattern.ts) reads the SAME list so an approved
//     Loss-of-Pay request becomes an LOP day and an approved paid leave does not.
// -----------------------------------------------------------------------------
import { LEAVE_APPLICATIONS, leaveApplicationStore } from "@/features/leave/data/leave-data";
import { findEmployee, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import {
  creditedToDate,
  holidayCalendarStore,
  holidaysForBranch,
  leaveMasterStore,
  leavePolicyStore,
} from "@/features/organization/data/hr-masters";
import { lockedMonthsIn, orgOfEmployee } from "@/features/attendance/data/attendance-pattern";
import { compOffRedemptionStore } from "@/features/travel/data/compoff-data";
import { tourStore } from "@/features/travel/data/tour-data";
import { managerStore } from "@/features/organization/data/manager-data";
import { hodForEmployee } from "@/features/organization/data/dept-data";
import { resolveApprover } from "@/features/administration/data/approval-chain";
import { userById } from "@/features/auth/data/auth-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";

export const LEAVE_KEY = "leave-applications";
export const LEAVE_TYPES_KEY = "leave-types";
export const LOP_TYPE = "Loss of Pay (LOP)";
/**
 * Comp-off has its own accrual ledger and HOD-approved redemption (Comp-off card). It is not applied through the leave
 * form — a "Comp Off" leave line from the profile was a second, unrelated balance that never touched the ledger.
 */
export const COMP_OFF_TYPE = "Comp Off";
const isCompOffType = (name) =>
  name === COMP_OFF_TYPE || leaveMasterStore.get().some((m) => m.name === name && m.code === "CO");
/** "Female employees" / "Male employees" master rows only apply to that gender (unknown gender: shown). */
const appliesToGender = (applicableTo, gender) => {
  const want = /female/i.test(applicableTo ?? "")
    ? "female"
    : /male/i.test(applicableTo ?? "")
      ? "male"
      : null;
  return !want || !gender || gender.toLowerCase() === want;
};
/** Statuses that no longer hold dates or balance. */
export const CLOSED_LEAVE_STATUSES = ["Rejected", "Cancelled"];
const isLive = (a) => !CLOSED_LEAVE_STATUSES.includes(a.status);

/** Same `[rows, setRows]` shape as before, now backed by the persisted store (survives reloads and portal switches). */
export const useLeaveApplications = () => [leaveApplicationStore.use(), leaveApplicationStore.set];
export const readLeaveApplications = () => leaveApplicationStore.get();
/** Leave types are derived from the Leave Master (Master Data) — one source for the apply form, validation and reports. */
export const leaveTypesFromMaster = () =>
  leaveMasterStore.get().map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    maxDays: r.maxConsecutive || (r.annual > 0 ? r.annual : 30),
    description: `${r.paid ? "Paid" : "Unpaid"} · ${r.creditFrequency}${r.approvalChain ? ` · approval ${r.approvalChain}` : ""}`,
    status: r.active ? "Active" : "Draft",
  }));
export const useLeaveTypes = () => {
  leaveMasterStore.use();
  return [leaveTypesFromMaster(), () => {}];
};
/** Leave types an employee can apply for through the leave form (comp-off is redeemed from its own ledger). */
export const applicableLeaveTypes = (types) => types.filter((t) => !isCompOffType(t.name));

// Seeded applications that were already decided are baked into the profile's opening usage. Seeded *pending*
// requests behave like live ones: on hold while pending, deducted once approved.
const SEED_IDS = new Set(LEAVE_APPLICATIONS.filter((l) => l.status !== "Pending").map((l) => l.id));

/** Parse an ISO date at local midnight so `getDay()` is the calendar weekday in every timezone (a bare "YYYY-MM-DD" parses as UTC). */
const localDate = (iso) => new Date(iso + "T00:00:00");
/** Local YYYY-MM-DD (never `toISOString()`, which is UTC and shifts IST dates back a day before 05:30). */
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayLocal = () => isoLocal(new Date());
const shiftIso = (iso, n) => {
  const d = localDate(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};

/** Days between two ISO dates excluding weekly offs (Sat/Sun) and any `holidays` (ISO dates) given. */
export function workingDaysBetween(from, to, holidays = []) {
  if (!from || !to) return 0;
  const a = localDate(from),
    b = localDate(to);
  if (b < a) return 0;
  const hol = new Set(holidays);
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6 && !hol.has(isoLocal(d))) n++;
  }
  return n;
}

/** Paid holidays (National + State calendars; optional / restricted ones are not days off) for an employee's branch. */
export function paidHolidaysFor(empId) {
  const branch = getEmployeeProfile(empId).job.location;
  const cals = holidayCalendarStore.get().filter(
    (c) =>
      c.active &&
      c.type !== "Optional / Restricted" &&
      (!c.appliesTo ||
        c.appliesTo
          .split(",")
          .map((x) => x.trim())
          .includes(branch)),
  );
  return cals.flatMap((c) => c.holidays.map((h) => h.date));
}

/** Chargeable leave days for a request: working days minus paid holidays; a half-day part counts 0.5 on the first day. */
export function leaveDaysFor(empId, from, to, dayPart = "Full day") {
  const raw = workingDaysBetween(from, to, empId ? paidHolidaysFor(empId) : []);
  if (!raw || dayPart === "Full day" || !dayPart) return raw;
  return raw - 0.5;
}

/**
 * @typedef {Object} LeaveBalanceLine
 * @property {string} type
 * @property {number} entitled
 * @property {number} used
 * @property {number} pending
 * @property {number} available
 */

/**
 * Entitlement and opening usage come from the employee's profile (the seeded
 * ledger); approved / pending applications created in this session are added
 * on top so both portals always agree.
 */
export function leaveBalances(empId, apps = readLeaveApplications()) {
  const profile = getEmployeeProfile(empId);
  const base = profile.leave;
  const master = leaveMasterStore.get();
  const mine = apps.filter((a) => a.empId === empId && !SEED_IDS.has(a.id));
  // Every entitled type in the Leave Master gets a line (Paternity / Maternity had none, so their balance was never
  // checked and could be applied for again and again). The profile's "Comp Off" line is dropped — see COMP_OFF_TYPE.
  const extra = master
    .filter(
      (m) =>
        m.active &&
        m.annual > 0 &&
        m.name !== LOP_TYPE &&
        !isCompOffType(m.name) &&
        !base.some((l) => l.type === m.name) &&
        appliesToGender(m.applicableTo, profile.personal?.gender),
    )
    .map((m) => ({ type: m.name, used: 0, total: m.annual }));
  const lines = [...base.filter((l) => !isCompOffType(l.type)), ...extra].map((l0) => {
    // Entitlement = credit-to-date per the Leave Master (quarterly pro-rata etc.), not the whole year upfront.
    const rule = master.find((m) => m.name === l0.type && m.active);
    // The profile's opening usage is a full-year figure; entitlement is credited to date (pro-rata). Scale the opening
    // usage by the same credited fraction — comparing a full-year "used" against a half-year credit showed most
    // employees overdrawn (e.g. 10 used of 9 credited → −1 EL) and blocked every EL / CL application.
    const credited =
      rule && rule.annual > 0 ? creditedToDate(rule, profile.job.dateOfJoining) : null;
    const l =
      rule && credited !== null
        ? {
            ...l0,
            total: credited + (rule.carryForward ? Math.max(l0.total - rule.annual, 0) : 0),
            used: Math.round(l0.used * Math.min(1, credited / rule.annual) * 2) / 2,
          }
        : l0;
    const approved = mine
      .filter((a) => a.leaveType === l.type && a.status === "Approved")
      .reduce((s, a) => s + a.days, 0);
    const pending = mine
      .filter((a) => a.leaveType === l.type && a.status === "Pending")
      .reduce((s, a) => s + a.days, 0);
    const used = l.used + approved;
    return {
      type: l.type,
      entitled: l.total,
      used,
      pending,
      // Negative = over-drawn (recovered in F&F per item 21).
      available: +(l.total - used - pending).toFixed(2),
    };
  });
  const lop = mine.filter((a) => a.leaveType === LOP_TYPE);
  lines.push({
    type: LOP_TYPE,
    entitled: 0,
    used: lop.filter((a) => a.status === "Approved").reduce((s, a) => s + a.days, 0),
    pending: lop.filter((a) => a.status === "Pending").reduce((s, a) => s + a.days, 0),
    available: Infinity,
  });
  return lines;
}

export const balanceFor = (empId, type, apps) =>
  leaveBalances(empId, apps).find((l) => l.type === type);

/**
 * @typedef {Object} LeaveValidation
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {number} days
 */

export function validateLeaveApplication(
  empId,
  input,
  apps = readLeaveApplications(),
  types = leaveTypesFromMaster(),
) {
  const errors = [],
    warnings = [];
  const days = leaveDaysFor(empId, input.from, input.to, input.dayPart);
  if (!input.leaveType) errors.push("Choose a leave type.");
  if (input.leaveType && isCompOffType(input.leaveType))
    errors.push(
      "Comp-off is redeemed from the Comp-off card (it uses your accrued comp-off ledger).",
    );
  if (
    input.dayPart &&
    input.dayPart !== "Full day" &&
    input.from &&
    input.to &&
    input.from !== input.to
  )
    errors.push(
      "A half day must start and end on the same date — apply the other days as a full-day request.",
    );
  if (!input.from || !input.to) errors.push("Both dates are required.");
  else if (input.to < input.from) errors.push("The end date is before the start date.");
  else if (days === 0) errors.push("The selected range falls entirely on weekly offs / holidays.");
  if (input.from && input.to && input.to >= input.from) {
    const locked = lockedMonthsIn(input.from, input.to, orgOfEmployee(empId));
    if (locked.length)
      errors.push(
        `Attendance for ${locked.join(", ")} is locked for payroll — ask HR to unlock the month or regularise it.`,
      );
    const span = (+localDate(input.to) - +localDate(input.from)) / 86400000;
    if (span > 366) errors.push("A single request cannot span more than a year.");
  }
  const type = types.find((t) => t.name === input.leaveType);
  if (input.leaveType && !type) errors.push("This leave type is no longer available.");
  if (type && type.status !== "Active") errors.push(`${type.name} is not active.`);
  if (type && days > type.maxDays)
    errors.push(`${type.name} allows at most ${type.maxDays} days per request.`);
  if (type?.name === "Casual Leave" && days > 3)
    errors.push("Casual leave cannot exceed 3 consecutive working days.");
  if (type?.name === "Sick Leave" && days > 2 && !input.attachment)
    errors.push("Sick leave beyond 2 days needs a medical certificate attached.");
  if (input.from) {
    // Whole calendar days between the start date and today (both at local midnight) — comparing against `Date.now()`
    // flagged a request starting *today* as back-dated.
    const ageDays = Math.round((+localDate(todayLocal()) - +localDate(input.from)) / 86400000);
    if (ageDays > 7)
      errors.push(
        "Back-dated requests are limited to the last 7 days — contact HR for regularisation.",
      );
    if (ageDays > 0 && ageDays <= 7)
      warnings.push("This is a back-dated request; your manager will see it flagged.");
  }
  const overlap = apps.filter(
    (a) =>
      a.empId === empId &&
      isLive(a) &&
      input.from &&
      input.to &&
      a.from <= input.to &&
      a.to >= input.from,
  );
  if (overlap.length)
    errors.push(
      `Overlaps with ${overlap.map((o) => `${o.id} (${o.from} → ${o.to}, ${o.status.toLowerCase()})`).join(", ")}.`,
    );
  // Cross-module clashes: a comp-off redemption or a tour already covers these dates.
  if (input.from && input.to && input.to >= input.from) {
    const co = compOffRedemptionStore
      .get()
      .find(
        (c) =>
          c.employeeId === empId &&
          c.status !== "Rejected" &&
          c.fromDate <= input.to &&
          c.toDate >= input.from,
      );
    if (co) errors.push(`Overlaps with comp-off ${co.id} (${co.fromDate} → ${co.toDate}).`);
    const onDuty =
      input.leaveType === "Outdoor Duty" || input.leaveType === "Travel Leave (on tour)";
    const tour = onDuty
      ? null
      : tourStore
          .get()
          .find(
            (t) =>
              ["Pending Approval", "Approved", "Completed", "Closed"].includes(t.status) &&
              (t.employeeId === empId || (t.travellers ?? []).some((x) => x.id === empId)) &&
              t.startDate <= input.to &&
              t.endDate >= input.from,
          );
    if (tour)
      errors.push(
        `Overlaps with tour ${tour.id} (${tour.startDate} → ${tour.endDate}) — use Travel Leave (on tour) for leave during a tour.`,
      );
  }
  const bal = balanceFor(empId, input.leaveType, apps);
  if (
    type &&
    type.name !== LOP_TYPE &&
    bal &&
    days > bal.available &&
    !(type.name === "Outdoor Duty" || type.name === "Travel Leave (on tour)")
  ) {
    errors.push(
      `Only ${bal.available} ${type.name} day(s) available (${bal.pending} on hold in pending requests). Apply the excess as Loss of Pay.`,
    );
  }
  if (type?.name === LOP_TYPE)
    warnings.push(`${days} day(s) will be deducted from salary in the payroll month they fall in.`);
  // Q3 — clubbing rules from Master Data → Leave policy.
  const policy = leavePolicyStore.get();
  if (input.from && input.to && (type?.name === "Casual Leave" || type?.name === "Sick Leave")) {
    const branch = getEmployeeProfile(empId).job.location;
    const hol = holidaysForBranch(branch).map((h) => h.date);
    const adj = [shiftIso(input.from, -1), shiftIso(input.to, 1)];
    const touchesHoliday = adj.some(
      (d) => hol.includes(d) || [0, 6].includes(localDate(d).getDay()),
    );
    const touchesEL = apps.some(
      (a) =>
        a.empId === empId &&
        isLive(a) &&
        a.leaveType === "Earned Leave" &&
        adj.some((d) => d >= a.from && d <= a.to),
    );
    if (touchesHoliday && !policy.allowClubSLCLWithHoliday)
      errors.push(`${type.name} cannot be clubbed with a holiday / weekly off (Leave policy).`);
    if (touchesEL && !policy.allowClubSLCLWithEL)
      errors.push(`${type.name} cannot be clubbed with Earned Leave (Leave policy).`);
    if (touchesHoliday && policy.allowClubSLCLWithHoliday)
      warnings.push("Clubbed with a holiday / weekly off — allowed by policy.");
  }
  const rule = leaveMasterStore.get().find((m) => m.name === input.leaveType);
  if (rule && rule.maxConsecutive > 0 && days > rule.maxConsecutive)
    errors.push(
      `${rule.name} allows at most ${rule.maxConsecutive} consecutive days (Leave Master).`,
    );
  if (rule?.needsAttachment && rule.attachmentAfterDays === 0 && !input.attachment)
    errors.push(`${rule.name} requires a supporting document (tour approval / certificate).`);
  if (rule && rule.approvalChain.includes("→"))
    warnings.push(`Approval workflow: ${rule.approvalChain}.`);
  return { ok: errors.length === 0, errors, warnings, days };
}

/** Approval-time re-check: the balance may have been consumed by another request approved first. */
export function validateApproval(app, apps = readLeaveApplications()) {
  if (app.status !== "Pending")
    return { ok: false, reason: `Already ${app.status.toLowerCase()}.` };
  const locked = lockedMonthsIn(app.from, app.to, orgOfEmployee(app.empId));
  if (locked.length)
    return {
      ok: false,
      reason: `Attendance for ${locked.join(", ")} is locked for payroll — unlock the month before approving.`,
    };
  if (
    app.leaveType === LOP_TYPE ||
    app.leaveType === "Outdoor Duty" ||
    app.leaveType === "Travel Leave (on tour)"
  )
    return { ok: true };
  const bal = balanceFor(app.empId, app.leaveType, apps);
  if (!bal) return { ok: true };
  // The request's own pending days are already on hold, so compare against available + its own hold.
  if (app.days > bal.available + Math.min(app.days, bal.pending))
    return {
      ok: false,
      reason: `Insufficient ${app.leaveType} balance — ${bal.available} available. Ask the employee to re-apply as LOP.`,
    };
  return { ok: true };
}

export const nextLeaveId = (apps) => {
  const max = apps.reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 5100);
  return `LVA-${max + 1}`;
};

/** Approval chain for a leave type from the Leave Master ("Manager", "HOD → HR" …) split into steps. */
export const chainStepsFor = (leaveType) =>
  (leaveMasterStore.get().find((m) => m.name === leaveType)?.approvalChain ?? "Manager")
    .split("→")
    .map((s) => s.trim());

/**
 * Apply one approval step. Multi-step chains (e.g. Travel Leave: HOD → HR) stay Pending until the last step approves;
 * returns the updated application.
 */
export function approveStep(app, by, note) {
  const steps = app.approvalChain
    ? app.approvalChain.split("→").map((s) => s.trim())
    : chainStepsFor(app.leaveType);
  const step = app.chainStep ?? 0;
  const today = todayLocal();
  const log = [...(app.chainLog ?? []), { step: steps[step] ?? "Approver", by, on: today, note }];
  if (step + 1 < steps.length)
    return {
      ...app,
      chainStep: step + 1,
      chainLog: log,
      decisionReason: `${steps[step]} approved · awaiting ${steps[step + 1]}`,
    };
  return {
    ...app,
    status: "Approved",
    chainStep: step + 1,
    chainLog: log,
    decisionReason: note || `Approved by ${by}`,
    decidedBy: by,
    decidedOn: today,
  };
}

/** Year-end EL encashment (item 22): encashable EL × daily rate on gross/basic, as a separate taxable component. */
export function elEncashmentFor(empId, monthlyGross, basic) {
  const policy = leavePolicyStore.get();
  const el = leaveBalances(empId).find((b) => b.type === "Earned Leave");
  const rule = leaveMasterStore.get().find((m) => m.code === "EL");
  if (!el || !rule?.encashable)
    return {
      days: 0,
      amount: 0,
      component: policy.elEncashComponent,
      month: policy.elEncashmentMonth,
    };
  const days = Math.min(Math.max(el.available, 0), policy.elEncashMaxDays);
  const rate = (policy.elEncashBasis === "Gross" ? monthlyGross : basic) / 30;
  return {
    days,
    amount: Math.round(days * rate),
    component: policy.elEncashComponent,
    month: policy.elEncashmentMonth,
    basis: policy.elEncashBasis,
  };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Approval authority, submission and decisions (one place for the org queue and HR-on-behalf)                        */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Roles that may act on any step (platform / entity administrators and the CEO). */
const OVERRIDE_ROLES = ["SuperAdmin", "Admin", "CEO"];
const HR_ROLES = ["HR", "CHRO"];

export const reportingManagerOf = (empId) =>
  managerStore.get()[empId] ?? userById(empId)?.managerId ?? null;

/** The chain steps of an application and the step currently pending (null once decided). */
export function leaveStepOf(app) {
  const steps = app.approvalChain
    ? app.approvalChain.split("→").map((s) => s.trim())
    : chainStepsFor(app.leaveType);
  const index = app.chainStep ?? 0;
  return {
    steps,
    index,
    current:
      app.status === "Pending" ? (steps[index] ?? steps[steps.length - 1] ?? "Manager") : null,
  };
}

/**
 * Who may approve / reject the pending step: the reporting manager for a "Manager" step, the department HOD for a
 * "HOD" step, HR / CHRO for an "HR" step; SuperAdmin / Admin / CEO may override any step. Nobody decides their own
 * request, and the same person cannot clear two steps of one chain (Manager → HR must be two different people).
 */
export function canDecideLeave(app, user) {
  const { current } = leaveStepOf(app);
  if (!current) return { ok: false, reason: `Already ${app.status.toLowerCase()}.` };
  if (user.id === app.empId)
    return { ok: false, reason: "You cannot decide your own leave request." };
  if ((app.chainLog ?? []).some((l) => l.by === user.name))
    return {
      ok: false,
      reason:
        "You already approved an earlier step of this request — the next step needs a different approver.",
    };
  if (OVERRIDE_ROLES.includes(user.role)) return { ok: true };
  const isHr = HR_ROLES.includes(user.role);
  if (/HR/i.test(current))
    return isHr ? { ok: true } : { ok: false, reason: `Awaiting HR approval.` };
  if (/HOD/i.test(current)) {
    const hod = hodForEmployee(app.empId);
    if (hod?.id === user.id) return { ok: true };
    return !hod && isHr
      ? { ok: true }
      : { ok: false, reason: `Awaiting ${hod?.name ?? "the HOD"} (HOD).` };
  }
  // "Manager" step — the reporting manager, or the department HOD standing in; HR only when no manager is on record.
  const mgr = reportingManagerOf(app.empId);
  if (mgr === user.id || hodForEmployee(app.empId)?.id === user.id) return { ok: true };
  if (!mgr && isHr) return { ok: true };
  return {
    ok: false,
    reason: `Awaiting ${userById(mgr)?.name ?? "the reporting manager"} (Manager).`,
  };
}

/** People to notify for a step ("Manager" → reporting manager, "HOD" → HOD, "HR" → the entity's HR). */
function approverIdsFor(step, empId) {
  if (/HR/i.test(step)) return [resolveApprover("HR", empId)?.id].filter(Boolean);
  if (/HOD/i.test(step)) return [hodForEmployee(empId)?.id].filter(Boolean);
  return [reportingManagerOf(empId)].filter(Boolean);
}

/** Adds a validated application to the ledger and notifies the first approver (and the employee when HR filed it). */
export function submitLeaveApplication(app) {
  leaveApplicationStore.set((r) => [app, ...r]);
  const first = leaveStepOf(app).current ?? "Manager";
  approverIdsFor(first, app.empId).forEach((id) =>
    pushAlert({
      empId: id,
      kind: "leave",
      to: "/org/leave",
      title: `Leave request ${app.id} awaiting your approval`,
      body: `${app.employee} · ${app.leaveType} · ${app.from} → ${app.to} (${app.days} day${app.days === 1 ? "" : "s"}) · step: ${first}.`,
    }),
  );
  if (app.appliedBy)
    pushAlert({
      empId: app.empId,
      kind: "leave",
      to: "/emp/leave",
      title: `Leave ${app.id} filed on your behalf`,
      body: `${app.appliedBy} applied ${app.leaveType} for ${app.from} → ${app.to} (${app.days} day(s)).`,
    });
}

/** Approve (one chain step) or reject a pending application, with authority, balance and lock checks. */
export function decideLeaveApplication(id, user, action, note) {
  const apps = leaveApplicationStore.get();
  const app = apps.find((a) => a.id === id);
  if (!app) return { ok: false, message: "Leave request not found." };
  const auth = canDecideLeave(app, user);
  if (!auth.ok) return { ok: false, message: auth.reason ?? "You cannot decide this request." };
  if (action === "Rejected" && !note.trim())
    return { ok: false, message: "A reason is required to reject a request." };
  let next;
  if (action === "Approved") {
    const check = validateApproval(app, apps);
    if (!check.ok) return { ok: false, message: check.reason ?? "Cannot approve this request." };
    next = approveStep(app, user.name, note.trim());
  } else {
    const step = leaveStepOf(app).current ?? "Approver";
    next = {
      ...app,
      status: "Rejected",
      decisionReason: note.trim(),
      decidedBy: user.name,
      decidedOn: todayLocal(),
      chainLog: [
        ...(app.chainLog ?? []),
        { step, by: user.name, on: todayLocal(), note: `Rejected — ${note.trim()}` },
      ],
    };
  }
  leaveApplicationStore.set((r) => r.map((x) => (x.id === id ? next : x)));
  if (next.status === "Pending") {
    const step = leaveStepOf(next).current ?? "HR";
    approverIdsFor(step, next.empId).forEach((aid) =>
      pushAlert({
        empId: aid,
        kind: "leave",
        to: "/org/leave",
        title: `Leave request ${next.id} awaiting your approval`,
        body: `${next.employee} · ${next.leaveType} · ${next.from} → ${next.to} — approved by ${user.name}, now at ${step}.`,
      }),
    );
    pushAlert({
      empId: next.empId,
      kind: "leave",
      to: "/emp/leave",
      title: `Leave ${next.id}: step approved`,
      body: `${user.name} approved — awaiting ${step}.`,
    });
    return { ok: true, message: `Step approved — ${next.decisionReason}`, app: next };
  }
  pushAlert({
    empId: next.empId,
    kind: "leave",
    to: "/emp/leave",
    title: `Leave ${next.id} ${next.status.toLowerCase()}`,
    body: `${next.leaveType} ${next.from} → ${next.to} ${next.status.toLowerCase()} by ${user.name}${note.trim() ? ` — ${note.trim()}` : ""}.`,
  });
  return { ok: true, message: `${next.employee}'s leave ${next.status.toLowerCase()}`, app: next };
}

/**
 * Withdraw / cancel a request. The applicant (or HR / an administrator) can withdraw a pending request at any time;
 * an approved one can be cancelled only before it starts (HR / administrators: any time) and never in a locked month.
 * The request moves to "Cancelled": its days leave the balance / on-hold totals, the overlap check and the register.
 */
export function cancelLeaveApplication(id, user, note = "") {
  const app = leaveApplicationStore.get().find((a) => a.id === id);
  if (!app) return { ok: false, message: "Leave request not found." };
  if (app.status !== "Pending" && app.status !== "Approved")
    return { ok: false, message: `Already ${app.status.toLowerCase()}.` };
  const privileged = [...OVERRIDE_ROLES, ...HR_ROLES].includes(user.role);
  if (user.id !== app.empId && !privileged)
    return { ok: false, message: "Only the applicant or HR can cancel this request." };
  if (app.status === "Approved") {
    if (!privileged && app.from <= todayLocal())
      return {
        ok: false,
        message: "Approved leave that has started can only be cancelled by HR (regularisation).",
      };
    const locked = lockedMonthsIn(app.from, app.to, orgOfEmployee(app.empId));
    if (locked.length)
      return {
        ok: false,
        message: `Attendance for ${locked.join(", ")} is locked for payroll — ask HR to unlock it first.`,
      };
  }
  const wasApproved = app.status === "Approved";
  const next = {
    ...app,
    status: "Cancelled",
    decisionReason:
      note.trim() || (wasApproved ? "Cancelled after approval" : "Withdrawn by applicant"),
    decidedBy: user.name,
    decidedOn: todayLocal(),
    chainLog: [
      ...(app.chainLog ?? []),
      {
        step: wasApproved ? "Cancelled" : "Withdrawn",
        by: user.name,
        on: todayLocal(),
        note: note.trim(),
      },
    ],
  };
  leaveApplicationStore.set((r) => r.map((x) => (x.id === id ? next : x)));
  const notify = new Set([
    ...(wasApproved
      ? [reportingManagerOf(app.empId)]
      : approverIdsFor(leaveStepOf(app).current ?? "Manager", app.empId)),
    user.id !== app.empId ? app.empId : null,
  ]);
  notify.forEach(
    (eid) =>
      eid &&
      eid !== user.id &&
      pushAlert({
        empId: eid,
        kind: "leave",
        to: eid === app.empId ? "/emp/leave" : "/org/leave",
        title: `Leave ${app.id} ${wasApproved ? "cancelled" : "withdrawn"}`,
        body: `${app.employee} · ${app.leaveType} · ${app.from} → ${app.to} — by ${user.name}.`,
      }),
  );
  return {
    ok: true,
    message: `Leave ${app.id} ${wasApproved ? "cancelled" : "withdrawn"}.`,
    app: next,
  };
}

/** Employee org of an application (for tenant scoping of the queue). */
export const leaveOrgOf = (app) =>
  findEmployee(app.empId)?.orgId ?? userById(app.empId)?.orgId ?? "";
