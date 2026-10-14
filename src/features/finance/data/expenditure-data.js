// ---------------------------------------------------------------------------
// Expenditure Booking — a general-purpose "what was spent, why, for whom and
// what did it achieve" record, distinct from Claims (an employee reimbursement
// request). Any role with expenditure-booking permission books spend for their
// organisation. Each record carries the full audit picture: purpose and reason,
// who asked for it, who it concerns, who approved it, department / cost centre,
// date & time, vendor, GST, bills with attachments, category-specific detail
// (asset purchases capitalise into the asset register; festival spend records
// beneficiaries and per-head cost) and, later, the outcome.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { userById } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";

export const EXPENDITURE_CATEGORIES = [
  "Asset Purchase",
  "Festival & Celebrations",
  "Employee Welfare",
  "Office Supplies & Consumables",
  "Site Equipment",
  "Software & Licenses",
  "Professional Services",
  "Marketing & Events",
  "Travel & Logistics",
  "Training & Certification",
  "Facilities & Utilities",
  "Rent & Lease",
  "Repairs & Maintenance",
  "Recruitment",
  "Statutory & Compliance Fees",
  "CSR & Donations",
  "Other",
];
/**
 * @typedef {(typeof EXPENDITURE_CATEGORIES)[number]} ExpenditureCategory
 */

export const CATEGORY_META = {
  "Asset Purchase": {
    capex: true,
    sub: [
      "Laptops & desktops",
      "Mobile devices",
      "Servers & networking",
      "Furniture & fixtures",
      "Vehicles",
      "Plant & machinery",
      "Office equipment",
    ],
    hint: "Capitalised — creates an entry in the asset register with tag, custodian and useful life.",
  },
  "Festival & Celebrations": {
    capex: false,
    sub: [
      "Diwali",
      "Holi",
      "Raja Parba",
      "Durga Puja",
      "Christmas / New Year",
      "Foundation Day",
      "Team outing",
      "Other occasion",
    ],
    hint: "Record the occasion, beneficiaries and per-head cost — reported under employee welfare.",
  },
  "Employee Welfare": {
    capex: false,
    sub: [
      "Health camp",
      "Wellness programme",
      "Cafeteria subsidy",
      "Gifts & awards",
      "Insurance top-up",
      "Sports & clubs",
    ],
    hint: "",
  },
  "Office Supplies & Consumables": {
    capex: false,
    sub: ["Stationery", "Pantry", "Housekeeping", "Printing", "Packaging"],
    hint: "",
  },
  "Site Equipment": {
    capex: true,
    sub: ["Tools", "Safety gear (PPE)", "Instruments", "Consumables", "Hire charges"],
    hint: "",
  },
  "Software & Licenses": {
    capex: false,
    sub: [
      "Cloud infrastructure",
      "SaaS subscription",
      "Perpetual licence",
      "Developer tools",
      "Security",
    ],
    hint: "",
  },
  "Professional Services": {
    capex: false,
    sub: ["Legal", "Audit & accounting", "Consulting", "Contract staffing", "Design agency"],
    hint: "",
  },
  "Marketing & Events": {
    capex: false,
    sub: [
      "Digital campaigns",
      "Conference / expo",
      "Collateral & branding",
      "Sponsorship",
      "Client event",
    ],
    hint: "",
  },
  "Travel & Logistics": {
    capex: false,
    sub: ["Air", "Rail / road", "Hotel", "Courier & freight", "Visa & permits"],
    hint: "Individual employee travel is claimed via Tours or Reimbursements — use this for bulk / company-paid travel.",
  },
  "Training & Certification": {
    capex: false,
    sub: ["External training", "Certification fees", "E-learning subscription", "Conference pass"],
    hint: "",
  },
  "Facilities & Utilities": {
    capex: false,
    sub: [
      "Electricity",
      "Water",
      "Internet & telecom",
      "Security services",
      "Housekeeping contract",
    ],
    hint: "",
  },
  "Rent & Lease": {
    capex: false,
    sub: ["Office rent", "Guest house", "Equipment lease", "Parking"],
    hint: "",
  },
  "Repairs & Maintenance": {
    capex: false,
    sub: ["AMC", "Breakdown repair", "Civil work", "Electrical", "IT hardware"],
    hint: "",
  },
  Recruitment: {
    capex: false,
    sub: ["Job portal", "Agency fee", "Background verification", "Campus drive", "Referral bonus"],
    hint: "",
  },
  "Statutory & Compliance Fees": {
    capex: false,
    sub: [
      "Registration / renewal",
      "Filing fees",
      "Penalty / late fee",
      "Professional tax enrolment",
      "Labour licence",
    ],
    hint: "",
  },
  "CSR & Donations": {
    capex: false,
    sub: ["CSR project", "Donation", "Scholarship", "Community event"],
    hint: "",
  },
  Other: { capex: false, sub: ["Miscellaneous"], hint: "" },
};

