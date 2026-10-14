// -----------------------------------------------------------------------------
// People cases (enterprise-grade): Promotions, Transfers, Terminations, Warnings, Referrals.
// Each record carries the full field set, approval workflow, attachments, the generated letter and a history trail,
// and is wired to the employee record (EmployeeDetail → Cases, Employee portal → Movements), payroll (compensation),
// recruitment (referrals → applicants) and exits (terminations → F&F).
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { moveUserAccount, userById } from "@/features/auth/data/auth-session";
import { setManager } from "@/features/organization/data/manager-data";
import {
  directoryEmployees,
  getEmployeeProfile,
  findEmployee,
  updateCompensation,
  updateEmployeeRecord,
} from "@/features/employees/data/employee-directory";
import { openTerminationExit } from "@/features/exit/data/exit-data";
import { computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { getOrg } from "@/features/organization/data/group-data";
import { fillTokens } from "@/lib/export-utils";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { suspendUser } from "@/features/auth/data/rbac-store";
import {
  addApplicant,
  findDuplicateApplicant,
} from "@/features/recruitment/data/recruitment-engine";

const today = () => new Date().toISOString().slice(0, 10);
const inr = (n) => n.toLocaleString("en-IN");
/**
 * @typedef {"Draft" | "Pending approval" | "Approved" | "Effective" | "Rejected" | "Withdrawn" | "Closed"} CaseStatus
 */
/**
 * @typedef {Object} Approval
 * @property {string} step
 * @property {string} by
 * @property {string} on
 * @property {"Approved" | "Rejected"} decision
 * @property {string} note
 */
/**
 * @typedef {Object} Hist
 * @property {string} at
 * @property {string} by
 * @property {string} action
 */
export const caseTone = (s) =>
  s === "Approved" || s === "Effective" || s === "Closed" || s === "Hired" || s === "Bonus paid"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected" || s === "Withdrawn" || s === "Not selected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Draft"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";

export const PROMOTION_PURPOSES = [
  "Annual appraisal outcome",
  "Mid-year appraisal outcome",
  "Role expansion / new responsibility",
  "Retention counter-offer",
  "Market correction",
  "Completion of probation / confirmation",
  "Succession / leadership pipeline",
];
// No "Entity" type: a move to another company is the group transfer ("Transfer to Group Company"); an Entity transfer
// here could never be submitted (any company change is refused below).
export const TRANSFER_TYPES = [
  "Branch",
  "Department",
  "Reporting manager",
  "Project / client",
  "Role",
];
export const TERMINATION_TYPES = [
  "Misconduct",
  "Performance (post-PIP)",
  "Absconding / abandonment",
  "Redundancy / restructuring",
  "Contract end",
  "Probation not confirmed",
  "Breach of policy / integrity",
  "Medical incapacity",
];
export const WARNING_TYPES = [
  "Attendance",
  "Performance",
  "Conduct / behaviour",
  "Policy violation",
  "Data / IT security",
  "Client complaint",
  "Insubordination",
  "Safety",
];
export const WARNING_CATEGORIES = [
  "Late arrival / unplanned absence",
  "Missed deliverables",
  "Unprofessional communication",
  "Dress code / discipline",
  "Unauthorised data sharing",
  "Repeated timesheet non-compliance",
  "Client escalation",
  "Refusal of reasonable instruction",
  "Other",
];
export const REFERRAL_RELATIONS = [
  "Ex-colleague",
  "Friend",
  "Family",
  "College batchmate",
  "Community / meetup",
  "Former client / vendor",
];

/* ------------------------------------ Promotions ------------------------------------ */
/**
 * @typedef {Object} PromotionCase
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} purpose
 * @property {string} appraisalRef
 * @property {string} basis
 * @property {string} fromDesignation
 * @property {string} toDesignation
 * @property {string} fromGrade
 * @property {string} toGrade
 * @property {number} fromCtc
 * @property {number} toCtc
 * @property {number} hikePct
 * @property {string} effectiveFrom
 * @property {string} newManager
 * @property {string} newBranch
 * @property {number} probationMonths
 * @property {string} recommendedBy
 * @property {"Promotion Letter" | "Increment Letter" | "Appointment Letter"} letterType
 * @property {"Generate from template" | "Attach signed letter"} letterMode
 * @property {string} [letterBody]
 * @property {string} [letterRef]
 * @property {string} [letterFile]
 * @property {string[]} attachments
 * @property {CaseStatus} status
 * @property {Approval[]} approvals
 * @property {Hist[]} history
 * @property {string} createdOn
 * @property {string} createdBy
 * @property {string} remarks
 */
export const promotionStore = createPersistentStore("seereon.cases.promotions.v2", [
  {
    id: "PRM-2026-001",
    empId: "SRN-0006",
    employee: "Subham Das",
    dept: "Engineering",
    purpose: "Annual appraisal outcome",
    appraisalRef: "RV-FY26-ANN-0006",
    basis: "Exceeds rating; led payments migration; recommended by Subh Sahoo",
    fromDesignation: "Software Engineer",
    toDesignation: "Senior Software Engineer",
    fromGrade: "G2",
    toGrade: "G3",
    fromCtc: 2200000,
    toCtc: 2600000,
    hikePct: 18.2,
    effectiveFrom: "2026-04-01",
    newManager: "Subh Sahoo",
    newBranch: "Bhubaneswar HQ",
    probationMonths: 0,
    recommendedBy: "Subh Sahoo",
    letterType: "Promotion Letter",
    letterMode: "Generate from template",
    letterRef: "PRM-20260412-0006",
    letterFile: "Promotion-Letter-Subham-Das.pdf",
    attachments: ["appraisal-summary-fy26.pdf"],
    status: "Effective",
    approvals: [
      {
        step: "HR",
        by: "Farah Khan",
        on: "2026-04-10",
        decision: "Approved",
        note: "Within G3 band",
      },
      {
        step: "Unit Head",
        by: "Santosh Nayak",
        on: "2026-04-11",
        decision: "Approved",
        note: "Approved",
      },
    ],
    history: [
      { at: "2026-04-08", by: "Ritu Bansal", action: "Promotion drafted from appraisal" },
      { at: "2026-04-11", by: "Santosh Nayak", action: "Approved" },
      { at: "2026-04-12", by: "Farah Khan", action: "Made effective · letter issued" },
    ],
    createdOn: "2026-04-08",
    createdBy: "Ritu Bansal",
    remarks: "",
  },
  {
    id: "PRM-2026-002",
    empId: "SRN-0014",
    employee: "Ishita Bose",
    dept: "Engineering",
    purpose: "Role expansion / new responsibility",
    appraisalRef: "SA-2026-004",
    basis: "Took over Semtech L2 support ownership; consistently 'Exceeds' in Q1–Q2 goal reviews.",
    fromDesignation: "Software Engineer",
    toDesignation: "Senior Software Engineer",
    fromGrade: "G3",
    toGrade: "G4",
    fromCtc: 1100000,
    toCtc: 1300000,
    hikePct: 18.2,
    effectiveFrom: "2026-10-01",
    newManager: "Subh Sahoo",
    newBranch: "Bhubaneswar HQ",
    probationMonths: 0,
    recommendedBy: "Subh Sahoo",
    letterType: "Promotion Letter",
    letterMode: "Generate from template",
    attachments: ["goal-review-q2.pdf"],
    status: "Pending approval",
    approvals: [
      {
        step: "HR",
        by: "Varen Mishra",
        on: "2026-09-12",
        decision: "Approved",
        note: "Within G4 band; budget confirmed with Finance",
      },
    ],
    history: [
      { at: "2026-09-11", by: "Varen Mishra", action: "Submitted for HR / Unit Head approval" },
      { at: "2026-09-12", by: "Varen Mishra", action: "HR approved" },
    ],
    createdOn: "2026-09-11",
    createdBy: "Varen Mishra",
    remarks: "",
  },
]);
export const usePromotions = () => promotionStore.use();
/** Token map used by the letter template and by the HR-editable preview. */
export function promotionLetterValues(c) {
  return {
    employee: c.employee,
    employeeId: c.empId,
    designation: c.toDesignation,
    position: c.toDesignation,
    department: c.dept,
    grade: c.toGrade,
    previous_grade: c.fromGrade,
    ctc: inr(c.toCtc),
    previous_ctc: inr(c.fromCtc),
    hike: String(c.hikePct),
    effective_date: c.effectiveFrom,
    joiningDate: c.effectiveFrom,
    date: new Date().toLocaleDateString("en-IN"),
    reportingManager: c.newManager,
    branch: c.newBranch,
    entity: entityOfEmployee(c.empId),
    reference: c.letterRef ?? "",
    expiryDate: "",
  };
}
/** The legal entity an employee's letters are issued by — their own company, not the group default. */
export const entityOfEmployee = (empId) => {
  const org = getOrg(findEmployee(empId)?.orgId);
  return org?.legalName || org?.name || "Seereon Consulting & IT Services Pvt. Ltd.";
};
export const promotionTemplate = (letterType, empId) =>
  templatesOf(letterType, empId ? entityOfEmployee(empId) : undefined)[0];
export function createPromotion(input, by, submit) {
  const e = findEmployee(input.empId);
  if (!e) return { ok: false, message: "Choose an employee." };
  // Segregation of duties — nobody raises their own promotion / increment.
  if (input.empId === by.id)
    return { ok: false, message: "You cannot raise a promotion for yourself." };
  const p = getEmployeeProfile(input.empId);
  if (!(input.toCtc > 0) || !input.effectiveFrom || !input.toDesignation.trim() || !input.toGrade)
    return {
      ok: false,
      message: "New designation, pay grade, CTC and effective date are required.",
    };
  if (submit && !input.basis.trim())
    return { ok: false, message: "Give the basis / justification before submitting for approval." };
  if (input.probationMonths < 0)
    return { ok: false, message: "Probation months cannot be negative." };
  const open = promotionStore
    .get()
    .find(
      (c) =>
        c.empId === input.empId && (c.status === "Pending approval" || c.status === "Approved"),
    );
  if (open)
    return {
      ok: false,
      message: `${e.name} already has ${open.id} (${open.status.toLowerCase()}) — complete or reject it first.`,
    };
  if (input.letterMode === "Attach signed letter" && !input.letterFile)
    return { ok: false, message: "Attach the signed appraisal / promotion letter." };
  const row = {
    ...input,
    id: nextCaseId("PRM", promotionStore.get()),
    employee: e.name,
    dept: e.dept,
    fromDesignation: e.role,
    fromGrade: p.job.grade,
    fromCtc: p.payroll.ctc,
    hikePct: p.payroll.ctc
      ? +(((input.toCtc - p.payroll.ctc) / p.payroll.ctc) * 100).toFixed(1)
      : 0,
    status: submit ? "Pending approval" : "Draft",
    approvals: [],
    history: [
      {
        at: today(),
        by: by.name,
        action: submit ? "Submitted for HR / Unit Head approval" : "Draft saved",
      },
    ],
    createdOn: today(),
    createdBy: by.name,
  };
  promotionStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: submit ? `${row.id} submitted for approval.` : "Draft saved.",
    id: row.id,
  };
}
export function submitPromotionDraft(id, by) {
  const c = promotionStore.get().find((x) => x.id === id);
  if (!c || c.status !== "Draft") return { ok: false, message: "Only a draft can be submitted." };
  if (!c.basis.trim())
    return { ok: false, message: "Add the basis / justification before submitting." };
  // Same rule as a direct submission: one open promotion per employee (two drafts could both be submitted).
  const open = promotionStore
    .get()
    .find(
      (x) =>
        x.id !== id &&
        x.empId === c.empId &&
        (x.status === "Pending approval" || x.status === "Approved"),
    );
  if (open)
    return {
      ok: false,
      message: `${c.employee} already has ${open.id} (${open.status.toLowerCase()}) — complete or reject it first.`,
    };
  promotionStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Pending approval",
            history: [
              ...x.history,
              { at: today(), by: by.name, action: "Submitted for HR / Unit Head approval" },
            ],
          }
        : x,
    ),
  );
  return { ok: true, message: `${id} submitted for approval.` };
}
/** Roles that may decide each promotion step (HR first, then the unit head). */
export const PROMOTION_STEP_ROLES = {
  HR: ["HR", "CHRO", "Admin", "SuperAdmin"],
  "Unit Head": ["CEO", "COO", "CFO", "CTO", "CHRO", "Admin", "SuperAdmin"],
};
export function approvePromotion(id, step, decision, note, by) {
  const c = promotionStore.get().find((x) => x.id === id);
  if (!c) return { ok: false, message: "Not found." };
  // A decision on anything but a pending case (or a repeated step) used to flip Effective / Rejected cases back to Approved.
  if (c.status !== "Pending approval")
    return { ok: false, message: `${id} is ${c.status.toLowerCase()} — nothing to decide.` };
  const expected = c.approvals.some((a) => a.step === "HR" && a.decision === "Approved")
    ? "Unit Head"
    : "HR";
  if (step !== expected) return { ok: false, message: `Awaiting the ${expected} decision.` };
  if (!(PROMOTION_STEP_ROLES[step] ?? []).includes(by.role))
    return { ok: false, message: `Your role cannot decide the ${step} step.` };
  if (c.empId === by.id) return { ok: false, message: "You cannot approve your own promotion." };
  if (c.approvals.some((a) => a.by === by.name))
    return {
      ok: false,
      message:
        "The same person cannot approve two steps — the Unit Head decision needs a different approver.",
    };
  if (decision === "Rejected" && !note.trim())
    return { ok: false, message: "Give a reason for rejecting." };
  promotionStore.set((l) =>
    l.map((c) =>
      c.id === id
        ? {
            ...c,
            status:
              decision === "Rejected"
                ? "Rejected"
                : c.approvals.length + 1 >= 2
                  ? "Approved"
                  : "Pending approval",
            approvals: [...c.approvals, { step, by: by.name, on: today(), decision, note }],
            history: [
              ...c.history,
              {
                at: today(),
                by: by.name,
                action: `${step} ${decision.toLowerCase()}${note ? ` — ${note}` : ""}`,
              },
            ],
          }
        : c,
    ),
  );
  return { ok: true, message: decision === "Approved" ? `${step} approved.` : "Rejected." };
}
/** Next free sequence for a case prefix — count-based ids could repeat a surviving case's id. */
function nextCaseId(prefix, rows) {
  const year = new Date().getFullYear();
  const n =
    rows.reduce(
      (m, r) =>
        r.id.startsWith(`${prefix}-${year}-`) ? Math.max(m, Number(r.id.slice(-3)) || 0) : m,
      0,
    ) + 1;
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}
/** Renders (downloads) the promotion / increment letter — from the HR-edited body when one was saved. */
export function renderPromotionLetter(c) {
  const t = promotionTemplate(c.letterType, c.empId);
  if (!t) return false;
  const bk = computeSalaryBreakup(c.toCtc, c.toGrade);
  renderTemplate(c.letterBody ? { ...t, body: c.letterBody } : t, promotionLetterValues(c), {
    columns: ["Component", "Monthly (₹)", "Annual (₹)"],
    rows: [
      ...bk.earnings.map((e) => [e.label, inr(e.monthly), inr(e.annual)]),
      ["Gross", inr(bk.monthlyGross), inr(bk.monthlyGross * 12)],
      ["Cost to company", inr(Math.round(c.toCtc / 12)), inr(c.toCtc)],
    ],
  });
  return true;
}
/**
 * A movement made effective also moves the person's login account and reporting line: approvals, branch scoping and
 * "My Team" read the account / hierarchy map, which used to keep pointing at the old manager, branch and department.
 */
