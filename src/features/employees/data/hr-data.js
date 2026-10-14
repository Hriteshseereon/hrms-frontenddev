import { useSharedList } from "@/lib/shared-list";

export const DESIGNATIONS = [
  "Senior Engineer",
  "Staff Engineer",
  "Engineering Manager",
  "Account Executive",
  "HR Business Partner",
  "Financial Analyst",
  "Ops Manager",
  "Content Lead",
];

/* ------------------------- Designation master (Master Data → Infrastructure) ------------------------- */
/**
 * @typedef {Object} DesignationRow
 * @property {string} id
 * @property {number} level
 * @property {string} name
 * @property {string} grade
 * @property {string} band
 * @property {string} [department]
 * @property {string} [description]
 */
/** Demo seed for the head-office entity only — other entities start empty. */
export const DESIGNATIONS_SEED = [
  { id: "DSG-01", level: 1, name: "Associate", grade: "L1", band: "Entry" },
  { id: "DSG-02", level: 2, name: "Senior Associate", grade: "L2", band: "Entry" },
  { id: "DSG-03", level: 3, name: "Assistant Manager", grade: "M1", band: "Mid" },
  { id: "DSG-04", level: 4, name: "Manager", grade: "M2", band: "Mid" },
  { id: "DSG-05", level: 5, name: "Senior Manager", grade: "M3", band: "Senior" },
  { id: "DSG-06", level: 6, name: "Director", grade: "D1", band: "Senior" },
  { id: "DSG-07", level: 7, name: "Vice President", grade: "VP", band: "Executive" },
  { id: "DSG-08", level: 8, name: "Senior Vice President", grade: "SVP", band: "Executive" },
  { id: "DSG-09", level: 9, name: "C-Level", grade: "CXO", band: "Executive" },
];
export const designationListKey = (orgId) => `infra-designations:${orgId}`;
export const designationSeedFor = (orgId) => (orgId === "ORG-SEEREON" ? DESIGNATIONS_SEED : []);
/** Designation master rows of one entity — the same list Master Data → Infrastructure → Designations edits. */
export const useDesignationMaster = (orgId) =>
  useSharedList(designationListKey(orgId), designationSeedFor(orgId));
/**
 * Designation names offered by the employee record, promotions and transfers: the entity's designation master plus the
 * functional titles already used on the head-office roster (the forms used to hard-code their own, different lists).
 */
export function useDesignationNames(orgId) {
  const [rows] = useDesignationMaster(orgId);
  return Array.from(
    new Set([...rows.map((r) => r.name), ...(orgId === "ORG-SEEREON" ? DESIGNATIONS : [])]),
  ).sort();
}

export const OFFICES = ["Bhubaneswar HQ", "Mumbai", "Pune", "Chennai", "Hyderabad"];

export const BRANCHES = {
  "Bhubaneswar HQ": ["Whitefield", "Koramangala", "Electronic City"],
  Mumbai: ["Andheri East", "BKC"],
  Pune: ["Hinjewadi", "Kharadi"],
  Chennai: ["OMR", "Guindy"],
  Hyderabad: ["Gachibowli", "Madhapur"],
};

export const SALARY_GRADES = ["G1", "G2", "G3", "G4", "G5", "M1", "M2", "M3"];

export const ADDITIONAL_ROLES = [
  "HR Manager",
  "Payroll Admin",
  "Recruiter",
  "Manager",
  "Approver",
  "Asset Custodian",
];

export const EMPLOYEE_OPTIONS = [
  {
    id: "SRN-0142",
    name: "Ananya Sharma",
    designation: "Senior Engineer",
    office: "Bhubaneswar HQ",
  },
  { id: "SRN-0143", name: "Vikram Iyer", designation: "Account Executive", office: "Mumbai" },
  {
    id: "SRN-0144",
    name: "Priya Nair",
    designation: "HR Business Partner",
    office: "Bhubaneswar HQ",
  },
  { id: "SRN-0145", name: "Rohit Deshmukh", designation: "Financial Analyst", office: "Pune" },
  { id: "SRN-0146", name: "Kavya Menon", designation: "Ops Manager", office: "Chennai" },
  { id: "SRN-0147", name: "Arjun Kapoor", designation: "Staff Engineer", office: "Bhubaneswar HQ" },
];