export const EXPENDITURE_PAYMENT_MODES = [
  "Bank transfer (NEFT/RTGS)",
  "UPI",
  "Corporate card",
  "Cheque",
  "Cash",
  "Petty cash",
  "Credit (payable)",
];
export const EXPENDITURE_PRIORITIES = ["Routine", "Planned (budgeted)", "Urgent", "Emergency"];
export const EXPENDITURE_STATUSES = ["Booked", "Approved", "Paid", "Rejected"];
/**
 * @typedef {(typeof EXPENDITURE_STATUSES)[number]} ExpenditureStatus
 */

/**
 * @typedef {Object} ExpenditureBill
 * @property {string} date
 * @property {string} vendor
 * @property {string} billNo
 * @property {string} description
 * @property {number} amount
 * @property {string} attachment
 */
/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {string} [role]
 */

/**
 * @typedef {Object} ExpenditureRecord
 * @property {string} id
 * @property {string} orgId
 * @property {string} title
 * @property {ExpenditureCategory} category
 * @property {string} subcategory
 * @property {string} purpose
 * @property {string} reason
 * @property {string} department - People
 * @property {string} branch
 * @property {Person} requestedBy
 * @property {Person} concernedPerson
 * @property {Person} [approvedBy]
 * @property {string} [preApprovalRef] - Booker's reference to an off-system pre-approval (never an approval itself).
 * @property {string} bookedBy
 * @property {string} bookedByName
 * @property {string} spendDate - When / where
 * @property {string} spendTime
 * @property {string} [project]
 * @property {string} [client]
 * @property {string} costCentre
 * @property {string} [budgetLine]
 * @property {(typeof EXPENDITURE_PRIORITIES)[number]} priority
 * @property {boolean} recurring
 * @property {string} vendor - Vendor & money
 * @property {string} [vendorGstin]
 * @property {string} [invoiceNo]
 * @property {(typeof EXPENDITURE_PAYMENT_MODES)[number]} paymentMode
 * @property {string} [paymentRef]
 * @property {number} amount
 * @property {number} gstPct
 * @property {number} gstAmount
 * @property {number} total
 * @property {ExpenditureBill[]} bills
 * @property {string[]} attachments
 * @property {{ assetName: string, quantity: number, unitCost: number, assetTag?: string, capitalise: boolean, usefulLifeYears: number, location: string, custodian: string }} [asset] - Category specifics
 * @property {{ occasion: string, beneficiaries: string, headcount: number, perHeadCost: number, giftType: string }} [festival]
 * @property {ExpenditureStatus} status - Lifecycle
 * @property {string} description
 * @property {string} [outcome]
 * @property {{ name: string, url: string }[]} [outcomeDocuments]
 * @property {string} [outcomeSubmittedOn]
 * @property {{ at: string, by: string, action: string }[]} history
 * @property {string} createdOn
 */

