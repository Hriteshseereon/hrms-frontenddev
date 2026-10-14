// -----------------------------------------------------------------------------
// Self-appraisal workflow (employee → Manager → HR → Unit Head → HR applies the pay grade → letter → dashboard).
// The employee states the purpose, the goals it is supported by (with live status), the quarter and timeline,
// self-ratings on the evaluation parameters, and the value proposition, then submits for approval.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { userById, allUsers } from "@/features/auth/data/auth-session";
import { goalStore } from "@/features/performance/data/goals-data";
import { evalParamStore } from "@/features/performance/data/performance-config";
import {
  getEmployeeProfile,
  findEmployee,
  updateCompensation,
} from "@/features/employees/data/employee-directory";
import { computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { hodForEmployee } from "@/features/organization/data/dept-data";

export const APPRAISAL_PURPOSES = [
  "Annual appraisal (increment)",
  "Promotion / grade change",
  "Mid-year increment",
  "Role change with revised pay",
  "Confirmation after probation",
  "Retention correction",
];
/**
 * @typedef {(typeof APPRAISAL_PURPOSES)[number]} AppraisalPurpose
 */
export const QUARTERS = [
  "Q1 FY27 (Apr–Jun 2026)",
  "Q2 FY27 (Jul–Sep 2026)",
  "Q3 FY27 (Oct–Dec 2026)",
  "Q4 FY27 (Jan–Mar 2027)",
  "Annual FY 2026-27",
];
/**
 * @typedef {"Manager" | "HR" | "Unit Head"} ApprovalStep
 */
export const APPROVAL_STEPS = ["Manager", "HR", "Unit Head"];
/**
 * @typedef {"Draft" | "Manager Review" | "HR Review" | "Unit Head Review" | "Approved" | "Applied" | "Sent back" | "Rejected"} AppraisalStage
 */
export const STAGE_FLOW = [
  "Draft",
  "Manager Review",
  "HR Review",
  "Unit Head Review",
  "Approved",
  "Applied",
];

/**
 * @typedef {Object} SelfAppraisal
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} designation
 * @property {string} dept
 * @property {string | null} managerId
 * @property {string} managerName
 * @property {AppraisalPurpose} purpose
 * @property {string} quarter
 * @property {{ from: string, to: string }} timeline
 * @property {{ goalId: string, title: string, status: string, progress: number, achievement: string, selfRating: number | null }[]} goals
 * @property {{ paramId: string, name: string, self: number | null, note: string }[]} ratings
 * @property {{ achievements: string, valueCreated: string, justification: string, askedFor: string, expectedGrade: string, expectedHikePct: number | null }} value
 * @property {string[]} attachments
 * @property {AppraisalStage} stage
 * @property {string} [submittedOn]
 * @property {{ step: ApprovalStep, by: string, on: string, decision: "Approved" | "Sent back" | "Rejected", rating: number | null, comments: string, recommendedHikePct?: number | null, recommendedGrade?: string }[]} approvals
 * @property {{ previousGrade: string, newGrade: string, previousCtc: number, newCtc: number, hikePct: number, effectiveFrom: string, letterType: string, letterRef: string, appliedOn: string, appliedBy: string, remarks: string, newDesignation?: string }} [outcome]
 * @property {{ at: string, by: string, action: string }[]} history
 */

const today = () => new Date().toISOString().slice(0, 10);
export const selfAppraisalStore = createPersistentStore("seereon.appraisal.self", [
  {
    id: "SA-2026-001",
    empId: "SRN-0007",
    employee: "Neha Kulkarni",
    designation: "QA Engineer",
    dept: "Engineering",
    managerId: "SRN-0005",
    managerName: "Subh Sahoo",
    purpose: "Annual appraisal (increment)",
    quarter: "Annual FY 2026-27",
    timeline: { from: "2025-04-01", to: "2026-03-31" },
    goals: [
      {
        goalId: "G-seed-1",
        title: "Automate regression suite for ZooPlus",
        status: "Completed",
        progress: 100,
        achievement: "Cut regression time from 3 days to 4 hours.",
        selfRating: 5,
      },
      {
        goalId: "G-seed-2",
        title: "Zero P1 escapes in Semtech releases",
        status: "In Progress",
        progress: 85,
        achievement: "One P2 escape in Q3; none since.",
        selfRating: 4,
      },
    ],
    ratings: [
      {
        paramId: "EP-01",
        name: "Communication",
        self: 4,
        note: "Client release notes owned end-to-end",
      },
      { paramId: "EP-02", name: "Technical skills", self: 5, note: "Playwright + CI pipelines" },
      { paramId: "EP-03", name: "Behaviour", self: 4, note: "" },
      { paramId: "EP-04", name: "Attitude", self: 5, note: "" },
      { paramId: "EP-05", name: "Aptitude & problem solving", self: 4, note: "" },
      { paramId: "EP-06", name: "Delivery & quality", self: 5, note: "" },
    ],
    value: {
      achievements: "Regression automation; release quality dashboards for two clients.",
      valueCreated: "≈ ₹9 L/yr of manual QA effort saved; SLA penalties avoided on Semtech.",
      justification:
        "Scope has grown to two client accounts and mentoring a junior — asking for G4 and a 15 % correction.",
      askedFor: "Grade G4 · 15 % hike",
      expectedGrade: "G4",
      expectedHikePct: 15,
    },
    attachments: ["regression-automation-summary.pdf"],
    stage: "HR Review",
    submittedOn: "2026-09-05",
    approvals: [
      {
        step: "Manager",
        by: "Subh Sahoo",
        on: "2026-09-08",
        decision: "Approved",
        rating: 4.5,
        comments: "Strong year; supports G4.",
        recommendedHikePct: 12,
        recommendedGrade: "G4",
      },
    ],
    history: [
      { at: "2026-09-05", by: "Neha Kulkarni", action: "Submitted for Manager review" },
      { at: "2026-09-08", by: "Subh Sahoo", action: "Manager approved → HR review" },
    ],
  },
]);
export const useSelfAppraisals = () => selfAppraisalStore.use();
const patch = (id, fn) => selfAppraisalStore.set((l) => l.map((a) => (a.id === id ? fn(a) : a)));
const log = (a, by, action) => ({ ...a, history: [...a.history, { at: today(), by, action }] });
const nextId = () =>
  `SA-2026-${String(Math.max(1, ...selfAppraisalStore.get().map((a) => Number(a.id.match(/(\d+)$/)?.[1]) || 0)) + 1).padStart(3, "0")}`;
/** Organisation of an employee (directory record first, then the login roster). */
const orgOf = (empId) => findEmployee(empId)?.orgId ?? userById(empId)?.orgId ?? null;
/** HR / CHRO of the appraisee's own entity — alerts used to go to every entity's HR team. */
const hrOf = (empId) => {
  const org = orgOf(empId);
  return allUsers().filter(
    (u) => (u.role === "HR" || u.role === "CHRO") && (!org || u.orgId === org),
  );
};
/** Who acts at the Unit Head step: the department HOD, else the entity's COO / CEO. */
export const unitHeadsFor = (empId) => {
  const hod = hodForEmployee(empId);
  if (hod && hod.id !== empId) return [hod];
  const org = orgOf(empId);
  return allUsers().filter(
    (u) => (u.role === "COO" || u.role === "CEO") && (!org || u.orgId === org) && u.id !== empId,
  );
};

/** Goals the employee owns — shown with live status inside the form ("supported goals"). */
export const goalsForEmployee = (empId) =>
  goalStore
    .get()
    .filter((g) => g.ownerId === empId)
    .map((g) => ({
      goalId: g.id,
      title: g.title,
      status: g.status,
      progress: g.progress,
      achievement: "",
      selfRating: g.selfRating ?? null,
    }));
export const blankRatings = () =>
  evalParamStore
    .get()
    .filter((p) => p.active)
    .map((p) => ({ paramId: p.id, name: p.name, self: null, note: "" }));

export function createSelfAppraisal(input, me, submit) {
  const emp = findEmployee(me.id);
  const mgr = userById(me.managerId);
  if (submit) {
    if (!input.purpose) return { ok: false, message: "Choose the purpose." };
    if (input.ratings.some((r) => r.self === null))
      return { ok: false, message: "Rate yourself on every evaluation parameter." };
    if (!input.value.justification.trim())
      return { ok: false, message: "Write the justification — why this appraisal is deserved." };
  }
  if (input.timeline.from && input.timeline.to && input.timeline.to < input.timeline.from)
    return { ok: false, message: "Timeline end must not be before its start." };
  if (input.value.expectedHikePct !== null && input.value.expectedHikePct < 0)
    return { ok: false, message: "Expected hike % cannot be negative." };
  if (
    selfAppraisalStore
      .get()
      .some((a) => a.empId === me.id && !["Applied", "Rejected"].includes(a.stage))
  )
    return {
      ok: false,
      message: "You already have a self-appraisal in progress — continue that one.",
    };
  // No reporting manager (e.g. a CXO) → the Manager step is skipped and the appraisal goes straight to HR.
  const firstStage = !submit ? "Draft" : mgr ? "Manager Review" : "HR Review";
  const row = {
    ...input,
    id: nextId(),
    empId: me.id,
    employee: me.name,
    designation: me.designation,
    dept: emp?.dept ?? me.dept,
    managerId: me.managerId,
    managerName: mgr?.name ?? "Reporting manager",
    stage: firstStage,
    submittedOn: submit ? today() : undefined,
    approvals: [],
    history: [
      {
        at: today(),
        by: me.name,
        action: !submit
          ? "Draft saved"
          : mgr
            ? "Submitted for Manager review"
            : "Submitted — no reporting manager, routed to HR review",
      },
    ],
  };
  selfAppraisalStore.set((l) => [row, ...l]);
  if (submit && mgr)
    pushAlert({
      empId: mgr.id,
      kind: "review",
      to: "/emp/reviews",
      title: `Self-appraisal to review — ${me.name}`,
      body: `${row.purpose} · ${row.quarter}. Review goals, ratings and value proposition, then approve or send back.`,
    });
  if (submit && !mgr)
    hrOf(me.id).forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Appraisal awaiting HR — ${me.name}`,
        body: `${row.purpose} · ${row.quarter} (no reporting manager).`,
      }),
    );
  return {
    ok: true,
    message: submit
      ? `Submitted — routed to ${mgr?.name ?? "HR"} (Manager → HR → Unit Head).`
      : "Draft saved.",
    id: row.id,
  };
}
export function updateDraft(id, input, me, submit) {
  const a = selfAppraisalStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Not found." };
  if (a.stage !== "Draft" && a.stage !== "Sent back")
    return { ok: false, message: `This appraisal is at "${a.stage}" and can no longer be edited.` };
  if (a.empId !== me.id)
    return { ok: false, message: "Only the appraisee can edit this self-appraisal." };
  const n = { ...a, ...input };
  if (n.timeline.from && n.timeline.to && n.timeline.to < n.timeline.from)
    return { ok: false, message: "Timeline end must not be before its start." };
  if (submit) {
    // Same checks as a first submission — a resubmitted draft must be complete too.
    if (!n.purpose) return { ok: false, message: "Choose the purpose." };
    if (n.ratings.some((r) => r.self === null))
      return { ok: false, message: "Rate yourself on every evaluation parameter." };
    if (!n.value.justification.trim())
      return { ok: false, message: "Write the justification — why this appraisal is deserved." };
  }
  let msg = "Draft saved.";
  const toStage = a.managerId && userById(a.managerId) ? "Manager Review" : "HR Review";
  patch(id, (x) => {
    const next = { ...x, ...input };
    if (submit) {
      msg = `Submitted — routed to ${toStage === "Manager Review" ? x.managerName : "HR"}.`;
      return log(
        { ...next, stage: toStage, submittedOn: today(), roundStart: x.approvals.length },
        me.name,
        `${a.stage === "Sent back" ? "Revised and resubmitted" : "Submitted"} for ${toStage === "Manager Review" ? "Manager" : "HR"} review`,
      );
    }
    return log(next, me.name, "Draft updated");
  });
  if (submit && toStage === "HR Review")
    hrOf(a.empId).forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Appraisal awaiting HR — ${a.employee}`,
        body: `${n.purpose} · ${n.quarter} (no reporting manager).`,
      }),
    );
  if (submit && toStage === "Manager Review" && a.managerId)
    pushAlert({
      empId: a.managerId,
      kind: "review",
      to: "/emp/reviews",
      title: `Self-appraisal to review — ${a.employee}`,
      body: `${n.purpose} · ${n.quarter}. ${a.stage === "Sent back" ? "Revised after being sent back — " : ""}review goals, ratings and value proposition, then approve or send back.`,
    });
  return { ok: true, message: msg };
}

