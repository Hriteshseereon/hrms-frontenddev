// -----------------------------------------------------------------------------
// HR-initiated appraisals — modelled on the employee self-appraisal form but
// filled by HR: why the appraisal happened (trigger), purpose, cycle & timeline,
// goals considered with HR ratings, evaluation-parameter ratings, linked reviews,
// value / justification, method and the pay outcome (grade, CTC, hike %,
// effective date, letter). Approving applies the compensation change and
// generates the letter, exactly like the self-appraisal outcome.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { goalStore } from "@/features/performance/data/goals-data";
import { evalParamStore } from "@/features/performance/data/performance-config";
import {
  getEmployeeProfile,
  updateCompensation,
} from "@/features/employees/data/employee-directory";
import { computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { teamReviewStore } from "@/features/organization/data/manager-data";
import { hrReviewStore } from "@/features/performance/data/hr-review-data";
import { APPRAISAL_METHODS } from "@/features/performance/data/performance-data";

export const APPRAISAL_TRIGGERS = [
  "Annual appraisal cycle",
  "Manager review outcome",
  "HR review outcome",
  "Promotion decision",
  "Market correction",
  "Retention (counter-offer)",
  "Confirmation after probation",
  "Role change",
  "Special recognition / award",
  "Client escalation resolved",
];
/**
 * @typedef {(typeof APPRAISAL_TRIGGERS)[number]} AppraisalTrigger
 */
export const APPRAISAL_PURPOSES_HR = [
  "Annual increment",
  "Promotion / grade change",
  "Mid-year increment",
  "Role change with revised pay",
  "Confirmation after probation",
  "Retention correction",
  "Performance bonus",
];
export const LETTER_TYPES = ["Increment Letter", "Promotion Letter", "Appointment Letter"];

/**
 * @typedef {Object} AppraisalGoal
 * @property {string} goalId
 * @property {string} title
 * @property {string} status
 * @property {number} progress
 * @property {string} target
 * @property {string} achievement
 * @property {number | null} rating
 * @property {number} weight
 */
/**
 * @typedef {Object} AppraisalParam
 * @property {string} paramId
 * @property {string} name
 * @property {number} weight
 * @property {number | null} rating
 * @property {string} note
 */

/**
 * @typedef {Object} HrAppraisal
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} designation
 * @property {string} department
 * @property {string} grade
 * @property {string} cycle
 * @property {AppraisalTrigger} trigger
 * @property {(typeof APPRAISAL_PURPOSES_HR)[number]} purpose
 * @property {string} whyHappened
 * @property {{ from: string, to: string }} timeline
 * @property {AppraisalGoal[]} goals
 * @property {AppraisalParam[]} params
 * @property {{ id: string, kind: "Manager review" | "HR review", by: string, rating: string, score: number | null }[]} linkedReviews
 * @property {{ achievements: string, valueCreated: string, justification: string }} value
 * @property {number | null} overallScore
 * @property {string} rating
 * @property {string} method
 * @property {number} currentCtc
 * @property {number} newCtc
 * @property {number} percentage
 * @property {string} newGrade
 * @property {string} newDesignation
 * @property {string} effectiveFrom
 * @property {(typeof LETTER_TYPES)[number]} letterType
 * @property {number} bonusAmount
 * @property {string} remarks
 * @property {string[]} attachments
 * @property {"Draft" | "Approved" | "Applied" | "Rejected"} status
 * @property {string} createdBy
 * @property {string} createdOn
 * @property {string} [approvedBy]
 * @property {string} [approvedOn]
 * @property {string} [letterRef]
 * @property {{ at: string, by: string, action: string }[]} history
 */

const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const bandOf = (s) =>
  s >= 4.5
    ? "5 — Outstanding"
    : s >= 3.75
      ? "4 — Exceeds"
      : s >= 2.75
        ? "3 — Meets"
        : s >= 1.75
          ? "2 — Developing"
          : "1 — Below";
export function appraisalScore(goals, params) {
  const avg = (rows) => {
    const used = rows.filter((x) => x.r !== null);
    const w = used.reduce((s, x) => s + x.w, 0);
    return w ? used.reduce((s, x) => s + x.r * x.w, 0) / w : null;
  };
  const g = avg(goals.map((x) => ({ w: x.weight || 1, r: x.rating })));
  const p = avg(params.map((x) => ({ w: x.weight || 1, r: x.rating })));
  if (g === null && p === null) return null;
  if (g === null) return +p.toFixed(2);
  if (p === null) return +g.toFixed(2);
  return +((g + p) / 2).toFixed(2);
}

/** What HR starts from for an employee: goals, parameters, linked reviews and the current pay. */
export function appraisalSeed(empId) {
  const p = getEmployeeProfile(empId);
  const goals = goalStore
    .get()
    .filter((g) => g.ownerId === empId)
    .map((g) => ({
      goalId: g.id,
      title: g.title,
      status: g.status,
      progress: g.progress,
      target: g.target,
      achievement:
        g.status === "Completed" ? "Completed" : g.progress ? `${g.progress} % complete` : "",
      rating: g.managerRating ?? null,
      weight: g.weight || 20,
    }));
  const params = evalParamStore
    .get()
    .filter((x) => x.active)
    .map((x) => ({ paramId: x.id, name: x.name, weight: x.weight, rating: null, note: "" }));
  const linked = [
    ...teamReviewStore
      .get()
      .filter((r) => r.empId === empId && r.status === "Completed")
      .map((r) => ({
        id: r.id,
        kind: "Manager review",
        by: r.manager,
        rating: r.rating,
        score: r.overallScore ?? null,
      })),
    ...hrReviewStore
      .get()
      .filter((r) => r.empId === empId && r.status === "Completed")
      .map((r) => ({
        id: r.id,
        kind: "HR review",
        by: r.reviewer,
        rating: r.rating,
        score: r.overallScore,
      })),
  ];
  return {
    goals,
    params,
    linked,
    ctc: p.payroll.ctc,
    grade: p.job.grade,
    monthlyGross: p.payroll.monthlyGross,
  };
}

export const hrAppraisalStore = createPersistentStore("seereon.appraisals.v2", [
  {
    id: "APR-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    designation: "Senior Engineer",
    department: "Engineering",
    grade: "G4",
    cycle: "Q3 FY26 Review",
    trigger: "HR review outcome",
    purpose: "Annual increment",
    whyHappened:
      "Q3 HR review (ER-001) and the manager's review (TRV-001) both rated 4+ with a promotion-readiness recommendation; RCU phase 2 delivered with zero Sev-1.",
    timeline: { from: "2026-04-01", to: "2026-06-30" },
    goals: [
      {
        goalId: "GOL-001",
        title: "Reduce API p95 latency to 250 ms",
        status: "In Progress",
        progress: 55,
        target: "250 ms",
        achievement: "380 ms after profiling; caching in progress",
        rating: 3,
        weight: 30,
      },
      {
        goalId: "G-RCU",
        title: "Ship RCU portal phase 2",
        status: "Completed",
        progress: 100,
        target: "Go-live by 30 Jun",
        achievement: "Live 24 Jun, zero Sev-1",
        rating: 5,
        weight: 50,
      },
    ],
    params: [
      { paramId: "EP-01", name: "Communication", weight: 15, rating: 3, note: "" },
      { paramId: "EP-02", name: "Technical skills", weight: 25, rating: 5, note: "" },
      { paramId: "EP-03", name: "Behaviour", weight: 15, rating: 4, note: "" },
      { paramId: "EP-04", name: "Attitude", weight: 10, rating: 5, note: "" },
      { paramId: "EP-05", name: "Aptitude & problem solving", weight: 15, rating: 4, note: "" },
      { paramId: "EP-06", name: "Delivery & quality", weight: 15, rating: 5, note: "" },
    ],
    linkedReviews: [
      {
        id: "TRV-001",
        kind: "Manager review",
        by: "Manish Patel",
        rating: "4 — Exceeds",
        score: 4.4,
      },
      { id: "ER-001", kind: "HR review", by: "Priya Nair", rating: "4 — Exceeds", score: 4.2 },
    ],
    value: {
      achievements: "RCU portal phase 2; regression cycle 1.5 days; two juniors mentored.",
      valueCreated: "RCU renewal secured (₹1.8 Cr ARR); ~₹6 L/yr QA effort saved.",
      justification:
        "Sustained 4+ ratings across manager and HR reviews; scope grown to a client track lead.",
    },
    overallScore: 4.3,
    rating: "4 — Exceeds",
    method: "Merit Increment",
    currentCtc: 2400000,
    newCtc: 2688000,
    percentage: 12,
    newGrade: "G4",
    newDesignation: "Senior Engineer",
    effectiveFrom: "2026-09-01",
    letterType: "Increment Letter",
    bonusAmount: 0,
    remarks: "Consistently exceeded sprint velocity targets.",
    attachments: ["rcu-phase2-closure.pdf"],
    status: "Applied",
    createdBy: "Varen Mishra",
    createdOn: "2026-08-20",
    approvedBy: "Farah Khan",
    approvedOn: "2026-08-22",
    letterRef: "INC-20260822-0142",
    history: [
      { at: "2026-08-20", by: "Varen Mishra", action: "Appraisal drafted" },
      {
        at: "2026-08-22",
        by: "Farah Khan",
        action: "Approved — 12 % merit increment effective 2026-09-01",
      },
    ],
  },
  {
    id: "APR-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    designation: "Account Manager",
    department: "Sales",
    grade: "G3",
    cycle: "Q3 FY26 Review",
    trigger: "Market correction",
    purpose: "Mid-year increment",
    whyHappened:
      "Compensation benchmarking (Aug 2026) shows account managers 8 % below the market band; retention risk flagged by Sales head.",
    timeline: { from: "2026-04-01", to: "2026-06-30" },
    goals: [
      {
        goalId: "G-Q",
        title: "Achieve 85 % of quarterly quota",
        status: "In Progress",
        progress: 70,
        target: "₹1.2 Cr",
        achievement: "₹84 L closed-won",
        rating: 3,
        weight: 60,
      },
    ],
    params: [
      { paramId: "EP-01", name: "Communication", weight: 15, rating: 4, note: "" },
      { paramId: "EP-02", name: "Technical skills", weight: 25, rating: 3, note: "" },
      { paramId: "EP-03", name: "Behaviour", weight: 15, rating: 3, note: "" },
      { paramId: "EP-04", name: "Attitude", weight: 10, rating: 3, note: "" },
      { paramId: "EP-05", name: "Aptitude & problem solving", weight: 15, rating: 3, note: "" },
      { paramId: "EP-06", name: "Delivery & quality", weight: 15, rating: 3, note: "" },
    ],
    linkedReviews: [
      { id: "ER-002", kind: "HR review", by: "Kavya Menon", rating: "3 — Meets", score: 3.1 },
    ],
    value: {
      achievements: "ZooPlus renewal retained; two new logos signed.",
      valueCreated: "₹84 L closed-won in Q1.",
      justification:
        "Alignment to market band for account executives; performance meets expectations.",
    },
    overallScore: 3.1,
    rating: "3 — Meets",
    method: "Market Correction",
    currentCtc: 1500000,
    newCtc: 1620000,
    percentage: 8,
    newGrade: "G3",
    newDesignation: "Account Manager",
    effectiveFrom: "2026-09-01",
    letterType: "Increment Letter",
    bonusAmount: 0,
    remarks: "Aligned to market band for account executives.",
    attachments: ["comp-benchmark-aug26.pdf"],
    status: "Draft",
    createdBy: "Varen Mishra",
    createdOn: "2026-08-25",
    history: [{ at: "2026-08-25", by: "Varen Mishra", action: "Appraisal drafted" }],
  },
]);
export const useHrAppraisals = () => hrAppraisalStore.use();
export { APPRAISAL_METHODS };

export function saveHrAppraisal(input, by) {
  if (!input.empId) return { ok: false, message: "Choose the employee." };
  if (!input.whyHappened.trim())
    return { ok: false, message: "Explain why this appraisal is happening." };
  if (!input.effectiveFrom) return { ok: false, message: "Set the effective date." };
  if (input.timeline.from && input.timeline.to && input.timeline.to < input.timeline.from)
    return { ok: false, message: "Timeline end date must not be before the start date." };
  if (!(input.newCtc > 0))
    return { ok: false, message: "New annual CTC must be greater than zero." };
  const existing = input.id ? hrAppraisalStore.get().find((a) => a.id === input.id) : undefined;
  if (existing && existing.status !== "Draft")
    return {
      ok: false,
      message: `${existing.id} is already ${existing.status.toLowerCase()} and can no longer be edited.`,
    };
  // Next number from the highest existing reference (length + 1 collides once any record is removed or imported).
  const nextNo =
    Math.max(0, ...hrAppraisalStore.get().map((a) => Number(a.id.match(/(\d+)$/)?.[1]) || 0)) + 1;
  const row = {
    ...input,
    id: existing?.id ?? `APR-${String(nextNo).padStart(3, "0")}`,
    status: "Draft",
    createdBy: existing?.createdBy ?? by.name,
    createdById: existing?.createdById ?? (existing ? undefined : by.id),
    createdOn: existing?.createdOn ?? today(),
    history: [
      ...(existing?.history ?? []),
      { at: today(), by: by.name, action: existing ? "Appraisal updated" : "Appraisal drafted" },
    ],
  };
  hrAppraisalStore.set((l) => (existing ? l.map((a) => (a.id === row.id ? row : a)) : [row, ...l]));
  return { ok: true, message: `${row.id} saved as draft for ${row.employee}.`, id: row.id };
}

/** Approve: apply the new grade / CTC / designation, generate the letter, notify the employee. */
export function approveHrAppraisal(id, by, remarks) {
  const a = hrAppraisalStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Not found." };
  if (a.status !== "Draft") return { ok: false, message: `Already ${a.status.toLowerCase()}.` };
  if (a.empId === by.id)
    return {
      ok: false,
      message:
        "You cannot approve an appraisal raised for yourself — another approver must apply it.",
    };
  if (!(a.newCtc > 0) || !a.effectiveFrom)
    return { ok: false, message: "New CTC and effective date are required before approval." };
  // Maker-checker: the person who drafted the appraisal cannot also approve and apply it.
  if ((a.createdById && a.createdById === by.id) || (!a.createdById && a.createdBy === by.name))
    return {
      ok: false,
      message: `You drafted ${a.id} — another approver must approve and apply it.`,
    };
  updateCompensation(a.empId, {
    ctc: a.newCtc,
    grade: a.newGrade,
    designation: a.newDesignation !== a.designation ? a.newDesignation : undefined,
  });
  const letterRef = `${a.letterType === "Promotion Letter" ? "PRM" : "INC"}-${today().replace(/-/g, "")}-${a.empId.slice(-4)}`;
  renderHrAppraisalLetter({ ...a, letterRef });
  hrAppraisalStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Applied",
            approvedBy: by.name,
            approvedOn: today(),
            letterRef,
            history: [
              ...x.history,
              {
                at: today(),
                by: by.name,
                action: `Approved & applied — ${a.method} ${a.percentage} % · ${a.grade} → ${a.newGrade} · CTC ₹${a.currentCtc.toLocaleString("en-IN")} → ₹${a.newCtc.toLocaleString("en-IN")} effective ${a.effectiveFrom} · ${a.letterType} ${letterRef}${remarks ? ` — ${remarks}` : ""}`,
              },
            ],
          }
        : x,
    ),
  );
  pushAlert({
    empId: a.empId,
    kind: "payroll",
    to: "/emp/appraisals",
    title: `Appraisal applied — ${a.letterType.replace(" Letter", "")}`,
    body: `${a.purpose}: grade ${a.grade} → ${a.newGrade}, CTC ₹${a.currentCtc.toLocaleString("en-IN")} → ₹${a.newCtc.toLocaleString("en-IN")} (${a.percentage} %) effective ${a.effectiveFrom}. Letter ${letterRef} e-mailed.`,
  });
  return {
    ok: true,
    message: `Applied — ${a.employee} moved to ${a.newGrade} at ₹${a.newCtc.toLocaleString("en-IN")} (${a.percentage} %); ${a.letterType} ${letterRef} generated.`,
  };
}

