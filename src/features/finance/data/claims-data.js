// Claims & Reimbursements + employee insurance assignments (feeds payroll deductions).
import { createStore, nextId } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";
import { userById } from "@/features/auth/data/auth-session";
import { getEmployeeProfile, findEmployee } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";

/* ---------------- Masters ---------------- */

/**
 * @typedef {Object} NamedMaster
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} status
 */

export const insuranceTypeStore = createStore([
  {
    id: "INT-001",
    name: "Group Health Insurance",
    description: "Family floater covering employee, spouse and 2 children",
    status: "Active",
  },
  {
    id: "INT-002",
    name: "Group Term Life",
    description: "Life cover of 3x annual CTC",
    status: "Active",
  },
  {
    id: "INT-003",
    name: "Personal Accident",
    description: "Accidental disability and death cover",
    status: "Active",
  },
]);

export const insuranceCategoryStore = createStore([
  {
    id: "INC-001",
    name: "Employee Only",
    description: "Cover applies to the employee alone",
    status: "Active",
  },
  {
    id: "INC-002",
    name: "Employee + Spouse",
    description: "Cover extends to spouse",
    status: "Active",
  },
  {
    id: "INC-003",
    name: "Family Floater",
    description: "Employee, spouse, children and parents",
    status: "Active",
  },
]);

export const reimbursementCategoryStore = createStore([
  {
    id: "RBC-001",
    name: "Travel",
    description: "Cab, flight, train and mileage claims",
    status: "Active",
  },
  {
    id: "RBC-002",
    name: "Medical",
    description: "Out-patient and diagnostics not covered by insurance",
    status: "Active",
  },
  {
    id: "RBC-003",
    name: "Internet & Telecom",
    description: "Home broadband and mobile bills",
    status: "Active",
  },
  {
    id: "RBC-004",
    name: "Client Entertainment",
    description: "Meals and hospitality with clients",
    status: "Active",
  },
]);

export const REIMBURSEMENT_TYPES = [
  "Expense Claim",
  "Advance Settlement",
  "Insurance Claim",
  "Petty Cash",
];

/* ---------------- Employee insurance ---------------- */

/**
 * @typedef {Object} InsuranceAssignment
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} department - Employee snapshot captured at assignment time
 * @property {string} designation
 * @property {string} branch
 * @property {string} dateOfBirth
 * @property {string} contact
 * @property {string} insurer - Insurer details
 * @property {string} policyNumber
 * @property {string} tpa
 * @property {string} insurerContact
 * @property {string} type - Cover details
 * @property {string} category
 * @property {number} amount
 * @property {string} roomRentLimit
 * @property {string} copay
 * @property {string} nominee
 * @property {string} nomineeRelation
 * @property {string} dependents
 * @property {string} validFrom
 * @property {string} validTo
 * @property {number} premium
 * @property {number} deduction
 * @property {string[]} documents
 * @property {string} remarks
 * @property {"Active" | "Lapsed"} status
 */

export const INSURERS = [
  "ICICI Lombard",
  "HDFC ERGO",
  "Star Health",
  "Niva Bupa",
  "Bajaj Allianz",
  "New India Assurance",
];

