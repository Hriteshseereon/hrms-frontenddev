// -----------------------------------------------------------------------------
// Separation extensions (UI-only): retention process, exit date → F&F,
// notice-shortfall recovery, leave over-draw, loan recovery, gratuity, exit
// survey, and the "continuity rejoin" special case. Works alongside
// exit-data.ts (which owns the resignation → clearance → notice flow).
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import {
  getEmployeeProfile,
  findEmployee,
  updateCompensation,
  updateEmployeeRecord,
} from "@/features/employees/data/employee-directory";
import { userById } from "@/features/auth/data/auth-session";
import { reactivateUser } from "@/features/auth/data/rbac-store";
import { hireEmployee } from "@/features/recruitment/data/hiring-data";
import {
  ACTIVE_STAGES,
  getExitRequests,
  markFnfSettled,
  markRetained,
} from "@/features/exit/data/exit-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { leaveBalances } from "@/features/leave/data/leave-engine";
import { computePayslipFor } from "@/features/payroll/data/payroll-engine";
import { groupJoiningDate } from "@/features/organization/data/group-data";
import { activeLoansOf, outstandingOf, recoverFromFnf } from "@/features/payroll/data/loans-data";

/* ------------------------------ Configuration ------------------------------ */
/**
 * @typedef {Object} FnfConfig
 * @property {number} gratuityDaysPerYear
 * @property {number} gratuityMinYears
 * @property {number} gratuityMonthsRoundUp
 * @property {number} gratuityCap
 * @property {"Optional" | "Always" | "Never"} noticeRecovery
 * @property {"Gross" | "Basic"} noticeRecoveryBasis
 * @property {"Gross" | "Basic"} leaveEncashmentBasis
 * @property {boolean} leaveOverdrawRecovery
 * @property {boolean} loanRecoveryFromFnf
 * @property {number} settlementDaysAfterLwd
 * @property {number} rejoinContinuityWindowDays
 * @property {boolean} exitSurveyMandatory
 * @property {string[]} retentionOwnerRoles
 * @property {string} updatedBy
 * @property {string} updatedOn
 */
export const fnfConfigStore = createPersistentStore("seereon.exit.fnf-config", {
  gratuityDaysPerYear: 15,
  gratuityMinYears: 5,
  gratuityMonthsRoundUp: 6,
  gratuityCap: 2000000,
  noticeRecovery: "Optional",
  noticeRecoveryBasis: "Gross",
  leaveEncashmentBasis: "Gross",
  leaveOverdrawRecovery: true,
  loanRecoveryFromFnf: true,
  settlementDaysAfterLwd: 30,
  rejoinContinuityWindowDays: 3,
  exitSurveyMandatory: true,
  retentionOwnerRoles: ["HR", "CHRO", "HOD", "Manager"],
  updatedBy: "Farah Khan",
  updatedOn: "2026-04-01",
});
export const useFnfConfig = () => fnfConfigStore.use();
export function saveFnfConfig(c, by) {
  const nums = [
    "gratuityDaysPerYear",
    "gratuityMinYears",
    "gratuityMonthsRoundUp",
    "gratuityCap",
    "settlementDaysAfterLwd",
    "rejoinContinuityWindowDays",
  ];
  if (nums.some((k) => !Number.isFinite(c[k]) || c[k] < 0))
    return { ok: false, message: "Configuration values cannot be negative or blank." };
  if (c.gratuityMonthsRoundUp > 11)
    return { ok: false, message: "Round-up months must be between 0 and 11." };
  fnfConfigStore.set({ ...c, updatedBy: by, updatedOn: new Date().toISOString().slice(0, 10) });
  return { ok: true, message: "Exit & F&F configuration saved" };
}

/* -------------------------------- Retention -------------------------------- */
/**
 * @typedef {"Open" | "In discussion" | "Offer made" | "Retained" | "Not retained" | "Withdrawn"} RetentionStatus
 */
