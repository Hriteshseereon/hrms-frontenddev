// Goals management — individual / team / department / organizational goals with
// milestones, progress and multi-level approval.
import { nextId } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";

export const GOAL_LEVELS = ["Individual", "Team", "Department", "Organizational"];
/**
 * @typedef {(typeof GOAL_LEVELS)[number]} GoalLevel
 */

export const GOAL_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "In Progress",
  "Completed",
];
/**
 * @typedef {(typeof GOAL_STATUSES)[number]} GoalStatus
 */

export const GOAL_RATINGS = ["Not Rated", "Below", "Meets", "Exceeds", "Outstanding"];
export const GOAL_CATEGORIES = [
  "Delivery / project",
  "Quality",
  "Revenue / business",
  "Customer / client",
  "Process improvement",
  "Learning & development",
  "People / leadership",
  "Compliance / risk",
  "Innovation",
];
export const GOAL_PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const GOAL_QUARTERS = [
  "Q1 FY27 (Apr–Jun 2026)",
  "Q2 FY27 (Jul–Sep 2026)",
  "Q3 FY27 (Oct–Dec 2026)",
  "Q4 FY27 (Jan–Mar 2027)",
  "H1 FY27",
  "H2 FY27",
  "Annual FY 2026-27",
];
export const METRIC_UNITS = [
  "Number",
  "Percentage",
  "Days",
  "Hours",
  "₹\u00A0(INR)",
  "Score (1–5)",
  "Yes / No",
];

/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {string} title
 * @property {string} due
 * @property {boolean} done
 */
/**
 * @typedef {Object} GoalLink
 * @property {string} label
 * @property {string} url
 */
/**
 * How the goal is measured — baseline → target, current value updated by the owner.
 * @typedef {Object} GoalMetric
 * @property {string} id
 * @property {string} name
 * @property {(typeof METRIC_UNITS)[number]} unit
 * @property {string} baseline
 * @property {string} target
 * @property {string} current
 * @property {number} weight
 */
/**
 * @typedef {Object} GoalHistory
 * @property {string} at
 * @property {string} by
 * @property {string} action
 */

/**
 * @typedef {Object} Goal
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {GoalLevel} level
 * @property {string} ownerId
 * @property {string} owner
 * @property {string} createdBy
 * @property {"Employee" | "Manager" | "HR" | "Admin"} createdByRole
 * @property {string} start
 * @property {string} due
 * @property {number} weight
 * @property {string} target
 * @property {number} progress
 * @property {GoalStatus} status
 * @property {string} rating
 * @property {string} managerRemarks
 * @property {number | null} [selfRating] - 1–5 self rating with justification (item 28) and manager rating.
 * @property {string} [selfJustification]
 * @property {number | null} [managerRating]
 * @property {string[]} documents
 * @property {Milestone[]} milestones
 * @property {(typeof GOAL_CATEGORIES)[number]} [category] - Detailed goal (v4)
 * @property {(typeof GOAL_PRIORITIES)[number]} [priority]
 * @property {string} [quarter]
 * @property {string} [successCriteria]
 * @property {GoalMetric[]} [metrics]
 * @property {string[]} [evaluationParams]
 * @property {GoalLink[]} [links]
 * @property {string} [alignedTo]
 * @property {string} [assignedById]
 * @property {string} [assignedOn]
 * @property {string} [reviewerId]
 * @property {string} [reviewer]
 * @property {string} [hrRemarks]
 * @property {string} [ownerNotes]
 * @property {GoalHistory[]} [history]
 */

