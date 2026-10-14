import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} LeaveType
 * @property {string} id
 * @property {string} name
 * @property {number} maxDays
 * @property {string} description
 * @property {"Active" | "Draft"} status
 */

export const LEAVE_TYPES = [
  {
    id: "LTP-OD",
    name: "Outdoor Duty",
    maxDays: 5,
    description: "Client site / field work — paid; approved by reporting manager via workflow.",
    status: "Active",
  },
  {
    id: "LTP-TL",
    name: "Travel Leave (on tour)",
    maxDays: 30,
    description: "Leave on approved tour days — HOD → HR workflow; tour reference required.",
    status: "Active",
  },
  {
    id: "LTP-01",
    name: "Casual Leave",
    maxDays: 12,
    description: "Short-notice personal leave, up to 3 consecutive days.",
    status: "Active",
  },
  {
    id: "LTP-02",
    name: "Sick Leave",
    maxDays: 10,
    description: "Medical leave; certificate required beyond 2 days.",
    status: "Active",
  },
  {
    id: "LTP-03",
    name: "Earned Leave",
    maxDays: 18,
    description: "Accrued leave, carry-forward allowed up to 30 days.",
    status: "Active",
  },
  {
    id: "LTP-04",
    name: "Maternity Leave",
    maxDays: 182,
    description: "Statutory maternity benefit as per Indian law.",
    status: "Active",
  },
  {
    id: "LTP-05",
    name: "Bereavement Leave",
    maxDays: 5,
    description: "Leave on death of an immediate family member.",
    status: "Draft",
  },
  {
    id: "LTP-06",
    name: "Paternity Leave",
    maxDays: 15,
    description: "Paternity benefit for new fathers, to be availed within 6 months of childbirth.",
    status: "Active",
  },
  {
    id: "LTP-07",
    name: "Loss of Pay (LOP)",
    maxDays: 30,
    description: "Unpaid leave — salary is deducted pro-rata for each LOP day approved.",
    status: "Active",
  },
];

/**
 * @typedef {Object} LeaveApplication
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} leaveType
 * @property {string} from
 * @property {string} to
 * @property {number} days
 * @property {string} description
 * @property {string} [attachment]
 * @property {"Pending" | "Approved" | "Rejected" | "Cancelled"} status
 * @property {string} [approvalChain] - Approval chain from the Leave Master (e.g. "HOD → HR") and the step currently pending (0-based).
 * @property {number} [chainStep]
 * @property {{ step: string, by: string, on: string, note: string }[]} [chainLog]
 * @property {string} [decisionReason]
 * @property {string} [decidedBy]
 * @property {string} [decidedOn]
 * @property {string} [appliedOn]
 * @property {"Full day" | "First half" | "Second half"} [dayPart] - Detailed application (enterprise form)
 * @property {string} [reasonCategory]
 * @property {string} [contactDuringLeave]
 * @property {string} [locationDuringLeave]
 * @property {string} [handoverTo]
 * @property {string} [handoverNotes]
 * @property {string[]} [documents]
 * @property {string} [appliedBy]
 */
export const LEAVE_REASON_CATEGORIES = [
  "Personal / family",
  "Medical (self)",
  "Medical (family)",
  "Travel / vacation",
  "Function / ceremony",
  "Exam / study",
  "Bereavement",
  "Relocation",
  "Other",
];

export const LEAVE_APPLICATIONS = [
  {
    id: "LVA-5001",
    employee: "Ananya Sharma",
    empId: "SRN-0142",
    leaveType: "Casual Leave",
    from: "2026-08-03",
    to: "2026-08-05",
    days: 3,
    description: "Family function out of town.",
    status: "Pending",
  },
  {
    id: "LVA-5002",
    employee: "Rohit Deshmukh",
    empId: "SRN-0145",
    leaveType: "Sick Leave",
    from: "2026-07-27",
    to: "2026-07-29",
    days: 3,
    description: "Viral fever, doctor advised rest.",
    attachment: "medical-certificate.pdf",
    status: "Pending",
  },
  {
    id: "LVA-5003",
    employee: "Kavya Menon",
    empId: "SRN-0146",
    leaveType: "Earned Leave",
    from: "2026-09-10",
    to: "2026-09-18",
    days: 9,
    description: "Annual vacation with family.",
    status: "Pending",
  },
  {
    id: "LVA-5004",
    employee: "Vikram Iyer",
    empId: "SRN-0143",
    leaveType: "Casual Leave",
    from: "2026-06-11",
    to: "2026-06-11",
    days: 1,
    description: "Personal work.",
    status: "Approved",
    decisionReason: "Approved by reporting manager.",
  },
  {
    id: "LVA-5005",
    employee: "Sneha Rao",
    empId: "SRN-0148",
    leaveType: "Earned Leave",
    from: "2026-06-01",
    to: "2026-06-14",
    days: 14,
    description: "Extended travel.",
    status: "Rejected",
    decisionReason: "Campaign launch week; requested to reschedule.",
  },
];

