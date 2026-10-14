// Universal multi-level approval engine (UI-only).
// Admins configure an ordered chain of approval levels per request type; every
// module that needs sign-off raises an ApprovalRequest against that chain.
import { createPersistentStore } from "@/lib/persist";
import { nextId } from "@/lib/store";
import { userById } from "@/features/auth/data/auth-session";
import { hodForEmployee } from "@/features/organization/data/dept-data";
import { managerOf } from "@/features/reports/data/reporting";
import { activeDelegationsTo } from "@/features/auth/data/rbac-store";

export const APPROVAL_MODULES = [
  "Leave",
  "Timesheets",
  "Tasks",
  "Goals",
  "Performance Reviews",
  "Training Completion",
  "Expenses",
  "Loan Requests",
  "Salary Approvals",
  "Finance Requests",
  "Asset Requests",
];
/**
 * @typedef {(typeof APPROVAL_MODULES)[number]} ApprovalModule
 */

export const APPROVER_ROLES = [
  "Team Lead",
  "Reporting Manager",
  "Department Head",
  "HR",
  "Finance",
  "CEO",
  "Admin",
];
/**
 * @typedef {(typeof APPROVER_ROLES)[number]} ApproverRole
 */

/**
 * @typedef {Object} ApprovalLevel
 * @property {number} level
 * @property {ApproverRole} role
 * @property {number} slaDays
 * @property {boolean} optional
 */

/**
 * @typedef {Object} ApprovalWorkflow
 * @property {string} id
 * @property {ApprovalModule} module
 * @property {string} name
 * @property {string} description
 * @property {boolean} active
 * @property {ApprovalLevel[]} levels
 */

const L = (role, slaDays = 2, optional = false) => ({ role, slaDays, optional });
const chain = (...rows) => rows.map((r, i) => ({ ...r, level: i + 1 }));

// Persisted — workflows configured here (and every decision in the inbox) used to be lost on reload.
export const workflowStore = createPersistentStore("seereon.approvals.workflows.v1", [
  {
    id: "WF-001",
    module: "Leave",
    name: "Standard Leave Approval",
    active: true,
    description: "Applies to all casual, sick and earned leave applications.",
    levels: chain(L("Reporting Manager", 1), L("HR", 2)),
  },
  {
    id: "WF-002",
    module: "Timesheets",
    name: "Weekly Timesheet Sign-off",
    active: true,
    description: "Weekly timesheets reviewed and locked by the reporting manager.",
    levels: chain(L("Team Lead", 1), L("Reporting Manager", 2)),
  },
  {
    id: "WF-003",
    module: "Tasks",
    name: "Task Completion Review",
    active: true,
    description: "Employee submits a task for review; manager approves or requests rework.",
    levels: chain(L("Reporting Manager", 2)),
  },
  {
    id: "WF-004",
    module: "Goals",
    name: "Goal Approval Chain",
    active: true,
    description: "Goal creation and closure approval.",
    levels: chain(L("Reporting Manager", 2), L("Department Head", 3), L("HR", 3)),
  },
  {
    id: "WF-005",
    module: "Loan Requests",
    name: "Employee Loan Approval",
    active: true,
    description: "Loan requests routed through HR, Finance and the CEO.",
    levels: chain(L("Reporting Manager", 2), L("HR", 2), L("Finance", 3), L("CEO", 5)),
  },
  {
    id: "WF-006",
    module: "Expenses",
    name: "Expense Reimbursement",
    active: true,
    description: "Claims above policy limits escalate to Finance.",
    levels: chain(L("Reporting Manager", 2), L("Finance", 3)),
  },
  {
    id: "WF-007",
    module: "Training Completion",
    name: "Training Completion Approval",
    active: true,
    description: "Trainer/manager evaluates uploaded assignments before marking complete.",
    levels: chain(L("Reporting Manager", 3), L("HR", 3)),
  },
]);

/**
 * Only one workflow per request type can be active — `workflowFor` routes by the first active match, so a second active
 * chain for the same module was silently ignored. Activating / creating one deactivates the others for that module.
 */
export const addWorkflow = (w) =>
  // Next free number — `nextId(prefix, length)` reuses a surviving id after a workflow has been deleted.
  workflowStore.set((p) => [
    {
      ...w,
      id: nextId(
        "WF",
        p.reduce((m, x) => Math.max(m, Number(x.id.replace(/^WF-/, "")) || 0), 0),
      ),
    },
    ...p.map((x) => (w.active && x.module === w.module ? { ...x, active: false } : x)),
  ]);

export const updateWorkflow = (id, patch) =>
  workflowStore.set((p) => {
    const target = p.find((w) => w.id === id);
    return p.map((w) =>
      w.id === id
        ? { ...w, ...patch }
        : patch.active && target && w.module === target.module
          ? { ...w, active: false }
          : w,
    );
  });

