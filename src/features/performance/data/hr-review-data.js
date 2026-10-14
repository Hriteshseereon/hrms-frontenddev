// -----------------------------------------------------------------------------
// HR employee reviews — the detailed "Add employee review" HR records on the
// Performance → Employee Review tab. HR assesses skills (technical, functional,
// behavioural), rates the organisation's evaluation parameters, considers the
// employee's goals (completed / in progress) with goal ratings, factors in
// attendance, discipline, training and the manager's review, and records
// strengths, improvements, remarks, recommendation and next steps.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { goalStore } from "@/features/performance/data/goals-data";
import { evalParamStore } from "@/features/performance/data/performance-config";
import { teamReviewStore } from "@/features/organization/data/manager-data";
import { trainingAssignmentStore } from "@/features/performance/data/training-assign";

export const REVIEW_TYPES = [
  "Quarterly review",
  "Mid-year review",
  "Annual review",
  "Probation confirmation",
  "Promotion readiness",
  "PIP checkpoint",
  "Exit / transition review",
  "Special (client escalation / recognition)",
];
/**
 * @typedef {(typeof REVIEW_TYPES)[number]} ReviewType
 */

export const SKILL_CATEGORIES = ["Technical", "Functional / Domain", "Behavioural", "Leadership"];
/**
 * @typedef {(typeof SKILL_CATEGORIES)[number]} SkillCategory
 */
export const SKILL_CATALOGUE = [
  {
    category: "Technical",
    skills: [
      "SAP ABAP / RAP",
      "SAP CPI / Integration",
      "SAP Fiori / UI5",
      "React / TypeScript",
      "Node.js / APIs",
      "Cloud (AWS / Azure)",
      "Data engineering / SQL",
      "QA automation (Playwright / Selenium)",
      "DevOps / CI-CD",
      "Security & compliance",
    ],
  },
  {
    category: "Functional / Domain",
    skills: [
      "Requirement analysis",
      "Solution design",
      "Finance / FI-CO",
      "Supply chain / MM-SD",
      "HR / payroll processes",
      "Client account management",
      "Project & delivery management",
      "Documentation",
    ],
  },
  {
    category: "Behavioural",
    skills: [
      "Communication",
      "Ownership & accountability",
      "Collaboration",
      "Adaptability",
      "Time management",
      "Client orientation",
      "Problem solving",
      "Integrity",
    ],
  },
  {
    category: "Leadership",
    skills: [
      "Mentoring",
      "Decision making",
      "Stakeholder management",
      "Strategic thinking",
      "Conflict resolution",
      "Driving initiatives",
    ],
  },
];
export const PROFICIENCY = ["", "Beginner", "Working", "Proficient", "Advanced", "Expert"];
export const RECOMMENDATIONS = [
  "Continue in role",
  "Confirm employment",
  "Extend probation",
  "Increment recommended",
  "Ready for promotion",
  "Role change / transfer",
  "Needs improvement plan (PIP)",
  "Retention action",
];

/**
 * @typedef {Object} SkillRating
 * @property {SkillCategory} category
 * @property {string} skill
 * @property {number | null} level
 * @property {string} evidence
 */
/**
 * @typedef {Object} GoalConsidered
 * @property {string} goalId
 * @property {string} title
 * @property {string} status
 * @property {number} progress
 * @property {string} target
 * @property {string} achieved
 * @property {number} weight
 * @property {number | null} rating
 * @property {boolean} considered
 */
/**
 * @typedef {Object} ParamRating
 * @property {string} paramId
 * @property {string} name
 * @property {number} weight
 * @property {number | null} rating
 * @property {string} note
 */

/**
 * @typedef {Object} HrReview
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} designation
 * @property {string} department
 * @property {string} reviewerId
 * @property {string} reviewer
 * @property {ReviewType} type
 * @property {string} cycle
 * @property {{ from: string, to: string }} period
 * @property {string} date
 * @property {"Scheduled" | "In Progress" | "Completed"} status
 * @property {GoalConsidered[]} goals - Inputs considered
 * @property {SkillRating[]} skills
 * @property {ParamRating[]} params
 * @property {{ attendancePct: number | null, lateMarks: number | null, warnings: number, trainingsCompleted: number, managerReviewId: string, managerRating: string, clientFeedback: string }} context
 * @property {string} strengths - Assessment
 * @property {string} improvements
 * @property {string} achievements
 * @property {string} remarks
 * @property {string} hrNotes
 * @property {(typeof RECOMMENDATIONS)[number]} recommendation
 * @property {string} developmentPlan
 * @property {string} nextReviewOn
 * @property {number | null} overallScore
 * @property {string} rating
 * @property {string[]} attachments
 * @property {boolean} sharedWithEmployee
 * @property {{ on: string, comment: string } | null} [employeeAck]
 * @property {{ at: string, by: string, action: string }[]} history
 */