// Persisted: payroll deducts these every month, so an assignment must survive a reload like the runs that use it.
export const insuranceStore = createPersistentStore("seereon.insurance.assignments.v1", [
  {
    id: "INS-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    department: "Engineering",
    designation: "Senior Engineer",
    branch: "Bhubaneswar HQ",
    dateOfBirth: "1994-02-11",
    contact: "+91 98450 22119",
    insurer: "ICICI Lombard",
    policyNumber: "GHI/2026/AVN/0142",
    tpa: "Medi Assist",
    insurerContact: "1800 266 7766",
    type: "Group Health Insurance",
    category: "Family Floater",
    amount: 800000,
    roomRentLimit: "1% of sum insured per day",
    copay: "Nil",
    nominee: "Rohit Sharma",
    nomineeRelation: "Spouse",
    dependents: "Spouse, 2 children",
    validFrom: "2026-04-01",
    validTo: "2027-03-31",
    premium: 21400,
    deduction: 1250,
    documents: ["policy-schedule.pdf", "e-card.pdf"],
    remarks: "Corporate floater — parents optional top-up available",
    status: "Active",
  },
  {
    id: "INS-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    department: "Sales",
    designation: "Account Executive",
    branch: "Mumbai",
    dateOfBirth: "1990-09-04",
    contact: "+91 99201 44510",
    insurer: "HDFC ERGO",
    policyNumber: "GTL/2026/AVN/0143",
    tpa: "—",
    insurerContact: "1800 258 4242",
    type: "Group Term Life",
    category: "Employee Only",
    amount: 4500000,
    roomRentLimit: "—",
    copay: "—",
    nominee: "Lakshmi Iyer",
    nomineeRelation: "Spouse",
    dependents: "—",
    validFrom: "2026-04-01",
    validTo: "2027-03-31",
    premium: 7800,
    deduction: 650,
    documents: ["term-life-certificate.pdf"],
    remarks: "3x annual CTC cover",
    status: "Active",
  },
]);

export const addInsurance = (a) =>
  insuranceStore.set((p) => [
    {
      ...a,
      // Highest serial + 1 — a length-based counter can repeat an id once rows are removed.
      id: nextId(
        "INS",
        p.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0),
      ),
      status: "Active",
    },
    ...p,
  ]);

/**
 * Monthly insurance deduction that flows into the employee's payroll. With a pay period ("YYYY-MM") only policies
 * whose validity overlaps that month are deducted.
 */
export const insuranceDeductionFor = (rows, empId, period) =>
  rows
    .filter(
      (r) =>
        r.empId === empId &&
        r.status === "Active" &&
        (!period ||
          ((!r.validFrom || r.validFrom.slice(0, 7) <= period) &&
            (!r.validTo || r.validTo.slice(0, 7) >= period))),
    )
    .reduce((s, r) => s + (Number(r.deduction) || 0), 0);

/* ---------------- Insurance claims ---------------- */

/**
 * @typedef {Object} InsuranceClaim
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} policyNumber
 * @property {string} insurer
 * @property {string} type - Policy type (GMC, GPA …).
 * @property {string} nature - Hospitalisation / Day care / Reimbursement.
 * @property {number} claimAmount
 * @property {number} [approvedAmount]
 * @property {string} details - Hospital / diagnosis / incident summary.
 * @property {string} raisedOn
 * @property {string[]} documents
 * @property {"Pending" | "Under Review" | "Approved" | "Rejected" | "Settled"} status
 * @property {{ at: string, by: string, action: string }[]} trail
 */
