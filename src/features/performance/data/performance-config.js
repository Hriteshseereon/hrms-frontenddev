// Evaluation parameters + appraisal / review forms (quarterly goal review, annual appraisal, self-appraisal).
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";

/**
 * @typedef {Object} EvalParam
 * @property {string} id
 * @property {string} name
 * @property {number} weight
 * @property {string} description
 * @property {string} forRoles
 * @property {boolean} active
 */
export const DEFAULT_EVAL_PARAMS = [
  {
    id: "EP-01",
    name: "Communication",
    weight: 15,
    description: "Clarity with clients and team, documentation",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-02",
    name: "Technical skills",
    weight: 25,
    description: "Depth and currency in the primary stack",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-03",
    name: "Behaviour",
    weight: 15,
    description: "Professional conduct, collaboration, respect",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-04",
    name: "Attitude",
    weight: 10,
    description: "Ownership, positivity, response to feedback",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-05",
    name: "Aptitude & problem solving",
    weight: 15,
    description: "Analytical ability, learning speed",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-06",
    name: "Delivery & quality",
    weight: 15,
    description: "On-time, defect-free, client satisfaction",
    forRoles: "All",
    active: true,
  },
  {
    id: "EP-07",
    name: "Leadership & mentoring",
    weight: 5,
    description: "Guides juniors, drives initiatives",
    forRoles: "Lead / Manager",
    active: true,
  },
];
export const evalParamStore = createPersistentStore(
  "seereon.masters.eval-params",
  DEFAULT_EVAL_PARAMS,
);
export const useEvalParams = () => evalParamStore.use();
export const saveEvalParam = (p) =>
  evalParamStore.set((l) =>
    l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p],
  );

/**
 * @typedef {Object} Rating
 * @property {string} paramId
 * @property {number | null} self
 * @property {number | null} manager
 * @property {number | null} hr
 * @property {string} selfNote
 * @property {string} managerNote
 */
/**
 * @typedef {"Quarterly review" | "Annual appraisal"} ReviewKind
 */
/**
 * @typedef {"Open" | "Self submitted" | "Manager reviewed" | "HR calibrated" | "Closed"} ReviewStatus
 */
/**
 * @typedef {Object} ReviewForm
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {ReviewKind} kind
 * @property {string} cycle
 * @property {string} period
 * @property {ReviewStatus} status
 * @property {{ title: string, target: string, achieved: string, selfRating: number | null, managerRating: number | null, weight: number }[]} goals
 * @property {Rating[]} ratings
 * @property {{ achievements: string, valueCreated: string, justification: string, development: string, evidence: string[], submittedOn?: string }} self
 * @property {{ comments: string, recommendation: "Exceeds" | "Meets" | "Below" | "", hikePct: number | null, promotion: boolean, reviewedOn?: string, by?: string }} manager
 * @property {{ calibratedRating: number | null, finalHikePct: number | null, comments: string, closedOn?: string, by?: string }} hr
 */

export const weightedRating = (r, params, who) => {
  const used = params
    .filter((p) => p.active)
    .map((p) => ({ p, v: r.find((x) => x.paramId === p.id)?.[who] ?? null }))
    .filter((x) => x.v !== null);
  const w = used.reduce((s, x) => s + x.p.weight, 0) || 1;
  return used.length ? +(used.reduce((s, x) => s + x.v * x.p.weight, 0) / w).toFixed(2) : null;
};

const blank = (params) =>
  params
    .filter((p) => p.active)
    .map((p) => ({
      paramId: p.id,
      self: null,
      manager: null,
      hr: null,
      selfNote: "",
      managerNote: "",
    }));

