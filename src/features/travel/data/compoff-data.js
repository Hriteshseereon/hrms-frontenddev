// ---------------------------------------------------------------------------
// Comp-off — auto-accrual, balance ledger and HOD-approved redemption.
//
// Per the client's confirmed spec, comp-off auto-credits with NO manual entry
// when either:
//   1. the employee worked (punched in/out) on a declared off day, or
//   2. the employee was on an approved/completed tour during a declared off day.
// Both are system-triggered credits — they land directly in the ledger, no
// approval needed. Redeeming comp-off (using it like a leave day) DOES need
// approval, routed to the employee's HOD via the shared approval-chain engine.
//
// "Declared off day" — this product doesn't yet model a per-employee working
// calendar, so weekends (Sat/Sun) are treated as the default off days,
// matching the existing "Weekend / holiday overtime" rule's own wording.
// ---------------------------------------------------------------------------
import { useEffect } from "react";
import { createPersistentStore } from "@/lib/persist";
import { leaveRule } from "@/features/organization/data/hr-masters";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { userById } from "@/features/auth/data/auth-session";
import {
  buildChain,
  decideChain,
  chainStatus,
} from "@/features/administration/data/approval-chain";
import { usePunches, punchesOf, punchHours } from "@/features/attendance/data/attendance-self";
import { useTours, tourClashFor } from "@/features/travel/data/tour-data";
import { overtimeRuleStore } from "@/features/attendance/data/attendance-data";
import { isAttendanceLocked, orgOfEmployee } from "@/features/attendance/data/attendance-pattern";

const COMPOFF_RULE_ID = "OTR-04";
const CREDIT_DAYS = 0.5; // default when the rule's reward value cannot be read: 0.5 day per qualifying instance.
const MONTHLY_CAP_DAYS = 2; // default monthly cap ("2 days").
const MIN_HOURS = 4; // default threshold ("> 4 hrs on a week-off").

/** First number in a rule text ("0.5 day", "2 days", "> 4 hrs on a week-off"), or the fallback. */
const numIn = (text, fallback) => {
  const m = String(text ?? "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : fallback;
};
/** The comp-off rule as configured in Master Data → Overtime rules (credit, monthly cap, minimum hours). */
export function compOffRuleConfig() {
  const rule = overtimeRuleStore.get().find((r) => r.id === COMPOFF_RULE_ID);
  return {
    active: !!rule?.active,
    credit: numIn(rule?.rewardValue, CREDIT_DAYS) || CREDIT_DAYS,
    monthlyCap: /no cap/i.test(rule?.monthlyCap ?? "")
      ? Infinity
      : numIn(rule?.monthlyCap, MONTHLY_CAP_DAYS),
    minHours: numIn(rule?.appliesAfter, MIN_HOURS),
  };
}

/** Local-midnight parse / format — a bare "YYYY-MM-DD" parses as UTC and `toISOString()` formats in UTC, which shifts
 *  the weekday / date by one outside UTC+x zones and made expiry dates drift. */
const localDate = (iso) => new Date(iso + "T00:00:00");
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayLocal = () => isoLocal(new Date());

const isOffDay = (dateStr) => {
  const d = localDate(dateStr).getDay();
  return d === 0 || d === 6; // Sunday, Saturday
};

const datesInRange = (start, end) => {
  const dates = [];
  const cur = localDate(start);
  const last = localDate(end);
  while (cur <= last) {
    dates.push(isoLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

/** Working days (Mon–Fri) in a redemption range — weekends are already off, so they are never charged to comp-off. */
export const compOffDaysBetween = (from, to) =>
  from && to && to >= from ? datesInRange(from, to).filter((d) => !isOffDay(d)).length : 0;

/** Next serial for an id prefix — highest existing number + 1 (length + 1 re-issued an id after a withdrawal). */
const nextSerial = (ids) =>
  ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, "")) || 0), 0) + 1;

/* ------------------------------- Ledger ---------------------------------- */

/**
 * @typedef {| { kind: "worked-off-day", date: string, punchId: string } | { kind: "tour-off-day", date: string, tourId: string }} CompOffSource
 */

/**
 * @typedef {Object} CompOffLedgerEntry
 * @property {string} id
 * @property {string} employeeId
 * @property {"Credit" | "Debit"} type
 * @property {number} days
 * @property {string} reason
 * @property {CompOffSource} [source]
 * @property {string} createdOn
 * @property {string} [expiresOn] - Credit must be applied within the Leave Master validity window (default 7 days).
 */