function applyMovement(empId, { managerName, branch, dept, designation }) {
  const e = findEmployee(empId);
  if (managerName) {
    const mgr = directoryEmployees().find(
      (x) => x.name === managerName && x.orgId === e?.orgId && x.id !== empId,
    );
    if (mgr) setManager(empId, mgr.id);
  }
  if (!userById(empId)) return;
  const patch = {};
  if (branch) patch.branch = branch;
  if (dept) patch.dept = dept;
  if (designation) patch.designation = designation;
  if (Object.keys(patch).length) moveUserAccount(empId, patch);
}
/** Makes the promotion effective: compensation + designation update, letter generation, employee alert. */
export function effectPromotion(id, by) {
  const c = promotionStore.get().find((x) => x.id === id);
  if (!c) return { ok: false, message: "Not found." };
  if (c.status !== "Approved") return { ok: false, message: "Approve the promotion first." };
  updateCompensation(c.empId, { ctc: c.toCtc, grade: c.toGrade, designation: c.toDesignation });
  if (c.newManager || c.newBranch)
    updateEmployeeRecord(c.empId, {
      reportingManager: c.newManager || undefined,
      branch: c.newBranch || undefined,
    });
  applyMovement(c.empId, {
    managerName: c.newManager,
    branch: c.newBranch,
    designation: c.toDesignation,
  });
  const letterRef = `${c.letterType === "Promotion Letter" ? "PRM" : c.letterType === "Increment Letter" ? "INC" : "APT"}-${today().replace(/-/g, "")}-${c.empId.slice(-4)}`;
  const withRef = { ...c, letterRef };
  const letterFile =
    c.letterMode === "Attach signed letter" && c.letterFile
      ? c.letterFile
      : `${c.letterType.replace(/ /g, "-")}-${c.employee.replace(/\s+/g, "-")}.pdf`;
  if (c.letterMode !== "Attach signed letter") renderPromotionLetter(withRef);
  promotionStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Effective",
            letterRef,
            letterFile,
            history: [
              ...x.history,
              {
                at: today(),
                by: by.name,
                action: `Effective ${c.effectiveFrom} · ${c.letterType} ${letterRef} ${c.letterMode === "Attach signed letter" ? "attached" : "generated"} & e-mailed · CTC ₹${inr(c.fromCtc)} → ₹${inr(c.toCtc)} · grade ${c.fromGrade} → ${c.toGrade}`,
              },
            ],
          }
        : x,
    ),
  );
  pushAlert({
    empId: c.empId,
    kind: "payroll",
    to: "/emp/movements",
    title: `Promoted to ${c.toDesignation}`,
    body: `Grade ${c.fromGrade} → ${c.toGrade}, CTC ₹${inr(c.fromCtc)} → ₹${inr(c.toCtc)} effective ${c.effectiveFrom}. ${c.letterType} ${letterRef} e-mailed — open Movements to download.`,
  });
  return {
    ok: true,
    message: `${c.employee} promoted — profile, salary structure and payroll updated; ${c.letterType} ${letterRef} issued.`,
  };
}

