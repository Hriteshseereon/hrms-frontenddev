// ---------------------------------------------------------------------------
// Tours (Travel Management) — organisation-scoped, UI-only store.
//
// One shared set of tour records powers every view: the employee's own "My
// Tours" screen, the admin-facing "All Tours" list, and the HOD → HR →
// Finance approval queue — same pattern as Assets and Exit. Approval order is
// fixed (HOD, then HR, then Finance) per the client's confirmed flow.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { ORGANIZATION, can, userById } from "@/features/auth/data/auth-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import {
  buildChain,
  decideChain,
  chainStatus,
  canActOn,
  currentStep,
  isBarredFromChain,
} from "@/features/administration/data/approval-chain";
import { leaveApplicationStore } from "@/features/leave/data/leave-data";
import { lockedMonthsIn } from "@/features/attendance/data/attendance-pattern";

/**
 * @typedef {"Road" | "Rail" | "Air" | "Own Vehicle" | "Site Transport"} TourMode
 */
/**
 * @typedef {"Draft" | "Pending Approval" | "Approved" | "Rejected" | "Completed" | "Closed"} TourStatus
 */

/**
 * @typedef {Object} TourRequest
 * @property {string} id
 * @property {string} orgId
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} purpose
 * @property {string} destination
 * @property {string} startDate
 * @property {string} endDate
 * @property {TourMode} mode
 * @property {number} estimatedCost
 * @property {string} costCentre
 * @property {ApprovalStep[]} chain
 * @property {TourStatus} status
 * @property {string} raisedOn
 * @property {string} [outcome] - Filled in once the tour is actually completed.
 * @property {{ name: string, url: string }[]} [proofDocuments]
 * @property {string} [outcomeSubmittedOn]
 * @property {TourOutcomes} [outcomes] - Item 32 — Tour Outcomes: revenue generated / saved vs the tour's cost and the target set at approval.
 * @property {TourExpense[]} [expenses] - Item 24 — actual expenses booked against the tour; petty cash encashment = approved expenses − advance.
 * @property {number} [advancePaid]
 * @property {{ amount: number, claimId: string, on: string }} [encashment]
 * @property {{ name: string, on: string, note: string }} [assignedBy] - HR-created & assigned tours
 * @property {{ id: string, name: string }[]} [travellers]
 * @property {string} [client]
 * @property {string} [project]
 * @property {string} [itinerary]
 * @property {string} [accommodation]
 * @property {string} [bookingRefs]
 * @property {TourBill[]} [bills] - Bills attached for reimbursement and financial audit (independent of expense lines).
 */
/**
 * @typedef {Object} TourBill
 * @property {string} id
 * @property {string} name
 * @property {string} vendor
 * @property {string} invoiceNo
 * @property {TourExpense["head"]} category
 * @property {number} amount
 * @property {number} gst
 * @property {string} date
 * @property {"Employee" | "Company card" | "Advance" | "Vendor invoice"} paidBy
 * @property {string} file
 * @property {string} uploadedBy
 * @property {string} uploadedOn
 * @property {string} [linkedExpenseId]
 * @property {string} note
 */
/**
 * @typedef {Object} TourOutcomes
 * @property {number} revenueGenerated
 * @property {number} revenueSaved
 * @property {number} targetRevenue
 * @property {number} targetSavings
 * @property {number} dealsClosed
 * @property {number} leads
 * @property {string} notes
 */
/**
 * @typedef {Object} TourExpense
 * @property {string} id
 * @property {"Travel" | "Lodging" | "Food" | "Local conveyance" | "Client entertainment" | "Other"} head
 * @property {number} amount
 * @property {string} date
 * @property {string} receipt
 * @property {boolean} approved
 * @property {string} [vendor]
 * @property {string} [invoiceNo]
 * @property {"Employee" | "Company card" | "Advance"} [paidBy]
 * @property {string} [note]
 * @property {string} [addedBy]
 */