const nextStage = { Manager: "HR Review", HR: "Unit Head Review", "Unit Head": "Approved" };
export const stepForStage = (s) =>
  s === "Manager Review"
    ? "Manager"
    : s === "HR Review"
      ? "HR"
      : s === "Unit Head Review"
        ? "Unit Head"
        : null;

export function decideAppraisal(id, step, decision, input, by) {
  const a = selfAppraisalStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Not found." };
  if (stepForStage(a.stage) !== step)
    return { ok: false, message: `This appraisal is at "${a.stage}", not the ${step} step.` };
  if (!input.comments.trim()) return { ok: false, message: "Add your comments." };
  if (a.empId === by.id) return { ok: false, message: "You cannot approve your own appraisal." };
  // Maker-checker: the three steps must be three different people (an Admin could otherwise approve HR and Unit Head alone).
  // Only approvals of the current submission round count — after a send-back the same manager must be able to
  // approve the resubmission (earlier rounds stay in `approvals` / history for the audit trail).
  const round = a.approvals.slice(a.roundStart ?? 0);
  if (
    decision === "Approved" &&
    round.some((x) => x.by === by.name && x.decision === "Approved" && x.step !== step)
  )
    return {
      ok: false,
      message: `You already approved this appraisal at an earlier step — the ${step} approval must come from someone else.`,
    };
  if (input.rating !== null && (input.rating < 1 || input.rating > 5))
    return { ok: false, message: "Rating must be between 1 and 5." };
  if (input.recommendedHikePct != null && input.recommendedHikePct < 0)
    return { ok: false, message: "Recommended hike % cannot be negative." };
  const entry = { step, by: by.name, on: today(), decision, ...input };
  const stage =
    decision === "Approved" ? nextStage[step] : decision === "Sent back" ? "Sent back" : "Rejected";
  patch(id, (x) =>
    log(
      { ...x, stage, approvals: [...x.approvals, entry] },
      by.name,
      `${step} ${decision.toLowerCase()}${decision === "Approved" ? ` → ${stage}` : ""}`,
    ),
  );
  pushAlert({
    empId: a.empId,
    kind: "review",
    to: "/emp/appraisals",
    title: `Appraisal ${decision.toLowerCase()} at ${step} step`,
    body:
      decision === "Approved"
        ? `${by.name} approved your ${a.purpose}. Now at: ${stage}.`
        : `${by.name}: ${input.comments}`,
  });
  if (decision === "Approved" && stage === "HR Review")
    hrOf(a.empId).forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Appraisal awaiting HR — ${a.employee}`,
        body: `${a.purpose} · manager recommended ${input.recommendedGrade ?? a.value.expectedGrade} / ${input.recommendedHikePct ?? "—"} %.`,
      }),
    );
  // The Unit Head step had no notification, so the record sat unseen at "Unit Head Review".
  if (decision === "Approved" && stage === "Unit Head Review")
    unitHeadsFor(a.empId).forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Appraisal awaiting Unit Head approval — ${a.employee}`,
        body: `${a.purpose} · Manager and HR approved. Final approval under Performance → Self-appraisal Approvals.`,
      }),
    );
  if (decision === "Approved" && stage === "Approved")
    hrOf(a.empId).forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Approved — apply pay grade for ${a.employee}`,
        body: "All three approvals done. Update the pay grade / CTC and issue the letter.",
      }),
    );
  return {
    ok: true,
    message:
      decision === "Approved"
        ? `Approved — now at ${stage}.`
        : decision === "Sent back"
          ? "Sent back to the employee for revision."
          : "Rejected.",
  };
}

/** HR applies the outcome: new grade & CTC flow into the salary structure, payroll and the profile; letter is generated; employee notified. */
export function applyAppraisalOutcome(id, input, by) {
  const a = selfAppraisalStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Not found." };
  if (a.stage !== "Approved")
    return { ok: false, message: "Outcome can be applied only after all approvals." };
  if (a.empId === by.id)
    return { ok: false, message: "You cannot apply your own appraisal outcome." };
  if (!input.newGrade) return { ok: false, message: "Choose the new grade." };
  if (!(input.newCtc > 0))
    return { ok: false, message: "New annual CTC must be greater than zero." };
  if (!input.effectiveFrom) return { ok: false, message: "Set the effective date." };
  const p = getEmployeeProfile(a.empId);
  const previousCtc = p.payroll.ctc,
    previousGrade = p.job.grade;
  const hikePct = previousCtc
    ? +(((input.newCtc - previousCtc) / previousCtc) * 100).toFixed(1)
    : 0;
  updateCompensation(a.empId, {
    ctc: input.newCtc,
    grade: input.newGrade,
    designation: input.newDesignation,
  });
  const letterRef = `${input.letterType === "Promotion Letter" ? "PRM" : "INC"}-${today().replace(/-/g, "")}-${a.empId.slice(-4)}`;
  const outcome = {
    previousGrade,
    newGrade: input.newGrade,
    previousCtc,
    newCtc: input.newCtc,
    hikePct,
    effectiveFrom: input.effectiveFrom,
    letterType: input.letterType,
    letterRef,
    appliedOn: today(),
    appliedBy: by.name,
    remarks: input.remarks,
    newDesignation: input.newDesignation,
  };
  renderAppraisalLetter({ ...a, outcome });
  patch(id, (x) =>
    log(
      { ...x, stage: "Applied", outcome },
      by.name,
      `Pay grade applied: ${previousGrade} → ${input.newGrade}, CTC ₹${previousCtc.toLocaleString("en-IN")} → ₹${input.newCtc.toLocaleString("en-IN")} (${hikePct} %) effective ${input.effectiveFrom} · ${input.letterType} ${letterRef}`,
    ),
  );
  pushAlert({
    empId: a.empId,
    kind: "payroll",
    to: "/emp/appraisals",
    title: `Appraisal applied — ${input.letterType.replace(" Letter", "")}`,
    body: `Grade ${previousGrade} → ${input.newGrade}, CTC ₹${previousCtc.toLocaleString("en-IN")} → ₹${input.newCtc.toLocaleString("en-IN")} (${hikePct} %) effective ${input.effectiveFrom}. Letter ${letterRef} e-mailed.`,
  });
  return {
    ok: true,
    message: `Applied — ${a.employee} moved to ${input.newGrade} at ₹${input.newCtc.toLocaleString("en-IN")} (${hikePct} %); ${input.letterType} ${letterRef} generated and e-mailed.`,
  };
}

/** Render (print / download) the increment / promotion letter of an applied self-appraisal — HR on apply, the employee from My Appraisals. */
export function renderAppraisalLetter(a) {
  const o = a.outcome;
  if (!o) return false;
  const t = templatesOf(o.letterType)[0];
  if (!t) return false;
  const bk = computeSalaryBreakup(o.newCtc, o.newGrade);
  renderTemplate(
    t,
    {
      employee: a.employee,
      employee_name: a.employee,
      employee_id: a.empId,
      designation: o.newDesignation ?? a.designation,
      department: a.dept,
      grade: o.newGrade,
      previous_grade: o.previousGrade,
      ctc: o.newCtc.toLocaleString("en-IN"),
      previous_ctc: o.previousCtc.toLocaleString("en-IN"),
      hike: String(o.hikePct),
      effective_date: o.effectiveFrom,
      effectiveDate: o.effectiveFrom,
      date: new Date().toLocaleDateString("en-IN"),
      reference: o.letterRef,
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
          Math.round(o.newCtc / 12).toLocaleString("en-IN"),
          o.newCtc.toLocaleString("en-IN"),
        ],
      ],
    },
  );
  return true;
}

export const appraisalTone = (s) =>
  s === "Applied" || s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Draft" || s === "Sent back"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";
/** Latest applied outcome for the employee's dashboard. */
export const latestOutcomeFor = (empId) =>
  selfAppraisalStore
    .get()
    .filter((a) => a.empId === empId && a.outcome)
    .sort((x, y) => (x.outcome.appliedOn < y.outcome.appliedOn ? 1 : -1))[0] ?? null;