export const goalStore = createPersistentStore("seereon.goals.v2", [
  {
    id: "GOL-001",
    title: "Reduce API p95 latency to 250 ms",
    level: "Individual",
    description: "Profile the billing service and cut p95 latency by 40% before the FY close.",
    ownerId: "SRN-0142",
    owner: "Ananya Sharma",
    createdBy: "Manish Patel",
    createdByRole: "Manager",
    start: "2026-07-01",
    due: "2026-09-30",
    weight: 30,
    target: "250 ms",
    progress: 55,
    status: "In Progress",
    rating: "Not Rated",
    managerRemarks: "Good traction on the caching layer.",
    documents: ["latency-baseline.pdf"],
    milestones: [
      { id: "MS-1", title: "Baseline profiling complete", due: "2026-07-15", done: true },
      { id: "MS-2", title: "Cache layer rollout", due: "2026-08-20", done: true },
      { id: "MS-3", title: "Load test sign-off", due: "2026-09-25", done: false },
    ],
    category: "Quality",
    priority: "High",
    quarter: "Q2 FY27 (Jul–Sep 2026)",
    successCriteria: "p95 ≤ 250 ms sustained for 2 weeks at production load; no regression in p99.",
    metrics: [
      {
        id: "M-1",
        name: "p95 latency",
        unit: "Number",
        baseline: "420 ms",
        target: "250 ms",
        current: "380 ms",
        weight: 70,
      },
      {
        id: "M-2",
        name: "Error rate",
        unit: "Percentage",
        baseline: "0.8",
        target: "0.5",
        current: "0.6",
        weight: 30,
      },
    ],
    evaluationParams: ["Technical skills", "Delivery & quality", "Aptitude & problem solving"],
    links: [
      {
        label: "Grafana latency dashboard",
        url: "https://grafana.seereon.co.in/d/billing-latency",
      },
      { label: "Jira epic BIL-220", url: "https://seereon.atlassian.net/browse/BIL-220" },
    ],
    assignedById: "SRN-0149",
    assignedOn: "2026-06-28",
    reviewerId: "SRN-0149",
    reviewer: "Manish Patel",
    ownerNotes: "Caching layer live; load test scheduled 20 Sep.",
    history: [
      { at: "2026-06-28", by: "Manish Patel", action: "Goal assigned" },
      {
        at: "2026-08-20",
        by: "Ananya Sharma",
        action: "Milestone 'Cache layer rollout' completed · progress 55 %",
      },
    ],
  },
  {
    id: "GOL-002",
    title: "Close FY27 hiring plan for Engineering",
    level: "Department",
    description: "Fill 18 open engineering roles across Bhubaneswar and Pune.",
    ownerId: "SRN-0144",
    owner: "Priya Nair",
    createdBy: "Priya Nair",
    createdByRole: "HR",
    start: "2026-04-01",
    due: "2027-03-31",
    weight: 40,
    target: "18 hires",
    progress: 35,
    status: "Approved",
    rating: "Not Rated",
    managerRemarks: "",
    documents: [],
    milestones: [{ id: "MS-1", title: "6 hires by Q2", due: "2026-09-30", done: false }],
    category: "People / leadership",
    priority: "Critical",
    quarter: "Annual FY 2026-27",
    successCriteria:
      "All 18 roles filled with offer acceptance ≥ 85 % and 90-day retention ≥ 95 %.",
    metrics: [
      {
        id: "M-1",
        name: "Hires closed",
        unit: "Number",
        baseline: "0",
        target: "18",
        current: "6",
        weight: 60,
      },
      {
        id: "M-2",
        name: "Time to fill",
        unit: "Days",
        baseline: "52",
        target: "35",
        current: "44",
        weight: 40,
      },
    ],
    evaluationParams: ["Delivery & quality", "Communication"],
    links: [{ label: "Hiring tracker", url: "https://seereon.co.in/hiring/fy27" }],
    assignedById: "SRN-0010",
    assignedOn: "2026-04-01",
    reviewerId: "SRN-0010",
    reviewer: "Farah Khan",
    history: [{ at: "2026-04-01", by: "Farah Khan", action: "Goal assigned" }],
  },
  {
    id: "GOL-003",
    title: "Grow enterprise ARR by 25%",
    level: "Organizational",
    description: "Organization-wide revenue goal cascaded to all sales pods.",
    ownerId: "SRN-0146",
    owner: "Kavya Menon",
    createdBy: "Admin",
    createdByRole: "Admin",
    start: "2026-04-01",
    due: "2027-03-31",
    weight: 50,
    target: "₹\u00A042 Cr",
    progress: 20,
    status: "Approved",
    rating: "Not Rated",
    managerRemarks: "",
    documents: ["arr-plan.xlsx"],
    milestones: [],
  },
  {
    id: "GOL-004",
    title: "Complete AWS Solutions Architect certification",
    level: "Individual",
    description: "Developmental goal for the FY26 growth plan.",
    ownerId: "SRN-0147",
    owner: "Arjun Kapoor",
    createdBy: "Arjun Kapoor",
    createdByRole: "Employee",
    start: "2026-07-10",
    due: "2026-12-15",
    weight: 15,
    target: "Certified",
    progress: 10,
    status: "Pending Approval",
    rating: "Not Rated",
    managerRemarks: "",
    documents: [],
    milestones: [],
  },
]);