const ORG = ORGANIZATION.id;
/** Local calendar date — `toISOString()` is UTC and stamps yesterday before 05:30 IST. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Next id from the highest existing number — `length + 1` re-issued an existing id after a tour was withdrawn. */
const nextTourId = () => {
  const max = tourStore
    .get()
    .reduce((m, t) => Math.max(m, Number(t.id.replace(/\D/g, "")) || 0), 0);
  return `TUR-${String(max + 1).padStart(3, "0")}`;
};

/** Fixed approval order per the client's confirmed flow — do not reorder. */
export const TOUR_CHAIN_ROLES = ["HOD", "HR", "CFO"];

const seedTour = (
  id,
  employeeId,
  purpose,
  destination,
  startDate,
  endDate,
  mode,
  estimatedCost,
  costCentre,
  raisedOn,
  overrides,
) => {
  const emp = userById(employeeId);
  // Seeded tours that are already past approval carry an approved chain (they used to show "HOD · Pending" on a
  // completed / closed tour).
  const decided = overrides?.status && overrides.status !== "Pending Approval";
  const chain = buildChain(employeeId, [...TOUR_CHAIN_ROLES]).map((s) =>
    decided && s.status === "Pending" ? { ...s, status: "Approved", actedOn: raisedOn } : s,
  );
  return {
    id,
    orgId: emp?.orgId ?? ORG,
    employeeId,
    employeeName: emp?.name ?? employeeId,
    purpose,
    destination,
    startDate,
    endDate,
    mode,
    estimatedCost,
    costCentre,
    chain,
    status: "Pending Approval",
    raisedOn,
    ...overrides,
  };
};

export const TOURS_SEED = [
  seedTour(
    "TUR-001",
    "SRN-0007",
    "Client site visit — quarterly SLA review and equipment audit.",
    "Seereon SAP Practice, Rajasthan",
    "2026-08-18",
    "2026-08-21",
    "Road",
    32000,
    "CC-1005",
    "2026-08-05",
  ),
  seedTour(
    "TUR-002",
    "SRN-0015",
    "AWS production console access review with the client's IT security team.",
    "Seereon Cloud Services, Jharkhand",
    "2026-07-10",
    "2026-07-12",
    "Air",
    48500,
    "CC-1005",
    "2026-06-28",
    {
      status: "Completed",
      outcome:
        "Completed access review; rotated 3 stale IAM keys and documented the new on-call escalation path with client IT.",
      outcomeSubmittedOn: "2026-07-14",
      proofDocuments: [
        { name: "flight-e-ticket.pdf", url: "#" },
        { name: "visit-report.pdf", url: "#" },
      ],
      outcomes: {
        revenueGenerated: 0,
        revenueSaved: 640000,
        targetRevenue: 0,
        targetSavings: 500000,
        dealsClosed: 0,
        leads: 1,
        notes:
          "Avoided a security-audit penalty clause; extension of the managed-services SOW discussed.",
      },
      advancePaid: 30000,
      expenses: [
        {
          id: "TX-01",
          head: "Travel",
          amount: 21400,
          date: "2026-07-10",
          receipt: "flight-e-ticket.pdf",
          approved: true,
        },
        {
          id: "TX-02",
          head: "Lodging",
          amount: 14200,
          date: "2026-07-12",
          receipt: "hotel-invoice.pdf",
          approved: true,
        },
        {
          id: "TX-03",
          head: "Food",
          amount: 3600,
          date: "2026-07-12",
          receipt: "meals.pdf",
          approved: true,
        },
        {
          id: "TX-04",
          head: "Local conveyance",
          amount: 2900,
          date: "2026-07-12",
          receipt: "cab.pdf",
          approved: false,
        },
      ],
    },
  ),
  seedTour(
    "TUR-003",
    "SRN-0006",
    "Annual budgeting workshop with the group's finance leadership.",
    "Bhubaneswar HQ",
    "2026-06-02",
    "2026-06-03",
    "Air",
    21000,
    "CC-1001",
    "2026-05-20",
    {
      status: "Closed",
      outcome:
        "Aligned FY27 budget assumptions across all four group entities; minutes shared with CFO office.",
      outcomeSubmittedOn: "2026-06-05",
      proofDocuments: [{ name: "workshop-minutes.pdf", url: "#" }],
      outcomes: {
        revenueGenerated: 1850000,
        revenueSaved: 220000,
        targetRevenue: 1500000,
        targetSavings: 200000,
        dealsClosed: 1,
        leads: 2,
        notes:
          "Semtech data-platform extension signed (₹18.5 L); consolidated AMC saved ₹2.2 L/yr.",
      },
      advancePaid: 20000,
      expenses: [
        {
          id: "TX-01",
          head: "Travel",
          amount: 15800,
          date: "2026-06-02",
          receipt: "flight.pdf",
          approved: true,
        },
        {
          id: "TX-02",
          head: "Lodging",
          amount: 6200,
          date: "2026-06-03",
          receipt: "hotel.pdf",
          approved: true,
        },
      ],
      encashment: { amount: 2000, claimId: "RMB-0042", on: "2026-06-08" },
    },
  ),
];