export const insuranceClaimStore = createPersistentStore("seereon.insurance.claims.v1", [
  {
    id: "ICL-2026-0003",
    empId: "SRN-0008",
    employee: "Rakesh Menon",
    policyNumber: "GMC-88214-SRN",
    insurer: "Star Health Insurance",
    type: "Group Mediclaim (GMC)",
    nature: "Hospitalisation (cashless)",
    claimAmount: 184000,
    details: "AMRI Hospital, Bhubaneswar — appendectomy, 3 days admission",
    raisedOn: "2026-09-21",
    documents: ["discharge-summary.pdf", "hospital-bill.pdf"],
    status: "Pending",
    trail: [{ at: "2026-09-21", by: "Rakesh Menon", action: "Claim submitted" }],
  },
  {
    id: "ICL-2026-0002",
    empId: "SRN-0014",
    employee: "Ishita Bose",
    policyNumber: "GMC-88214-SRN",
    insurer: "Star Health Insurance",
    type: "Group Mediclaim (GMC)",
    nature: "Reimbursement",
    claimAmount: 42600,
    details: "Apollo Clinic — dengue treatment, outpatient + diagnostics",
    raisedOn: "2026-09-02",
    documents: ["bills-combined.pdf"],
    status: "Under Review",
    trail: [
      { at: "2026-09-02", by: "Ishita Bose", action: "Claim submitted" },
      { at: "2026-09-05", by: "Saras Venkatesh", action: "Taken up for review with TPA" },
    ],
  },
  {
    id: "ICL-2026-0001",
    empId: "SRN-0005",
    employee: "Subh Sahoo",
    policyNumber: "GPA-70331-SRN",
    insurer: "ICICI Lombard",
    type: "Group Personal Accident (GPA)",
    nature: "Reimbursement",
    claimAmount: 23500,
    approvedAmount: 21000,
    details: "Fracture — minor road accident during office commute",
    raisedOn: "2026-07-30",
    documents: ["xray-report.pdf", "pharmacy-bills.pdf"],
    status: "Settled",
    trail: [
      { at: "2026-07-30", by: "Subh Sahoo", action: "Claim submitted" },
      {
        at: "2026-08-04",
        by: "Saras Venkatesh",
        action: "Approved ₹21,000 (room-rent cap applied)",
      },
      { at: "2026-08-12", by: "Saras Venkatesh", action: "Settled · UTR AXIS-99281" },
    ],
  },
]);
export const useInsuranceClaims = () => insuranceClaimStore.use();

export const addInsuranceClaim = (input, by) =>
  insuranceClaimStore.set((p) => [
    {
      ...input,
      id: nextId("ICL-2026", p.length),
      status: "Pending",
      raisedOn: new Date().toISOString().slice(0, 10),
      trail: [{ at: new Date().toISOString().slice(0, 10), by, action: "Claim submitted" }],
    },
    ...p,
  ]);

/** Review → Approve (with the admissible amount) / Reject → Settle, each recorded on the trail. */
export function actInsuranceClaim(id, by, action, { amount, note, ref, byId } = {}) {
  const row = insuranceClaimStore.get().find((c) => c.id === id);
  if (!row) return { ok: false, message: "Claim not found." };
  if (byId && byId === row.empId)
    return { ok: false, message: "You cannot review, approve or settle your own insurance claim." };
  let admissible = row.claimAmount;
  if (action === "approve" && amount !== undefined && String(amount).trim() !== "") {
    admissible = Number(String(amount).replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(admissible) || admissible <= 0 || admissible > row.claimAmount)
      return {
        ok: false,
        message: `Admissible amount must be a number between ₹1 and the claimed ₹${row.claimAmount.toLocaleString("en-IN")}.`,
      };
  }
  const next = {
    review: { from: ["Pending"], to: "Under Review", log: "Taken up for review" },
    approve: {
      from: ["Pending", "Under Review"],
      to: "Approved",
      log: `Approved ${admissible < row.claimAmount ? `₹${admissible.toLocaleString("en-IN")}` : "in full"}${note ? ` — ${note}` : ""}`,
    },
    reject: { from: ["Pending", "Under Review"], to: "Rejected", log: `Rejected — ${note}` },
    settle: { from: ["Approved"], to: "Settled", log: `Settled${ref ? ` · ${ref}` : ""}` },
  }[action];
  if (!next) return { ok: false, message: "Unknown action." };
  if (!next.from.includes(row.status))
    return { ok: false, message: `A ${row.status.toLowerCase()} claim cannot be ${action}ed.` };
  if (action === "reject" && !String(note ?? "").trim())
    return { ok: false, message: "A rejection needs a reason." };
  if (action === "settle" && !String(ref ?? "").trim())
    return { ok: false, message: "Enter the payment reference (UTR) to settle the claim." };
  insuranceClaimStore.set((p) =>
    p.map((c) =>
      c.id === id
        ? {
            ...c,
            status: next.to,
            approvedAmount: action === "approve" ? admissible : c.approvedAmount,
            trail: [
              ...c.trail,
              { at: new Date().toISOString().slice(0, 10), by, action: next.log },
            ],
          }
        : c,
    ),
  );
  pushAlert({
    empId: row.empId,
    kind: "finance",
    title: `Insurance claim ${row.id} ${next.to.toLowerCase()}`,
    body: next.log,
    link: "/emp/reimbursements",
  });
  return { ok: true, message: `Claim ${next.to.toLowerCase()}.` };
}