const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const bandFor = (s) =>
  s >= 4.5
    ? "5 — Outstanding"
    : s >= 3.75
      ? "4 — Exceeds"
      : s >= 2.75
        ? "3 — Meets"
        : s >= 1.75
          ? "2 — Developing"
          : "1 — Below";

/** Weighted overall: 40 % goals · 40 % evaluation parameters · 20 % skills. */
export function hrOverall(goals, params, skills) {
  const avg = (rows) => {
    const used = rows.filter((x) => x.r !== null);
    const w = used.reduce((s, x) => s + x.w, 0);
    return w ? used.reduce((s, x) => s + x.r * x.w, 0) / w : null;
  };
  const g = avg(goals.filter((x) => x.considered).map((x) => ({ w: x.weight || 1, r: x.rating })));
  const p = avg(params.map((x) => ({ w: x.weight || 1, r: x.rating })));
  const s = avg(skills.map((x) => ({ w: 1, r: x.level })));
  const parts = [
    g !== null && { v: g, w: 0.4 },
    p !== null && { v: p, w: 0.4 },
    s !== null && { v: s, w: 0.2 },
  ].filter(Boolean);
  if (!parts.length) return null;
  const tw = parts.reduce((t, x) => t + x.w, 0);
  return +(parts.reduce((t, x) => t + x.v * x.w, 0) / tw).toFixed(2);
}

/** Pre-fill what HR should consider for an employee: goals, parameters, manager review and training context. */
export function seedForEmployee(empId) {
  const goals = goalStore
    .get()
    .filter((g) => g.ownerId === empId)
    .map((g) => ({
      goalId: g.id,
      title: g.title,
      status: g.status,
      progress: g.progress,
      target: g.target,
      achieved:
        g.status === "Completed" ? "Completed" : g.progress ? `${g.progress} % complete` : "",
      weight: g.weight || 20,
      rating: g.managerRating ?? null,
      considered: true,
    }));
  const params = evalParamStore
    .get()
    .filter((p) => p.active)
    .map((p) => ({ paramId: p.id, name: p.name, weight: p.weight, rating: null, note: "" }));
  const mr = teamReviewStore
    .get()
    .filter((r) => r.empId === empId && r.status === "Completed")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const trainings = trainingAssignmentStore
    .get()
    .filter((t) => t.empId === empId && t.status === "Completed").length;
  return {
    goals,
    params,
    managerReviewId: mr?.id ?? "",
    managerRating: mr?.rating ?? "",
    trainingsCompleted: trainings,
  };
}

