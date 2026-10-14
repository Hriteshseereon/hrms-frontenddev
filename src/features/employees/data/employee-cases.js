// Data layer for Terminations, Warnings and Complaints (Employee module)

export const TERMINATION_TYPES = [
  "Voluntary",
  "Involuntary",
  "Performance",
  "Misconduct",
  "Redundancy",
  "End of Contract",
];

export const WARNING_TYPES = [
  "Verbal Warning",
  "Written Warning",
  "Final Warning",
  "Performance Improvement",
  "Attendance",
];

export const COMPLAINT_TYPES = [
  "Harassment",
  "Workplace Safety",
  "Discrimination",
  "Payroll Dispute",
  "Facilities",
  "Other",
];

export const SEVERITIES = ["Low", "Medium", "High", "Critical"];
/**
 * @typedef {(typeof SEVERITIES)[number]} Severity
 */

/**
 * @typedef {Object} Termination
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} type
 * @property {string} noticeDate
 * @property {string} terminationDate
 * @property {string} [description]
 * @property {string} [document]
 */

export const TERMINATIONS = [
  {
    id: "TRM-4001",
    employee: "Karan Bhatia",
    empId: "SRN-0152",
    type: "Performance",
    noticeDate: "2026-06-01",
    terminationDate: "2026-07-01",
    description: "Repeated failure to meet quarterly targets after PIP.",
    document: "pip-summary.pdf",
  },
  {
    id: "TRM-4002",
    employee: "Sneha Rao",
    empId: "SRN-0148",
    type: "End of Contract",
    noticeDate: "2026-07-05",
    terminationDate: "2026-08-05",
    description: "Fixed-term marketing contract concluding as scheduled.",
  },
  {
    id: "TRM-4003",
    employee: "Manish Patel",
    empId: "SRN-0149",
    type: "Redundancy",
    noticeDate: "2026-05-20",
    terminationDate: "2026-08-19",
    description: "Role redundant post platform consolidation.",
  },
];

/**
 * @typedef {Object} Warning
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} warningBy
 * @property {string} type
 * @property {string} subject
 * @property {Severity} severity
 * @property {string} date
 * @property {string} [description]
 */

export const WARNINGS = [
  {
    id: "WRN-5001",
    employee: "Vikram Iyer",
    empId: "SRN-0143",
    warningBy: "Priya Nair",
    type: "Attendance",
    subject: "Repeated late log-ins",
    severity: "Low",
    date: "2026-07-08",
    description: "Logged in past 11:00 on six occasions this month.",
  },
  {
    id: "WRN-5002",
    employee: "Arjun Kapoor",
    empId: "SRN-0147",
    warningBy: "Manish Patel",
    type: "Written Warning",
    subject: "Unapproved production deploy",
    severity: "High",
    date: "2026-06-22",
    description: "Deployed to production outside the change window without approval.",
  },
  {
    id: "WRN-5003",
    employee: "Rohit Deshmukh",
    empId: "SRN-0145",
    warningBy: "Kavya Menon",
    type: "Performance Improvement",
    subject: "Delayed month-end closing",
    severity: "Medium",
    date: "2026-05-30",
  },
];

/**
 * @typedef {Object} Complaint
 * @property {string} id
 * @property {string} complaintBy
 * @property {string} against
 * @property {string} type
 * @property {string} subject
 * @property {string} date
 * @property {string} [description]
 * @property {string} [document]
 * @property {"Open" | "Investigating" | "Resolved"} status
 */

export const COMPLAINTS = [
  {
    id: "CMP-6001",
    complaintBy: "Ananya Sharma",
    against: "Facilities Team",
    type: "Facilities",
    subject: "AC not working on 3rd floor",
    date: "2026-07-14",
    description: "Cooling has been out for four working days in A-Wing.",
    status: "Open",
  },
  {
    id: "CMP-6002",
    complaintBy: "Priya Nair",
    against: "Vikram Iyer",
    type: "Harassment",
    subject: "Inappropriate remarks in team meeting",
    date: "2026-07-02",
    description: "Escalated to the POSH committee for review.",
    document: "statement.pdf",
    status: "Investigating",
  },
  {
    id: "CMP-6003",
    complaintBy: "Kavya Menon",
    against: "Payroll Admin",
    type: "Payroll Dispute",
    subject: "Overtime not reflected in June payslip",
    date: "2026-06-18",
    status: "Resolved",
  },
];