export const RETENTION_GROUNDS = [
  "Critical skill / niche expertise",
  "Key client relationship",
  "High performer (top rating)",
  "Succession / leadership pipeline",
  "Project-critical (go-live within 90 days)",
  "Replacement cost & ramp-up time",
  "Culture carrier / mentor",
];
export const RETENTION_TYPES = [
  "Compensation correction",
  "Promotion / grade change",
  "Role or project change",
  "Location / remote flexibility",
  "Learning & career plan",
  "Counselling / manager change",
  "Retention bonus (clawback)",
];
/**
 * @typedef {Object} RetentionCase
 * @property {string} id
 * @property {string} exitId
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} managerName
 * @property {string} startedBy
 * @property {string} startedOn
 * @property {RetentionStatus} status
 * @property {string} owner
 * @property {string} reasonStated
 * @property {string} offer
 * @property {string} outcomeNote
 * @property {("Compensation" | "Role change" | "Project change" | "Location" | "Flexibility" | "Counselling")[]} offerKind
 * @property {number} [hikePct]
 * @property {string} [closedOn]
 * @property {{ at: string, by: string, action: string }[]} history
 * @property {{ grounds: string[], justification: string, qualification: string, retentionType: string[], discussionSummary: string, discussedOn: string, discussedBy: string, newDesignation: string, newGrade: string, previousCtc: number, newCtc: number, effectiveFrom: string, retentionBonus: number, clawbackMonths: number, appraisalRef: string, conditions: string, approvedBy: string, approvedOn: string, reviewAfterMonths: number, attachments: string[], letterRef?: string }} [form] - Audit form (filled when the employee is retained)
 */
export const retentionStore = createPersistentStore("seereon.exit.retention.v2", [
  {
    id: "RET-2026-001",
    exitId: "EXT-1002",
    empId: "SRN-0008",
    employee: "Rakesh Menon",
    dept: "Engineering",
    managerName: "Subh Sahoo",
    startedBy: "Ritu Bansal",
    startedOn: "2026-09-08",
    status: "Retained",
    owner: "Ritu Bansal",
    reasonStated: "Higher pay at a product company; wanted data-engineering scope.",
    offer: "12 % correction + move to the Semtech data platform pod from Oct.",
    outcomeNote: "Resignation withdrawn on 12 Sep; status Retained.",
    offerKind: ["Compensation", "Project change"],
    hikePct: 12,
    closedOn: "2026-09-12",
    history: [
      { at: "2026-09-08", by: "Ritu Bansal", action: "Retention started" },
      { at: "2026-09-10", by: "Subh Sahoo", action: "Offer made: 12 % + data pod" },
      {
        at: "2026-09-12",
        by: "Ritu Bansal",
        action: "Retained — resignation withdrawn; employment continues on existing records",
      },
    ],
    form: {
      grounds: ["Critical skill / niche expertise", "Project-critical (go-live within 90 days)"],
      justification:
        "Only engineer with end-to-end ownership of the Semtech data platform; replacement cost ≈ 6 months of ramp-up during the KSeF go-live window.",
      qualification:
        "'Exceeds' rating in FY26 appraisal; zero escalations; certified on Databricks and Airflow.",
      retentionType: ["Compensation correction", "Role or project change"],
      discussionSummary:
        "Two discussions (8 & 10 Sep) with manager and HRBP; employee's ask was market parity and a data-platform role.",
      discussedOn: "2026-09-10",
      discussedBy: "Subh Sahoo, Ritu Bansal",
      newDesignation: "Senior Data Engineer",
      newGrade: "G4",
      previousCtc: 1650000,
      newCtc: 1848000,
      effectiveFrom: "2026-10-01",
      retentionBonus: 0,
      clawbackMonths: 0,
      appraisalRef: "RV-FY26-ANN-0008",
      conditions:
        "Revised CTC effective 1 Oct; no change to DOJ, leave balance or gratuity continuity.",
      approvedBy: "Farah Khan",
      approvedOn: "2026-09-12",
      reviewAfterMonths: 6,
      attachments: ["retention-discussion-notes.pdf", "market-benchmark-data-eng.xlsx"],
      letterRef: "INC-20260912-0008",
    },
  },
]);
export const useRetention = () => retentionStore.use();
export const retentionForExit = (exitId) =>
  retentionStore.get().find((r) => r.exitId === exitId) ?? null;
const now = () => new Date().toISOString().slice(0, 10);