/* ---------------- Reimbursements ---------------- */

export const CLAIM_STATUSES = ["Submitted", "Approved", "Rejected", "Paid"];
/**
 * @typedef {(typeof CLAIM_STATUSES)[number]} ClaimStatus
 */

/** Multi-stage approval pipeline every reimbursement moves through. */
export const REIMBURSEMENT_STAGES = ["Manager", "HR", "CHRO", "CEO", "CFO", "Accounts"];
/**
 * @typedef {(typeof REIMBURSEMENT_STAGES)[number]} ReimbursementStage
 */

/**
 * @typedef {ReimbursementStage | "Settled"} ClaimStage
 */

/**
 * @typedef {"Submitted" | "Approved" | "Rejected" | "Processed"} TrailAction
 */

/**
 * @typedef {Object} ClaimTrailEntry
 * @property {ClaimStage} stage
 * @property {string} actor
 * @property {TrailAction} action
 * @property {string} at
 * @property {string} remarks
 */

/**
 * One bill inside a claim — what the employee actually attaches.
 * @typedef {Object} ClaimLineItem
 * @property {string} date
 * @property {string} vendor
 * @property {string} billNo
 * @property {string} description
 * @property {number} amount
 * @property {string} attachment
 * @property {string} paidVia
 */

export const CLAIM_PAYMENT_MODES = ["With salary (payroll)", "Bank transfer", "Petty cash"];
export const CLAIM_PAID_VIA = ["Own card / UPI", "Cash", "Corporate card", "Company advance"];

/**
 * @typedef {Object} Reimbursement
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} name
 * @property {string} type
 * @property {string} category
 * @property {number} amount
 * @property {string} date
 * @property {string} document
 * @property {string} description
 * @property {ClaimStatus} status
 * @property {string} remarks
 * @property {ClaimStage} currentStage - Stage the claim is currently awaiting action at, or "Settled" once fully processed.
 * @property {"Pending" | "Approved" | "Rejected" | "Processed"} stageStatus - Human-readable status of the current stage.
 * @property {ClaimTrailEntry[]} trail
 * @property {string} [purpose] - Detailed submission (v4) — everything the approver sees in the claim popup.
 * @property {string} [project]
 * @property {string} [client]
 * @property {string} [costCentre]
 * @property {string} [periodFrom]
 * @property {string} [periodTo]
 * @property {(typeof CLAIM_PAYMENT_MODES)[number]} [paymentMode]
 * @property {number} [advanceAdjusted]
 * @property {string} [advanceRef]
 * @property {ClaimLineItem[]} [items]
 * @property {string[]} [attachments]
 * @property {number} [policyLimit]
 * @property {string} [submittedOn]
 * @property {string} [department]
 * @property {string} [designation]
 * @property {string} [branch]
 * @property {string} [bankAccount]
 * @property {boolean} [declaration]
 */

/** Amount actually payable after any advance adjustment. */
export const claimPayable = (r) => Math.max(0, r.amount - (r.advanceAdjusted ?? 0));