export const compOffLedgerStore = createPersistentStore("seereon.compoff.ledger", []);
export const useCompOffLedger = () => compOffLedgerStore.use();

export function useCompOffLedgerOf(employeeId) {
  const rows = useCompOffLedger();
  return rows.filter((r) => r.employeeId === employeeId);
}

export const compOffValidityDays = () => leaveRule("CO")?.validityDays ?? 7;
export const isExpiredCredit = (r, today = todayLocal()) =>
  r.type === "Credit" && !!r.expiresOn && r.expiresOn < today;
export function compOffBalance(employeeId) {
  const rows = compOffLedgerStore.get().filter((r) => r.employeeId === employeeId);
  const active = rows
    .filter((r) => r.type === "Credit" && !isExpiredCredit(r))
    .reduce((s, r) => s + r.days, 0);
  const expired = rows
    .filter((r) => r.type === "Credit" && isExpiredCredit(r))
    .reduce((s, r) => s + r.days, 0);
  const redeemed = rows.filter((r) => r.type === "Debit").reduce((s, r) => s + r.days, 0);
  // Debits consume the oldest credits first, so a credit that was already redeemed before it expired must not lapse
  // a second time (that pushed the balance negative once the credit aged out).
  const earned = Math.round((active + Math.min(expired, redeemed)) * 100) / 100;
  return { earned, redeemed, available: Math.round((earned - redeemed) * 100) / 100 };
}

export function useCompOffBalance(employeeId) {
  useCompOffLedger();
  return compOffBalance(employeeId);
}

/** Months (YYYY-MM) touched by a date range. */
const monthsIn = (from, to) => [...new Set(datesInRange(from, to).map((d) => d.slice(0, 7)))];

function creditsThisMonth(employeeId, monthKey) {
  return compOffLedgerStore
    .get()
    .filter(
      (r) =>
        r.employeeId === employeeId && r.type === "Credit" && r.createdOn.slice(0, 7) === monthKey,
    )
    .reduce((s, r) => s + r.days, 0);
}

/**
 * One credit per employee per off day, whatever triggered it — a weekend that was both punched and on tour (or punched
 * twice) used to be credited once per punch / per source kind.
 */
function alreadyCredited(employeeId, source) {
  return compOffLedgerStore.get().some((r) => {
    if (!r.source) return false;
    if (r.employeeId === employeeId && r.source.date === source.date) return true;
    if (r.source.kind !== source.kind) return false;
    if (source.kind === "worked-off-day" && r.source.kind === "worked-off-day")
      return r.source.punchId === source.punchId;
    if (source.kind === "tour-off-day" && r.source.kind === "tour-off-day")
      return r.source.tourId === source.tourId && r.source.date === source.date;
    return false;
  });
}

function creditIfEligible(employeeId, days, reason, source, monthlyCap = MONTHLY_CAP_DAYS) {
  if (alreadyCredited(employeeId, source)) return;
  const monthKey = source.date.slice(0, 7);
  const capRemaining = monthlyCap - creditsThisMonth(employeeId, monthKey);
  if (capRemaining <= 0) return;
  const grant = Math.min(days, capRemaining);
  const exp = localDate(source.date);
  exp.setDate(exp.getDate() + compOffValidityDays());
  const expiresOn = isoLocal(exp);
  compOffLedgerStore.set((p) => [
    {
      id: `CO-${String(nextSerial(p.map((x) => x.id))).padStart(4, "0")}`,
      employeeId,
      type: "Credit",
      days: grant,
      reason,
      source,
      createdOn: source.date,
      expiresOn,
    },
    ...p,
  ]);
  pushAlert({
    empId: employeeId,
    kind: "compoff",
    to: "/emp/leave",
    title: "Comp-off credited",
    body: `${grant} day(s) comp-off credited for ${source.date} (${reason}). Apply within ${compOffValidityDays()} days — expires ${expiresOn}.`,
  });
}

/**
 * Scans punches and tours for qualifying off-day work and auto-credits comp-off.
 * Idempotent — safe to call repeatedly (e.g. on every render of the balance
 * screen); already-credited instances are skipped via `alreadyCredited`.
 */
