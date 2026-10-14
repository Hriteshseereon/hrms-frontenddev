// Manager hierarchy, substitute (delegated) managers and manager-run performance reviews.
import { nextId } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";
import { directoryEmployees } from "@/features/employees/data/employee-directory";
import { SEEREON_USERS, moveUserAccount, userById } from "@/features/auth/data/auth-session";

/** empId -> manager empId */
const SEED_MANAGERS = {
  // Seereon reporting lines — CEO → CXO → VP/Head → Manager/HRBP → Employee
  "SRN-0002": "SRN-0001", // CFO → CEO
  "SRN-0003": "SRN-0001", // COO → CEO
  "SRN-0009": "SRN-0001", // CTO → CEO
  "SRN-0010": "SRN-0001", // CHRO → CEO
  "SRN-0011": "SRN-0010", // VP People Ops → CHRO
  "SRN-0004": "SRN-0011", // Head of HR → VP People Ops
  "SRN-0012": "SRN-0004", // HRBP Engineering → Head of HR
  "SRN-0013": "SRN-0004", // HRBP Ops & Sales → Head of HR
  "SRN-0005": "SRN-0009", // Engineering Manager → CTO
  "SRN-0006": "SRN-0005",
  "SRN-0007": "SRN-0005",
  "SRN-0008": "SRN-0005",
  "SRN-0014": "SRN-0005",
  "SRN-0015": "SRN-0005",
  "SRN-0016": "SRN-0005",
  "SRN-0142": "SRN-0149",
  "SRN-0147": "SRN-0149",
  "SRN-0143": "SRN-0146",
  "SRN-0148": "SRN-0146",
  "SRN-0145": "SRN-0146",
  "SRN-0144": "SRN-0149",
  "SRN-0149": "SRN-0009",
  "SRN-0146": "SRN-0003",
};

// Persisted — manager assignments made on the employee record were lost on reload.
// People of the other Seereon companies (SAP Practice, Cloud, Products) carry their manager on their account only —
// without it their managers' "My Team" was empty.
const FROM_ACCOUNTS = Object.fromEntries(
  SEEREON_USERS.filter((u) => u.managerId && !SEED_MANAGERS[u.id]).map((u) => [u.id, u.managerId]),
);
export const managerStore = createPersistentStore("seereon.org.managers.v1", {
  ...FROM_ACCOUNTS,
  ...SEED_MANAGERS,
});

/**
 * Assign (or clear with "") the reporting manager; a manager can never report to themself or to their own report chain.
 * The login account's managerId follows — approvals (leave, exits, the approval inbox) route by the account, so a
 * change made here used to leave every request going to the old manager.
 */
export const setManager = (empId, managerId) => {
  setManagerMap(empId, managerId);
  const applied = (managerStore.get()[empId] ?? "") === (managerId || "");
  if (applied && userById(empId)) moveUserAccount(empId, { managerId: managerId || null });
};
function setManagerMap(empId, managerId) {
  managerStore.set((p) => {
    const next = { ...p };
    if (!managerId) {
      delete next[empId];
      return next;
    }
    // Walk up from the new manager — if we reach empId the assignment would create a reporting loop.
    let cur = managerId;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      if (cur === empId) return p;
      seen.add(cur);
      cur = p[cur];
    }
    next[empId] = managerId;
    return next;
  });
}

export const useManagerMap = () => managerStore.use();

// Directory incl. new hires — the static roster missed everyone hired through the app.
export function directReports(map, managerId) {
  return directoryEmployees().filter((e) => map[e.id] === managerId);
}

export const managerName = (map, empId) =>
  directoryEmployees().find((e) => e.id === map[empId])?.name ?? "—";

/* ---------------- Substitute assignments ---------------- */

/**
 * @typedef {Object} Substitute
 * @property {string} id
 * @property {string} managerId
 * @property {string} manager
 * @property {string} substituteId
 * @property {string} substitute
 * @property {string} scope
 * @property {string} from
 * @property {string} to
 * @property {string} reason
 * @property {"Active" | "Expired"} status
 */

export const SUBSTITUTE_SCOPES = [
  "Leave Approvals",
  "Attendance Approvals",
  "Timesheet Approvals",
  "Performance Reviews",
  "Reimbursement Approvals",
  "All Manager Duties",
];

export const substituteStore = createPersistentStore("seereon.org.substitutes.v1", [
  {
    id: "SUB-001",
    managerId: "SRN-0149",
    manager: "Manish Patel",
    substituteId: "SRN-0147",
    substitute: "Arjun Kapoor",
    scope: "Leave Approvals",
    from: "2026-08-01",
    to: "2026-08-14",
    reason: "Manager on annual leave",
    status: "Active",
  },
]);

export const addSubstitute = (s) =>
  substituteStore.set((p) => [
    {
      ...s,
      id: nextId(
        "SUB",
        p.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0),
      ),
      status: "Active",
    },
    ...p,
  ]);

export const endSubstitute = (id) =>
  substituteStore.set((p) => p.map((s) => (s.id === id ? { ...s, status: "Expired" } : s)));

