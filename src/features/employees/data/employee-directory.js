import { useSyncExternalStore } from "react";
import { computeSalaryBreakup } from "@/features/payroll/data/salary-engine";
// Central employee directory + the enterprise-grade 360° profile used by the
// Employee detail view (org admin) and the Employee portal.

/**
 * Employee detail view (org admin) and the Employee portal.
 * @typedef {Object} Employee
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} dept
 * @property {string} role
 * @property {string} branch
 * @property {"Active" | "On Leave" | "Notice" | "Exited" | "Retired"} status - Exited = separation completed (exit module); Retired = superannuated (HR policy).
 * @property {string} orgId
 */

export const EMPLOYEES = [
  // ----- Seereon (active organization) -----
  {
    id: "SRN-0001",
    name: "Santosh Nayak",
    email: "santosh@seereon.co.in",
    phone: "+91 98450 10001",
    dept: "Executive",
    role: "Chief Executive Officer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0002",
    name: "Saras Venkatesh",
    email: "saras@seereon.co.in",
    phone: "+91 98450 10002",
    dept: "Finance",
    role: "Chief Financial Officer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0003",
    name: "Ashish Nayak",
    email: "ashish@seereon.co.in",
    phone: "+91 98450 10003",
    dept: "Operations",
    role: "Chief Operating Officer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0004",
    name: "Varen Mishra",
    email: "varen@seereon.co.in",
    phone: "+91 98450 10004",
    dept: "Human Resources",
    role: "Head of Human Resources",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0005",
    name: "Subh Sahoo",
    email: "subh@seereon.co.in",
    phone: "+91 98450 10005",
    dept: "Engineering",
    role: "Engineering Manager",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0006",
    name: "Subham Das",
    email: "subham@seereon.co.in",
    phone: "+91 98450 10006",
    dept: "Engineering",
    role: "Senior Software Engineer",
    branch: "Bhubaneswar HQ",
    status: "Notice",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0007",
    name: "Neha Kulkarni",
    email: "neha@seereon.co.in",
    phone: "+91 98450 10007",
    dept: "Engineering",
    role: "QA Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0008",
    name: "Rakesh Menon",
    email: "rakesh@seereon.co.in",
    phone: "+91 98450 10008",
    dept: "Engineering",
    role: "Data Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0009",
    name: "Vivek Raman",
    email: "vivek@seereon.co.in",
    phone: "+91 98450 10009",
    dept: "Technology",
    role: "Chief Technology Officer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0010",
    name: "Farah Khan",
    email: "farah@seereon.co.in",
    phone: "+91 98450 10010",
    dept: "Human Resources",
    role: "Chief Human Resources Officer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0011",
    name: "Meera Iyer",
    email: "meera@seereon.co.in",
    phone: "+91 98450 10011",
    dept: "Human Resources",
    role: "Vice President — People Operations",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0012",
    name: "Ritu Bansal",
    email: "ritu@seereon.co.in",
    phone: "+91 98450 10012",
    dept: "Human Resources",
    role: "HR Business Partner — Engineering",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0013",
    name: "Aditya Verma",
    email: "aditya@seereon.co.in",
    phone: "+91 98450 10013",
    dept: "Human Resources",
    role: "HR Business Partner — Operations & Sales",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0014",
    name: "Ishita Bose",
    email: "ishita@seereon.co.in",
    phone: "+91 98450 10014",
    dept: "Engineering",
    role: "Software Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0015",
    name: "Aravind Krishnan",
    email: "aravind@seereon.co.in",
    phone: "+91 98450 10015",
    dept: "Engineering",
    role: "DevOps Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0016",
    name: "Tanvi Joshi",
    email: "tanvi@seereon.co.in",
    phone: "+91 98450 10016",
    dept: "Engineering",
    role: "Frontend Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0017",
    name: "Kiran Shetty",
    email: "kiran@seereon.co.in",
    phone: "+91 98450 10017",
    dept: "Operations",
    role: "Head of Department — Operations",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0142",
    name: "Ananya Sharma",
    email: "ananya.s@seereon.co.in",
    phone: "+91 98450 12345",
    dept: "Engineering",
    role: "Senior Engineer",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0143",
    name: "Vikram Iyer",
    email: "vikram.i@seereon.co.in",
    phone: "+91 98450 12346",
    dept: "Sales",
    role: "Account Executive",
    branch: "Mumbai",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0144",
    name: "Priya Nair",
    email: "priya.n@seereon.co.in",
    phone: "+91 98450 12347",
    dept: "HR",
    role: "HR Business Partner",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0145",
    name: "Rohit Deshmukh",
    email: "rohit.d@seereon.co.in",
    phone: "+91 98450 12348",
    dept: "Finance",
    role: "Financial Analyst",
    branch: "Pune",
    status: "On Leave",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0146",
    name: "Kavya Menon",
    email: "kavya.m@seereon.co.in",
    phone: "+91 98450 12349",
    dept: "Operations",
    role: "Ops Manager",
    branch: "Chennai",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0147",
    name: "Arjun Kapoor",
    email: "arjun.k@seereon.co.in",
    phone: "+91 98450 12350",
    dept: "Engineering",
    role: "Staff Engineer",
    branch: "Bhubaneswar HQ",
    status: "Notice",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0148",
    name: "Sneha Rao",
    email: "sneha.r@seereon.co.in",
    phone: "+91 98450 12351",
    dept: "Marketing",
    role: "Content Lead",
    branch: "Mumbai",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "SRN-0149",
    name: "Manish Patel",
    email: "manish.p@seereon.co.in",
    phone: "+91 98450 12352",
    dept: "Engineering",
    role: "Engineering Manager",
    branch: "Bhubaneswar HQ",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  // ----- Seereon SAP Practice -----
  {
    id: "SRN-2001",
    name: "Devraj Solanki",
    email: "devraj.solanki@sap.seereon.co.in",
    phone: "+91 98450 20001",
    dept: "SAP Delivery",
    role: "Head of Department — SAP Delivery",
    branch: "Hyderabad Office",
    status: "Active",
    orgId: "ORG-1042",
  },
  {
    id: "SRN-2002",
    name: "Falguni Rathore",
    email: "falguni.rathore@sap.seereon.co.in",
    phone: "+91 98450 20002",
    dept: "Human Resources",
    role: "HR Business Partner",
    branch: "Hyderabad Office",
    status: "Active",
    orgId: "ORG-1042",
  },
  {
    id: "SRN-2003",
    name: "Manjeet Bhati",
    email: "manjeet.bhati@sap.seereon.co.in",
    phone: "+91 98450 20003",
    dept: "SAP Delivery",
    role: "SAP ABAP Consultant",
    branch: "Hyderabad Office",
    status: "Active",
    orgId: "ORG-1042",
  },
  // ----- Seereon Cloud Services -----
  {
    id: "SRN-2101",
    name: "Ritesh Barman",
    email: "ritesh.barman@cloud.seereon.co.in",
    phone: "+91 98450 21001",
    dept: "Cloud & DevOps",
    role: "Head of Department — Cloud & DevOps",
    branch: "Pune Office",
    status: "Active",
    orgId: "ORG-1043",
  },
  {
    id: "SRN-2102",
    name: "Pallavi Chatterjee",
    email: "pallavi.chatterjee@cloud.seereon.co.in",
    phone: "+91 98450 21002",
    dept: "Cloud & DevOps",
    role: "DevOps Lead",
    branch: "Pune Office",
    status: "Active",
    orgId: "ORG-1043",
  },
  {
    id: "SRN-2103",
    name: "Soumen Ghosh",
    email: "soumen.ghosh@cloud.seereon.co.in",
    phone: "+91 98450 21003",
    dept: "Cloud & DevOps",
    role: "Cloud Support Lead (Night)",
    branch: "Pune Office",
    status: "Active",
    orgId: "ORG-1043",
  },
  // ----- Seereon Products -----
  {
    id: "SRN-2201",
    name: "Yashodhara Naik",
    email: "yashodhara.naik@products.seereon.co.in",
    phone: "+91 98450 22001",
    dept: "Product Engineering",
    role: "Head of Department — Product Engineering",
    branch: "Kolkata Office",
    status: "Active",
    orgId: "ORG-1044",
  },
  {
    id: "SRN-2202",
    name: "Biraja Mohanty",
    email: "biraja.mohanty@products.seereon.co.in",
    phone: "+91 98450 22002",
    dept: "Product Engineering",
    role: "QA Automation Engineer",
    branch: "Kolkata Office",
    status: "Active",
    orgId: "ORG-1044",
  },
];

/** The roster exactly as the server renders it (before browser-persisted overrides / new hires are applied). */
const PRISTINE_EMPLOYEES = EMPLOYEES.map((e) => ({ ...e }));

/* ------------------------------------------------------------------ */
/* Directory extension — employees created at runtime (new hires)      */
/* ------------------------------------------------------------------ */

const extra = [];
const extraCtc = new Map();
const extraStructure = new Map();
export const structureOf = (empId) => extraStructure.get(empId) ?? null;
const extraJob = new Map();
const dirSubs = new Set();
let dirVersion = 0;

/** Add or replace a runtime employee (e.g. a new hire) so every screen that lists employees sees them. */
export function registerEmployee(e, meta) {
  const i = extra.findIndex((x) => x.id === e.id);
  if (i === -1) extra.push(e);
  else extra[i] = e;
  if (meta?.ctc) extraCtc.set(e.id, meta.ctc);
  if (meta?.grade)
    extraStructure.set(e.id, { grade: meta.grade, wageType: meta.wageType ?? "Salaried" });
  if (meta?.doj)
    extraJob.set(e.id, {
      doj: meta.doj,
      probationMonths: meta.probationMonths ?? 3,
      employmentType: meta.employmentType ?? "Full-time",
      dob: meta.dob ?? "",
      gender: meta.gender ?? "",
      managerName: meta.managerName ?? "",
    });
  CACHE.delete(e.id);
  dirVersion++;
  dirSubs.forEach((f) => f());
}

/** Appraisal / promotion outcome: new CTC and grade → salary structure recomputed for payroll, payslips and the profile. */
export function updateCompensation(empId, patch) {
  if (patch.ctc) extraCtc.set(empId, patch.ctc);
  if (patch.grade)
    extraStructure.set(empId, {
      grade: patch.grade,
      wageType: patch.wageType ?? extraStructure.get(empId)?.wageType ?? "Salaried",
    });
  try {
    window.localStorage.setItem(
      "seereon.directory.compensation",
      JSON.stringify({
        ctc: Object.fromEntries(extraCtc),
        structure: Object.fromEntries(extraStructure),
      }),
    );
  } catch {
    /* ignore */
  }
  CACHE.delete(empId);
  dirVersion++;
  dirSubs.forEach((f) => f());
  // The new designation goes through the record override so it is persisted and restored with the rest of the
  // record (it used to be patched onto the in-memory row only and was lost on reload while the new CTC survived).
  if (patch.designation) updateEmployeeRecord(empId, { role: patch.designation });
}
/* Employee-record overrides written by People cases (transfer → dept/branch/manager, termination → status, promotion → designation). */
/**
 * Employee-record overrides written by People cases (transfer → dept/branch/manager, termination → status, promotion → designation).
 * @typedef {Object} RecordPatch
 * @property {string} [dept]
 * @property {string} [branch]
 * @property {string} [role]
 * @property {Employee["status"]} [status]
 * @property {string} [reportingManager]
 * @property {string} [orgId]
 */
const extraRecord = new Map();
export function updateEmployeeRecord(empId, patch) {
  const cur = extraRecord.get(empId) ?? {};
  const next = { ...cur, ...patch };
  extraRecord.set(empId, next);
  const apply = (e) => ({
    ...e,
    dept: next.dept ?? e.dept,
    branch: next.branch ?? e.branch,
    role: next.role ?? e.role,
    status: next.status ?? e.status,
    orgId: next.orgId ?? e.orgId,
  });
  const i = extra.findIndex((x) => x.id === empId);
  if (i >= 0) extra[i] = apply(extra[i]);
  else {
    const j = EMPLOYEES.findIndex((x) => x.id === empId);
    if (j >= 0) EMPLOYEES[j] = apply(EMPLOYEES[j]);
  }
  try {
    window.localStorage.setItem(
      "seereon.directory.records",
      JSON.stringify(Object.fromEntries(extraRecord)),
    );
  } catch {
    /* ignore */
  }
  CACHE.delete(empId);
  dirVersion++;
  dirSubs.forEach((f) => f());
}
export const recordOverride = (empId) => extraRecord.get(empId);
/* Statutory identifiers fixed by HR from payroll compliance checks (UAN / PF member ID / ESI IP / PAN). */
/**
 * Statutory identifiers fixed by HR from payroll compliance checks (UAN / PF member ID / ESI IP / PAN).
 * @typedef {Object} StatutoryPatch
 * @property {string} [pan]
 * @property {string} [uan]
 * @property {string} [pfNo]
 * @property {string} [esiNo]
 * @property {string} [aadhaar]
 */
const extraStatutory = new Map();
export function updateStatutoryIds(empId, patch) {
  const next = { ...(extraStatutory.get(empId) ?? {}), ...patch };
  extraStatutory.set(empId, next);
  try {
    window.localStorage.setItem(
      "seereon.directory.statutory",
      JSON.stringify(Object.fromEntries(extraStatutory)),
    );
  } catch {
    /* ignore */
  }
  CACHE.delete(empId);
  dirVersion++;
  dirSubs.forEach((f) => f());
}
export const statutoryOverride = (empId) => extraStatutory.get(empId);
/* Salary bank account captured on the employee record form (it used to be typed in and discarded). */
/**
 * Salary bank account captured on the employee record form (it used to be typed in and discarded).
 * @typedef {Object} BankPatch
 * @property {string} [bankName]
 * @property {string} [accountNo]
 * @property {string} [ifsc]
 * @property {string} [mode]
 * @property {string} [holder] - Account holder name as per bank records.
 */
const extraBank = new Map();
export function updateBankDetails(empId, patch) {
  const next = { ...(extraBank.get(empId) ?? {}), ...patch };
  extraBank.set(empId, next);
  try {
    window.localStorage.setItem(
      "seereon.directory.bank",
      JSON.stringify(Object.fromEntries(extraBank)),
    );
  } catch {
    /* ignore */
  }
  CACHE.delete(empId);
  dirVersion++;
  dirSubs.forEach((f) => f());
}
/**
 * Personal, education, previous-employment and job-preference details captured on the detailed employee record form
 * (every one of these fields used to be typed in and discarded on create).
 * @typedef {Object} PersonalPatch
 * @property {Partial<EmployeeProfile["personal"]>} [personal]
 * @property {Partial<EmployeeProfile["job"]>} [job]
 * @property {EmployeeProfile["education"]} [education]
 * @property {EmployeeProfile["experience"]} [experience]
 * @property {Record<string, string>} [other] - Social profiles, documents numbers, bank account type, pay components…
 */
const extraPersonal = new Map();
export function updatePersonalDetails(empId, patch) {
  const cur = extraPersonal.get(empId) ?? {};
  extraPersonal.set(empId, {
    ...cur,
    ...patch,
    personal: { ...cur.personal, ...patch.personal },
    job: { ...cur.job, ...patch.job },
    other: { ...cur.other, ...patch.other },
  });
  try {
    window.localStorage.setItem(
      "seereon.directory.personal",
      JSON.stringify(Object.fromEntries(extraPersonal)),
    );
  } catch {
    /* ignore */
  }
  CACHE.delete(empId);
  dirVersion++;
  dirSubs.forEach((f) => f());
}
export const personalDetailsOf = (empId) => extraPersonal.get(empId) ?? null;
/* Restore compensation and record overrides persisted in this browser. */
if (typeof window !== "undefined") {
  try {
    const raw = JSON.parse(window.localStorage.getItem("seereon.directory.compensation") ?? "null");
    if (raw) {
      Object.entries(raw.ctc ?? {}).forEach(([k, v]) => extraCtc.set(k, v));
      Object.entries(raw.structure ?? {}).forEach(([k, v]) => extraStructure.set(k, v));
    }
    const recs = JSON.parse(window.localStorage.getItem("seereon.directory.records") ?? "null");
    if (recs)
      Object.entries(recs).forEach(([k, v]) => {
        extraRecord.set(k, v);
        const j = EMPLOYEES.findIndex((x) => x.id === k);
        if (j >= 0)
          EMPLOYEES[j] = {
            ...EMPLOYEES[j],
            dept: v.dept ?? EMPLOYEES[j].dept,
            branch: v.branch ?? EMPLOYEES[j].branch,
            role: v.role ?? EMPLOYEES[j].role,
            status: v.status ?? EMPLOYEES[j].status,
            orgId: v.orgId ?? EMPLOYEES[j].orgId,
          };
      });
    const stat = JSON.parse(window.localStorage.getItem("seereon.directory.statutory") ?? "null");
    if (stat) Object.entries(stat).forEach(([k, v]) => extraStatutory.set(k, v));
    const bank = JSON.parse(window.localStorage.getItem("seereon.directory.bank") ?? "null");
    if (bank) Object.entries(bank).forEach(([k, v]) => extraBank.set(k, v));
    const pers = JSON.parse(window.localStorage.getItem("seereon.directory.personal") ?? "null");
    if (pers) Object.entries(pers).forEach(([k, v]) => extraPersonal.set(k, v));
  } catch {
    /* ignore */
  }
}

/** Seeded employees plus everyone hired during the session. */
export const directoryEmployees = () => [...EMPLOYEES, ...extra];
export const findEmployee = (id) =>
  EMPLOYEES.find((e) => e.id === id) ?? extra.find((e) => e.id === id);

/**
 * Reactive directory — re-renders when a hire is registered. During hydration it returns the pristine seeded roster
 * (what the server rendered): returning the browser's new hires / record overrides straight away made every screen
 * listing employees fail hydration ("25" on the server vs "26" on the client) and React re-created the whole tree.
 */
export function useDirectory() {
  const v = useSyncExternalStore(
    (cb) => {
      dirSubs.add(cb);
      return () => {
        dirSubs.delete(cb);
      };
    },
    () => dirVersion,
    () => -1,
  );
  return v === -1 ? PRISTINE_EMPLOYEES : directoryEmployees();
}

export const initials = (name) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * @typedef {Object} PayrollBreakup
 * @property {number} ctc
 * @property {number} monthlyGross
 * @property {{ label: string, amount: number }[]} earnings
 * @property {{ label: string, amount: number }[]} deductions
 * @property {{ bankName: string, accountNo: string, ifsc: string, mode: string }} bank
 * @property {{ pan: string, uan: string, pfNo: string, esiNo: string }} statutory
 * @property {{ period: string, gross: number, deductions: number, net: number, status: "Paid" | "Processing" }[]} payslips
 */

/**
 * @typedef {Object} EmployeeProfile
 * @property {{ dob: string, gender: string, bloodGroup: string, maritalStatus: string, nationality: string, personalEmail: string, emergencyContact: string, currentAddress: string, permanentAddress: string }} personal
 * @property {{ dateOfJoining: string, confirmationDate: string, employmentType: string, workMode: string, grade: string, wageType: string, shift: string, reportingManager: string, probationMonths: number, noticePeriodDays: number, location: string }} job
 * @property {{ degree: string, institute: string, year: string, score: string }[]} education
 * @property {{ company: string, role: string, from: string, to: string }[]} experience
 * @property {{ name: string, type: string, uploaded: string, status: "Verified" | "Pending" }[]} documents
 * @property {PayrollBreakup} payroll
 * @property {{ present: number, absent: number, leave: number, halfDays: number, lateMarks: number, avgHours: number, overtimeHours: number, shortHours: number, monthly: { month: string, present: number, absent: number, leave: number, overtime: number }[] }} attendance
 * @property {{ type: string, used: number, total: number }[]} leave
 * @property {{ overallRating: string, lastReview: string, nextReview: string, indicators: { name: string, category: string, target: string, actual: string, attainment: number }[], reviews: { cycle: string, reviewer: string, date: string, rating: string, status: string, remarks: string }[], goals: { title: string, type: string, due: string, progress: number, status: string }[] }} performance
 * @property {{ title: string, type: string, trainer: string, from: string, to: string, status: string, score: string }[]} training
 * @property {{ date: string, title: string, detail: string, kind: "promotion" | "transfer" | "award" | "join" | "warning" }[]} timeline
 * @property {{ tag: string, item: string, issued: string, condition: string }[]} assets
 */

function money(n) {
  return Math.round(n);
}

/** Realistic dates of birth for the leadership / long-tenured staff (the seeded generator only produces 1990s DOBs). */
const DOB_OVERRIDES = {
  "SRN-0001": "1975-03-14", // Santosh Nayak
  "SRN-0002": "1972-11-02", // Saras Venkatesh
  "SRN-0003": "1974-06-21", // Ashish Nayak
  "SRN-0017": "1968-11-20", // Kiran Shetty — retires Nov 2026 at 58
  "SRN-0004": "1969-01-08", // Varen Mishra — retires Jan 2027
  "SRN-0005": "1988-09-19", // Subh Sahoo — birthday this week
  "SRN-0007": "1993-09-22", // Neha Kulkarni — birthday this week
  "SRN-0143": "1986-09-27", // Vikram Iyer
  "SRN-2001": "1970-05-05",
  "SRN-2101": "1971-08-30",
};

function buildProfile(e, ctc, seed) {
  const cfg = extraStructure.get(e.id);
  const bk = cfg ? computeSalaryBreakup(ctc, cfg.grade) : null;
  const gross = bk ? bk.monthlyGross : money(ctc / 12);
  const basic = bk ? bk.basic : money(gross * 0.4);
  const hra = money(basic * 0.4);
  const conveyance = 1600;
  const special = money(gross - basic - hra - conveyance);
  const pf = money(basic * 0.12);
  const pt = 200;
  const medins = 850;
  const tds = money(gross * 0.08);
  const totalDed = pf + pt + medins + tds;

  return {
    personal: {
      dob: DOB_OVERRIDES[e.id] ?? `199${(seed % 5) + 0}-0${(seed % 8) + 1}-1${seed % 9}`,
      gender: seed % 2 === 0 ? "Female" : "Male",
      bloodGroup: ["O+", "B+", "A+", "AB+"][seed % 4],
      maritalStatus: seed % 3 === 0 ? "Married" : "Single",
      nationality: "Indian",
      personalEmail: e.email.replace("@seereon.co.in", "@gmail.com"),
      emergencyContact: `${e.name.split(" ")[1] ?? e.name} (Spouse) · +91 90${seed}0 4${seed}231`,
      currentAddress: `${100 + seed}, Palm Meadows, ${e.branch}`,
      permanentAddress: `${20 + seed}, Lake View Residency, ${e.branch}`,
    },
    job: {
      dateOfJoining: `202${(seed % 4) + 1}-0${(seed % 9) + 1}-0${(seed % 8) + 1}`,
      confirmationDate: `202${(seed % 4) + 1}-1${seed % 2}-01`,
      employmentType: "Full-time · Permanent",
      workMode: seed % 3 === 0 ? "Hybrid" : "Work from Office",
      grade: cfg?.grade ?? ["G3", "G4", "G5", "M1"][seed % 4],
      wageType: cfg?.wageType ?? "Salaried",
      shift: seed % 4 === 0 ? "Morning Shift" : "General Shift",
      reportingManager: e.name === "Manish Patel" ? "Subh Sahoo" : "Manish Patel",
      probationMonths: 6,
      noticePeriodDays: 90,
      location: e.branch,
    },
    education: [
      {
        degree: "B.Tech, Computer Science",
        institute: "NIT Surathkal",
        year: "2016",
        score: "8.6 CGPA",
      },
      { degree: "Class XII (CBSE)", institute: "Delhi Public School", year: "2012", score: "92%" },
    ],
    experience: [
      { company: "Zenith Systems", role: "Software Engineer", from: "2016-07", to: "2019-11" },
      { company: "Northwind Labs", role: "Senior Engineer", from: "2019-12", to: "2022-05" },
    ],
    documents: [
      { name: "Aadhaar Card", type: "Identity", uploaded: "2024-01-12", status: "Verified" },
      { name: "PAN Card", type: "Identity", uploaded: "2024-01-12", status: "Verified" },
      { name: "Offer Letter", type: "Employment", uploaded: "2024-01-05", status: "Verified" },
      {
        name: "Relieving Letter (Prev.)",
        type: "Employment",
        uploaded: "2024-02-02",
        status: "Pending",
      },
      { name: "Degree Certificate", type: "Education", uploaded: "2024-01-20", status: "Verified" },
    ],
    payroll: {
      ctc,
      monthlyGross: gross,
      earnings: bk
        ? bk.earnings.map((x) => ({ label: x.label, amount: x.monthly }))
        : [
            { label: "Basic", amount: basic },
            { label: "House Rent Allowance", amount: hra },
            { label: "Conveyance", amount: conveyance },
            { label: "Special Allowance", amount: special },
          ],
      deductions: [
        { label: "Provident Fund", amount: pf },
        { label: "Professional Tax", amount: pt },
        { label: "Health Insurance", amount: medins },
        { label: "TDS", amount: tds },
      ],
      bank: {
        bankName: "HDFC Bank",
        accountNo: `XXXX XXXX ${4000 + seed}`,
        ifsc: "HDFC0001234",
        mode: "NEFT — Salary Account",
      },
      statutory: {
        pan: `ABCDE${1000 + seed}F`,
        uan: `101234567${700 + seed}`,
        pfNo: `OR/BBS/${20000 + seed}`,
        esiNo: "Not applicable",
      },
      payslips: [
        {
          period: "July 2026",
          gross,
          deductions: totalDed,
          net: gross - totalDed,
          status: "Processing",
        },
        { period: "June 2026", gross, deductions: totalDed, net: gross - totalDed, status: "Paid" },
        { period: "May 2026", gross, deductions: totalDed, net: gross - totalDed, status: "Paid" },
        {
          period: "April 2026",
          gross,
          deductions: totalDed,
          net: gross - totalDed,
          status: "Paid",
        },
        {
          period: "March 2026",
          gross,
          deductions: totalDed,
          net: gross - totalDed,
          status: "Paid",
        },
        {
          period: "February 2026",
          gross,
          deductions: totalDed,
          net: gross - totalDed,
          status: "Paid",
        },
      ],
    },
    attendance: {
      present: 18 + (seed % 4),
      absent: seed % 3,
      leave: 2 + (seed % 3),
      halfDays: seed % 3,
      lateMarks: seed % 5,
      avgHours: 8.4 - (seed % 5) * 0.15,
      overtimeHours: 6 + (seed % 9),
      shortHours: (seed % 4) * 1.5,
      monthly: [
        { month: "Mar 2026", present: 21, absent: 1, leave: 1, overtime: 5 },
        { month: "Apr 2026", present: 20, absent: 0, leave: 2, overtime: 8 },
        { month: "May 2026", present: 19, absent: 2, leave: 1, overtime: 4 },
        { month: "Jun 2026", present: 21, absent: 0, leave: 1, overtime: 11 },
        {
          month: "Jul 2026",
          present: 18 + (seed % 4),
          absent: seed % 3,
          leave: 2 + (seed % 3),
          overtime: 6 + (seed % 9),
        },
      ],
    },
    leave: [
      { type: "Casual Leave", used: (seed % 6) + 1, total: 12 },
      { type: "Sick Leave", used: seed % 5, total: 10 },
      { type: "Earned Leave", used: (seed % 9) + 2, total: 18 },
      { type: "Comp Off", used: seed % 3, total: 6 },
    ],
    performance: {
      overallRating: ["3 — Meets", "4 — Exceeds", "5 — Outstanding"][seed % 3],
      lastReview: "2026-04-12",
      nextReview: "2026-10-14",
      indicators: [
        {
          name: "Sprint Velocity",
          category: "Productivity",
          target: "38",
          actual: String(34 + (seed % 8)),
          attainment: 88 + (seed % 12),
        },
        {
          name: "Defect Escape Rate",
          category: "Quality",
          target: "2%",
          actual: `${1 + (seed % 2)}%`,
          attainment: 95 - (seed % 10),
        },
        {
          name: "CSAT Score",
          category: "Customer",
          target: "4.5",
          actual: (4.1 + (seed % 5) / 10).toFixed(1),
          attainment: 92 + (seed % 8),
        },
        {
          name: "Peer Collaboration",
          category: "Collaboration",
          target: "4.0",
          actual: (3.8 + (seed % 4) / 10).toFixed(1),
          attainment: 90 + (seed % 9),
        },
      ],
      reviews: [
        {
          cycle: "Q3 FY26 Review",
          reviewer: "Priya Nair",
          date: "2026-07-12",
          rating: "4 — Exceeds",
          status: "Completed",
          remarks: "Consistently strong delivery; ready for larger scope.",
        },
        {
          cycle: "Q2 FY26 Review",
          reviewer: "Manish Patel",
          date: "2026-04-12",
          rating: "3 — Meets",
          status: "Completed",
          remarks: "Solid quarter; improve stakeholder communication.",
        },
        {
          cycle: "Annual FY26",
          reviewer: "Priya Nair",
          date: "2026-10-14",
          rating: "—",
          status: "Scheduled",
          remarks: "Calibration pending.",
        },
      ],
      goals: [
        {
          title: "Reduce p95 API latency by 30%",
          type: "Individual",
          due: "2026-09-30",
          progress: 65 + (seed % 20),
          status: "On Track",
        },
        {
          title: "Mentor 2 junior engineers",
          type: "Developmental",
          due: "2026-12-31",
          progress: 40 + (seed % 25),
          status: "On Track",
        },
        {
          title: "Ship billing revamp",
          type: "Team",
          due: "2026-08-31",
          progress: 80 + (seed % 15),
          status: "At Risk",
        },
      ],
    },
    training: [
      {
        title: "Advanced React Patterns",
        type: "Technical Upskilling",
        trainer: "Sanjay Rao",
        from: "2026-08-03",
        to: "2026-08-05",
        status: "Planned",
        score: "—",
      },
      {
        title: "POSH Awareness FY26",
        type: "POSH & Compliance",
        trainer: "Meera Suresh",
        from: "2026-07-15",
        to: "2026-07-15",
        status: "Completed",
        score: "Pass",
      },
      {
        title: "Enterprise Negotiation Lab",
        type: "Sales Enablement",
        trainer: "Aditya Menon",
        from: "2026-07-27",
        to: "2026-07-29",
        status: "Ongoing",
        score: "—",
      },
      {
        title: "Cloud Security Essentials",
        type: "Technical Upskilling",
        trainer: "Sanjay Rao",
        from: "2026-02-10",
        to: "2026-02-12",
        status: "Completed",
        score: "88%",
      },
    ],
    timeline: [
      {
        date: "2026-04-01",
        title: "Promotion",
        detail: `Promoted to ${e.role} (Grade ${["G3", "G4", "G5", "M1"][seed % 4]})`,
        kind: "promotion",
      },
      {
        date: "2025-10-12",
        title: "Spot Award",
        detail: "Recognised for the payments migration",
        kind: "award",
      },
      { date: "2025-03-20", title: "Transfer", detail: `Moved to ${e.branch}`, kind: "transfer" },
      {
        date: `202${(seed % 4) + 1}-0${(seed % 9) + 1}-0${(seed % 8) + 1}`,
        title: "Joined Seereon",
        detail: `Onboarded into ${e.dept}`,
        kind: "join",
      },
    ],
    assets: [
      {
        tag: `LAP-${3000 + seed}`,
        item: "MacBook Pro 14 M3",
        issued: "2024-01-08",
        condition: "Good",
      },
      { tag: `ACC-${900 + seed}`, item: "Access Card", issued: "2024-01-08", condition: "Active" },
      {
        tag: `MON-${500 + seed}`,
        item: 'Dell 27" Monitor',
        issued: "2024-02-14",
        condition: "Good",
      },
    ],
  };
}

const CTC = {
  "SRN-0001": 9600000,
  "SRN-0002": 7200000,
  "SRN-0003": 7000000,
  "SRN-0004": 4200000,
  "SRN-0005": 3600000,
  "SRN-0006": 2600000,
  "SRN-0007": 1500000,
  "SRN-0008": 1650000,
  "SRN-0142": 2400000,
  "SRN-0143": 1500000,
  "SRN-0144": 1680000,
  "SRN-0145": 1320000,
  "SRN-0146": 1800000,
  "SRN-0147": 2760000,
  "SRN-0148": 1440000,
  "SRN-0149": 3200000,
};

const CACHE = new Map();

export function getEmployeeProfile(empId) {
  const cached = CACHE.get(empId);
  if (cached) return cached;
  // Unknown ids (tenant admins, invited users without a directory row) used to fall back to EMPLOYEES[0] — the CEO —
  // so their profile / payroll tab showed the CEO's CTC, bank and statutory numbers. Build a neutral placeholder instead.
  const found = findEmployee(empId);
  const e = found ?? {
    id: empId,
    name: empId,
    email: "",
    phone: "",
    dept: "—",
    role: "—",
    branch: "—",
    status: "Active",
    orgId: "",
  };
  const seed = found
    ? (EMPLOYEES.indexOf(found) === -1
        ? extra.indexOf(found) + EMPLOYEES.length
        : EMPLOYEES.indexOf(found)) + 3
    : Array.from(empId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 97, 7) + 3;
  const p = buildProfile(e, extraCtc.get(e.id) ?? CTC[e.id] ?? 1200000, seed);
  const job = extraJob.get(e.id);
  if (job) {
    p.job = {
      ...p.job,
      dateOfJoining: job.doj,
      confirmationDate: "—",
      employmentType: `${job.employmentType} · On probation`,
      probationMonths: job.probationMonths,
      reportingManager: job.managerName || p.job.reportingManager,
    };
    p.personal = {
      ...p.personal,
      dob: job.dob || p.personal.dob,
      gender: job.gender || p.personal.gender,
    };
    p.timeline = [
      { date: job.doj, title: "Joined", detail: `Onboarded into ${e.dept}`, kind: "join" },
    ];
    p.experience = [];
    p.assets = [];
    p.documents = [];
    p.payroll.payslips = [];
    p.attendance = { ...p.attendance, monthly: [] };
  }
  const pd = extraPersonal.get(e.id);
  if (pd) {
    const keep = (o) =>
      Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== "" && v != null));
    p.personal = { ...p.personal, ...keep(pd.personal) };
    p.job = { ...p.job, ...keep(pd.job) };
    if (pd.education?.length) p.education = pd.education;
    if (pd.experience?.length) p.experience = pd.experience;
  }
  const rec = extraRecord.get(e.id);
  if (rec?.reportingManager) p.job = { ...p.job, reportingManager: rec.reportingManager };
  if (rec?.branch) p.job = { ...p.job, location: rec.branch };
  const st = extraStatutory.get(e.id);
  if (st) p.payroll = { ...p.payroll, statutory: { ...p.payroll.statutory, ...st } };
  const bank = extraBank.get(e.id);
  if (bank)
    p.payroll = {
      ...p.payroll,
      bank: {
        ...p.payroll.bank,
        ...bank,
        accountNo: bank.accountNo
          ? `XXXX XXXX ${bank.accountNo.slice(-4)}`
          : p.payroll.bank.accountNo,
      },
    };
  CACHE.set(empId, p);
  return p;
}

// New hires are provisioned (directory row + sign-in account) by hiring-data. Screens such as the login page never
// imported it, so after a reload a hired employee's account did not exist and "can sign in" failed. Every page that
// loads the directory now loads the hiring registry too (dynamic import — a static one would be a circular import).
if (typeof window !== "undefined") void import("@/features/recruitment/data/hiring-data");

export const CURRENT_EMPLOYEE_ID = "SRN-0006";
export const getCurrentEmployee = () =>
  EMPLOYEES.find((e) => e.id === CURRENT_EMPLOYEE_ID) ?? EMPLOYEES[0];