/** Next id from the highest existing serial — records can be removed, so a length-based counter would repeat an id. */
const nextId = (rows) =>
  `EXP-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;
const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const stamp = () => {
  const d = new Date();
  return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const personOf = (id) => {
  const u = userById(id);
  const e = findEmployee(id);
  return { id, name: u?.name ?? e?.name ?? id, role: e?.role ?? u?.role };
};

export const EXPENDITURES_SEED = [
  {
    id: "EXP-0001",
    orgId: "ORG-SEEREON",
    title: "AWS production capacity — Q3 rollout",
    category: "Software & Licenses",
    subcategory: "Cloud infrastructure",
    purpose: "Additional production compute for the Semtech Q3 client rollout.",
    reason:
      "Load test showed 60 % headroom shortfall at projected go-live traffic; approved in the Q3 infra plan.",
    department: "Engineering",
    branch: "Bhubaneswar HQ",
    requestedBy: { id: "SRN-0009", name: "Vivek Raman", role: "CTO" },
    concernedPerson: { id: "SRN-0015", name: "Aravind Krishnan", role: "DevOps Engineer" },
    approvedBy: { id: "SRN-0002", name: "Saras Venkatesh", role: "CFO" },
    bookedBy: "SRN-0006",
    bookedByName: "Subham Das",
    spendDate: "2026-07-05",
    spendTime: "11:20",
    project: "Semtech — Platform",
    client: "Semtech",
    costCentre: "CC-1005",
    budgetLine: "FY27 Infra — Cloud",
    priority: "Planned (budgeted)",
    recurring: true,
    vendor: "Amazon Web Services India",
    vendorGstin: "29AAACA1234F1Z5",
    invoiceNo: "AWSIN-2026-07-118820",
    paymentMode: "Corporate card",
    paymentRef: "CC-****4821",
    amount: 71186,
    gstPct: 18,
    gstAmount: 12814,
    total: 84000,
    bills: [
      {
        date: "2026-07-05",
        vendor: "Amazon Web Services India",
        billNo: "AWSIN-2026-07-118820",
        description: "EC2 reserved capacity + EBS — July",
        amount: 84000,
        attachment: "aws-jul-invoice.pdf",
      },
    ],
    attachments: ["aws-jul-invoice.pdf", "q3-infra-plan-approval.pdf"],
    status: "Paid",
    description: "Reserved instances for 3 months; reviewed monthly.",
    outcome:
      "Rollout completed on schedule with zero downtime; retained the added capacity for the next release cycle.",
    outcomeSubmittedOn: "2026-07-28",
    history: [
      { at: "2026-07-05 11:25", by: "Subham Das", action: "Booked" },
      {
        at: "2026-07-06 09:10",
        by: "Saras Venkatesh",
        action: "Approved — within Q3 infra budget",
      },
      { at: "2026-07-06 15:40", by: "Saras Venkatesh", action: "Marked paid · CC-****4821" },
      { at: "2026-07-28 10:00", by: "Subham Das", action: "Outcome recorded" },
    ],
    createdOn: "2026-07-05",
  },
  {
    id: "EXP-0002",
    orgId: "ORG-SEEREON",
    title: "Raja Parba celebration — Bhubaneswar HQ",
    category: "Festival & Celebrations",
    subcategory: "Raja Parba",
    purpose: "Office celebration of Raja Parba for all HQ staff and contract workers.",
    reason: "Annual cultural calendar item approved by CHRO; boosts engagement across HQ teams.",
    department: "Human Resources",
    branch: "Bhubaneswar HQ",
    requestedBy: { id: "SRN-0010", name: "Farah Khan", role: "CHRO" },
    concernedPerson: { id: "SRN-0004", name: "Varen Mishra", role: "HR Head" },
    approvedBy: { id: "SRN-0003", name: "Ashish Nayak", role: "COO" },
    bookedBy: "SRN-0004",
    bookedByName: "Varen Mishra",
    spendDate: "2026-06-14",
    spendTime: "16:00",
    costCentre: "CC-HR-01",
    budgetLine: "FY27 Engagement — Festivals",
    priority: "Planned (budgeted)",
    recurring: true,
    vendor: "Multiple (see bills)",
    paymentMode: "Petty cash",
    amount: 46200,
    gstPct: 0,
    gstAmount: 0,
    total: 46200,
    bills: [
      {
        date: "2026-06-13",
        vendor: "Dalma Caterers",
        billNo: "DC/0613/44",
        description: "Poda pitha & lunch for 140",
        amount: 32000,
        attachment: "dalma-0613.pdf",
      },
      {
        date: "2026-06-13",
        vendor: "Utkal Handicrafts",
        billNo: "UH-2231",
        description: "Traditional gift hampers × 140",
        amount: 11200,
        attachment: "utkal-2231.pdf",
      },
      {
        date: "2026-06-14",
        vendor: "Sound & Stage BBSR",
        billNo: "SS-118",
        description: "Music system & decor hire",
        amount: 3000,
        attachment: "",
      },
    ],
    attachments: ["dalma-0613.pdf", "utkal-2231.pdf", "raja-parba-approval.pdf"],
    festival: {
      occasion: "Raja Parba",
      beneficiaries: "All HQ employees + 12 contract staff",
      headcount: 140,
      perHeadCost: 330,
      giftType: "Handicraft hamper",
    },
    status: "Paid",
    description: "",
    outcome: "138 of 140 attended; feedback score 4.6/5 in the pulse survey.",
    outcomeSubmittedOn: "2026-06-20",
    history: [
      { at: "2026-06-14 18:30", by: "Varen Mishra", action: "Booked" },
      { at: "2026-06-15 10:00", by: "Ashish Nayak", action: "Approved" },
      {
        at: "2026-06-15 10:05",
        by: "Varen Mishra",
        action: "Marked paid · petty cash voucher PC-0612",
      },
    ],
    createdOn: "2026-06-14",
  },
  {
    id: "EXP-0003",
    orgId: "ORG-SEEREON",
    title: 'MacBook Pro 14" × 4 — new joiners (Engineering)',
    category: "Asset Purchase",
    subcategory: "Laptops & desktops",
    purpose: "Laptops for four engineers joining the Spotlight project in August.",
    reason: "Approved headcount for Spotlight; existing loaner pool exhausted.",
    department: "Engineering",
    branch: "Bhubaneswar HQ",
    requestedBy: { id: "SRN-0005", name: "Subh Sahoo", role: "Engineering Manager" },
    concernedPerson: { id: "SRN-0015", name: "Aravind Krishnan", role: "DevOps Engineer" },
    approvedBy: { id: "SRN-0002", name: "Saras Venkatesh", role: "CFO" },
    bookedBy: "SRN-0004",
    bookedByName: "Varen Mishra",
    spendDate: "2026-08-02",
    spendTime: "10:45",
    project: "Spotlight — Build",
    client: "Spotlight",
    costCentre: "CC-ENG-02",
    budgetLine: "FY27 Capex — IT hardware",
    priority: "Planned (budgeted)",
    recurring: false,
    vendor: "Ingram Micro India",
    vendorGstin: "27AAACI1234B1Z2",
    invoiceNo: "IMI/MUM/2026/55012",
    paymentMode: "Bank transfer (NEFT/RTGS)",
    paymentRef: "NEFT-H26080244120",
    amount: 677966,
    gstPct: 18,
    gstAmount: 122034,
    total: 800000,
    bills: [
      {
        date: "2026-08-02",
        vendor: "Ingram Micro India",
        billNo: "IMI/MUM/2026/55012",
        description: 'MacBook Pro 14" M4 16/512 × 4',
        amount: 800000,
        attachment: "ingram-55012.pdf",
      },
    ],
    attachments: ["ingram-55012.pdf", "capex-approval-aug.pdf"],
    asset: {
      assetName: 'MacBook Pro 14" M4',
      quantity: 4,
      unitCost: 200000,
      assetTag: "SRN-LAP-0141…0144",
      capitalise: true,
      usefulLifeYears: 3,
      location: "Bhubaneswar HQ · 3F",
      custodian: "Aravind Krishnan",
    },
    status: "Approved",
    description: "Assets to be tagged and issued on DOJ.",
    history: [
      { at: "2026-08-02 10:50", by: "Varen Mishra", action: "Booked" },
      { at: "2026-08-03 09:00", by: "Saras Venkatesh", action: "Approved — capex plan line 7" },
    ],
    createdOn: "2026-08-02",
  },
  {
    id: "EXP-0004",
    orgId: "ORG-SEEREON",
    title: "POSH awareness workshop — external trainer",
    category: "Training & Certification",
    subcategory: "External training",
    purpose:
      "Mandatory annual POSH awareness session for all employees (Section 19, POSH Act 2013).",
    reason: "Statutory annual requirement; last session was Aug 2025.",
    department: "Human Resources",
    branch: "Bhubaneswar HQ",
    requestedBy: { id: "SRN-0004", name: "Varen Mishra", role: "HR Head" },
    concernedPerson: { id: "SRN-0013", name: "Aditya Verma", role: "HR Business Partner" },
    bookedBy: "SRN-0013",
    bookedByName: "Aditya Verma",
    spendDate: "2026-08-21",
    spendTime: "09:30",
    costCentre: "CC-HR-01",
    budgetLine: "FY27 L&D",
    priority: "Planned (budgeted)",
    recurring: true,
    vendor: "Rainmaker Training LLP",
    vendorGstin: "21AAKFR2345C1ZQ",
    invoiceNo: "RM/2026/0812",
    paymentMode: "Credit (payable)",
    amount: 38000,
    gstPct: 18,
    gstAmount: 6840,
    total: 44840,
    bills: [
      {
        date: "2026-08-21",
        vendor: "Rainmaker Training LLP",
        billNo: "RM/2026/0812",
        description: "Full-day workshop, 2 batches",
        amount: 44840,
        attachment: "rainmaker-0812.pdf",
      },
    ],
    attachments: ["rainmaker-0812.pdf"],
    status: "Booked",
    description: "Payable in 30 days.",
    history: [{ at: "2026-08-21 12:00", by: "Aditya Verma", action: "Booked" }],
    createdOn: "2026-08-21",
  },
  {
    id: "EXP-0005",
    orgId: "ORG-1042",
    title: "Replacement drill bits & PPE — Jaipur site",
    category: "Site Equipment",
    subcategory: "Consumables",
    purpose: "Replacement drill bits and safety gear for the Jaipur site crew.",
    reason: "Bit wear beyond tolerance after 400 hrs; PPE audit flagged 18 expired helmets.",
    department: "SAP Delivery",
    branch: "Hyderabad Office",
    requestedBy: { id: "SRN-2001", name: personOf("SRN-2001").name },
    concernedPerson: { id: "SRN-2001", name: personOf("SRN-2001").name },
    bookedBy: "SRN-2001",
    bookedByName: personOf("SRN-2001").name,
    spendDate: "2026-08-01",
    spendTime: "14:10",
    costCentre: "CC-2001",
    priority: "Urgent",
    recurring: false,
    vendor: "Rajasthan Drilling Supplies Co.",
    invoiceNo: "RDS/1042/88",
    paymentMode: "Bank transfer (NEFT/RTGS)",
    amount: 224576,
    gstPct: 18,
    gstAmount: 40424,
    total: 265000,
    bills: [
      {
        date: "2026-08-01",
        vendor: "Rajasthan Drilling Supplies Co.",
        billNo: "RDS/1042/88",
        description: "Drill bits × 24, helmets × 20, harness × 10",
        amount: 265000,
        attachment: "rds-88.pdf",
      },
    ],
    attachments: ["rds-88.pdf", "ppe-audit-jul.pdf"],
    status: "Booked",
    description: "",
    history: [{ at: "2026-08-01 14:15", by: personOf("SRN-2001").name, action: "Booked" }],
    createdOn: "2026-08-01",
  },
];

export const expenditureStore = createPersistentStore("seereon.expenditure.v2", EXPENDITURES_SEED);
export const useExpenditures = () => expenditureStore.use();
export function useOrgExpenditures(orgId) {
  const all = useExpenditures();
  return all.filter((e) => e.orgId === orgId);
}

/**
 * @typedef {Omit<ExpenditureRecord, "id" | "bookedByName" | "status" | "history" | "createdOn" | "gstAmount" | "total"> & { bookedByName?: string }} BookExpenditureInput
 */

export function bookExpenditure(input) {
  const user = userById(input.bookedBy);
  const gstAmount = Math.round((input.amount * input.gstPct) / 100);
  // Approval is only ever recorded by approveExpenditure — a booker cannot pre-fill an approver.
  const clean = { ...input };
  delete clean.approvedBy;
  const row = {
    ...clean,
    id: nextId(expenditureStore.get()),
    bookedByName: input.bookedByName ?? user?.name ?? input.bookedBy,
    gstAmount,
    total: input.amount + gstAmount,
    status: "Booked",
    history: [
      { at: stamp(), by: input.bookedByName ?? user?.name ?? input.bookedBy, action: "Booked" },
    ],
    createdOn: today(),
  };
  expenditureStore.set((p) => [row, ...p]);
  return row;
}

export const APPROVER_ROLES = ["Admin", "SuperAdmin", "CEO", "COO", "CFO", "CHRO"];
/* Lifecycle: Booked → Approved → Paid (or Booked → Rejected). Each step only applies from its predecessor. */
/** Maker–checker: the person who booked or requested a spend cannot approve / reject it. */
export const isOwnExpenditure = (e, userId) => e.bookedBy === userId || e.requestedBy.id === userId;
export function approveExpenditure(id, by, remarks) {
  expenditureStore.set((p) =>
    p.map((e) =>
      e.id === id && e.status === "Booked" && !isOwnExpenditure(e, by.id)
        ? {
            ...e,
            status: "Approved",
            approvedBy: by,
            history: [
              ...e.history,
              { at: stamp(), by: by.name, action: `Approved${remarks ? ` — ${remarks}` : ""}` },
            ],
          }
        : e,
    ),
  );
}
export function rejectExpenditure(id, by, reason) {
  expenditureStore.set((p) =>
    p.map((e) =>
      e.id === id && e.status === "Booked" && !isOwnExpenditure(e, by.id) && reason.trim()
        ? {
            ...e,
            status: "Rejected",
            history: [...e.history, { at: stamp(), by: by.name, action: `Rejected — ${reason}` }],
          }
        : e,
    ),
  );
}
export function markExpenditurePaid(id, by, paymentRef) {
  expenditureStore.set((p) =>
    p.map((e) =>
      e.id === id && e.status === "Approved"
        ? {
            ...e,
            status: "Paid",
            paymentRef: paymentRef || e.paymentRef,
            history: [
              ...e.history,
              {
                at: stamp(),
                by: by.name,
                action: `Marked paid${paymentRef ? ` · ${paymentRef}` : ""}`,
              },
            ],
          }
        : e,
    ),
  );
}

export function submitExpenditureOutcome(id, outcome, outcomeDocuments, by = "") {
  expenditureStore.set((p) =>
    p.map((e) =>
      e.id === id
        ? {
            ...e,
            outcome,
            outcomeDocuments,
            outcomeSubmittedOn: today(),
            history: [
              ...e.history,
              { at: stamp(), by: by || e.bookedByName, action: "Outcome recorded" },
            ],
          }
        : e,
    ),
  );
}

export const removeExpenditure = (id) => expenditureStore.set((p) => p.filter((e) => e.id !== id));

/* ---------------- Reports ---------------- */
/**
 * @typedef {Object} ExpenditureFilter
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [category]
 * @property {string} [department]
 * @property {string} [status]
 * @property {string} [branch]
 */
export const filterExpenditures = (rows, f) =>
  rows.filter(
    (r) =>
      (!f.from || r.spendDate >= f.from) &&
      (!f.to || r.spendDate <= f.to) &&
      (!f.category || f.category === "all" || r.category === f.category) &&
      (!f.department || f.department === "all" || r.department === f.department) &&
      (!f.status || f.status === "all" || r.status === f.status) &&
      (!f.branch || f.branch === "all" || r.branch === f.branch),
  );

const group = (rows, key) => {
  const m = new Map();
  rows.forEach((r) => {
    const k = key(r);
    const g = m.get(k) ?? { key: k, count: 0, total: 0, gst: 0 };
    g.count++;
    g.total += r.total;
    g.gst += r.gstAmount;
    m.set(k, g);
  });
  return [...m.values()].sort((a, b) => b.total - a.total);
};
export const monthOf = (iso) => iso.slice(0, 7);
export const monthLabelOf = (m) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });

export function expenditureReport(allRows) {
  // Rejected bookings were never spent — they stay in the register but not in spend totals.
  const rows = allRows.filter((r) => r.status !== "Rejected");
  const total = rows.reduce((s, r) => s + r.total, 0);
  const gst = rows.reduce((s, r) => s + r.gstAmount, 0);
  const capex = rows
    .filter((r) => (CATEGORY_META[r.category] ?? CATEGORY_META.Other).capex)
    .reduce((s, r) => s + r.total, 0);
  return {
    count: rows.length,
    total,
    gst,
    capex,
    opex: total - capex,
    paid: rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.total, 0),
    payable: rows
      .filter((r) => r.status !== "Paid" && r.status !== "Rejected")
      .reduce((s, r) => s + r.total, 0),
    withOutcome: rows.filter((r) => r.outcome).length,
    byCategory: group(rows, (r) => r.category),
    byDepartment: group(rows, (r) => r.department),
    byMonth: group(rows, (r) => monthOf(r.spendDate)).sort((a, b) => (a.key < b.key ? -1 : 1)),
    byVendor: group(rows, (r) => r.vendor).slice(0, 10),
    byRequester: group(rows, (r) => r.requestedBy.name),
    byPayment: group(rows, (r) => r.paymentMode),
    festivals: rows.filter((r) => r.festival),
    assets: rows.filter((r) => r.asset),
  };
}

/** Kept for dashboards that summarise spend per organisation. */
export function expenditureRollup(orgId) {
  const rows = expenditureStore.get().filter((e) => e.orgId === orgId);
  const byCategory = group(rows, (r) => r.category).map((g) => ({
    category: g.key,
    total: g.total,
  }));
  return {
    total: rows.reduce((s, r) => s + r.total, 0),
    count: rows.length,
    withOutcome: rows.filter((r) => r.outcome).length,
    byCategory,
  };
}