export const hrReviewStore = createPersistentStore("seereon.hr.reviews.v1", [
  {
    id: "ER-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    designation: "Senior Engineer",
    department: "Engineering",
    reviewerId: "SRN-0144",
    reviewer: "Priya Nair",
    type: "Quarterly review",
    cycle: "Q3 FY26 Review",
    period: { from: "2026-04-01", to: "2026-06-30" },
    date: "2026-07-12",
    status: "Completed",
    goals: [
      {
        goalId: "GOL-001",
        title: "Reduce API p95 latency to 250 ms",
        status: "In Progress",
        progress: 55,
        target: "250 ms",
        achieved: "380 ms — profiling done, caching in progress",
        weight: 30,
        rating: 3,
        considered: true,
      },
      {
        goalId: "G-RCU",
        title: "Ship RCU portal phase 2",
        status: "Completed",
        progress: 100,
        target: "Go-live by 30 Jun",
        achieved: "Live 24 Jun, zero Sev-1",
        weight: 50,
        rating: 5,
        considered: true,
      },
    ],
    skills: [
      {
        category: "Technical",
        skill: "React / TypeScript",
        level: 5,
        evidence: "Owns the RCU portal front-end architecture",
      },
      {
        category: "Technical",
        skill: "Cloud (AWS / Azure)",
        level: 3,
        evidence: "Deployed phase 2 on ECS with DevOps support",
      },
      {
        category: "Behavioural",
        skill: "Communication",
        level: 3,
        evidence: "Client status reached PMO late twice in May",
      },
      {
        category: "Leadership",
        skill: "Mentoring",
        level: 4,
        evidence: "Two juniors, one fully independent",
      },
    ],
    params: [
      {
        paramId: "EP-01",
        name: "Communication",
        weight: 15,
        rating: 3,
        note: "Structure status updates",
      },
      { paramId: "EP-02", name: "Technical skills", weight: 25, rating: 5, note: "" },
      { paramId: "EP-03", name: "Behaviour", weight: 15, rating: 4, note: "" },
      {
        paramId: "EP-04",
        name: "Attitude",
        weight: 10,
        rating: 5,
        note: "Steps in on prod issues",
      },
      { paramId: "EP-05", name: "Aptitude & problem solving", weight: 15, rating: 4, note: "" },
      { paramId: "EP-06", name: "Delivery & quality", weight: 15, rating: 5, note: "" },
    ],
    context: {
      attendancePct: 96.5,
      lateMarks: 1,
      warnings: 0,
      trainingsCompleted: 1,
      managerReviewId: "TRV-001",
      managerRating: "4 — Exceeds",
      clientFeedback: "RCU PMO rated delivery 4.6/5 in the quarterly survey.",
    },
    strengths: "Delivery ownership, code quality, mentoring.",
    improvements: "Proactive stakeholder communication; broaden cloud skills.",
    achievements: "RCU portal phase 2 live with zero Sev-1; regression cycle down to 1.5 days.",
    remarks: "Consistent with the manager's review; calibrated at 4.",
    hrNotes: "Promotion case to be built for the annual cycle.",
    recommendation: "Ready for promotion",
    developmentPlan: "AWS SA-Associate by Dec; own the weekly client deck in Q3.",
    nextReviewOn: "2026-10-15",
    overallScore: 4.2,
    rating: "4 — Exceeds",
    attachments: ["rcu-phase2-closure.pdf"],
    sharedWithEmployee: true,
    employeeAck: { on: "2026-07-15", comment: "Thank you — will take up the client deck." },
    history: [
      { at: "2026-07-10", by: "Priya Nair", action: "Review scheduled" },
      {
        at: "2026-07-12",
        by: "Priya Nair",
        action: "Review completed — 4.2 / 5, Ready for promotion",
      },
    ],
  },
  {
    id: "ER-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    designation: "Account Manager",
    department: "Sales",
    reviewerId: "SRN-0146",
    reviewer: "Kavya Menon",
    type: "Quarterly review",
    cycle: "Q3 FY26 Review",
    period: { from: "2026-04-01", to: "2026-06-30" },
    date: "2026-07-20",
    status: "In Progress",
    goals: [
      {
        goalId: "G-Q",
        title: "Achieve 85 % of quarterly quota",
        status: "In Progress",
        progress: 70,
        target: "₹1.2 Cr closed-won",
        achieved: "₹84 L closed-won",
        weight: 60,
        rating: 3,
        considered: true,
      },
      {
        goalId: "G-P",
        title: "Open 3 new enterprise logos",
        status: "In Progress",
        progress: 66,
        target: "3",
        achieved: "2 signed, 1 in legal",
        weight: 40,
        rating: null,
        considered: true,
      },
    ],
    skills: [
      {
        category: "Functional / Domain",
        skill: "Client account management",
        level: 4,
        evidence: "Retained ZooPlus renewal",
      },
      {
        category: "Behavioural",
        skill: "Time management",
        level: 2,
        evidence: "CRM hygiene lagging",
      },
    ],
    params: [
      { paramId: "EP-01", name: "Communication", weight: 15, rating: 4, note: "" },
      { paramId: "EP-02", name: "Technical skills", weight: 25, rating: 3, note: "Product demos" },
      { paramId: "EP-03", name: "Behaviour", weight: 15, rating: 3, note: "" },
      { paramId: "EP-04", name: "Attitude", weight: 10, rating: 3, note: "" },
      { paramId: "EP-05", name: "Aptitude & problem solving", weight: 15, rating: null, note: "" },
      { paramId: "EP-06", name: "Delivery & quality", weight: 15, rating: null, note: "" },
    ],
    context: {
      attendancePct: 91.2,
      lateMarks: 4,
      warnings: 0,
      trainingsCompleted: 0,
      managerReviewId: "",
      managerRating: "",
      clientFeedback: "",
    },
    strengths: "Relationship building.",
    improvements: "Pipeline discipline and CRM updates.",
    achievements: "",
    remarks: "",
    hrNotes: "",
    recommendation: "Continue in role",
    developmentPlan: "",
    nextReviewOn: "",
    overallScore: 3.1,
    rating: "3 — Meets",
    attachments: [],
    sharedWithEmployee: false,
    employeeAck: null,
    history: [{ at: "2026-07-18", by: "Kavya Menon", action: "Review scheduled" }],
  },
  {
    id: "ER-003",
    empId: "SRN-0147",
    employee: "Arjun Kapoor",
    designation: "Software Engineer",
    department: "Engineering",
    reviewerId: "SRN-0144",
    reviewer: "Priya Nair",
    type: "PIP checkpoint",
    cycle: "Annual FY26",
    period: { from: "2026-07-01", to: "2026-09-30" },
    date: "2026-08-05",
    status: "Scheduled",
    goals: [],
    skills: [],
    params: [],
    context: {
      attendancePct: null,
      lateMarks: null,
      warnings: 0,
      trainingsCompleted: 0,
      managerReviewId: "",
      managerRating: "",
      clientFeedback: "",
    },
    strengths: "",
    improvements: "",
    achievements: "",
    remarks: "",
    hrNotes: "PIP-001 mid-point checkpoint.",
    recommendation: "Continue in role",
    developmentPlan: "",
    nextReviewOn: "",
    overallScore: null,
    rating: "",
    attachments: [],
    sharedWithEmployee: false,
    employeeAck: null,
    history: [{ at: "2026-08-01", by: "Priya Nair", action: "Review scheduled" }],
  },
]);
export const useHrReviews = () => hrReviewStore.use();