/* ------------------------------------ Transfers ------------------------------------ */
/**
 * @typedef {Object} TransferCase
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {(typeof TRANSFER_TYPES)[number]} type
 * @property {string} fromBranch
 * @property {string} toBranch
 * @property {string} fromDept
 * @property {string} toDept
 * @property {string} fromEntity
 * @property {string} toEntity
 * @property {string} fromManager
 * @property {string} toManager
 * @property {string} newDesignation
 * @property {string} effectiveFrom
 * @property {string} reason
 * @property {"Employee" | "Manager" | "HR" | "Management"} requestedBy
 * @property {number} relocationAllowance
 * @property {boolean} joiningTravel
 * @property {number} noticeDays
 * @property {string} handoverTo
 * @property {string} assetsToReturn
 * @property {string} payrollImpact
 * @property {string} [letterRef]
 * @property {string[]} attachments
 * @property {CaseStatus} status
 * @property {Approval[]} approvals
 * @property {Hist[]} history
 * @property {string} createdOn
 * @property {string} createdBy
 * @property {string} remarks
 */
export const transferStore = createPersistentStore("seereon.cases.transfers.v2", [
  {
    id: "TRF-2026-001",
    empId: "SRN-0007",
    employee: "Neha Kulkarni",
    type: "Project / client",
    fromBranch: "Bhubaneswar HQ",
    toBranch: "Bhubaneswar HQ",
    fromDept: "Engineering",
    toDept: "Engineering",
    fromEntity: "Seereon Consulting & IT Services",
    toEntity: "Seereon Consulting & IT Services",
    fromManager: "Subh Sahoo",
    toManager: "Subh Sahoo",
    newDesignation: "",
    effectiveFrom: "2026-10-01",
    reason: "ZooPlus KSeF rollout needs a QA lead on the Poland account",
    requestedBy: "Manager",
    relocationAllowance: 0,
    joiningTravel: false,
    noticeDays: 15,
    handoverTo: "Rohan Patnaik",
    assetsToReturn: "None",
    payrollImpact: "Client allowance ₹5,000/month added",
    attachments: [],
    status: "Pending approval",
    approvals: [],
    history: [{ at: "2026-09-10", by: "Subh Sahoo", action: "Transfer requested" }],
    createdOn: "2026-09-10",
    createdBy: "Subh Sahoo",
    remarks: "",
  },
  {
    id: "TRF-2026-002",
    empId: "SRN-0008",
    employee: "Rakesh Menon",
    type: "Branch",
    fromBranch: "Bhubaneswar HQ",
    toBranch: "Hyderabad",
    fromDept: "Engineering",
    toDept: "Engineering",
    fromEntity: "Seereon Consulting & IT Services",
    toEntity: "Seereon Consulting & IT Services",
    fromManager: "Subh Sahoo",
    toManager: "Manish Patel",
    newDesignation: "",
    effectiveFrom: "2026-08-01",
    reason: "On-site data-platform presence for the Semtech Hyderabad engagement",
    requestedBy: "Management",
    relocationAllowance: 60000,
    joiningTravel: true,
    noticeDays: 30,
    handoverTo: "Aravind Krishnan",
    assetsToReturn: "Access card (HQ)",
    payrollImpact: "HRA recomputed for Hyderabad (metro); relocation allowance paid in Aug payroll",
    letterRef: "TRF-20260710-0011",
    attachments: ["relocation-approval.pdf"],
    status: "Effective",
    approvals: [
      {
        step: "HR",
        by: "Farah Khan",
        on: "2026-07-10",
        decision: "Approved",
        note: "Approved with relocation",
      },
    ],
    history: [
      { at: "2026-07-05", by: "Santosh Nayak", action: "Transfer requested" },
      { at: "2026-07-10", by: "Farah Khan", action: "Approved · letter TRF-20260710-0011" },
      {
        at: "2026-08-01",
        by: "Farah Khan",
        action:
          "Transfer effective — employee record, reporting line and payroll cost centre updated",
      },
    ],
    createdOn: "2026-07-05",
    createdBy: "Santosh Nayak",
    remarks: "",
  },
]);
export const useTransfers = () => transferStore.use();
export function transferLetterValues(c) {
  return {
    employee: c.employee,
    employeeId: c.empId,
    transferType: c.type,
    from: `${c.fromDept}, ${c.fromBranch} (${c.fromEntity})`,
    to: `${c.toDept}, ${c.toBranch} (${c.toEntity})`,
    effective_date: c.effectiveFrom,
    reportingManager: c.toManager || c.fromManager,
    designation: c.newDesignation || findEmployee(c.empId)?.role || "",
    relocationAllowance: inr(c.relocationAllowance),
    handoverTo: c.handoverTo || "your reporting manager",
    reason: c.reason,
    date: new Date().toLocaleDateString("en-IN"),
    reference: c.letterRef ?? "",
    department: c.toDept,
    position: c.newDesignation || findEmployee(c.empId)?.role || "",
  };
}
export const renderTransferLetter = (c) => {
  const t = templatesOf("Transfer Letter", entityOfEmployee(c.empId))[0];
  if (!t) return false;
  renderTemplate(t, transferLetterValues(c));
  return true;
};
export function createTransfer(input, by) {
  const e = findEmployee(input.empId);
  if (!e) return { ok: false, message: "Choose an employee." };
  if (!input.effectiveFrom || !input.reason.trim())
    return { ok: false, message: "Effective date and reason are required." };
  if (input.relocationAllowance < 0 || input.noticeDays < 0)
    return { ok: false, message: "Relocation allowance and notice days cannot be negative." };
  // Moving to another entity changes the employer (PF, gratuity carry-forward, payroll) — that is the confirmed group
  // transfer. Here the entity change was stored but never applied, so the employee silently stayed in the old company.
  if (input.toEntity && input.fromEntity && input.toEntity !== input.fromEntity)
    return {
      ok: false,
      message: 'Moving to another company is a group transfer — use "Transfer to Group Company".',
    };
  const moved =
    input.toBranch !== input.fromBranch ||
    input.toDept !== input.fromDept ||
    (!!input.toManager && input.toManager !== input.fromManager) ||
    !!input.newDesignation;
  const needs = {
    Branch: input.toBranch !== input.fromBranch,
    Department: input.toDept !== input.fromDept,
    "Reporting manager": !!input.toManager && input.toManager !== input.fromManager,
    Role: !!input.newDesignation,
  };
  if (needs[input.type] === false)
    return {
      ok: false,
      message: `A ${input.type.toLowerCase()} transfer must change the ${input.type === "Role" ? "designation" : input.type.toLowerCase()}.`,
    };
  if (input.type !== "Project / client" && !moved)
    return {
      ok: false,
      message:
        "Nothing changes in this transfer — pick the new branch, department, manager or designation.",
    };
  const open = transferStore
    .get()
    .find(
      (c) =>
        c.empId === input.empId && (c.status === "Pending approval" || c.status === "Approved"),
    );
  if (open)
    return {
      ok: false,
      message: `${e.name} already has transfer ${open.id} (${open.status.toLowerCase()}).`,
    };
  const row = {
    ...input,
    id: nextCaseId("TRF", transferStore.get()),
    employee: e.name,
    status: "Pending approval",
    approvals: [],
    history: [
      {
        at: today(),
        by: by.name,
        action: `${input.type} transfer requested by ${input.requestedBy}`,
      },
    ],
    createdOn: today(),
    createdBy: by.name,
  };
  transferStore.set((l) => [row, ...l]);
  return { ok: true, message: `${row.id} raised — HR approval pending.`, id: row.id };
}
export function decideTransfer(id, decision, note, by) {
  const c = transferStore.get().find((x) => x.id === id);
  if (!c) return { ok: false, message: "Not found." };
  if (c.status !== "Pending approval")
    return { ok: false, message: `${id} is ${c.status.toLowerCase()} — nothing to decide.` };
  if (c.empId === by.id) return { ok: false, message: "You cannot approve your own transfer." };
  // Segregation of duties — the person who raised the transfer cannot also be its single HR approver.
  if (c.createdBy === by.name)
    return { ok: false, message: "You raised this transfer — another approver must decide it." };
  if (decision === "Rejected" && !note.trim())
    return { ok: false, message: "Give a reason for rejecting." };
  const letterRef =
    decision === "Approved" ? `TRF-${today().replace(/-/g, "")}-${c.empId.slice(-4)}` : undefined;
  if (decision === "Approved") {
    renderTransferLetter({ ...c, letterRef });
    pushAlert({
      empId: c.empId,
      kind: "general",
      to: "/emp/movements",
      title: `Transfer approved — effective ${c.effectiveFrom}`,
      body: `${c.type} transfer to ${c.toDept}, ${c.toBranch}. Report to ${c.toManager || c.fromManager}. Letter ${letterRef} e-mailed.`,
    });
  }
  transferStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: decision === "Approved" ? "Approved" : "Rejected",
            letterRef,
            approvals: [...x.approvals, { step: "HR", by: by.name, on: today(), decision, note }],
            history: [
              ...x.history,
              {
                at: today(),
                by: by.name,
                action: `${decision}${letterRef ? ` · letter ${letterRef}` : ""}${note ? ` — ${note}` : ""}`,
              },
            ],
          }
        : x,
    ),
  );
  return {
    ok: true,
    message:
      decision === "Approved"
        ? `Approved — transfer letter ${letterRef} issued and e-mailed.`
        : "Rejected.",
  };
}
/** Effective date reached: the employee record (department, branch, entity, reporting manager, designation) is updated. */
export function effectTransfer(id, by) {
  const c = transferStore.get().find((x) => x.id === id);
  if (!c || c.status !== "Approved") return { ok: false, message: "Approve the transfer first." };
  if (c.effectiveFrom > today())
    return {
      ok: false,
      message: `${id} takes effect on ${c.effectiveFrom} — it can be made effective from that date.`,
    };
  updateEmployeeRecord(c.empId, {
    dept: c.toDept || undefined,
    branch: c.toBranch || undefined,
    reportingManager: c.toManager || undefined,
    role: c.newDesignation || undefined,
  });
  applyMovement(c.empId, {
    managerName: c.toManager && c.toManager !== c.fromManager ? c.toManager : "",
    branch: c.toBranch,
    dept: c.toDept,
    designation: c.newDesignation,
  });
  transferStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Effective",
            history: [
              ...x.history,
              {
                at: today(),
                by: by.name,
                action:
                  "Transfer effective — employee record, reporting line and payroll cost centre updated",
              },
            ],
          }
        : x,
    ),
  );
  return {
    ok: true,
    message: `${c.employee} moved to ${c.toDept}, ${c.toBranch}${c.toManager ? ` under ${c.toManager}` : ""} — employee record updated.`,
  };
}