export const tourStore = createPersistentStore("seereon.tours.v2", TOURS_SEED);
export const useTours = () => tourStore.use();

/** Tours the employee travels on — as the requester / primary traveller or as an assigned co-traveller. */
export function useMyTours(employeeId) {
  const tours = useTours();
  return tours.filter(
    (t) => t.employeeId === employeeId || (t.travellers ?? []).some((x) => x.id === employeeId),
  );
}

/** Alert whoever the chain is now waiting on. */
function notifyCurrentApprover(t) {
  const step = currentStep(t.chain);
  if (step?.approverId)
    pushAlert({
      empId: step.approverId,
      kind: "general",
      to: "/org/tours",
      title: `Tour ${t.id} awaiting your approval (${step.label})`,
      body: `${t.employeeName} · ${t.destination} · ${t.startDate} → ${t.endDate} · est. ₹${t.estimatedCost.toLocaleString("en-IN")}.`,
    });
}

/**
 * @typedef {Object} TourInput
 * @property {string} employeeId
 * @property {string} purpose
 * @property {string} destination
 * @property {string} startDate
 * @property {string} endDate
 * @property {TourMode} mode
 * @property {number} estimatedCost
 * @property {string} costCentre
 */

/** Validation shared by the request form and `submitTour`. Returns the first problem or null. */
export function validateTourInput(input) {
  if (!input.purpose.trim() || !input.destination.trim())
    return "Purpose and destination are required.";
  if (!input.startDate || !input.endDate) return "Start and end dates are required.";
  if (input.endDate < input.startDate) return "The tour end date cannot be before its start date.";
  if (!(input.estimatedCost > 0)) return "Estimated cost must be greater than zero.";
  return null;
}

/* ----------------------------- submit ------------------------------ */

/** Statuses of a tour that still occupies the traveller's calendar. */
const LIVE_TOUR = new Set(["Pending Approval", "Approved", "Completed", "Closed"]);

/**
 * Calendar clash for a traveller: another live tour (as requester or co-traveller) or an approved / pending leave
 * request in the same dates. Returns a message or null.
 */
export function tourClashFor(employeeId, startDate, endDate, exceptId) {
  const tour = tourStore
    .get()
    .find(
      (t) =>
        t.id !== exceptId &&
        LIVE_TOUR.has(t.status) &&
        (t.employeeId === employeeId || (t.travellers ?? []).some((x) => x.id === employeeId)) &&
        t.startDate <= endDate &&
        t.endDate >= startDate,
    );
  if (tour) return `Overlaps with tour ${tour.id} (${tour.startDate} → ${tour.endDate}).`;
  const leave = leaveApplicationStore
    .get()
    .find(
      (l) =>
        l.empId === employeeId &&
        (l.status === "Approved" || l.status === "Pending") &&
        l.leaveType !== "Travel Leave (on tour)" &&
        l.leaveType !== "Outdoor Duty" &&
        l.from <= endDate &&
        l.to >= startDate,
    );
  if (leave)
    return `Overlaps with leave ${leave.id} (${leave.from} → ${leave.to}, ${leave.status.toLowerCase()}).`;
  return null;
}

