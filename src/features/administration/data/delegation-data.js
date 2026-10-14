// Universal role delegation — any user can delegate selected module
// responsibilities to another employee for a bounded period.
import { createPersistentStore } from "@/lib/persist";

export const DELEGATION_LEVELS = ["View Only", "Create", "Edit", "Approve", "Full Control"];
/**
 * @typedef {(typeof DELEGATION_LEVELS)[number]} DelegationLevel
 */

export const DELEGATABLE_MODULES = [
  "Leave",
  "Timesheets",
  "Tasks",
  "Goals",
  "Performance",
  "Training",
  "Recruitment",
  "Finance",
  "Claims",
  "Announcements",
  "Support Tickets",
  "Employees",
];

export const DELEGATION_STATUSES = ["Pending Approval", "Active", "Expired", "Revoked", "Rejected"];
/**
 * @typedef {(typeof DELEGATION_STATUSES)[number]} DelegationStatus
 */

/**
 * @typedef {Object} Delegation
 * @property {string} id
 * @property {string} fromId
 * @property {string} from
 * @property {string} toId
 * @property {string} to
 * @property {string[]} modules
 * @property {DelegationLevel} level
 * @property {string} start
 * @property {string} end
 * @property {string} reason
 * @property {DelegationStatus} status
 * @property {boolean} requiresApproval
 * @property {string} [createdById] - Who entered the delegation (may differ from the delegator); they cannot approve it.
 * @property {{ at: string, by: string, action: string }[]} history
 */

// Persisted — delegations (and their approve / revoke history) used to be lost on every reload.
export const delegationStore = createPersistentStore("seereon.delegations.v1", [
  {
    id: "DEL-001",
    fromId: "SRN-0149",
    from: "Manish Patel",
    toId: "SRN-0142",
    to: "Ananya Sharma",
    modules: ["Tasks", "Timesheets", "Leave"],
    level: "Approve",
    start: "2026-08-01",
    end: "2026-08-14",
    reason: "Annual leave — sabbatical cover",
    status: "Active",
    requiresApproval: false,
    history: [{ at: "2026-07-25", by: "Manish Patel", action: "Delegation created" }],
  },
  {
    id: "DEL-002",
    fromId: "SRN-0144",
    from: "Priya Nair",
    toId: "SRN-0148",
    to: "Sneha Rao",
    modules: ["Announcements"],
    level: "Create",
    start: "2026-07-20",
    end: "2026-07-27",
    reason: "Internal comms coverage during offsite",
    status: "Expired",
    requiresApproval: false,
    history: [{ at: "2026-07-18", by: "Priya Nair", action: "Delegation created" }],
  },
  {
    id: "DEL-003",
    fromId: "SRN-0146",
    from: "Kavya Menon",
    toId: "SRN-0143",
    to: "Vikram Iyer",
    modules: ["Claims", "Finance"],
    level: "View Only",
    start: "2026-08-05",
    end: "2026-08-20",
    reason: "Quarter close support",
    status: "Pending Approval",
    requiresApproval: true,
    history: [{ at: "2026-07-29", by: "Kavya Menon", action: "Submitted for approval" }],
  },
]);

const today = () => new Date().toISOString().slice(0, 10);

/** Next free DEL number (max + 1) — never reuses an id. */
const nextDelegationId = (p) =>
  `DEL-${String(p.reduce((m, d) => Math.max(m, Number(d.id.replace(/^DEL-/, "")) || 0), 0) + 1).padStart(3, "0")}`;

/** Live (pending or active, not yet ended) delegation from the same person to the same delegate that overlaps the window. */
export const overlappingDelegation = (fromId, toId, start, end, list = delegationStore.get()) =>
  list.find(
    (d) =>
      d.fromId === fromId &&
      d.toId === toId &&
      (effectiveStatus(d) === "Active" || effectiveStatus(d) === "Pending Approval") &&
      !(end < d.start || start > d.end),
  ) ?? null;