/* ------------------------------------ Terminations ------------------------------------ */
export const TERMINATION_STEPS = ["HR Head", "Unit Head", "Legal"];
/** Roles that may decide each termination step (the case used to accept any approver role on any step). */
export const TERMINATION_STEP_ROLES = {
  "HR Head": ["HR", "CHRO", "Admin", "SuperAdmin"],
  "Unit Head": ["CEO", "COO", "CHRO", "Admin", "SuperAdmin"],
  Legal: ["CHRO", "CEO", "Admin", "SuperAdmin"],
};
/**
 * @typedef {Object} TerminationCase
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} type
 * @property {string} reason
 * @property {string} incidentDate
 * @property {string} description
 * @property {string[]} evidence
 * @property {"Serve notice" | "Pay in lieu" | "Immediate (misconduct)"} noticeMode
 * @property {number} noticeDays
 * @property {string} lastWorkingDay
 * @property {boolean} fnfRequired
 * @property {boolean} gratuityForfeited
 * @property {boolean} assetsRecovered
 * @property {boolean} accessRevoked
 * @property {string} hearingDate
 * @property {boolean} showCauseIssued
 * @property {string} employeeResponse
 * @property {boolean} legalReview
 * @property {string} initiatedBy
 * @property {string} [letterRef]
 * @property {CaseStatus} status
 * @property {Approval[]} approvals
 * @property {Hist[]} history
 * @property {string} createdOn
 * @property {string} createdBy
 */