export function submitTour(input) {
  const problem = validateTourInput(input);
  if (problem) throw new Error(problem);
  const clash = tourClashFor(input.employeeId, input.startDate, input.endDate);
  if (clash) throw new Error(clash);
  const emp = userById(input.employeeId);
  const chain = buildChain(input.employeeId, [...TOUR_CHAIN_ROLES]);
  const row = {
    id: nextTourId(),
    orgId: emp?.orgId ?? ORG,
    employeeId: input.employeeId,
    employeeName: emp?.name ?? input.employeeId,
    purpose: input.purpose,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    mode: input.mode,
    estimatedCost: input.estimatedCost,
    costCentre: input.costCentre,
    chain,
    // A chain with no approver left (every role vacant / self) is already cleared — it must not sit pending forever.
    status: chainStatus(chain) === "Approved" ? "Approved" : "Pending Approval",
    raisedOn: today(),
  };
  tourStore.set((p) => [row, ...p]);
  notifyCurrentApprover(row);
  return row;
}

/** Withdraw a request that no approver has acted on yet. */
export const withdrawTour = (id) =>
  tourStore.set((p) =>
    p.filter(
      (t) =>
        !(
          t.id === id &&
          t.status === "Pending Approval" &&
          t.chain.every((s) => s.status !== "Approved" && s.status !== "Rejected")
        ),
    ),
  );

/** HR / Admin / Super Admin creates a tour and assigns it to one or more employees — approved on creation, employee notified. */
export function createAndAssignTour(input, by) {
  const emp = userById(input.employeeId);
  if (!emp) return { ok: false, message: "Choose an employee." };
  if (!input.destination.trim() || !input.startDate || !input.endDate || !input.purpose.trim())
    return { ok: false, message: "Destination, dates and purpose are required." };
  if (input.endDate < input.startDate)
    return { ok: false, message: "The tour end date cannot be before its start date." };
  if (input.estimatedCost < 0 || input.advancePaid < 0)
    return { ok: false, message: "Estimated cost and advance cannot be negative." };
  for (const id of [emp.id, ...(input.travellers ?? [])]) {
    const clash = tourClashFor(id, input.startDate, input.endDate);
    if (clash) return { ok: false, message: `${userById(id)?.name ?? id}: ${clash}` };
  }
  const chain = buildChain(input.employeeId, [...TOUR_CHAIN_ROLES]).map((s) => ({
    ...s,
    status: "Approved",
    actedOn: today(),
    note: `Assigned by ${by.name}`,
  }));
  const row = {
    id: nextTourId(),
    orgId: emp.orgId ?? ORG,
    employeeId: emp.id,
    employeeName: emp.name,
    purpose: input.purpose,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    mode: input.mode,
    estimatedCost: input.estimatedCost,
    costCentre: input.costCentre,
    chain,
    status: "Approved",
    raisedOn: today(),
    advancePaid: input.advancePaid || undefined,
    assignedBy: { name: by.name, on: today(), note: input.note },
    travellers: (input.travellers ?? []).map((id) => ({ id, name: userById(id)?.name ?? id })),
    client: input.client,
    project: input.project,
    itinerary: input.itinerary,
    accommodation: input.accommodation,
    bookingRefs: input.bookingRefs,
    expenses: [],
    bills: [],
  };
  tourStore.set((p) => [row, ...p]);
  [emp.id, ...(input.travellers ?? [])].forEach((id) =>
    pushAlert({
      empId: id,
      kind: "general",
      to: "/emp/tours",
      title: `Tour assigned: ${input.destination}`,
      body: `${input.startDate} → ${input.endDate} · ${input.mode} · ${input.purpose}${input.advancePaid ? ` · advance ₹${input.advancePaid.toLocaleString("en-IN")}` : ""}. Assigned by ${by.name}.`,
    }),
  );
  return {
    ok: true,
    message: `${row.id} created and assigned to ${emp.name}${input.travellers?.length ? ` + ${input.travellers.length} co-traveller(s)` : ""}.`,
    id: row.id,
  };
}
export const setTourAdvance = (id, amount) =>
  tourStore.set((p) => p.map((t) => (t.id === id ? { ...t, advancePaid: amount } : t)));