/** Render (print / download) the increment / promotion letter of an appraisal — HR on approval, the employee afterwards. */
export function renderHrAppraisalLetter(a) {
  const t = templatesOf(a.letterType)[0];
  if (!t) return false;
  const bk = computeSalaryBreakup(a.newCtc, a.newGrade);
  renderTemplate(
    t,
    {
      employee: a.employee,
      employee_name: a.employee,
      employee_id: a.empId,
      designation: a.newDesignation || a.designation,
      department: a.department,
      grade: a.newGrade,
      previous_grade: a.grade,
      ctc: a.newCtc.toLocaleString("en-IN"),
      previous_ctc: a.currentCtc.toLocaleString("en-IN"),
      hike: String(a.percentage),
      effective_date: a.effectiveFrom,
      effectiveDate: a.effectiveFrom,
      date: new Date().toLocaleDateString("en-IN"),
      reference: a.letterRef ?? "",
    },
    {
      columns: ["Component", "Monthly (₹)", "Annual (₹)"],
      rows: [
        ...bk.earnings.map((e) => [
          e.label,
          e.monthly.toLocaleString("en-IN"),
          e.annual.toLocaleString("en-IN"),
        ]),
        [
          "Gross",
          bk.monthlyGross.toLocaleString("en-IN"),
          (bk.monthlyGross * 12).toLocaleString("en-IN"),
        ],
        [
          "Cost to company",
          Math.round(a.newCtc / 12).toLocaleString("en-IN"),
          a.newCtc.toLocaleString("en-IN"),
        ],
      ],
    },
  );
  return true;
}

export function rejectHrAppraisal(id, by, reason) {
  const a = hrAppraisalStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Not found." };
  // Only a draft can be rejected — rejecting an applied appraisal would leave the new CTC in payroll with a "Rejected" record.
  if (a.status !== "Draft")
    return {
      ok: false,
      message: `${a.id} is already ${a.status.toLowerCase()} and can no longer be rejected.`,
    };
  if (!reason.trim()) return { ok: false, message: "Enter the reason for rejection." };
  hrAppraisalStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Rejected",
            history: [...x.history, { at: today(), by: by.name, action: `Rejected — ${reason}` }],
          }
        : x,
    ),
  );
  return { ok: true, message: "Appraisal rejected." };
}

export const appraisalStatusTone = (s) =>
  s === "Applied" || s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/40 bg-gold/10 text-gold";