export const terminationStore = createPersistentStore("seereon.cases.terminations.v2", [
  {
    id: "TRM-2026-001",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    dept: "Sales",
    type: "Misconduct",
    reason: "POSH Internal Committee findings (GRV-2026-0004)",
    incidentDate: "2026-07-01",
    description:
      "IC recommended termination after inquiry; show-cause notice replied on 2026-09-02.",
    evidence: ["ic-report.pdf", "show-cause-reply.pdf"],
    noticeMode: "Immediate (misconduct)",
    noticeDays: 0,
    lastWorkingDay: "2026-09-30",
    fnfRequired: true,
    gratuityForfeited: false,
    assetsRecovered: false,
    accessRevoked: false,
    hearingDate: "2026-09-08",
    showCauseIssued: true,
    employeeResponse: "Denied allegations; no new evidence.",
    legalReview: true,
    initiatedBy: "Farah Khan",
    status: "Pending approval",
    approvals: [
      {
        step: "HR Head",
        by: "Farah Khan",
        on: "2026-09-10",
        decision: "Approved",
        note: "Per IC recommendation",
      },
    ],
    history: [
      { at: "2026-09-08", by: "Farah Khan", action: "Termination case opened" },
      {
        at: "2026-09-10",
        by: "Farah Khan",
        action: "HR Head approved · awaiting Unit Head / Legal",
      },
    ],
    createdOn: "2026-09-08",
    createdBy: "Farah Khan",
  },
]);
export const useTerminations = () => terminationStore.use();
export function terminationLetterValues(c) {
  return {
    employee: c.employee,
    employeeId: c.empId,
    hearingDate: c.hearingDate || "—",
    entity: entityOfEmployee(c.empId),
    terminationType: c.type,
    reason: c.reason,
    lastWorkingDay: c.lastWorkingDay,
    noticeMode:
      c.noticeMode === "Pay in lieu"
        ? `${c.noticeDays} days' pay in lieu of notice`
        : c.noticeMode === "Serve notice"
          ? `${c.noticeDays} days' notice`
          : "with immediate effect",
    gratuityNote: c.gratuityForfeited
      ? "; gratuity stands forfeited under Section 4(6) of the Payment of Gratuity Act"
      : "",
    date: new Date().toLocaleDateString("en-IN"),
    reference: c.letterRef ?? "",
    department: c.dept,
    position: findEmployee(c.empId)?.role ?? "",
  };
}
export const renderTerminationLetter = (c) => {
  const t = templatesOf("Termination Letter", entityOfEmployee(c.empId))[0];
  if (!t) return false;
  renderTemplate(t, terminationLetterValues(c));
  return true;
};
export function createTermination(input, by) {
  const e = findEmployee(input.empId);
  if (!e) return { ok: false, message: "Choose an employee." };
  if (!input.type || !input.reason.trim() || !input.lastWorkingDay)
    return { ok: false, message: "Type, reason and last working day are required." };
  if (input.empId === by.id)
    return { ok: false, message: "You cannot open a termination case against yourself." };
  if (input.incidentDate && input.incidentDate > today())
    return { ok: false, message: "The incident date cannot be in the future." };
  if (input.incidentDate && input.lastWorkingDay < input.incidentDate)
    return { ok: false, message: "Last working day cannot be before the incident date." };
  if (input.hearingDate && input.lastWorkingDay < input.hearingDate)
    return { ok: false, message: "Last working day cannot be before the hearing date." };
  if (input.noticeDays < 0) return { ok: false, message: "Notice days cannot be negative." };
  const open = terminationStore
    .get()
    .find(
      (c) =>
        c.empId === input.empId && (c.status === "Pending approval" || c.status === "Approved"),
    );
  if (open)
    return { ok: false, message: `${e.name} already has termination case ${open.id} in progress.` };
  const row = {
    ...input,
    id: nextCaseId("TRM", terminationStore.get()),
    employee: e.name,
    dept: e.dept,
    status: "Pending approval",
    approvals: [],
    history: [{ at: today(), by: by.name, action: "Termination case opened" }],
    createdOn: today(),
    createdBy: by.name,
  };
  terminationStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: `${row.id} opened — HR Head, Unit Head and Legal approvals required.`,
    id: row.id,
  };
}
export function decideTermination(id, step, decision, note, by) {
  const c = terminationStore.get().find((x) => x.id === id);
  if (!c) return { ok: false, message: "Not found." };
  if (c.status !== "Pending approval")
    return { ok: false, message: `${id} is ${c.status.toLowerCase()} — nothing to decide.` };
  const expected = TERMINATION_STEPS[c.approvals.filter((a) => a.decision === "Approved").length];
  if (step !== expected) return { ok: false, message: `Awaiting the ${expected} decision.` };
  if (c.empId === by.id)
    return { ok: false, message: "You cannot decide your own termination case." };
  if (!(TERMINATION_STEP_ROLES[step] ?? []).includes(by.role))
    return { ok: false, message: `Your role cannot decide the ${step} step.` };
  // The person who opened the case cannot approve it (they could sign the HR Head step of their own case).
  if (c.createdBy === by.name && decision === "Approved")
    return { ok: false, message: "You opened this case — another approver must decide it." };
  // Three-step approval means three people — one user could click through HR Head, Unit Head and Legal alone.
  if (c.approvals.some((a) => a.by === by.name))
    return {
      ok: false,
      message:
        "You have already decided a step on this case — the next step needs a different approver.",
    };
  if (decision === "Rejected" && !note.trim())
    return { ok: false, message: "Give a reason for rejecting." };
  terminationStore.set((l) =>
    l.map((c) =>
      c.id === id
        ? {
            ...c,
            status:
              decision === "Rejected"
                ? "Rejected"
                : c.approvals.length + 1 >= TERMINATION_STEPS.length
                  ? "Approved"
                  : "Pending approval",
            approvals: [...c.approvals, { step, by: by.name, on: today(), decision, note }],
            history: [
              ...c.history,
              {
                at: today(),
                by: by.name,
                action: `${step} ${decision.toLowerCase()}${note ? ` — ${note}` : ""}`,
              },
            ],
          }
        : c,
    ),
  );
  return { ok: true, message: `${step} ${decision.toLowerCase()}.` };
}
export function executeTermination(id, by) {
  const c = terminationStore.get().find((x) => x.id === id);
  if (!c) return { ok: false, message: "Not found." };
  if (c.status !== "Approved") return { ok: false, message: "All approvals are required first." };
  const letterRef = `TRM-${today().replace(/-/g, "")}-${c.empId.slice(-4)}`;
  renderTerminationLetter({ ...c, letterRef });
  updateEmployeeRecord(c.empId, { status: "Notice" });
  // "Access revoked" was only a flag. A last working day already reached suspends the login now; a later one is
  // enforced at sign-in (see SignInView) once that day has passed.
  if (c.lastWorkingDay <= today()) suspendUser(c.empId, by.name, `Terminated — ${c.type}`);
  // The message promised "F&F and asset recovery initiated in Exit Management" but no exit file was ever opened.
  const e = findEmployee(c.empId);
  if (e)
    openTerminationExit(
      {
        empId: e.id,
        empName: e.name,
        email: e.email,
        designation: e.role,
        dept: e.dept,
        branch: e.branch,
        managerId: userById(c.empId)?.managerId ?? null,
        reason: c.type,
        description: c.reason,
        lastWorkingDay: c.lastWorkingDay,
        letterRef,
      },
      by,
    );
  terminationStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Effective",
            letterRef,
            accessRevoked: true,
            history: [
              ...x.history,
              {
                at: today(),
                by: by.name,
                action: `Termination letter ${letterRef} issued · access revocation scheduled for LWD ${c.lastWorkingDay} · F&F and asset recovery initiated in Exit Management`,
              },
            ],
          }
        : x,
    ),
  );
  pushAlert({
    empId: c.empId,
    kind: "general",
    to: "/emp/movements",
    title: "Termination letter issued",
    body: `Letter ${letterRef} · last working day ${c.lastWorkingDay}. Complete exit formalities and asset return on the portal.`,
  });
  return {
    ok: true,
    message: `Termination letter ${letterRef} issued; employee moved to notice, F&F and asset recovery initiated in Exit Management.`,
  };
}
export const updateTerminationChecklist = (id, patch, by) =>
  terminationStore.set((l) =>
    l.map((c) =>
      c.id === id
        ? {
            ...c,
            ...patch,
            history: [
              ...c.history,
              {
                at: today(),
                by: by.name,
                action: `Checklist updated: ${Object.entries(patch)
                  .map(([k, v]) => `${k} = ${v ? "yes" : "no"}`)
                  .join(", ")}`,
              },
            ],
          }
        : c,
    ),
  );