export const reimbursementStore = createPersistentStore("seereon.claims.reimbursements.v1", [
  {
    id: "RMB-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    name: "Client visit — Chennai",
    type: "Expense Claim",
    category: "Travel",
    amount: 8450,
    date: "2026-07-18",
    document: "chennai-cabs.pdf",
    description: "Cab and airport transfers for the Zensar visit",
    status: "Submitted",
    remarks: "",
    currentStage: "CFO",
    stageStatus: "Pending",
    purpose: "Client visit — Zensar Chennai delivery review (16–17 Jul)",
    project: "Zensar — Managed QA",
    client: "Zensar Technologies",
    costCentre: "CC-ENG-02",
    periodFrom: "2026-07-16",
    periodTo: "2026-07-17",
    paymentMode: "With salary (payroll)",
    advanceAdjusted: 0,
    department: "Engineering",
    designation: "Senior Engineer",
    branch: "Bhubaneswar HQ",
    bankAccount: "HDFC Bank ••4142",
    submittedOn: "2026-07-18 09:40",
    declaration: true,
    policyLimit: 15000,
    items: [
      {
        date: "2026-07-16",
        vendor: "Uber",
        billNo: "UBR-88213",
        description: "Airport → client office",
        amount: 1250,
        attachment: "uber-88213.pdf",
        paidVia: "Own card / UPI",
      },
      {
        date: "2026-07-16",
        vendor: "IndiGo",
        billNo: "6E-QW3P2L",
        description: "BLR → MAA (economy)",
        amount: 3100,
        attachment: "indigo-6EQW3P2L.pdf",
        paidVia: "Own card / UPI",
      },
      {
        date: "2026-07-17",
        vendor: "IndiGo",
        billNo: "6E-QW3P2M",
        description: "MAA → BLR (economy)",
        amount: 3300,
        attachment: "indigo-6EQW3P2M.pdf",
        paidVia: "Own card / UPI",
      },
      {
        date: "2026-07-17",
        vendor: "Ola",
        billNo: "OLA-55129",
        description: "Client office → airport",
        amount: 800,
        attachment: "ola-55129.pdf",
        paidVia: "Cash",
      },
    ],
    attachments: [
      "chennai-cabs.pdf",
      "indigo-6EQW3P2L.pdf",
      "indigo-6EQW3P2M.pdf",
      "visit-approval-email.pdf",
    ],
    trail: [
      {
        stage: "Manager",
        actor: "Ananya Sharma",
        action: "Submitted",
        at: "2026-07-18",
        remarks: "",
      },
      {
        stage: "Manager",
        actor: "Subh Sahoo",
        action: "Approved",
        at: "2026-07-19",
        remarks: "Verified against travel bills",
      },
      {
        stage: "HR",
        actor: "Varen Mishra",
        action: "Approved",
        at: "2026-07-20",
        remarks: "Within travel policy limits",
      },
      {
        stage: "CHRO",
        actor: "Ashish Nayak",
        action: "Approved",
        at: "2026-07-21",
        remarks: "Approved",
      },
      {
        stage: "CEO",
        actor: "Santosh Nayak",
        action: "Approved",
        at: "2026-07-22",
        remarks: "Approved",
      },
    ],
  },
  {
    id: "RMB-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    name: "Broadband — July",
    type: "Expense Claim",
    category: "Internet & Telecom",
    amount: 1899,
    date: "2026-07-05",
    document: "act-july.pdf",
    description: "Monthly home broadband bill",
    status: "Submitted",
    remarks: "",
    currentStage: "Manager",
    stageStatus: "Pending",
    purpose: "Work-from-home connectivity (hybrid policy — 3 days remote)",
    costCentre: "CC-SALES-01",
    periodFrom: "2026-07-01",
    periodTo: "2026-07-31",
    paymentMode: "With salary (payroll)",
    department: "Sales",
    designation: "Account Executive",
    branch: "Mumbai",
    bankAccount: "ICICI Bank ••2210",
    submittedOn: "2026-07-05 18:22",
    declaration: true,
    policyLimit: 2000,
    items: [
      {
        date: "2026-07-01",
        vendor: "ACT Fibernet",
        billNo: "ACT/MUM/1123491",
        description: "1 Gbps plan — July",
        amount: 1899,
        attachment: "act-july.pdf",
        paidVia: "Own card / UPI",
      },
    ],
    attachments: ["act-july.pdf"],
    trail: [
      {
        stage: "Manager",
        actor: "Vikram Iyer",
        action: "Submitted",
        at: "2026-07-05",
        remarks: "",
      },
    ],
  },
  {
    id: "RMB-003",
    empId: "SRN-0146",
    employee: "Kavya Menon",
    name: "Diagnostics reimbursement",
    type: "Insurance Claim",
    category: "Medical",
    amount: 4200,
    date: "2026-06-28",
    document: "apollo-bill.pdf",
    description: "Annual health check not covered under the policy",
    status: "Paid",
    remarks: "Settled with July payroll",
    currentStage: "Settled",
    stageStatus: "Processed",
    purpose: "Annual preventive health check (policy benefit)",
    costCentre: "CC-ENG-02",
    periodFrom: "2026-06-26",
    periodTo: "2026-06-26",
    paymentMode: "With salary (payroll)",
    department: "Operations",
    designation: "Ops Manager",
    branch: "Chennai",
    bankAccount: "HDFC Bank ••4146",
    submittedOn: "2026-06-28 11:05",
    declaration: true,
    policyLimit: 5000,
    items: [
      {
        date: "2026-06-26",
        vendor: "Apollo Diagnostics",
        billNo: "APD/BBS/77120",
        description: "Full body check-up package",
        amount: 3500,
        attachment: "apollo-bill.pdf",
        paidVia: "Own card / UPI",
      },
      {
        date: "2026-06-26",
        vendor: "Apollo Diagnostics",
        billNo: "APD/BBS/77121",
        description: "Vitamin D & B12 add-on",
        amount: 700,
        attachment: "apollo-bill-2.pdf",
        paidVia: "Own card / UPI",
      },
    ],
    attachments: ["apollo-bill.pdf", "apollo-bill-2.pdf", "lab-report.pdf"],
    trail: [
      {
        stage: "Manager",
        actor: "Kavya Menon",
        action: "Submitted",
        at: "2026-06-28",
        remarks: "",
      },
      {
        stage: "Manager",
        actor: "Subh Sahoo",
        action: "Approved",
        at: "2026-06-29",
        remarks: "Approved",
      },
      {
        stage: "HR",
        actor: "Varen Mishra",
        action: "Approved",
        at: "2026-06-30",
        remarks: "Approved",
      },
      {
        stage: "CHRO",
        actor: "Ashish Nayak",
        action: "Approved",
        at: "2026-07-01",
        remarks: "Approved",
      },
      {
        stage: "CEO",
        actor: "Santosh Nayak",
        action: "Approved",
        at: "2026-07-02",
        remarks: "Approved",
      },
      {
        stage: "CFO",
        actor: "Saras Venkatesh",
        action: "Approved",
        at: "2026-07-03",
        remarks: "Cleared for payment",
      },
      {
        stage: "Accounts",
        actor: "Saras Venkatesh",
        action: "Processed",
        at: "2026-07-05",
        remarks: "Settled with July payroll",
      },
    ],
  },
  {
    id: "RMB-004",
    empId: "SRN-0006",
    employee: "Subham Das",
    name: "Client dinner — Bhubaneswar",
    type: "Expense Claim",
    category: "Client Entertainment",
    amount: 6200,
    date: "2026-06-14",
    document: "dinner-bill.pdf",
    description: "Dinner with prospective client team",
    status: "Rejected",
    remarks: "Missing itemised bill",
    currentStage: "Manager",
    stageStatus: "Rejected",
    purpose: "Relationship dinner with RCU evaluation team (4 guests + 2 Seereon)",
    client: "RCU",
    costCentre: "CC-ENG-02",
    periodFrom: "2026-06-13",
    periodTo: "2026-06-13",
    paymentMode: "Bank transfer",
    department: "Engineering",
    designation: "Senior Software Engineer",
    branch: "Bhubaneswar HQ",
    bankAccount: "HDFC Bank ••4006",
    submittedOn: "2026-06-14 10:15",
    declaration: true,
    policyLimit: 5000,
    items: [
      {
        date: "2026-06-13",
        vendor: "Mayfair Lagoon — Kitchen",
        billNo: "MFL/0613/221",
        description: "Dinner for 6 (summary bill only)",
        amount: 6200,
        attachment: "dinner-bill.pdf",
        paidVia: "Own card / UPI",
      },
    ],
    attachments: ["dinner-bill.pdf"],
    trail: [
      { stage: "Manager", actor: "Subham Das", action: "Submitted", at: "2026-06-14", remarks: "" },
      {
        stage: "Manager",
        actor: "Subh Sahoo",
        action: "Rejected",
        at: "2026-06-15",
        remarks: "Missing itemised bill",
      },
    ],
  },
]);