export function addTourBill(id, b) {
  // Highest serial + 1: bills can be removed, so `length + 1` re-issued an existing bill id.
  const serial = (t) =>
    (t.bills ?? []).reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1;
  tourStore.set((p) =>
    p.map((t) =>
      t.id === id
        ? {
            ...t,
            bills: [
              ...(t.bills ?? []),
              { ...b, id: `BL-${String(serial(t)).padStart(2, "0")}`, uploadedOn: today() },
            ],
          }
        : t,
    ),
  );
}
export const removeTourBill = (id, billId) =>
  tourStore.set((p) =>
    p.map((t) =>
      t.id === id ? { ...t, bills: (t.bills ?? []).filter((b) => b.id !== billId) } : t,
    ),
  );
/** Bill → expense line in one step (for reimbursement). */
export function addBillAsExpense(id, billId, by) {
  const t = tourStore.get().find((x) => x.id === id);
  const b = t?.bills?.find((x) => x.id === billId);
  if (!t || !b) return;
  if (b.linkedExpenseId) return;
  const before = new Set((t.expenses ?? []).map((x) => x.id));
  addTourExpense(id, {
    head: b.category,
    amount: b.amount,
    date: b.date,
    receipt: b.file,
    vendor: b.vendor,
    invoiceNo: b.invoiceNo,
    paidBy: b.paidBy === "Vendor invoice" ? "Company card" : b.paidBy,
    note: b.note,
    addedBy: by,
  });
  // Link to the expense line that was actually created (none when the tour is closed / already encashed).
  const created = (tourStore.get().find((x) => x.id === id)?.expenses ?? []).find(
    (x) => !before.has(x.id),
  );
  if (!created) return;
  tourStore.set((p) =>
    p.map((x) =>
      x.id === id
        ? {
            ...x,
            bills: (x.bills ?? []).map((y) =>
              y.id === billId ? { ...y, linkedExpenseId: created.id } : y,
            ),
          }
        : x,
    ),
  );
}

/* ----------------------------- approvals ---------------------------- */

/**
 * Who may act on the current step: the resolved approver, an override role (SuperAdmin / Admin / CEO / CHRO), or —
 * for the HR and Finance steps — any user of the tour's entity holding `tour.hr.decide` / `tour.finance.decide`. The
 * HR step used to be pinned to the first HR user found, so the entity's other HR executives could never clear it.
 */
export function canDecideTour(t, user) {
  if (t.status !== "Pending Approval" || t.employeeId === user.id) return false;
  const step = currentStep(t.chain);
  if (!step) return false;
  // One person may not clear two steps (e.g. a CHRO overriding HOD, then HR, then Finance in three clicks).
  if (isBarredFromChain(t.chain, user.id, t.employeeId)) return false;
  if (canActOn(t.chain, user.id, user.role, t.employeeId)) return true;
  if (user.orgId !== t.orgId) return false;
  if (step.role === "HR") return can(user.role, "tour.hr.decide");
  if (step.role === "CFO") return can(user.role, "tour.finance.decide");
  return false;
}