/* ------------------------------------ Warnings ------------------------------------ */
/**
 * @typedef {Object} WarningCase
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} type
 * @property {"Level 1" | "Level 2" | "Level 3 (final)"} severity
 * @property {string} category
 * @property {string} incidentDate
 * @property {string} description
 * @property {string[]} evidence
 * @property {string} witnesses
 * @property {string} issuedBy
 * @property {string} issuedOn
 * @property {number} validityMonths
 * @property {string} improvementPlan
 * @property {string} reviewDate
 * @property {string} escalation
 * @property {boolean} pipLinked
 * @property {boolean} acknowledged
 * @property {string} [acknowledgedOn]
 * @property {string} employeeComment
 * @property {string} [letterRef]
 * @property {CaseStatus} status
 * @property {Hist[]} history
 */
export const warningStore = createPersistentStore("seereon.cases.warnings.v2", [
  {
    id: "WRN-2026-001",
    empId: "SRN-0015",
    employee: "Aravind Krishnan",
    dept: "Engineering",
    type: "Attendance",
    severity: "Level 1",
    category: "Late arrival / unplanned absence",
    incidentDate: "2026-08-20",
    description: "Six late marks and two unplanned absences in August without prior intimation.",
    evidence: ["attendance-aug-2026.csv"],
    witnesses: "",
    issuedBy: "Subh Sahoo",
    issuedOn: "2026-08-25",
    validityMonths: 6,
    improvementPlan: "Punctuality to be reviewed weekly for 8 weeks; apply leave in advance.",
    reviewDate: "2026-10-20",
    escalation: "Level 2 warning on recurrence",
    pipLinked: false,
    acknowledged: true,
    acknowledgedOn: "2026-08-26",
    employeeComment: "Acknowledged; family situation resolved.",
    letterRef: "WRN-20260825-0015",
    status: "Effective",
    history: [
      { at: "2026-08-25", by: "Subh Sahoo", action: "Warning issued · letter WRN-20260825-0015" },
      { at: "2026-08-26", by: "Aravind Krishnan", action: "Acknowledged" },
    ],
  },
  {
    id: "WRN-2026-002",
    empId: "SRN-0006",
    employee: "Subham Das",
    dept: "Engineering",
    type: "Data / IT security",
    severity: "Level 1",
    category: "Unauthorised data sharing",
    incidentDate: "2026-09-05",
    description:
      "Client (Semtech) test dataset shared to a personal e-mail for weekend debugging, in breach of the IT security policy §4.2. No data left the organisation network per DLP logs.",
    evidence: ["dlp-alert-0905.pdf"],
    witnesses: "",
    issuedBy: "Farah Khan",
    issuedOn: "2026-09-09",
    validityMonths: 6,
    improvementPlan:
      "Complete the information-security refresher (LMS) within 14 days; use the sanctioned VPN + VDI for remote debugging.",
    reviewDate: "2026-10-09",
    escalation: "Level 2 warning and access review on recurrence",
    pipLinked: false,
    acknowledged: false,
    employeeComment: "",
    letterRef: "WRN-20260909-0006",
    status: "Effective",
    history: [
      {
        at: "2026-09-09",
        by: "Farah Khan",
        action: "Warning issued · letter WRN-20260909-0006 · awaiting employee acknowledgement",
      },
    ],
  },
]);
export const useWarnings = () => warningStore.use();
export function warningLetterValues(c) {
  return {
    employee: c.employee,
    employeeId: c.empId,
    severity: c.severity,
    category: c.category,
    incidentDate: c.incidentDate,
    description: c.description,
    improvementPlan: c.improvementPlan || "as discussed with your reporting manager",
    reviewDate: c.reviewDate || "the end of the review period",
    validityMonths: String(c.validityMonths),
    date: new Date().toLocaleDateString("en-IN"),
    reference: c.letterRef ?? "",
    department: c.dept,
    position: findEmployee(c.empId)?.role ?? "",
    warningType: c.type,
  };
}
export const renderWarningLetter = (c) => {
  const t = templatesOf("Warning Letter", entityOfEmployee(c.empId))[0];
  if (!t) return false;
  renderTemplate(t, warningLetterValues(c));
  return true;
};
export function issueWarning(input, by) {
  const e = findEmployee(input.empId);
  if (!e) return { ok: false, message: "Choose an employee." };
  if (!input.type || !input.description.trim())
    return { ok: false, message: "Type and description are required." };
  if (input.empId === by.id)
    return { ok: false, message: "You cannot issue a warning to yourself." };
  if (!input.incidentDate || input.incidentDate > today())
    return { ok: false, message: "The incident date is required and cannot be in the future." };
  if (!input.reviewDate || input.reviewDate < input.incidentDate)
    return { ok: false, message: "The review date must be on or after the incident date." };
  if (!(input.validityMonths > 0))
    return { ok: false, message: "Validity must be at least one month." };
  const letterRef = `WRN-${today().replace(/-/g, "")}-${input.empId.slice(-4)}`;
  const row = {
    ...input,
    id: nextCaseId("WRN", warningStore.get()),
    employee: e.name,
    dept: e.dept,
    issuedOn: today(),
    acknowledged: false,
    employeeComment: "",
    letterRef,
    status: "Effective",
    history: [
      {
        at: today(),
        by: by.name,
        action: `Warning issued · letter ${letterRef} · awaiting employee acknowledgement`,
      },
    ],
  };
  renderWarningLetter(row);
  warningStore.set((l) => [row, ...l]);
  pushAlert({
    empId: e.id,
    kind: "general",
    to: "/emp/movements",
    title: `${input.severity} warning issued — ${input.type}`,
    body: `${input.description.slice(0, 120)}… Please acknowledge letter ${letterRef} within 3 working days.`,
  });
  return {
    ok: true,
    message: `Warning ${row.id} issued; letter ${letterRef} generated and e-mailed for acknowledgement.`,
    id: row.id,
  };
}
export const acknowledgeWarning = (id, comment, by) =>
  warningStore.set((l) =>
    l.map((w) =>
      w.id === id && !w.acknowledged && w.empId === by.id
        ? {
            ...w,
            acknowledged: true,
            acknowledgedOn: today(),
            employeeComment: comment,
            history: [
              ...w.history,
              {
                at: today(),
                by: by.name,
                action: `Acknowledged by employee${comment ? ` — "${comment}"` : ""}`,
              },
            ],
          }
        : w,
    ),
  );