export const addDelegation = (d, createdBy = d.from) => {
  const id = nextDelegationId(delegationStore.get());
  delegationStore.set((p) => [
    {
      ...d,
      id,
      history: [
        {
          at: today(),
          by: createdBy,
          action: d.status === "Pending Approval" ? "Submitted for approval" : "Delegation created",
        },
      ],
    },
    ...p,
  ]);
  return id;
};

export const setDelegationStatus = (id, status, by) =>
  delegationStore.set((p) =>
    p.map((d) =>
      d.id === id
        ? { ...d, status, history: [{ at: today(), by, action: `Marked ${status}` }, ...d.history] }
        : d,
    ),
  );

/** Auto-expiry: anything (active or still pending) whose end date has passed is no longer live. */
export const effectiveStatus = (d) =>
  (d.status === "Active" || d.status === "Pending Approval") && d.end < today()
    ? "Expired" // a request never approved before its window ended can no longer be approved
    : d.status;

export const delegationTone = (s) =>
  s === "Active"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Revoked" || s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Pending Approval"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

export const useDelegations = () => delegationStore.use();

/* ------------------------------ What a delegate actually receives ------------------------------ */
/** Delegatable module → the RBAC module keys / screens it maps to, and the action keys per level. */
const MODULE_MAP = {
  Leave: {
    screens: ["Leave applications", "Leave balances", "Comp-off requests", "Holiday calendar"],
    actions: {
      "View Only": ["leave.view"],
      Create: ["leave.view", "leave.apply-on-behalf"],
      Edit: ["leave.view", "leave.apply-on-behalf", "leave.edit"],
      Approve: ["leave.view", "leave.approve", "compoff.hod.decide"],
      "Full Control": [
        "leave.view",
        "leave.apply-on-behalf",
        "leave.edit",
        "leave.approve",
        "compoff.hod.decide",
        "leave.cancel",
      ],
    },
  },
  Timesheets: {
    screens: ["Timesheet register", "Weekly submissions"],
    actions: {
      "View Only": ["timesheet.view"],
      Create: ["timesheet.view", "timesheet.fill"],
      Edit: ["timesheet.view", "timesheet.fill", "timesheet.edit"],
      Approve: ["timesheet.view", "timesheet.approve"],
      "Full Control": [
        "timesheet.view",
        "timesheet.fill",
        "timesheet.edit",
        "timesheet.approve",
        "timesheet.lock",
      ],
    },
  },
  Tasks: {
    screens: ["Task board", "Task detail"],
    actions: {
      "View Only": ["task.view"],
      Create: ["task.view", "task.assign"],
      Edit: ["task.view", "task.assign", "task.edit"],
      Approve: ["task.view", "task.approve-update"],
      "Full Control": [
        "task.view",
        "task.assign",
        "task.edit",
        "task.approve-update",
        "task.delete",
      ],
    },
  },
  Goals: {
    screens: ["Goals", "Goal check-ins"],
    actions: {
      "View Only": ["goal.view"],
      Create: ["goal.view", "goal.create"],
      Edit: ["goal.view", "goal.create", "goal.edit"],
      Approve: ["goal.view", "goal.review"],
      "Full Control": ["goal.view", "goal.create", "goal.edit", "goal.review", "goal.close"],
    },
  },
  Performance: {
    screens: ["Team reviews", "Appraisal workflow", "PIP"],
    actions: {
      "View Only": ["performance.view"],
      Create: ["performance.view", "review.start"],
      Edit: ["performance.view", "review.start", "review.edit"],
      Approve: ["performance.view", "review.approve"],
      "Full Control": [
        "performance.view",
        "review.start",
        "review.edit",
        "review.approve",
        "performance.manage",
      ],
    },
  },
  Training: {
    screens: ["Training calendar", "Nominations"],
    actions: {
      "View Only": ["training.view"],
      Create: ["training.view", "training.nominate"],
      Edit: ["training.view", "training.nominate", "training.edit"],
      Approve: ["training.view", "training.approve"],
      "Full Control": ["training.view", "training.nominate", "training.edit", "training.approve"],
    },
  },
  Recruitment: {
    screens: ["Openings", "Pipeline", "Interviews", "Offers"],
    actions: {
      "View Only": ["recruitment.view"],
      Create: ["recruitment.view", "opening.create", "interview.schedule"],
      Edit: ["recruitment.view", "opening.create", "interview.schedule", "candidate.edit"],
      Approve: ["recruitment.view", "offer.approve"],
      "Full Control": [
        "recruitment.view",
        "opening.create",
        "interview.schedule",
        "candidate.edit",
        "offer.approve",
        "recruitment.manage",
      ],
    },
  },
  Finance: {
    screens: ["Expenditure booking", "Loans & advances", "Payroll runs (read)"],
    actions: {
      "View Only": ["finance.view"],
      Create: ["finance.view", "expenditure.book"],
      Edit: ["finance.view", "expenditure.book", "expenditure.edit"],
      Approve: ["finance.view", "expenditure.approve", "loan.approve"],
      "Full Control": [
        "finance.view",
        "expenditure.book",
        "expenditure.edit",
        "expenditure.approve",
        "loan.approve",
        "finance.manage",
      ],
    },
  },
  Claims: {
    screens: ["Reimbursement claims", "Insurance"],
    actions: {
      "View Only": ["claims.view"],
      Create: ["claims.view", "claim.raise-on-behalf"],
      Edit: ["claims.view", "claim.raise-on-behalf", "claim.edit"],
      Approve: ["claims.view", "claim.approve"],
      "Full Control": [
        "claims.view",
        "claim.raise-on-behalf",
        "claim.edit",
        "claim.approve",
        "claim.pay",
      ],
    },
  },
  Announcements: {
    screens: ["Announcements", "Notices & circulars"],
    actions: {
      "View Only": ["announcement.view"],
      Create: ["announcement.view", "announcement.draft"],
      Edit: ["announcement.view", "announcement.draft", "announcement.edit"],
      Approve: ["announcement.view", "announcement.publish"],
      "Full Control": [
        "announcement.view",
        "announcement.draft",
        "announcement.edit",
        "announcement.publish",
        "announcement.retract",
      ],
    },
  },
  "Support Tickets": {
    screens: ["Helpdesk queue", "Ticket detail"],
    actions: {
      "View Only": ["ticket.view"],
      Create: ["ticket.view", "ticket.raise"],
      Edit: ["ticket.view", "ticket.raise", "ticket.update"],
      Approve: ["ticket.view", "ticket.resolve"],
      "Full Control": [
        "ticket.view",
        "ticket.raise",
        "ticket.update",
        "ticket.resolve",
        "ticket.reassign",
      ],
    },
  },
  Employees: {
    screens: ["Employee directory", "Employee profile", "Documents"],
    actions: {
      "View Only": ["employee.view"],
      Create: ["employee.view", "employee.add"],
      Edit: ["employee.view", "employee.add", "employee.edit"],
      Approve: ["employee.view", "employee.approve-change"],
      "Full Control": [
        "employee.view",
        "employee.add",
        "employee.edit",
        "employee.approve-change",
        "employee.manage",
      ],
    },
  },
};

/**
 * @typedef {Object} DelegatedPermission
 * @property {string} module
 * @property {string[]} screens
 * @property {string[]} actions
 */
/** Exactly what the delegate gets for the chosen modules and level — shown before creating and on the record. */
export function delegatedPermissions(modules, level) {
  return modules.map((m) => {
    const def = MODULE_MAP[m];
    return {
      module: m,
      screens: def?.screens ?? [m],
      actions: def?.actions[level] ?? [
        `${m.toLowerCase()}.${level.toLowerCase().replace(/\s+/g, "-")}`,
      ],
    };
  });
}
export const LEVEL_HINT = {
  "View Only": "Read-only access to the module's screens and records.",
  Create: "View plus raise / create new records on behalf of the delegator.",
  Edit: "View, create and change existing records (no approvals).",
  Approve: "View plus act on approvals routed to the delegator.",
  "Full Control": "Everything the delegator can do in the module, including approvals and deletes.",
};