export const deleteWorkflow = (id) => workflowStore.set((p) => p.filter((w) => w.id !== id));

export const workflowFor = (module) =>
  workflowStore.get().find((w) => w.module === module && w.active);

/* ---------------------------------------------------------------- requests */

/**
 * @typedef {"Pending" | "Approved" | "Rejected" | "Rework" | "Skipped"} ApprovalStatus
 */

/**
 * @typedef {Object} ApprovalStep
 * @property {number} level
 * @property {ApproverRole} role
 * @property {ApprovalStatus} status
 * @property {string} [actedBy]
 * @property {string} [actedAt]
 * @property {string} [remarks]
 */

/**
 * @typedef {Object} ApprovalRequest
 * @property {string} id
 * @property {ApprovalModule} module
 * @property {string} reference
 * @property {string} title
 * @property {string} requestedBy
 * @property {string} requestedByName
 * @property {string} raisedOn
 * @property {string} [amount]
 * @property {ApprovalStatus} status
 * @property {number} currentLevel
 * @property {ApprovalStep[]} steps
 */

const today = () => new Date().toISOString().slice(0, 10);

const stepsFrom = (module) =>
  (workflowFor(module)?.levels ?? [{ level: 1, role: "HR", slaDays: 2, optional: false }]).map(
    (l) => ({ level: l.level, role: l.role, status: "Pending" }),
  );

export const approvalStore = createPersistentStore("seereon.approvals.requests.v1", [
  {
    id: "APR-001",
    module: "Leave",
    reference: "LV-2041",
    title: "Earned leave · 3 days",
    requestedBy: "SRN-0142",
    requestedByName: "Ananya Sharma",
    raisedOn: "2026-07-28",
    status: "Pending",
    currentLevel: 1,
    steps: [
      { level: 1, role: "Reporting Manager", status: "Pending" },
      { level: 2, role: "HR", status: "Pending" },
    ],
  },
  {
    id: "APR-002",
    module: "Loan Requests",
    reference: "LN-3012",
    title: "Personal loan request",
    requestedBy: "SRN-0143",
    requestedByName: "Vikram Iyer",
    raisedOn: "2026-07-24",
    amount: "₹\u00A02,50,000",
    status: "Pending",
    currentLevel: 2,
    steps: [
      {
        level: 1,
        role: "Reporting Manager",
        status: "Approved",
        actedBy: "Kavya Menon",
        actedAt: "2026-07-25",
      },
      { level: 2, role: "HR", status: "Pending" },
      { level: 3, role: "Finance", status: "Pending" },
      { level: 4, role: "CEO", status: "Pending" },
    ],
  },
  {
    id: "APR-003",
    module: "Timesheets",
    reference: "TS-W30",
    title: "Week 30 timesheet · 41.5 h",
    requestedBy: "SRN-0147",
    requestedByName: "Arjun Kapoor",
    raisedOn: "2026-07-27",
    status: "Pending",
    currentLevel: 1,
    steps: [
      { level: 1, role: "Team Lead", status: "Pending" },
      { level: 2, role: "Reporting Manager", status: "Pending" },
    ],
  },
  {
    id: "APR-004",
    module: "Expenses",
    reference: "EXP-882",
    title: "Client travel — Mumbai",
    requestedBy: "SRN-0148",
    requestedByName: "Sneha Rao",
    raisedOn: "2026-07-19",
    amount: "₹\u00A018,400",
    status: "Approved",
    currentLevel: 2,
    steps: [
      {
        level: 1,
        role: "Reporting Manager",
        status: "Approved",
        actedBy: "Kavya Menon",
        actedAt: "2026-07-20",
      },
      {
        level: 2,
        role: "Finance",
        status: "Approved",
        actedBy: "Rohit Deshmukh",
        actedAt: "2026-07-21",
      },
    ],
  },
]);

const firstRequiredLevel = (module, count) => {
  const optional = new Set(
    (workflowFor(module)?.levels ?? []).filter((l) => l.optional).map((l) => l.level),
  );
  let lvl = 1;
  while (lvl < count && optional.has(lvl)) lvl += 1;
  return lvl;
};

export function raiseApproval(input) {
  const steps = stepsFrom(input.module);
  const id = nextId(
    "APR",
    approvalStore.get().reduce((m, r) => Math.max(m, Number(r.id.replace(/^APR-/, "")) || 0), 0),
  );
  approvalStore.set((p) => [
    {
      ...input,
      id,
      raisedOn: today(),
      status: "Pending",
      // A leading optional level is skipped straight away.
      currentLevel: firstRequiredLevel(input.module, steps.length),
      steps,
    },
    ...p,
  ]);
  return id;
}