export const closeWarning = (id, note, by) =>
  warningStore.set((l) =>
    l.map((w) =>
      w.id === id
        ? {
            ...w,
            status: "Closed",
            history: [
              ...w.history,
              { at: today(), by: by.name, action: `Closed — ${note || "improvement sustained"}` },
            ],
          }
        : w,
    ),
  );
export const escalateWarning = (id, by) =>
  warningStore.set((l) =>
    l.map((w) =>
      w.id === id
        ? {
            ...w,
            severity: w.severity === "Level 1" ? "Level 2" : "Level 3 (final)",
            pipLinked: true,
            history: [
              ...w.history,
              {
                at: today(),
                by: by.name,
                action: `Escalated to ${w.severity === "Level 1" ? "Level 2" : "Level 3 (final)"} · PIP linked`,
              },
            ],
          }
        : w,
    ),
  );

/* ------------------------------------ Referrals ------------------------------------ */
/**
 * @typedef {Object} ReferralCase
 * @property {string} id
 * @property {string} referrerId
 * @property {string} referrer
 * @property {string} referrerDept
 * @property {string} candidate
 * @property {string} email
 * @property {string} phone
 * @property {string} relationship
 * @property {string} jobId
 * @property {string} jobTitle
 * @property {string} cvFile
 * @property {string} skills
 * @property {number} experienceYears
 * @property {string} note
 * @property {string} [applicantId]
 * @property {boolean} bonusEligible
 * @property {number} bonusAmount
 * @property {string} [bonusPaidOn]
 * @property {"Submitted" | "Screening" | "Interviewing" | "Hired" | "Bonus paid" | "Not selected"} status
 * @property {string} createdOn
 * @property {Hist[]} history
 */