/** Next goal id from the highest existing number (`length` collides once any goal is removed / re-seeded). */
const nextGoalId = (list) =>
  nextId("GOL", Math.max(0, ...list.map((g) => Number(g.id.match(/(\d+)$/)?.[1]) || 0)));
export const addGoal = (g) => {
  const id = nextGoalId(goalStore.get());
  goalStore.set((p) => [{ ...g, id }, ...p]);
  return id;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Create a detailed goal from any portal. Managers / HR / admins assign goals (active immediately);
 * employees self-add (pending manager approval). Returns the new goal id.
 */
export function createGoal(input, by) {
  const self = by.id === input.ownerId;
  const role = self
    ? "Employee"
    : ["HR", "CHRO"].includes(by.role)
      ? "HR"
      : ["Admin", "SuperAdmin", "CEO", "COO", "CFO"].includes(by.role)
        ? "Admin"
        : "Manager";
  const status = input.status ?? (self ? "Pending Approval" : "Approved");
  const id = nextGoalId(goalStore.get());
  const row = {
    ...input,
    id,
    createdBy: by.name,
    createdByRole: role,
    progress: 0,
    status,
    rating: "Not Rated",
    assignedById: self ? undefined : by.id,
    assignedOn: today(),
    history: [
      {
        at: today(),
        by: by.name,
        action: self
          ? "Goal created — pending manager approval"
          : `Goal assigned by ${by.name} (${by.role})`,
      },
    ],
  };
  goalStore.set((p) => [row, ...p]);
  return { id, row, self };
}

export const logGoal = (id, by, action) =>
  goalStore.set((p) =>
    p.map((g) =>
      g.id === id ? { ...g, history: [...(g.history ?? []), { at: today(), by, action }] } : g,
    ),
  );
export const updateMetric = (goalId, metricId, current) =>
  goalStore.set((p) =>
    p.map((g) =>
      g.id === goalId
        ? {
            ...g,
            metrics: (g.metrics ?? []).map((m) => (m.id === metricId ? { ...m, current } : m)),
          }
        : g,
    ),
  );

export const updateGoal = (id, patch) =>
  goalStore.set((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));

export const addMilestone = (goalId, title, due) =>
  goalStore.set((p) =>
    p.map((g) =>
      g.id === goalId
        ? {
            ...g,
            milestones: [
              ...g.milestones,
              { id: `MS-${g.milestones.length + 1}`, title, due, done: false },
            ],
          }
        : g,
    ),
  );

export const toggleMilestone = (goalId, msId) =>
  goalStore.set((p) =>
    p.map((g) =>
      g.id === goalId
        ? {
            ...g,
            milestones: g.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done } : m)),
          }
        : g,
    ),
  );

export const goalTone = (s) =>
  s === "Completed" || s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Pending Approval" || s === "In Progress"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

export const useGoals = () => goalStore.use();