export function startRetention(exit, by) {
  if (retentionForExit(exit.id))
    return { ok: false, message: "Retention already started for this resignation." };
  const live = getExitRequests().find((e) => e.id === exit.id);
  if (live && !ACTIVE_STAGES.includes(live.stage))
    return {
      ok: false,
      message: `This resignation is already ${live.stage.toLowerCase()} — retention is no longer possible.`,
    };
  const nextNo =
    Math.max(1, ...retentionStore.get().map((r) => Number(r.id.match(/(\d+)$/)?.[1]) || 0)) + 1;
  const row = {
    id: `RET-2026-${String(nextNo).padStart(3, "0")}`,
    exitId: exit.id,
    empId: exit.empId,
    employee: exit.empName,
    dept: exit.dept,
    managerName: exit.managerName,
    startedBy: by.name,
    startedOn: now(),
    status: "In discussion",
    owner: by.name,
    reasonStated: `${exit.reason}${exit.description ? ` — ${exit.description}` : ""}`,
    offer: "",
    outcomeNote: "",
    offerKind: [],
    history: [
      {
        at: now(),
        by: by.name,
        action: "Retention process started — employee status → Retention in progress",
      },
    ],
  };
  retentionStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: `Retention started for ${exit.empName}. Status is now "Retention in progress".`,
    id: row.id,
  };
}
export function updateRetention(id, patch, by, action) {
  retentionStore.set((l) =>
    l.map((r) =>
      r.id === id
        ? {
            ...r,
            ...patch,
            closedOn:
              patch.status === "Retained" || patch.status === "Not retained" ? now() : r.closedOn,
            history: [...r.history, { at: now(), by: by.name, action }],
          }
        : r,
    ),
  );
}
/**
 * Retain with the full audit form: the resignation closes as "Retained", employment continues on the existing
 * records (DOJ, leave, gratuity continuity untouched) and — only if a revised pay / grade was agreed — the
 * compensation is updated and an increment / promotion letter reference recorded.
 */