const nextStage = (stage) => {
  const idx = REIMBURSEMENT_STAGES.indexOf(stage);
  return idx === REIMBURSEMENT_STAGES.length - 1 ? "Settled" : REIMBURSEMENT_STAGES[idx + 1];
};

export const addReimbursement = (r) =>
  reimbursementStore.set((p) => [
    {
      ...r,
      // Highest serial + 1 (claims are shared across entities, a length-based counter can repeat an id).
      id: nextId(
        "RMB",
        p.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0),
      ),
      status: "Submitted",
      remarks: "",
      currentStage: "Manager",
      stageStatus: "Pending",
      trail: [
        {
          stage: "Manager",
          actor: r.employee,
          action: "Submitted",
          // Submission date (the expense date lives in `date` / periodFrom).
          at: (r.submittedOn ?? new Date().toISOString()).slice(0, 10),
          remarks: "",
        },
      ],
    },
    ...p,
  ]);

/** @deprecated retained for compatibility — prefer approveClaimStage/rejectClaimStage. */
export const setClaimStatus = (id, status, remarks = "") =>
  reimbursementStore.set((p) => p.map((r) => (r.id === id ? { ...r, status, remarks } : r)));

/** Approve the claim's current stage and advance it to the next stage in the pipeline. */
export const approveClaimStage = (id, actor, remarks = "", actorId) =>
  reimbursementStore.set((p) =>
    p.map((r) => {
      if (r.id !== id || r.currentStage === "Settled" || r.status === "Rejected") return r;
      const stage = r.currentStage;
      const isAccounts = stage === "Accounts";
      const action = isAccounts ? "Processed" : "Approved";
      const upcoming = nextStage(stage);
      const trail = [
        ...r.trail,
        { stage, actor, actorId, action, at: new Date().toISOString().slice(0, 10), remarks },
      ];
      return {
        ...r,
        currentStage: upcoming,
        stageStatus: isAccounts ? "Processed" : "Pending",
        status: isAccounts ? "Paid" : stage === "CFO" ? "Approved" : r.status,
        remarks: remarks || r.remarks,
        trail,
      };
    }),
  );