/* ---------------- Manager-run reviews ---------------- */

export const REVIEW_BASES = [
  "Quarterly goal review",
  "Mid-year review",
  "Annual appraisal input",
  "Probation confirmation review",
  "Project / engagement closure",
  "Performance improvement plan (PIP) checkpoint",
  "Promotion readiness",
];
/**
 * @typedef {Object} ReviewGoal
 * @property {string} goalId
 * @property {string} title
 * @property {string} target
 * @property {string} achieved
 * @property {number} weight
 * @property {number | null} rating
 */
/**
 * @typedef {Object} ReviewParam
 * @property {string} paramId
 * @property {string} name
 * @property {number} weight
 * @property {number | null} rating
 * @property {string} note
 */
/**
 * @typedef {Object} TeamReview
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} managerId
 * @property {string} manager
 * @property {string} cycle
 * @property {string} date
 * @property {string} rating
 * @property {"Scheduled" | "In Progress" | "Completed"} status
 * @property {string} strengths
 * @property {string} improvements
 * @property {string} remarks
 * @property {string} [basis] - Detailed review (enterprise form)
 * @property {{ from: string, to: string }} [period]
 * @property {ReviewGoal[]} [goals]
 * @property {ReviewParam[]} [params]
 * @property {string} [feedback]
 * @property {string} [suggestions]
 * @property {string} [developmentPlan]
 * @property {number | null} [overallScore]
 * @property {"Continue in role" | "Ready for promotion" | "Increment recommended" | "Needs improvement plan" | "Extend probation" | "Confirm employment"} [recommendation]
 * @property {string[]} [attachments]
 * @property {{ on: string, comment: string } | null} [employeeAck]
 * @property {boolean} [sharedWithEmployee]
 */

export const teamReviewStore = createPersistentStore("seereon.team.reviews.v2", [
  {
    id: "TRV-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    managerId: "SRN-0149",
    manager: "Manish Patel",
    cycle: "Q3 FY26 Review",
    date: "2026-07-12",
    rating: "4 — Exceeds",
    status: "Completed",
    strengths: "Delivery predictability, mentoring",
    improvements: "Stakeholder comms",
    remarks: "Ready for larger scope next quarter.",
    basis: "Quarterly goal review",
    period: { from: "2026-04-01", to: "2026-06-30" },
    goals: [
      {
        goalId: "G-1",
        title: "Ship RCU portal phase 2",
        target: "Go-live by 30 Jun",
        achieved: "Live on 24 Jun; zero Sev-1 in first 2 weeks",
        weight: 50,
        rating: 5,
      },
      {
        goalId: "G-2",
        title: "Mentor two junior engineers",
        target: "Both independent on tickets",
        achieved: "One fully independent, one shadowing",
        weight: 30,
        rating: 4,
      },
      {
        goalId: "G-3",
        title: "Reduce regression cycle",
        target: "< 2 days",
        achieved: "1.5 days after test automation",
        weight: 20,
        rating: 4,
      },
    ],
    params: [
      { paramId: "EP-1", name: "Technical competence", weight: 30, rating: 5, note: "" },
      {
        paramId: "EP-2",
        name: "Communication",
        weight: 20,
        rating: 3,
        note: "Stakeholder updates need more structure",
      },
      { paramId: "EP-3", name: "Ownership", weight: 25, rating: 5, note: "" },
      { paramId: "EP-4", name: "Teamwork", weight: 25, rating: 4, note: "" },
    ],
    feedback:
      "Ananya carried the RCU phase-2 delivery end to end, kept the plan predictable and stepped in on production issues without being asked. The quality bar on her pull requests raised the team's standard. The one area to work on is proactive communication with the client PMO — status reached them late twice in May.",
    suggestions:
      "Own the weekly client status deck for Q3; pair with Priya on stakeholder communication; take the Architecture Fundamentals course on the LMS.",
    developmentPlan:
      "Q3: lead the Semtech integration track; present at the engineering guild; complete AWS SA-Associate.",
    overallScore: 4.4,
    recommendation: "Ready for promotion",
    attachments: ["rcu-phase2-closure.pdf"],
    employeeAck: {
      on: "2026-07-14",
      comment: "Agree with the feedback; will take the client status deck from July.",
    },
    sharedWithEmployee: true,
  },
  {
    id: "TRV-002",
    empId: "SRN-0147",
    employee: "Arjun Kapoor",
    managerId: "SRN-0149",
    manager: "Manish Patel",
    cycle: "Q3 FY26 Review",
    date: "2026-08-05",
    rating: "",
    status: "Scheduled",
    strengths: "",
    improvements: "",
    remarks: "",
  },
]);

export const addTeamReview = (r) =>
  teamReviewStore.set((p) => [
    {
      ...r,
      id: nextId(
        "TRV",
        p.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0),
      ),
    },
    ...p,
  ]);

export const updateTeamReview = (id, patch) =>
  teamReviewStore.set((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