/**
 * @typedef {Object} Promotion
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} from
 * @property {string} to
 * @property {string} grade
 * @property {string} validFrom
 * @property {string} validTo
 * @property {"Active" | "Scheduled"} status
 */

export const PROMOTIONS = [
  {
    id: "PRM-1001",
    employee: "Ananya Sharma",
    empId: "SRN-0142",
    from: "Engineer",
    to: "Senior Engineer",
    grade: "G4",
    validFrom: "2026-04-01",
    validTo: "2027-03-31",
    status: "Active",
  },
  {
    id: "PRM-1002",
    employee: "Kavya Menon",
    empId: "SRN-0146",
    from: "Ops Lead",
    to: "Ops Manager",
    grade: "M1",
    validFrom: "2026-07-01",
    validTo: "2027-06-30",
    status: "Active",
  },
  {
    id: "PRM-1003",
    employee: "Vikram Iyer",
    empId: "SRN-0143",
    from: "Sales Associate",
    to: "Account Executive",
    grade: "G3",
    validFrom: "2026-09-01",
    validTo: "2027-08-31",
    status: "Scheduled",
  },
];

/**
 * @typedef {Object} Transfer
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} fromOffice
 * @property {string} toOffice
 * @property {string} branch
 * @property {string[]} roles
 * @property {string} effective
 * @property {"Completed" | "In Transit" | "Scheduled"} status
 */

export const TRANSFERS = [
  {
    id: "TRF-2001",
    employee: "Rohit Deshmukh",
    empId: "SRN-0145",
    fromOffice: "Pune",
    toOffice: "Mumbai",
    branch: "BKC",
    roles: ["Approver"],
    effective: "2026-08-01",
    status: "Scheduled",
  },
  {
    id: "TRF-2002",
    employee: "Sneha Rao",
    empId: "SRN-0148",
    fromOffice: "Mumbai",
    toOffice: "Bhubaneswar HQ",
    branch: "Whitefield",
    roles: ["Manager"],
    effective: "2026-06-15",
    status: "Completed",
  },
  {
    id: "TRF-2003",
    employee: "Arjun Kapoor",
    empId: "SRN-0147",
    fromOffice: "Bhubaneswar HQ",
    toOffice: "Hyderabad",
    branch: "Gachibowli",
    roles: [],
    effective: "2026-07-20",
    status: "In Transit",
  },
];

/**
 * @typedef {Object} Resignation
 * @property {string} id
 * @property {string} employee
 * @property {string} empId
 * @property {string} designation
 * @property {string} office
 * @property {string} appliedOn
 * @property {string} lastWorkingDay
 * @property {string} reason
 * @property {string} [description]
 * @property {string} [document]
 * @property {"Pending" | "Approved" | "Rejected"} status
 * @property {string} [decisionReason]
 */

export const RESIGNATIONS = [
  {
    id: "RSG-3001",
    employee: "Arjun Kapoor",
    empId: "SRN-0147",
    designation: "Staff Engineer",
    office: "Bhubaneswar HQ",
    appliedOn: "2026-07-02",
    lastWorkingDay: "2026-08-31",
    reason: "Higher studies",
    status: "Pending",
  },
  {
    id: "RSG-3002",
    employee: "Manish Patel",
    empId: "SRN-0149",
    designation: "Engineering Manager",
    office: "Bhubaneswar HQ",
    appliedOn: "2026-06-28",
    lastWorkingDay: "2026-09-27",
    reason: "Relocation abroad",
    status: "Pending",
  },
  {
    id: "RSG-3003",
    employee: "Neha Verma",
    empId: "SRN-0151",
    designation: "Recruiter",
    office: "Mumbai",
    appliedOn: "2026-05-10",
    lastWorkingDay: "2026-06-09",
    reason: "Better opportunity",
    status: "Approved",
    decisionReason: "Cleared by HR and reporting manager.",
  },
  {
    id: "RSG-3004",
    employee: "Karan Bhatia",
    empId: "SRN-0152",
    designation: "Manager",
    office: "Pune",
    appliedOn: "2026-04-18",
    lastWorkingDay: "2026-07-17",
    reason: "Personal reasons",
    status: "Rejected",
    decisionReason: "Critical project handover pending; retained after discussion.",
  },
];