/** Approve / process the current stage and tell the claimant where the claim went next. */
export function approveClaim(id, actor, remarks = "", actorId) {
  const before = reimbursementStore.get().find((r) => r.id === id);
  if (!before || before.currentStage === "Settled" || before.status === "Rejected") return false;
  if (actorId && hasActedOn(before, { id: actorId, name: actor })) return false;
  approveClaimStage(id, actor, remarks, actorId);
  const after = reimbursementStore.get().find((r) => r.id === id);
  pushAlert({
    empId: after.empId,
    kind: "general",
    to: "/emp/reimbursements",
    title:
      after.currentStage === "Settled"
        ? `Claim ${after.id} paid`
        : `Claim ${after.id} approved at ${before.currentStage}`,
    body:
      after.currentStage === "Settled"
        ? `${after.name}: ₹${claimPayable(after).toLocaleString("en-IN")} processed by ${actor}.`
        : `${after.name} moved to the ${after.currentStage} stage.${remarks ? ` Note: ${remarks}` : ""}`,
  });
  return true;
}

/** Reject at the current stage and notify the claimant with the reason. */
export function rejectClaim(id, actor, reason, actorId) {
  const before = reimbursementStore.get().find((r) => r.id === id);
  if (
    !before ||
    before.currentStage === "Settled" ||
    before.status === "Rejected" ||
    !reason.trim()
  )
    return false;
  rejectClaimStage(id, actor, reason.trim(), actorId);
  pushAlert({
    empId: before.empId,
    kind: "general",
    to: "/emp/reimbursements",
    title: `Claim ${before.id} rejected at ${before.currentStage}`,
    body: `${before.name}: ${reason.trim()} — ${actor}`,
  });
  return true;
}

