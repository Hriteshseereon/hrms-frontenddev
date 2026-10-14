// Performance module reference data

export const STATUSES = ["Active", "Inactive"];
export const REVIEW_STATUSES = ["Scheduled", "In Progress", "Completed"];
export const RATINGS = [
  "1 — Below",
  "2 — Developing",
  "3 — Meets",
  "4 — Exceeds",
  "5 — Outstanding",
];
export const FREQUENCIES = ["Monthly", "Quarterly", "Half-Yearly", "Annual"];

export const INDICATOR_CATEGORIES = [
  "Productivity",
  "Quality",
  "Collaboration",
  "Leadership",
  "Customer",
];
export const MEASUREMENT_UNITS = ["Number", "Percentage", "Hours", "Score (1-5)", "Currency"];
export const GOAL_TYPES = ["Individual", "Team", "Organizational", "Developmental"];
export const REVIEW_CYCLES = ["Q3 FY26 Review", "Annual FY26", "Mid-Year FY26"];

export const PERF_INDICATORS = [
  {
    id: "PI-001",
    name: "Sprint Velocity",
    category: "Productivity",
    description: "Story points delivered per sprint",
    unit: "Number",
    target: "38",
    status: "Active",
  },
  {
    id: "PI-002",
    name: "Defect Escape Rate",
    category: "Quality",
    description: "Bugs reported post-release",
    unit: "Percentage",
    target: "2",
    status: "Active",
  },
  {
    id: "PI-003",
    name: "CSAT Score",
    category: "Customer",
    description: "Average customer satisfaction rating",
    unit: "Score (1-5)",
    target: "4.5",
    status: "Active",
  },
];

export const INDICATOR_CATEGORY_ROWS = [
  {
    id: "IC-001",
    name: "Productivity",
    description: "Output and throughput measures",
    status: "Active",
  },
  {
    id: "IC-002",
    name: "Quality",
    description: "Accuracy and defect-related measures",
    status: "Active",
  },
  {
    id: "IC-003",
    name: "Collaboration",
    description: "Teamwork and cross-functional contribution",
    status: "Active",
  },
];

export const GOAL_TYPE_ROWS = [
  {
    id: "GT-001",
    name: "Individual",
    description: "Goals owned by a single employee",
    status: "Active",
  },
  { id: "GT-002", name: "Team", description: "Shared goals across a team", status: "Active" },
  {
    id: "GT-003",
    name: "Developmental",
    description: "Skill and career growth goals",
    status: "Inactive",
  },
];

export const REVIEW_CYCLE_ROWS = [
  {
    id: "RC-001",
    name: "Q3 FY26 Review",
    frequency: "Quarterly",
    status: "Active",
    description: "Quarterly performance conversation for all staff",
  },
  {
    id: "RC-002",
    name: "Annual FY26",
    frequency: "Annual",
    status: "Active",
    description: "Year-end appraisal and rating calibration",
  },
  {
    id: "RC-003",
    name: "Mid-Year FY26",
    frequency: "Half-Yearly",
    status: "Inactive",
    description: "Mid-year checkpoint on goals",
  },
];

export const EMPLOYEE_REVIEW_ROWS = [
  {
    id: "ER-001",
    employee: "Ananya Sharma",
    reviewer: "Priya Nair",
    cycle: "Q3 FY26 Review",
    date: "2026-07-12",
    status: "Completed",
    rating: "4 — Exceeds",
  },
  {
    id: "ER-002",
    employee: "Vikram Iyer",
    reviewer: "Kavya Menon",
    cycle: "Q3 FY26 Review",
    date: "2026-07-20",
    status: "In Progress",
    rating: "3 — Meets",
  },
  {
    id: "ER-003",
    employee: "Arjun Kapoor",
    reviewer: "Priya Nair",
    cycle: "Annual FY26",
    date: "2026-08-05",
    status: "Scheduled",
    rating: "",
  },
];

export const APPRAISAL_METHODS = [
  "Merit Increment",
  "Promotion Linked",
  "Market Correction",
  "Retention Bonus Linked",
  "Performance Bonus",
];

/**
 * @typedef {Object} Appraisal
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} cycle
 * @property {string} review
 * @property {string} rating
 * @property {string} method
 * @property {number} percentage
 * @property {number} currentCtc
 * @property {number} newCtc
 * @property {string} effectiveFrom
 * @property {string} remarks
 * @property {"Draft" | "Approved"} status
 */

export const APPRAISALS = [
  {
    id: "APR-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    cycle: "Q3 FY26 Review",
    review: "ER-001",
    rating: "4 — Exceeds",
    method: "Merit Increment",
    percentage: 12,
    currentCtc: 2400000,
    newCtc: 2688000,
    effectiveFrom: "2026-09-01",
    remarks: "Consistently exceeded sprint velocity targets.",
    status: "Approved",
  },
  {
    id: "APR-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    cycle: "Q3 FY26 Review",
    review: "ER-002",
    rating: "3 — Meets",
    method: "Market Correction",
    percentage: 8,
    currentCtc: 1500000,
    newCtc: 1620000,
    effectiveFrom: "2026-09-01",
    remarks: "Aligned to market band for account executives.",
    status: "Draft",
  },
];