export const reviewStore = createPersistentStore("seereon.performance.reviews", [
  {
    id: "RV-2026-Q1-0006",
    empId: "SRN-0006",
    employee: "Subham Das",
    kind: "Quarterly review",
    cycle: "Q1 FY27 (Apr–Jun 2026)",
    period: "2026-Q1",
    status: "Closed",
    goals: [
      {
        title: "Ship billing revamp",
        target: "Go-live by 30 Jun",
        achieved: "Live 28 Jun, 0 P1 defects",
        selfRating: 5,
        managerRating: 5,
        weight: 40,
      },
      {
        title: "Reduce p95 API latency by 30 %",
        target: "≤ 350 ms",
        achieved: "380 ms (−24 %)",
        selfRating: 4,
        managerRating: 3,
        weight: 35,
      },
      {
        title: "Mentor 2 juniors",
        target: "Weekly 1:1s",
        achieved: "Done; both on client work",
        selfRating: 4,
        managerRating: 4,
        weight: 25,
      },
    ],
    ratings: [
      { paramId: "EP-01", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      {
        paramId: "EP-02",
        self: 5,
        manager: 4,
        hr: 4,
        selfNote: "",
        managerNote: "Strong on RAP; broaden CPI",
      },
      { paramId: "EP-03", self: 4, manager: 5, hr: 5, selfNote: "", managerNote: "" },
      { paramId: "EP-04", self: 5, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-05", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-06", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
    ],
    self: {
      achievements:
        "Delivered billing revamp on time with zero P1 defects; cut p95 latency by 24 %.",
      valueCreated: "Billing revamp unblocked ₹1.2 Cr of ZooPlus renewals.",
      justification: "",
      development: "SAP CPI certification",
      evidence: ["release-notes-jun.pdf"],
      submittedOn: "2026-07-03",
    },
    manager: {
      comments: "Reliable delivery; keep pushing on latency.",
      recommendation: "Exceeds",
      hikePct: null,
      promotion: false,
      reviewedOn: "2026-07-08",
      by: "Subh Sahoo",
    },
    hr: {
      calibratedRating: 4.2,
      finalHikePct: null,
      comments: "Calibrated with Engineering band.",
      closedOn: "2026-07-12",
      by: "Ritu Bansal",
    },
  },
  {
    id: "RV-2026-Q2-0006",
    empId: "SRN-0006",
    employee: "Subham Das",
    kind: "Quarterly review",
    cycle: "Q2 FY27 (Jul–Sep 2026)",
    period: "2026-Q2",
    status: "Open",
    goals: [
      {
        title: "ZooPlus KSeF e-invoicing rollout",
        target: "UAT sign-off by 30 Sep",
        achieved: "",
        selfRating: null,
        managerRating: null,
        weight: 50,
      },
      {
        title: "CPI certification",
        target: "Pass by Sep",
        achieved: "",
        selfRating: null,
        managerRating: null,
        weight: 20,
      },
      {
        title: "Knowledge sessions",
        target: "2 sessions",
        achieved: "",
        selfRating: null,
        managerRating: null,
        weight: 30,
      },
    ],
    ratings: blank(DEFAULT_EVAL_PARAMS),
    self: { achievements: "", valueCreated: "", justification: "", development: "", evidence: [] },
    manager: { comments: "", recommendation: "", hikePct: null, promotion: false },
    hr: { calibratedRating: null, finalHikePct: null, comments: "" },
  },
  {
    id: "RV-FY26-ANN-0006",
    empId: "SRN-0006",
    employee: "Subham Das",
    kind: "Annual appraisal",
    cycle: "Annual FY 2025-26",
    period: "FY26",
    status: "Closed",
    goals: [
      {
        title: "Payments migration",
        target: "Complete",
        achieved: "Complete",
        selfRating: 5,
        managerRating: 5,
        weight: 60,
      },
      {
        title: "Client CSAT ≥ 4.5",
        target: "4.5",
        achieved: "4.6",
        selfRating: 4,
        managerRating: 4,
        weight: 40,
      },
    ],
    ratings: [
      { paramId: "EP-01", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-02", self: 5, manager: 5, hr: 4.5, selfNote: "", managerNote: "" },
      { paramId: "EP-03", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-04", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-05", self: 4, manager: 4, hr: 4, selfNote: "", managerNote: "" },
      { paramId: "EP-06", self: 5, manager: 4, hr: 4, selfNote: "", managerNote: "" },
    ],
    self: {
      achievements: "Led the payments migration end to end.",
      valueCreated: "Saved ~₹18 L/yr in gateway fees.",
      justification: "Took senior-engineer scope for the full year; ready for the next grade.",
      development: "Architecture reviews",
      evidence: ["payments-migration-summary.pdf"],
      submittedOn: "2026-04-05",
    },
    manager: {
      comments: "Consistently strong delivery; recommend hike and G5.",
      recommendation: "Exceeds",
      hikePct: 12,
      promotion: true,
      reviewedOn: "2026-04-10",
      by: "Subh Sahoo",
    },
    hr: {
      calibratedRating: 4.3,
      finalHikePct: 10,
      comments: "Promotion to G5 approved effective Apr 2026.",
      closedOn: "2026-04-12",
      by: "Farah Khan",
    },
  },
]);
export const useReviews = () => reviewStore.use();
export const newReview = (empId, employee, kind, cycle, period, goals, params) => {
  const row = {
    id: `RV-${period}-${empId.slice(-4)}-${Date.now().toString(36)}`,
    empId,
    employee,
    kind,
    cycle,
    period,
    status: "Open",
    goals,
    ratings: blank(params),
    self: { achievements: "", valueCreated: "", justification: "", development: "", evidence: [] },
    manager: { comments: "", recommendation: "", hikePct: null, promotion: false },
    hr: { calibratedRating: null, finalHikePct: null, comments: "" },
  };
  reviewStore.set((l) => [row, ...l]);
  pushAlert({
    empId,
    kind: "review",
    to: "/emp/appraisals",
    title: `${kind} launched`,
    body: `${cycle}: complete your self-appraisal (goals, parameters, justification & evidence).`,
  });
  return row;
};
export const updateReview = (id, fn) =>
  reviewStore.set((l) => l.map((r) => (r.id === id ? fn(r) : r)));
export const reviewTone = (s) =>
  s === "Closed" || s === "HR calibrated"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Open"
      ? "border-border bg-muted text-muted-foreground"
      : "border-gold/40 bg-gold/15 text-gold";