/** Reject the claim at its current stage, halting the flow. */
export const rejectClaimStage = (id, actor, reason, actorId) =>
  reimbursementStore.set((p) =>
    p.map((r) => {
      if (r.id !== id || r.currentStage === "Settled" || r.status === "Rejected") return r;
      const stage = r.currentStage;
      const trail = [
        ...r.trail,
        {
          stage,
          actor,
          actorId,
          action: "Rejected",
          at: new Date().toISOString().slice(0, 10),
          remarks: reason,
        },
      ];
      return {
        ...r,
        status: "Rejected",
        stageStatus: "Rejected",
        remarks: reason,
        trail,
      };
    }),
  );

/** Maps a role to the stage it is responsible for actioning. The COO also stands in for the CHRO stage. */
export function stageForRole(role) {
  switch (role) {
    case "Manager":
      return "Manager";
    case "HR":
      return "HR";
    case "CHRO":
    case "COO":
      return "CHRO";
    case "CEO":
      return "CEO";
    case "CFO":
      return "CFO";
    default:
      return null;
  }
}

/** Whether the given role can approve/reject the claim's current stage. */
export function canActionStage(role, stage) {
  if (stage === "Settled") return false;
  // Admin / Super Admin may stand in at any stage — but canActionClaim still limits them to one stage per claim.
  if (role === "Admin" || role === "SuperAdmin") return true;
  if (stage === "Accounts") return role === "CFO";
  return stageForRole(role) === stage;
}

/** Reporting manager of a claimant: the user's managerId, else the HR profile's reporting-manager name. */
export function isReportingManagerOf(user, empId) {
  const u = userById(empId);
  if (u) return u.managerId === user.id;
  return findEmployee(empId) ? getEmployeeProfile(empId).job.reportingManager === user.name : false;
}

/**
 * Can this user act on the claim now? Nobody approves their own claim; the Manager stage belongs to the claimant's
 * reporting manager (any role) or an Admin; the later stages follow the stage ↔ role mapping.
 */
/**
 * Has this user already approved / processed an earlier stage of the claim? Older trail entries carry only the
 * actor's name, so they are matched by name when no actorId was recorded.
 */
export function hasActedOn(claim, user) {
  return claim.trail.some(
    (t) =>
      (t.action === "Approved" || t.action === "Processed") &&
      (t.actorId ? t.actorId === user.id : t.actor === user.name),
  );
}

export function canActionClaim(user, claim) {
  if (claim.currentStage === "Settled" || claim.status === "Rejected") return false;
  if (claim.empId === user.id) return false;
  // One person signs at most one stage — an Admin or the CFO cannot walk a claim through several stages alone.
  if (hasActedOn(claim, user)) return false;
  if (claim.currentStage === "Manager")
    return user.role === "Admin" || isReportingManagerOf(user, claim.empId);
  return canActionStage(user.role, claim.currentStage);
}