export function retainWithForm(exit, form, by) {
  if (!form.grounds.length || !form.justification.trim())
    return {
      ok: false,
      message: "Grounds and justification are required for the retention audit.",
    };
  if (!form.qualification.trim() || !form.discussionSummary.trim() || !form.approvedBy.trim())
    return {
      ok: false,
      message:
        "Qualification, discussion summary and approver are required for the retention audit.",
    };
  if (form.newCtc < 0 || form.retentionBonus < 0 || form.clawbackMonths < 0)
    return { ok: false, message: "Amounts and months cannot be negative." };
  const live = getExitRequests().find((e) => e.id === exit.id);
  if (!live || !ACTIVE_STAGES.includes(live.stage))
    return { ok: false, message: "Only a live resignation can be retained." };
  // Once the settlement is approved / paid (loans closed) the exit can no longer be reversed by retention.
  const settlement = fnfForExit(exit.id);
  if (live.fnfSettled || (settlement && settlement.status !== "Draft"))
    return {
      ok: false,
      message: "The F&F settlement is already approved or paid — retention is no longer possible.",
    };
  let rc = retentionForExit(exit.id);
  if (!rc) {
    const r = startRetention(exit, by);
    if (!r.ok) return r;
    rc = retentionForExit(exit.id);
  }
  const payChange = form.newCtc > 0 && form.newCtc !== form.previousCtc;
  let letterRef = form.letterRef;
  if (payChange) {
    updateCompensation(exit.empId, {
      ctc: form.newCtc,
      grade: form.newGrade || undefined,
      designation: form.newDesignation || undefined,
    });
    letterRef = `${form.retentionType.includes("Promotion / grade change") ? "PRM" : "INC"}-${now().replace(/-/g, "")}-${exit.empId.slice(-4)}`;
  }
  const hike = form.previousCtc
    ? +(((form.newCtc - form.previousCtc) / form.previousCtc) * 100).toFixed(1)
    : 0;
  updateRetention(
    rc.id,
    {
      status: "Retained",
      offer: [
        form.retentionType.join(", "),
        payChange
          ? `CTC ₹${form.previousCtc.toLocaleString("en-IN")} → ₹${form.newCtc.toLocaleString("en-IN")} (${hike} %)`
          : "",
        form.newDesignation ? `→ ${form.newDesignation}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      hikePct: payChange ? hike : rc.hikePct,
      offerKind: rc.offerKind,
      outcomeNote: form.discussionSummary,
      form: { ...form, letterRef },
    },
    by,
    `Retained — resignation withdrawn; employment continues on existing records${payChange ? `; compensation revised, ${letterRef} issued` : ""}`,
  );
  markRetained(
    exit.id,
    by,
    `${rc.id} — ${form.grounds.join(", ")}. ${payChange ? `Revised CTC ₹${form.newCtc.toLocaleString("en-IN")} effective ${form.effectiveFrom}.` : "No change to compensation."} Employment records continue unchanged.`,
  );
  pushAlert({
    empId: exit.empId,
    kind: "general",
    to: "/emp/resignation",
    title: "Resignation withdrawn — you have been retained",
    body: `${form.retentionType.join(", ")}${payChange ? ` · revised CTC effective ${form.effectiveFrom} (letter ${letterRef})` : ""}. Your employment continues on the existing records.`,
  });
  return {
    ok: true,
    message: `${exit.empName} retained — status "Retained", employment continues unchanged${payChange ? `; compensation updated and ${letterRef} issued` : ""}.`,
  };
}
export const retentionTone = (s) =>
  s === "Retained"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Not retained" || s === "Withdrawn"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/40 bg-gold/15 text-gold";

/* Loans live in loans-data.ts (kept import-cycle free for the payroll engine). */
export * from "@/features/payroll/data/loans-data";

/* --------------------------------- Gratuity --------------------------------- */
export function computeGratuityAmount(empId, lwd, cfg = fnfConfigStore.get()) {
  const p = getEmployeeProfile(empId);
  const start = groupJoiningDate(empId, p.job.dateOfJoining);
  const basic =
    p.payroll.earnings.find((e) => /basic/i.test(e.label))?.amount ??
    Math.round(p.payroll.monthlyGross * 0.4);
  const ms = (+new Date(lwd) - +new Date(start)) / (86400000 * 30.4375);
  const years = Math.floor(ms / 12) + (ms % 12 >= cfg.gratuityMonthsRoundUp ? 1 : 0);
  const eligible = ms / 12 >= cfg.gratuityMinYears;
  const amount = eligible
    ? Math.min(Math.round((basic * cfg.gratuityDaysPerYear * years) / 26), cfg.gratuityCap)
    : 0;
  return {
    start,
    basic,
    tenureYears: +(ms / 12).toFixed(2),
    completedYears: years,
    eligible,
    amount,
    formula: `Basic ₹${basic.toLocaleString("en-IN")} × ${cfg.gratuityDaysPerYear} / 26 × ${years} yr`,
  };
}

/* ------------------------------ F&F statement ------------------------------ */
/**
 * @typedef {Object} FnfLine
 * @property {string} label
 * @property {number} amount
 * @property {"earning" | "deduction"} kind
 * @property {string} note
 * @property {boolean} [optional]
 * @property {boolean} enabled
 */
/**
 * @typedef {Object} FnfStatement
 * @property {string} id
 * @property {string} exitId
 * @property {string} empId
 * @property {string} employee
 * @property {string} lwd
 * @property {string} exitDate
 * @property {number} noticeDays
 * @property {number} noticeServed
 * @property {string} period
 * @property {FnfLine[]} lines
 * @property {number} gross
 * @property {number} deductions
 * @property {number} net
 * @property {ReturnType<typeof computeGratuityAmount>} gratuity
 * @property {"Draft" | "HR reviewed" | "Finance approved" | "Paid"} status
 * @property {string} preparedBy
 * @property {string} preparedOn
 * @property {string} [approvedBy]
 * @property {string} [paidOn]
 * @property {string} [paymentRef]
 * @property {{ at: string, by: string, action: string }[]} history
 */
export const fnfStore = createPersistentStore("seereon.exit.fnf", []);
export const useFnf = () => fnfStore.use();
export const fnfForExit = (exitId) => fnfStore.get().find((f) => f.exitId === exitId) ?? null;

export function computeFnf(input, cfg = fnfConfigStore.get()) {
  const period = input.lwd.slice(0, 7);
  const slip = computePayslipFor(input.empId, period);
  const p = getEmployeeProfile(input.empId);
  const gross = slip?.structureGross ?? p.payroll.monthlyGross;
  const basic =
    slip?.earnings.find((e) => /basic/i.test(e.label))?.amount ?? Math.round(gross * 0.4);
  const dim = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
  const daysWorked = Number(input.lwd.slice(8, 10));
  const proRata = Math.round((gross * daysWorked) / dim);
  const served = input.noticeStart
    ? Math.max(0, Math.round((+new Date(input.lwd) - +new Date(input.noticeStart)) / 86400000) + 1)
    : input.noticeDays;
  const shortfall = Math.max(input.noticeDays - served, 0);
  const noticeRecovery = Math.round(
    ((cfg.noticeRecoveryBasis === "Gross" ? gross : basic) / 30) * shortfall,
  );
  const bal = leaveBalances(input.empId);
  const el = bal.find((b) => b.type === "Earned Leave");
  const elDays = el ? Math.max(el.available, 0) : 0;
  const elEncash = Math.round(
    ((cfg.leaveEncashmentBasis === "Gross" ? gross : basic) / 30) * elDays,
  );
  const overdraw = bal
    .filter((b) => Number.isFinite(b.available) && b.available < 0)
    .reduce((t, b) => t + -b.available, 0);
  const overdrawRecovery = cfg.leaveOverdrawRecovery ? Math.round((gross / 30) * overdraw) : 0;
  // Only money actually paid out is recoverable — sanctioned-but-undisbursed loans lapse at exit.
  const loans = activeLoansOf(input.empId);
  const loanOut = loans.reduce((t, l) => t + outstandingOf(l), 0);
  const gratuity = computeGratuityAmount(input.empId, input.lwd, cfg);
  // Dues the finance clearance officer recorded ("recovered in F&F") — they were captured but never deducted.
  const financeDues = Math.max(
    0,
    Number(
      getExitRequests().find((e) => e.id === input.exitId)?.clearances?.finance?.amount ?? 0,
    ) || 0,
  );
  const statDed = slip
    ? slip.pf.employee + slip.esi.employee + slip.pt
    : Math.round(basic * 0.12) + 200;
  const tds = slip ? Math.round((slip.tds.monthly * daysWorked) / dim) : 0;
  const lines = [
    {
      label: `Salary for ${daysWorked}/${dim} days of ${period}`,
      amount: proRata,
      kind: "earning",
      note: "Pro-rata on structure gross",
      enabled: true,
    },
    {
      label: `Earned leave encashment (${elDays} days on ${cfg.leaveEncashmentBasis})`,
      amount: elEncash,
      kind: "earning",
      note: "Balance as on LWD",
      enabled: elDays > 0,
    },
    {
      label: `Gratuity (${gratuity.completedYears} yrs · ${cfg.gratuityDaysPerYear} days/yr)`,
      amount: gratuity.amount,
      kind: "earning",
      note: gratuity.eligible
        ? gratuity.formula
        : `Not eligible — service ${gratuity.tenureYears} yrs < ${cfg.gratuityMinYears}`,
      enabled: gratuity.eligible,
    },
    {
      label: "Pending reimbursements",
      amount: 0,
      kind: "earning",
      note: "From approved claims not yet paid",
      enabled: false,
    },
    {
      label: "Statutory deductions (PF / ESI / PT) on final salary",
      amount: Math.round((statDed * daysWorked) / dim),
      kind: "deduction",
      note: "Pro-rata",
      enabled: true,
    },
    {
      label: "TDS on final salary & encashment",
      amount: tds,
      kind: "deduction",
      note: "Per current regime projection",
      enabled: tds > 0,
    },
    {
      label: `Notice shortfall recovery (${shortfall} of ${input.noticeDays} days on ${cfg.noticeRecoveryBasis})`,
      amount: noticeRecovery,
      kind: "deduction",
      note:
        cfg.noticeRecovery === "Never"
          ? "Disabled by policy"
          : cfg.noticeRecovery === "Optional"
            ? "Optional — HR decides"
            : "Mandatory",
      optional: cfg.noticeRecovery === "Optional",
      enabled:
        shortfall > 0 &&
        cfg.noticeRecovery !== "Never" &&
        (cfg.noticeRecovery === "Always" || input.recoverNotice),
    },
    {
      label: `Leave over-draw recovery (${overdraw} days)`,
      amount: overdrawRecovery,
      kind: "deduction",
      note: "Leaves availed beyond credit",
      enabled: overdraw > 0 && cfg.leaveOverdrawRecovery,
    },
    {
      label: `Loan / advance outstanding (${loans.map((l) => l.id).join(", ") || "none"})`,
      amount: loanOut,
      kind: "deduction",
      note: "Recovered in full from settlement",
      enabled: loanOut > 0 && cfg.loanRecoveryFromFnf,
    },
    {
      label: "Asset damage / non-return",
      amount: 0,
      kind: "deduction",
      note: "From asset clearance",
      optional: true,
      enabled: false,
    },
    {
      label: "Finance clearance dues",
      amount: financeDues,
      kind: "deduction",
      note: "Outstanding recorded by the finance clearance officer",
      enabled: financeDues > 0,
    },
  ];
  const tot = (k) =>
    lines.filter((l) => l.kind === k && l.enabled).reduce((t, l) => t + l.amount, 0);
  return {
    id: `FNF-${input.exitId.replace(/^EXT-/, "")}`,
    exitId: input.exitId,
    empId: input.empId,
    employee: input.employee,
    lwd: input.lwd,
    exitDate: input.lwd,
    noticeDays: input.noticeDays,
    noticeServed: served,
    period,
    lines,
    gross: tot("earning"),
    deductions: tot("deduction"),
    net: tot("earning") - tot("deduction"),
    gratuity,
    status: "Draft",
    preparedBy: input.by.name,
    preparedOn: now(),
    history: [{ at: now(), by: input.by.name, action: "F&F statement computed" }],
  };
}
export function saveFnf(f) {
  const cur = fnfStore.get().find((x) => x.id === f.id);
  if (cur && cur.status !== "Draft")
    return {
      ok: false,
      message: `${f.id} is already ${cur.status.toLowerCase()} and cannot be replaced.`,
    };
  fnfStore.set((l) =>
    l.some((x) => x.id === f.id) ? l.map((x) => (x.id === f.id ? f : x)) : [f, ...l],
  );
  return { ok: true, message: `${f.id} saved as draft.` };
}
export function advanceFnf(id, by, ref = "") {
  const f = fnfStore.get().find((x) => x.id === id);
  if (!f) return { ok: false, message: "Not found." };
  if (f.status === "Paid") return { ok: false, message: `${f.id} is already paid.` };
  if (f.empId === by.id) return { ok: false, message: "You cannot process your own F&F." };
  const next =
    f.status === "Draft" ? "HR reviewed" : f.status === "HR reviewed" ? "Finance approved" : "Paid";
  // Segregation of duties: Finance approval must come from someone other than the HR reviewer.
  const hrReviewer = f.history.find((h) => h.action === "HR reviewed")?.by;
  if (next === "Finance approved" && hrReviewer === by.name)
    return {
      ok: false,
      message: "You did the HR review — the Finance approval must come from someone else.",
    };
  if (next === "Paid") {
    if (!ref.trim()) return { ok: false, message: "Enter the payment reference." };
    // Pay only against a file in final settlement; the exit flag is set first so a refusal closes nothing.
    const settled = markFnfSettled(f.exitId, by, ref.trim(), f.net);
    if (!settled.ok) return settled;
    recoverFromFnf(f.empId, by);
  }
  fnfStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: next,
            approvedBy: next === "Finance approved" ? by.name : x.approvedBy,
            paidOn: next === "Paid" ? now() : x.paidOn,
            paymentRef: next === "Paid" ? ref : x.paymentRef,
            history: [
              ...x.history,
              {
                at: now(),
                by: by.name,
                action: next === "Paid" ? `Settlement paid · ${ref}` : `${next}`,
              },
            ],
          }
        : x,
    ),
  );
  return {
    ok: true,
    message:
      next === "Paid" ? "F&F paid; loans closed; relieving letter can be issued." : `${next}.`,
  };
}

/** Settle from the exit file: the saved statement is marked Paid (history kept), loans are closed and the exit is flagged settled. */
export function settleFnf(exitId, by, ref) {
  const f = fnfForExit(exitId);
  if (!f) return { ok: false, message: "Compute and save the F&F statement first." };
  if (!ref.trim()) return { ok: false, message: "Enter the payment reference." };
  // The statement must have been HR-reviewed and Finance-approved — settling from the exit file used to jump Draft → Paid.
  if (f.status !== "Finance approved" && f.status !== "Paid")
    return {
      ok: false,
      message: `${f.id} is "${f.status}" — it must be HR-reviewed and Finance-approved before it is paid.`,
    };
  const r = markFnfSettled(exitId, by, ref.trim(), f.net);
  if (!r.ok) return r;
  if (f.status !== "Paid") {
    recoverFromFnf(f.empId, by);
    fnfStore.set((l) =>
      l.map((x) =>
        x.id === f.id
          ? {
              ...x,
              status: "Paid",
              approvedBy: x.approvedBy ?? by.name,
              paidOn: now(),
              paymentRef: ref.trim(),
              history: [
                ...x.history,
                {
                  at: now(),
                  by: by.name,
                  action: `Settlement paid from the exit file · ${ref.trim()}`,
                },
              ],
            }
          : x,
      ),
    );
  }
  return r;
}

/* ---------------------------- Continuity rejoin ---------------------------- */
/**
 * @typedef {Object} RejoinCase
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} exitId
 * @property {string} exitedOn
 * @property {string} requestedOn
 * @property {string} rejoinOn
 * @property {number} daysGap
 * @property {"Continuity (original DOJ retained)" | "Fresh hire (new DOJ)"} mode
 * @property {string} decidedBy
 * @property {string} note
 * @property {boolean} fnfReversed
 * @property {string} originalDoj
 * @property {"Proposed" | "Approved" | "Rejoined"} status
 */
export const rejoinStore = createPersistentStore("seereon.exit.rejoin", []);
export const useRejoins = () => rejoinStore.use();
export function proposeRejoin(input, by, cfg = fnfConfigStore.get()) {
  const e = findEmployee(input.empId);
  if (!e) return { ok: false, message: "Employee not found." };
  const exit = getExitRequests().find((x) => x.id === input.exitId);
  if (!exit || exit.stage !== "Exit Completed")
    return { ok: false, message: "Rejoin applies only to a completed exit." };
  if (rejoinStore.get().some((r) => r.exitId === input.exitId))
    return { ok: false, message: "A rejoin is already recorded for this exit." };
  if (!input.rejoinOn) return { ok: false, message: "Set the rejoin date." };
  const gap = Math.round(
    (+new Date(input.rejoinOn + "T00:00:00") - +new Date(input.exitedOn + "T00:00:00")) / 86400000,
  );
  if (gap < 0) return { ok: false, message: "Rejoin date must be after the exit date." };
  if (input.forceContinuity && !["CHRO", "SuperAdmin", "Admin"].includes(by.role))
    return { ok: false, message: "Only the CHRO can override the continuity window." };
  const continuity = input.forceContinuity || gap <= cfg.rejoinContinuityWindowDays;
  const profile = getEmployeeProfile(input.empId);
  const doj = profile.job.dateOfJoining;
  let newHireId;
  if (continuity) {
    // Employment resumes on the existing record: directory status, login and the settled F&F are all reversed.
    updateEmployeeRecord(e.id, { status: "Active" });
    reactivateUser(e.id, by.name);
    fnfStore.set((l) =>
      l.map((f) =>
        f.exitId === input.exitId
          ? {
              ...f,
              reversedOn: now(),
              history: [
                ...f.history,
                { at: now(), by: by.name, action: "Reversed — continuity rejoin" },
              ],
            }
          : f,
      ),
    );
  } else {
    // Fresh hire: a new employment record linked to the old one (rehireOfId) from the rejoin date.
    const u = userById(e.id);
    const [first, ...rest] = e.name.split(" ");
    const hire = hireEmployee({
      firstName: first,
      lastName: rest.join(" "),
      personalEmail: profile.personal?.personalEmail ?? "",
      phone: e.phone ?? "",
      dob: profile.personal?.dob ?? "",
      gender: profile.personal?.gender ?? "",
      orgId: e.orgId,
      branch: e.branch,
      dept: e.dept,
      designation: e.role,
      role: u?.role ?? "Employee",
      employmentType: "Full-time",
      managerId: u?.managerId ?? null,
      doj: input.rejoinOn,
      probationMonths: 0,
      ctc: profile.payroll?.ctc ?? 0,
      grade: profile.job?.grade,
      rehireOfId: e.id,
    });
    newHireId = hire.id;
  }
  const row = {
    id: `RJ-2026-${String(Math.max(0, ...rejoinStore.get().map((r) => Number(r.id.match(/(\d+)$/)?.[1]) || 0)) + 1).padStart(3, "0")}`,
    empId: e.id,
    employee: e.name,
    exitId: input.exitId,
    exitedOn: input.exitedOn,
    requestedOn: now(),
    rejoinOn: input.rejoinOn,
    daysGap: gap,
    mode: continuity ? "Continuity (original DOJ retained)" : "Fresh hire (new DOJ)",
    decidedBy: by.name,
    note: input.note,
    fnfReversed: continuity,
    originalDoj: doj,
    newHireId,
    status: "Approved",
  };
  rejoinStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: continuity
      ? `Continuity rejoin approved — employment resumes with original DOJ ${doj}; F&F reversed and salary continues on the existing structure.`
      : `Fresh rejoin — new employment record ${newHireId} from ${input.rejoinOn}; previous service settled.`,
    id: row.id,
  };
}

/* -------------------------------- Exit survey -------------------------------- */
/**
 * @typedef {Object} ExitSurvey
 * @property {string} id
 * @property {string} exitId
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} submittedOn
 * @property {string} reason
 * @property {{ manager: number, culture: number, growth: number, comp: number, workLife: number }} ratings
 * @property {"Yes" | "Maybe" | "No"} rejoin
 * @property {"Yes" | "Maybe" | "No"} recommend
 * @property {string} feedback
 * @property {string} interviewer
 * @property {string} interviewNotes
 */
export const exitSurveyStore = createPersistentStore("seereon.exit.surveys", [
  {
    id: "XS-001",
    exitId: "EXT-0998",
    empId: "SRN-0146",
    employee: "Kavya Menon",
    dept: "Operations",
    submittedOn: "2026-09-15",
    reason: "Personal reasons",
    ratings: { manager: 4, culture: 4, growth: 3, comp: 3, workLife: 4 },
    rejoin: "Yes",
    recommend: "Yes",
    feedback: "Relocating with family; would rejoin if a Chennai / remote operations role opens.",
    interviewer: "Self-service",
    interviewNotes: "",
  },
  {
    id: "XS-002",
    exitId: "EXT-1005",
    empId: "SRN-0013",
    employee: "Aditya Verma",
    dept: "Human Resources",
    submittedOn: "2026-09-18",
    reason: "Better career opportunity",
    ratings: { manager: 5, culture: 4, growth: 3, comp: 3, workLife: 4 },
    rejoin: "Maybe",
    recommend: "Yes",
    feedback: "Moving to a regional HR lead role; growth path for HRBPs could be clearer.",
    interviewer: "Self-service",
    interviewNotes: "",
  },
]);
export const useExitSurveys = () => exitSurveyStore.use();
export const addExitSurvey = (s) => {
  // One survey per exit (a double submit used to create duplicates and skew the survey report).
  const existing = exitSurveyStore.get().find((x) => x.exitId === s.exitId);
  if (existing) return existing;
  const row = {
    ...s,
    id: `XS-${String(Math.max(0, ...exitSurveyStore.get().map((x) => Number(x.id.match(/(\d+)$/)?.[1]) || 0)) + 1).padStart(3, "0")}`,
  };
  exitSurveyStore.set((l) => [row, ...l]);
  return row;
};