/** HOD, then HR, then Finance — decideChain always acts on the current pending step. */
export function decideTour(id, userId, decision, note) {
  const t = tourStore.get().find((x) => x.id === id);
  const actor = userById(userId);
  if (!t) return { ok: false, message: "Tour not found." };
  if (t.status !== "Pending Approval")
    return { ok: false, message: `Tour is already ${t.status.toLowerCase()}.` };
  // Only the current step's approver (or an override role) may decide — the lib used to accept any caller.
  if (t.employeeId === userId) return { ok: false, message: "You cannot approve your own tour." };
  if (!actor || !canDecideTour(t, actor))
    return { ok: false, message: "This tour is not awaiting your approval." };
  // Approved tour days are on-duty days in the attendance register — not in a month already locked for payroll.
  if (decision === "Approved") {
    const locked = lockedMonthsIn(t.startDate, t.endDate, t.orgId);
    if (locked.length)
      return {
        ok: false,
        message: `Attendance for ${locked.join(", ")} is locked for payroll — unlock it before approving this tour.`,
      };
  }
  const chain = decideChain(t.chain, userId, decision, note, t.employeeId);
  if (chain === t.chain)
    return {
      ok: false,
      message: "You already acted on this tour — the next step needs a different approver.",
    };
  const stage = chainStatus(chain);
  const status =
    stage === "Rejected" ? "Rejected" : stage === "Pending" ? "Pending Approval" : "Approved";
  const next = { ...t, chain, status };
  tourStore.set((p) => p.map((x) => (x.id === id ? next : x)));
  if (status === "Pending Approval") notifyCurrentApprover(next);
  else
    pushAlert({
      empId: t.employeeId,
      kind: "general",
      to: "/emp/tours",
      title: `Tour ${t.id} ${status.toLowerCase()}`,
      body: `${t.destination} · ${t.startDate} → ${t.endDate} — ${status.toLowerCase()} by ${actor.name}${note ? ` (${note})` : ""}.`,
    });
  return {
    ok: true,
    message:
      status === "Pending Approval"
        ? `Approved — now with ${currentStep(chain)?.label ?? "next approver"}`
        : `Tour ${status.toLowerCase()}`,
  };
}

/* ----------------------------- outcome ------------------------------ */

export function submitTourOutcome(id, outcome, proofDocuments) {
  tourStore.set((p) =>
    p.map((t) =>
      t.id === id
        ? {
            ...t,
            status: "Completed",
            outcome,
            proofDocuments,
            outcomeSubmittedOn: today(),
          }
        : t,
    ),
  );
}

export function submitTourOutcomes(id, o) {
  tourStore.set((p) => p.map((t) => (t.id === id ? { ...t, outcomes: o } : t)));
}
export function addTourExpense(id, e) {
  if (!(e.amount > 0)) return;
  tourStore.set((p) =>
    p.map((t) =>
      t.id === id && t.status !== "Closed" && !t.encashment
        ? {
            ...t,
            expenses: [
              ...(t.expenses ?? []),
              {
                ...e,
                id: `TX-${String((t.expenses ?? []).reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,
                approved: false,
              },
            ],
          }
        : t,
    ),
  );
}
export function approveTourExpense(id, expId, approved) {
  tourStore.set((p) =>
    p.map((t) =>
      // Once encashed (or closed) the approved total is final — approving more would change the encashable amount
      // after the petty cash claim was raised.
      t.id === id && !t.encashment && t.status !== "Closed"
        ? {
            ...t,
            expenses: (t.expenses ?? []).map((e) => (e.id === expId ? { ...e, approved } : e)),
          }
        : t,
    ),
  );
}
export const tourExpenseTotals = (t) => {
  const all = (t.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const approved = (t.expenses ?? []).filter((e) => e.approved).reduce((s, e) => s + e.amount, 0);
  return {
    all,
    approved,
    advance: t.advancePaid ?? 0,
    encashable: Math.max(approved - (t.advancePaid ?? 0), 0),
    refundable: Math.max((t.advancePaid ?? 0) - approved, 0),
  };
};
export const markEncashed = (id, amount, claimId) =>
  tourStore.set((p) =>
    p.map((t) => (t.id === id ? { ...t, encashment: { amount, claimId, on: today() } } : t)),
  );
export const tourRoi = (t) => {
  const cost = tourExpenseTotals(t).approved || t.estimatedCost;
  const gain = (t.outcomes?.revenueGenerated ?? 0) + (t.outcomes?.revenueSaved ?? 0);
  return { cost, gain, roi: cost ? +(((gain - cost) / cost) * 100).toFixed(0) : 0 };
};

export const closeTour = (id) =>
  tourStore.set((p) => p.map((t) => (t.id === id ? { ...t, status: "Closed" } : t)));

/* ----------------------------- selectors ----------------------------- */

export const TOUR_MODES = ["Road", "Rail", "Air", "Own Vehicle", "Site Transport"];