/** Roles that may act on any level (override) — mirrors approval-chain's canActOn. */
const OVERRIDE_ROLES = ["SuperAdmin", "Admin", "CEO", "CHRO"];

/**
 * May `user` act on the request's current level? The inbox used to let anyone who could open it approve every level —
 * HR signing the Finance and CEO steps, or the requester approving their own request.
 */
/** Delegated module → the approval request types it covers. */
const DELEGATED_APPROVALS = {
  Leave: ["Leave"],
  Timesheets: ["Timesheets"],
  Tasks: ["Tasks"],
  Goals: ["Goals"],
  Performance: ["Performance Reviews"],
  Training: ["Training Completion"],
  Finance: ["Expenses", "Loan Requests", "Salary Approvals", "Finance Requests"],
  Claims: ["Expenses"],
};

export function canActOnApproval(req, user) {
  if (req.status !== "Pending") return false;
  if (req.requestedBy === user.id) return false; // never self-approve
  // One person signs one level: an override role could otherwise click a request through every level alone.
  if (req.steps.some((s) => s.level < req.currentLevel && s.actedBy === user.name)) return false;
  if (canActDirectly(req, user)) return true;
  // An approved, live delegation at "Approve" / "Full Control" lets the delegate act where the delegator could.
  return activeDelegationsTo(user.id).some((d) => {
    if (d.level !== "Approve" && d.level !== "Full Control") return false;
    if (!d.modules.some((m) => (DELEGATED_APPROVALS[m] ?? []).includes(req.module))) return false;
    const delegator = userById(d.fromId);
    return !!delegator && delegator.id !== req.requestedBy && canActDirectly(req, delegator);
  });
}

function canActDirectly(req, user) {
  if (OVERRIDE_ROLES.includes(user.role)) return true;
  const step = req.steps.find((s) => s.level === req.currentLevel);
  if (!step) return false;
  const requester = userById(req.requestedBy);
  switch (step.role) {
    case "Team Lead":
    case "Reporting Manager":
      return (requester?.managerId ?? managerOf(req.requestedBy)) === user.id;
    case "Department Head":
      return user.role === "HOD" && hodForEmployee(req.requestedBy)?.id === user.id;
    case "HR":
      return user.role === "HR";
    case "Finance":
      return user.role === "CFO";
    case "CEO":
      return user.role === "CEO";
    case "Admin":
      return user.role === "Admin" || user.role === "SuperAdmin";
    default:
      return false;
  }
}

/**
 * Records a decision on the current level. `actor` is the acting user (a bare name is still accepted for callers that
 * pass one, without the permission re-check). Optional levels are skipped when the chain advances, and "Rework" sends
 * the request back to the requester (see resubmitApproval).
 */
export function actOnApproval(id, decision, actor, remarks = "") {
  const actedBy = typeof actor === "string" ? actor : actor.name;
  const req = approvalStore.get().find((r) => r.id === id);
  if (!req || (typeof actor !== "string" && !canActOnApproval(req, actor))) return false;
  approvalStore.set((p) =>
    p.map((r) => {
      if (r.id !== id || r.status !== "Pending") return r; // a decided request cannot be decided again
      const steps = r.steps.map((s) =>
        s.level === r.currentLevel
          ? { ...s, status: decision, actedBy, actedAt: today(), remarks }
          : s,
      );
      if (decision !== "Approved") return { ...r, steps, status: decision };
      // Levels marked optional in the workflow are skipped (the flag was shown but never honoured).
      const optional = new Set(
        (workflowFor(r.module)?.levels ?? []).filter((l) => l.optional).map((l) => l.level),
      );
      let next = r.currentLevel + 1;
      while (next <= r.steps.length && optional.has(next)) next += 1;
      const done = next > r.steps.length;
      return {
        ...r,
        steps: steps.map((s) =>
          s.level > r.currentLevel && s.level < next ? { ...s, status: "Skipped" } : s,
        ),
        currentLevel: done ? r.currentLevel : next,
        status: done ? "Approved" : "Pending",
      };
    }),
  );
  return true;
}

/** A request sent back for rework is resubmitted by its requester and starts again at level 1. */
export function resubmitApproval(id, by) {
  const req = approvalStore.get().find((r) => r.id === id);
  if (!req || req.status !== "Rework" || req.requestedBy !== by.id) return false;
  approvalStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "Pending",
            currentLevel: firstRequiredLevel(r.module, r.steps.length),
            raisedOn: today(),
            steps: r.steps.map((s) => ({ level: s.level, role: s.role, status: "Pending" })),
          }
        : r,
    ),
  );
  return true;
}

export const approvalTone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Rework"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

export const useWorkflows = () => workflowStore.use();
export const useApprovals = () => approvalStore.use();