export const referralStore = createPersistentStore("seereon.cases.referrals.v2", [
  {
    id: "REF-2026-001",
    referrerId: "SRN-0006",
    referrer: "Subham Das",
    referrerDept: "Engineering",
    candidate: "Priyanka Das",
    email: "priyanka.d@mail.com",
    phone: "+91 98610 44332",
    relationship: "Ex-colleague",
    jobId: "JP-1001",
    jobTitle: "Senior Frontend Engineer",
    cvFile: "Priyanka-Das-CV.pdf",
    skills: "React, TypeScript, Next.js",
    experienceYears: 7,
    note: "Strong front-end lead; open to Bhubaneswar.",
    applicantId: "CND-007",
    bonusEligible: true,
    bonusAmount: 25000,
    status: "Screening",
    createdOn: "2026-08-15",
    history: [
      {
        at: "2026-08-15",
        by: "Subham Das",
        action: "Referred for JP-1001 · added to applicants as CND-007",
      },
    ],
  },
  {
    id: "REF-2026-002",
    referrerId: "SRN-0144",
    referrer: "Priya Nair",
    referrerDept: "HR",
    candidate: "Arun Mahapatra",
    email: "arun.m@mail.com",
    phone: "+91 94370 22110",
    relationship: "College batchmate",
    jobId: "JP-1002",
    jobTitle: "Business Analyst",
    cvFile: "Arun-Mahapatra-CV.pdf",
    skills: "SQL, Power BI, Requirements",
    experienceYears: 4,
    note: "Worked on RCU-type public-sector clients.",
    bonusEligible: true,
    bonusAmount: 15000,
    bonusPaidOn: "2026-07-31",
    status: "Bonus paid",
    createdOn: "2026-05-02",
    history: [
      { at: "2026-05-02", by: "Priya Nair", action: "Referred for JP-1002" },
      { at: "2026-06-15", by: "Ritu Bansal", action: "Hired" },
      {
        at: "2026-07-31",
        by: "Saras Venkatesh",
        action: "Bonus paid — ₹15,000 with July payroll (post 90-day retention)",
      },
    ],
  },
]);
export const useReferrals = () => referralStore.use();
export function createReferral(input, by) {
  const e = findEmployee(input.referrerId);
  if (!e) return { ok: false, message: "Referrer not found." };
  if (!input.candidate.trim() || !/^\S+@\S+\.\S+$/.test(input.email) || !input.jobId)
    return { ok: false, message: "Candidate name, valid e-mail and job post are required." };
  if (input.email.trim().toLowerCase() === e.email.toLowerCase())
    return { ok: false, message: "You cannot refer yourself." };
  if (input.experienceYears < 0 || input.bonusAmount < 0)
    return { ok: false, message: "Experience and bonus cannot be negative." };
  const dup = findDuplicateApplicant(input.email, input.jobId);
  if (dup)
    return {
      ok: false,
      message: `${dup.name} (${dup.email}) has already applied for this post as ${dup.id}.`,
    };
  const applicant = addApplicant(
    {
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      name: input.candidate,
      email: input.email,
      phone: input.phone,
      source: "Referral",
      currentCompany: "",
      experienceYears: input.experienceYears,
      currentCtc: 0,
      expectedCtc: 0,
      skills: input.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      education: "",
      noticeDays: 30,
      location: "",
      cvFile: input.cvFile,
      coverNote: `Referred by ${e.name} (${input.relationship}). ${input.note}`,
    },
    by.name,
  );
  const row = {
    ...input,
    id: nextCaseId("REF", referralStore.get()),
    referrer: e.name,
    referrerDept: e.dept,
    applicantId: applicant.id,
    status: "Submitted",
    createdOn: today(),
    history: [
      {
        at: today(),
        by: by.name,
        action: `Referred for ${input.jobTitle} · added to applicants as ${applicant.id}`,
      },
    ],
  };
  referralStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: `Referral ${row.id} recorded and ${input.candidate} added to Step 2 (Candidates applied) as ${applicant.id}.`,
    id: row.id,
  };
}
export const updateReferralStatus = (id, status, by) => {
  const cur = referralStore.get().find((x) => x.id === id);
  // A bonus is paid only on a hired, bonus-eligible referral, and only once.
  if (status === "Bonus paid" && !(cur?.status === "Hired" && cur.bonusEligible)) return false;
  if (cur?.status === status) return false;
  referralStore.set((l) =>
    l.map((r) =>
      r.id === id
        ? {
            ...r,
            status,
            bonusPaidOn: status === "Bonus paid" ? today() : r.bonusPaidOn,
            history: [
              ...r.history,
              {
                at: today(),
                by: by.name,
                action:
                  status === "Bonus paid"
                    ? `Bonus paid — ₹${inr(r.bonusAmount)} with payroll`
                    : status,
              },
            ],
          }
        : r,
    ),
  );
  const r = referralStore.get().find((x) => x.id === id);
  if (r)
    pushAlert({
      empId: r.referrerId,
      kind: "general",
      to: "/emp/referrals",
      title: `Referral ${r.candidate}: ${status}`,
      body:
        status === "Bonus paid"
          ? `Referral bonus ₹${inr(r.bonusAmount)} credited with this month's payroll.`
          : `Your referral for ${r.jobTitle} is now "${status}".`,
    });
  return true;
};

/** Offer accepted & welcome sent → the referral (if any) becomes Hired and the referrer is told. */
export const syncReferralOnHire = (applicantId, by) => {
  const r = referralStore.get().find((x) => x.applicantId === applicantId);
  if (r && r.status !== "Hired" && r.status !== "Bonus paid")
    updateReferralStatus(r.id, "Hired", by);
};

/** Everything on record for one employee — shown on the employee record (Cases tab) and the employee portal. */
export function casesForEmployee(empId) {
  return {
    promotions: promotionStore.get().filter((c) => c.empId === empId),
    transfers: transferStore.get().filter((c) => c.empId === empId),
    terminations: terminationStore.get().filter((c) => c.empId === empId),
    warnings: warningStore.get().filter((c) => c.empId === empId),
    referrals: referralStore.get().filter((c) => c.referrerId === empId),
  };
}
export function useCasesForEmployee(empId) {
  const promotions = promotionStore.use().filter((c) => c.empId === empId);
  const transfers = transferStore.use().filter((c) => c.empId === empId);
  const terminations = terminationStore.use().filter((c) => c.empId === empId);
  const warnings = warningStore.use().filter((c) => c.empId === empId);
  const referrals = referralStore.use().filter((c) => c.referrerId === empId);
  return { promotions, transfers, terminations, warnings, referrals };
}
/** Letter preview text (for the HR-editable promotion letter). */
export const previewLetterBody = (body, values) => fillTokens(body, values);