export function runCompOffAutoAccrual(punches, tours, onlyEmployeeId) {
  // Read the live rule set (Master Data → overtime rules): on/off, credit per day, monthly cap and minimum hours.
  const cfg = compOffRuleConfig();
  if (!cfg.active) return;
  const today = todayLocal();

  // Condition 1: worked (with a completed punch) on a declared off day.
  for (const p of punches) {
    if (!p.outAt) continue;
    if (!isOffDay(p.date)) continue;
    if (onlyEmployeeId && p.empId !== onlyEmployeeId) continue;
    if (punchHours(p) < cfg.minHours) continue; // the rule's "> N hrs" threshold
    creditIfEligible(
      p.empId,
      cfg.credit,
      `Worked ${punchHours(p)}h on ${p.date} (declared off day)`,
      {
        kind: "worked-off-day",
        date: p.date,
        punchId: p.id,
      },
      cfg.monthlyCap,
    );
  }

  // Condition 2: on an approved/completed/closed tour during a declared off day — the requester and every assigned
  // co-traveller, and only for off days that have already happened (an approved future tour used to credit at once).
  for (const t of tours) {
    if (t.status !== "Approved" && t.status !== "Completed" && t.status !== "Closed") continue;
    const people = [t.employeeId, ...(t.travellers ?? []).map((x) => x.id)].filter(
      (id) => !onlyEmployeeId || id === onlyEmployeeId,
    );
    for (const date of datesInRange(t.startDate, t.endDate)) {
      if (!isOffDay(date) || date > today) continue;
      for (const empId of people)
        creditIfEligible(
          empId,
          cfg.credit,
          `On tour (${t.id}) on ${date} (declared off day)`,
          {
            kind: "tour-off-day",
            date,
            tourId: t.id,
          },
          cfg.monthlyCap,
        );
    }
  }
}

/** Convenience hook: runs accrual against the live punch/tour stores and returns the resulting balance. */
export function useCompOffAutoAccrual(employeeId) {
  const punches = usePunches();
  const tours = useTours();
  // Accrual writes to the ledger / alert stores, so it must run after render (writing to a store during render
  // triggers "cannot update a component while rendering" and, on the server, mutates shared module state).
  useEffect(() => {
    runCompOffAutoAccrual(
      punchesOf(punches, employeeId),
      tours.filter(
        (t) => t.employeeId === employeeId || (t.travellers ?? []).some((x) => x.id === employeeId),
      ),
      employeeId,
    );
  }, [punches, tours, employeeId]);
  return useCompOffBalance(employeeId);
}

/* ---------------------------- Redemption ---------------------------------- */

/**
 * @typedef {Object} CompOffRedemption
 * @property {string} id
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} fromDate
 * @property {string} toDate
 * @property {number} days
 * @property {string} reason
 * @property {ApprovalStep[]} chain
 * @property {"Pending Approval" | "Approved" | "Rejected"} status
 * @property {string} raisedOn
 */

export const compOffRedemptionStore = createPersistentStore("seereon.compoff.redemptions", []);
export const useCompOffRedemptions = () => compOffRedemptionStore.use();

export function useMyCompOffRedemptions(employeeId) {
  const rows = useCompOffRedemptions();
  return rows.filter((r) => r.employeeId === employeeId);
}

/** Days already requested in redemptions that are still awaiting approval (they are on hold against the balance). */
const pendingRedemptionDays = (employeeId, exceptId) =>
  compOffRedemptionStore
    .get()
    .filter(
      (r) => r.employeeId === employeeId && r.status === "Pending Approval" && r.id !== exceptId,
    )
    .reduce((s, r) => s + r.days, 0);

