// Pay grade definitions, salary structures and approval workflows (Masters module).

export const PAY_GRADE_ROWS = [
  {
    id: "PG-001",
    name: "G3",
    band: "Individual Contributor",
    minCtc: "1200000",
    maxCtc: "1800000",
    currency: "INR",
    status: "Active",
    description: "Mid-level individual contributors",
  },
  {
    id: "PG-002",
    name: "G4",
    band: "Senior IC",
    minCtc: "1800000",
    maxCtc: "2600000",
    currency: "INR",
    status: "Active",
    description: "Senior engineers and specialists",
  },
  {
    id: "PG-003",
    name: "M1",
    band: "People Manager",
    minCtc: "2600000",
    maxCtc: "3600000",
    currency: "INR",
    status: "Active",
    description: "First-line managers",
  },
];

export const PAY_BANDS = [
  "Entry",
  "Individual Contributor",
  "Senior IC",
  "People Manager",
  "Leadership",
];

export const SALARY_STRUCTURE_ROWS = [
  {
    id: "SS-001",
    name: "Standard India Structure",
    grade: "G3",
    basic: "40",
    hra: "40",
    allowances: "Conveyance, Special",
    deductions: "PF, PT, Health Insurance",
    status: "Active",
    description: "Default structure for all India-based staff",
  },
  {
    id: "SS-002",
    name: "Manager Structure",
    grade: "M1",
    basic: "45",
    hra: "50",
    allowances: "Conveyance, Car Lease, Special",
    deductions: "PF, PT, Health Insurance, TDS",
    status: "Active",
    description: "Applies to grade M1 and above",
  },
];

export const APPROVAL_WORKFLOW_ROWS = [
  {
    id: "AWF-001",
    name: "Leave Approval",
    entity: "Leave Application",
    level1: "Reporting Manager",
    level2: "HR Manager",
    level3: "—",
    escalation: "48 hours",
    status: "Active",
    description: "Two-step approval with HR oversight",
  },
  {
    id: "AWF-002",
    name: "Reimbursement Approval",
    entity: "Reimbursement",
    level1: "Reporting Manager",
    level2: "Finance",
    level3: "CFO (above ₹50,000)",
    escalation: "72 hours",
    status: "Active",
    description: "Finance settles with the next payroll",
  },
  {
    id: "AWF-003",
    name: "Timesheet Approval",
    entity: "Timesheet",
    level1: "Reporting Manager",
    level2: "—",
    level3: "—",
    escalation: "24 hours",
    status: "Active",
    description: "Weekly approval before payroll cut-off",
  },
];

export const APPROVAL_ENTITIES = [
  "Leave Application",
  "Timesheet",
  "Reimbursement",
  "Loan Request",
  "Appraisal",
  "Resignation",
  "Insurance Assignment",
];

export const APPROVER_ROLES = [
  "Reporting Manager",
  "Substitute Manager",
  "HR Manager",
  "Finance",
  "Payroll Admin",
  "Organization Admin",
  "CFO (above ₹50,000)",
  "—",
];