/**
 * Live leave applications — one persisted list shared by the employee portal, the org approval queue, attendance and
 * payroll (LOP). It used to be an in-memory shared list, so every request and approval vanished on a page reload.
 */
export const leaveApplicationStore = createPersistentStore(
  "seereon.leave.applications.v1",
  LEAVE_APPLICATIONS,
);

/**
 * @typedef {Object} LeaveBalance
 * @property {string} empId
 * @property {string} employee
 * @property {string} designation
 * @property {string} office
 * @property {Record<string, { used: number, total: number }>} balances - leave type name -> { used, total }
 */

export const LEAVE_BALANCES = [
  {
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    designation: "Senior Engineer",
    office: "Bhubaneswar HQ",
    balances: {
      "Casual Leave": { used: 5, total: 12 },
      "Sick Leave": { used: 2, total: 10 },
      "Earned Leave": { used: 6, total: 18 },
    },
  },
  {
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    designation: "Account Executive",
    office: "Mumbai",
    balances: {
      "Casual Leave": { used: 9, total: 12 },
      "Sick Leave": { used: 1, total: 10 },
      "Earned Leave": { used: 3, total: 18 },
    },
  },
  {
    empId: "SRN-0144",
    employee: "Priya Nair",
    designation: "HR Business Partner",
    office: "Bhubaneswar HQ",
    balances: {
      "Casual Leave": { used: 2, total: 12 },
      "Sick Leave": { used: 4, total: 10 },
      "Earned Leave": { used: 11, total: 18 },
    },
  },
  {
    empId: "SRN-0145",
    employee: "Rohit Deshmukh",
    designation: "Financial Analyst",
    office: "Pune",
    balances: {
      "Casual Leave": { used: 7, total: 12 },
      "Sick Leave": { used: 8, total: 10 },
      "Earned Leave": { used: 2, total: 18 },
    },
  },
  {
    empId: "SRN-0146",
    employee: "Kavya Menon",
    designation: "Ops Manager",
    office: "Chennai",
    balances: {
      "Casual Leave": { used: 1, total: 12 },
      "Sick Leave": { used: 0, total: 10 },
      "Earned Leave": { used: 14, total: 18 },
    },
  },
  {
    empId: "SRN-0147",
    employee: "Arjun Kapoor",
    designation: "Staff Engineer",
    office: "Bhubaneswar HQ",
    balances: {
      "Casual Leave": { used: 12, total: 12 },
      "Sick Leave": { used: 3, total: 10 },
      "Earned Leave": { used: 9, total: 18 },
    },
  },
];

export const HOLIDAY_TYPES = [
  "National Holiday",
  "Regional Holiday",
  "Optional Holiday",
  "Company Shutdown",
  "Observance",
];

/**
 * @typedef {Object} Holiday
 * @property {string} id
 * @property {string} name
 * @property {string} from
 * @property {string} to
 * @property {string} type
 * @property {string} description
 * @property {boolean} paid
 */

export const HOLIDAYS = [
  {
    id: "HOL-01",
    name: "Independence Day",
    from: "2026-08-15",
    to: "2026-08-15",
    type: "National Holiday",
    description: "Statutory national holiday across all offices.",
    paid: true,
  },
  {
    id: "HOL-02",
    name: "Ganesh Chaturthi",
    from: "2026-09-14",
    to: "2026-09-15",
    type: "Regional Holiday",
    description: "Observed at Mumbai and Pune offices.",
    paid: true,
  },
  {
    id: "HOL-03",
    name: "Diwali Break",
    from: "2026-11-07",
    to: "2026-11-10",
    type: "Company Shutdown",
    description: "Company-wide festive shutdown.",
    paid: true,
  },
  {
    id: "HOL-04",
    name: "Christmas Eve",
    from: "2026-12-24",
    to: "2026-12-24",
    type: "Optional Holiday",
    description: "Optional holiday; can be swapped with any restricted holiday.",
    paid: false,
  },
];