export function requestCompOffRedemption(input) {
  const { available } = compOffBalance(input.employeeId);
  const onHold = pendingRedemptionDays(input.employeeId);
  if (!input.fromDate || !input.toDate || input.toDate < input.fromDate || !(input.days > 0)) {
    throw new Error("Choose a valid date range — the end date cannot be before the start date.");
  }
  if (!input.reason.trim()) throw new Error("A reason is required.");
  const maxConsecutive = leaveRule("CO")?.maxConsecutive ?? 0;
  if (maxConsecutive > 0 && input.days > maxConsecutive) {
    throw new Error(
      `Comp-off can be availed for at most ${maxConsecutive} consecutive day(s) (Leave Master).`,
    );
  }
  // Pending requests are on hold: two requests could each pass against the full balance and both be approved,
  // leaving a negative balance.
  if (input.days > available - onHold) {
    throw new Error(
      `Only ${Math.max(0, available - onHold)} comp-off day(s) available${onHold ? ` (${onHold} on hold in pending requests)` : ""} — cannot redeem ${input.days}.`,
    );
  }
  const overlap = compOffRedemptionStore
    .get()
    .find(
      (r) =>
        r.employeeId === input.employeeId &&
        r.status !== "Rejected" &&
        r.fromDate <= input.toDate &&
        r.toDate >= input.fromDate,
    );
  if (overlap)
    throw new Error(`Overlaps with ${overlap.id} (${overlap.fromDate} → ${overlap.toDate}).`);
  // A day already on leave / tour cannot also be taken as comp-off (it was charged twice).
  const clash = tourClashFor(input.employeeId, input.fromDate, input.toDate);
  if (clash) throw new Error(clash);
  const locked = monthsIn(input.fromDate, input.toDate).filter((m) =>
    isAttendanceLocked(m, orgOfEmployee(input.employeeId)),
  );
  if (locked.length)
    throw new Error(
      `Attendance for ${locked.join(", ")} is locked for payroll — ask HR to unlock the month first.`,
    );
  const emp = userById(input.employeeId);
  // HOD approves; when the department has no HOD on record, fall back to the reporting manager, then HR, then an
  // administrator — a chain with no actionable step could never be decided and sat in "Pending Approval" forever.
  let chain = buildChain(input.employeeId, ["HOD"]);
  for (const role of ["Manager", "HR", "Admin", "SuperAdmin"])
    if (!chain.some((s) => s.status === "Pending")) chain = buildChain(input.employeeId, [role]);
  if (!chain.some((s) => s.status === "Pending"))
    throw new Error("No approver is configured for you — ask HR to set your HOD or manager.");
  const row = {
    id: `COR-${String(nextSerial(compOffRedemptionStore.get().map((r) => r.id))).padStart(3, "0")}`,
    employeeId: input.employeeId,
    employeeName: emp?.name ?? input.employeeId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    days: input.days,
    reason: input.reason,
    chain,
    status: "Pending Approval",
    raisedOn: todayLocal(),
  };
  compOffRedemptionStore.set((p) => [row, ...p]);
  const approver = chain.find((s) => s.status === "Pending");
  if (approver?.approverId)
    pushAlert({
      empId: approver.approverId,
      kind: "compoff",
      to: "/org/leave",
      title: `Comp-off redemption ${row.id} awaiting approval`,
      body: `${row.employeeName} · ${row.fromDate} → ${row.toDate} · ${row.days} day(s).`,
    });
  return row;
}

export function decideCompOffRedemption(id, userId, decision, note) {
  const row = compOffRedemptionStore.get().find((r) => r.id === id);
  if (!row || row.status !== "Pending Approval") return;
  if (decision === "Approved") {
    const locked = monthsIn(row.fromDate, row.toDate).filter((m) =>
      isAttendanceLocked(m, orgOfEmployee(row.employeeId)),
    );
    if (locked.length)
      throw new Error(
        `Attendance for ${locked.join(", ")} is locked for payroll — unlock the month before approving.`,
      );
  }
  // Re-check the balance at approval time — credits may have expired or been redeemed since the request was raised.
  if (decision === "Approved" && row.days > compOffBalance(row.employeeId).available) {
    throw new Error(
      `Only ${compOffBalance(row.employeeId).available} comp-off day(s) available now — reject or ask the employee to re-apply.`,
    );
  }
  const chain = decideChain(row.chain, userId, decision, note, row.employeeId);
  if (chain === row.chain) throw new Error("You cannot decide your own comp-off request.");
  const stage = chainStatus(chain);
  const status =
    stage === "Rejected" ? "Rejected" : stage === "Pending" ? "Pending Approval" : "Approved";

  compOffRedemptionStore.set((p) => p.map((r) => (r.id === id ? { ...r, chain, status } : r)));

  // Debit the ledger only once the redemption is fully approved.
  if (status === "Approved") {
    compOffLedgerStore.set((p) => [
      {
        id: `CO-${String(nextSerial(p.map((x) => x.id))).padStart(4, "0")}`,
        employeeId: row.employeeId,
        type: "Debit",
        days: row.days,
        reason: `Redeemed ${row.fromDate} to ${row.toDate} (${row.id})`,
        createdOn: todayLocal(),
      },
      ...p,
    ]);
  }
  if (status !== "Pending Approval")
    pushAlert({
      empId: row.employeeId,
      kind: "compoff",
      to: "/emp/leave",
      title: `Comp-off ${row.id} ${status.toLowerCase()}`,
      body: `${row.fromDate} → ${row.toDate} · ${row.days} day(s)${note ? ` — ${note}` : ""}.`,
    });
}

/** Only a request that is still pending can be withdrawn (a decided one is part of the ledger's audit trail). */
export const withdrawCompOffRedemption = (id) =>
  compOffRedemptionStore.set((p) =>
    p.filter((r) => !(r.id === id && r.status === "Pending Approval")),
  );