export function saveHrReview(input, by, complete) {
  if (!input.empId) return { ok: false, message: "Choose the employee." };
  if (input.period.from && input.period.to && input.period.to < input.period.from)
    return { ok: false, message: "Review period end must not be before its start." };
  if (complete && (!input.remarks.trim() || input.params.every((p) => p.rating === null)))
    return {
      ok: false,
      message: "Remarks and at least one parameter rating are required to complete the review.",
    };
  if (complete && input.empId === by.id)
    return { ok: false, message: "You cannot complete an HR review of yourself." };
  const overall = hrOverall(input.goals, input.params, input.skills);
  const nextNo =
    Math.max(0, ...hrReviewStore.get().map((r) => Number(r.id.match(/(\d+)$/)?.[1]) || 0)) + 1;
  const row = {
    ...input,
    id: input.id ?? `ER-${String(nextNo).padStart(3, "0")}`,
    overallScore: overall,
    rating: overall ? bandFor(overall) : "",
    status: complete ? "Completed" : input.status === "Completed" ? "Completed" : "In Progress",
    history: [],
  };
  const existing = hrReviewStore.get().find((r) => r.id === row.id);
  const action = complete
    ? `Review completed — ${overall ?? "—"} / 5, ${row.recommendation}`
    : existing
      ? "Review updated"
      : "Review created";
  row.history = [...(existing?.history ?? []), { at: today(), by: by.name, action }];
  hrReviewStore.set((l) => (existing ? l.map((r) => (r.id === row.id ? row : r)) : [row, ...l]));
  if (complete && row.sharedWithEmployee)
    pushAlert({
      empId: row.empId,
      kind: "review",
      to: "/emp/appraisals",
      title: `${row.cycle} — HR review shared`,
      body: `${row.type} by ${row.reviewer}: overall ${overall ?? "—"}/5 (${row.rating || "unrated"}) · ${row.recommendation}. Read and acknowledge on My Appraisals.`,
    });
  return {
    ok: true,
    message: complete
      ? `Review for ${row.employee} completed${row.sharedWithEmployee ? " and shared with the employee" : ""}.`
      : "Review saved.",
    id: row.id,
  };
}

/** Share a review that was completed without sharing — the employee is notified and can acknowledge it on My Appraisals. */
export function shareHrReview(id, by) {
  const r = hrReviewStore.get().find((x) => x.id === id);
  if (!r) return { ok: false, message: "Review not found." };
  if (r.status !== "Completed")
    return { ok: false, message: "Complete the review before sharing it." };
  if (r.sharedWithEmployee) return { ok: false, message: "Already shared with the employee." };
  hrReviewStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            sharedWithEmployee: true,
            history: [
              ...x.history,
              { at: today(), by: by.name, action: "Shared with the employee" },
            ],
          }
        : x,
    ),
  );
  pushAlert({
    empId: r.empId,
    kind: "review",
    to: "/emp/appraisals",
    title: `${r.cycle} — HR review shared`,
    body: `${r.type} by ${r.reviewer}: overall ${r.overallScore ?? "—"}/5 (${r.rating || "unrated"}) · ${r.recommendation}. Read and acknowledge on My Appraisals.`,
  });
  return { ok: true, message: `Shared with ${r.employee}.` };
}
/** Employee acknowledgement — only for a completed review that was shared and not yet acknowledged. */
export const ackHrReview = (id, comment) =>
  hrReviewStore.set((l) =>
    l.map((r) =>
      r.id === id && r.status === "Completed" && r.sharedWithEmployee && !r.employeeAck
        ? {
            ...r,
            employeeAck: { on: today(), comment },
            history: [
              ...r.history,
              { at: today(), by: r.employee, action: `Acknowledged — "${comment}"` },
            ],
          }
        : r,
    ),
  );
export const hrReviewTone = (s) =>
  s === "Completed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "In Progress"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border bg-muted text-muted-foreground";
