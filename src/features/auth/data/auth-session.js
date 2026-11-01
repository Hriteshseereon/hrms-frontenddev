import { createPersistentStore } from "@/lib/persist";
// ---------------------------------------------------------------------------
// Seereon — UI-only organization, roles, users and permission model.
// Everything lives in memory/localStorage. No backend.
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from "react";

export const ORGANIZATION = {
  id: "ORG-SEEREON",
  name: "Seereon",
  legalName: "Seereon Consulting & IT Services Pvt. Ltd.",
  code: "SRN-001",
  hq: "Bhubaneswar HQ",
  domain: "seereon.co.in",
};

/**
 * @typedef {"SuperAdmin" | "Admin" | "BranchAdmin" | "CEO" | "COO" | "CFO" | "CTO" | "CHRO" | "HR" | "HOD" | "Manager" | "Employee"} AppRole
 */

export const ROLE_ORDER = [
  "SuperAdmin",
  "Admin",
  "BranchAdmin",
  "CEO",
  "COO",
  "CFO",
  "CTO",
  "CHRO",
  "HR",
  "HOD",
  "Manager",
  "Employee",
];

/**
 * @typedef {Object} AppUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {AppRole} role
 * @property {string} designation
 * @property {string} dept
 * @property {string} branch
 * @property {string} phone
 * @property {string | null} managerId
 * @property {string | null} [hrPartnerId] - HR Business Partner who owns this employee's HR approvals.
 * @property {string} doj
 * @property {string} [groupDoj] - First joining date anywhere in the company group — drives gratuity.
 * @property {string} orgId - Which Organization (legal entity, group-data.ts) this person's employment record belongs to.
 * @property {string} [groupId] - Company group (group-data.ts) — SuperAdmin scope; entity users inherit it from their org.
 * @property {string} [branchId] - Branch Admin only: the entity branch (group-data branch id) the account is locked to.
 * @property {"org" | "emp" | "app"} portal - Landing portal after sign-in: org/emp = client tenant portals; app = Seereon platform console (hidden).
 * @property {string} password - UI-only demo password.
 */

export const SEEREON_USERS = [
  {
    // Client-side SUPER ADMIN — head of the Seereon group of companies. Sees the whole group and can switch to any entity.
    id: "SRN-SUPER",
    name: "Group Administrator",
    email: "superadmin@seereon.co.in",
    role: "SuperAdmin",
    designation: "Group Super Administrator",
    dept: "IT & Systems",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10001",
    managerId: null,
    hrPartnerId: null,
    doj: "2019-04-01",
    orgId: ORGANIZATION.id,
    groupId: "GRP-001",
    portal: "org",
    password: "Super@123",
  },
  {
    id: "SRN-ADMIN",
    name: "Seereon Administrator",
    email: "admin@seereon.co.in",
    role: "Admin",
    designation: "Organization Administrator",
    dept: "IT & Systems",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10000",
    managerId: null,
    hrPartnerId: null,
    doj: "2019-04-01",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Admin@123",
  },
  {
    id: "SRN-0001",
    name: "Santosh Nayak",
    email: "santosh@seereon.co.in",
    role: "CEO",
    designation: "Chief Executive Officer",
    dept: "Executive",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10001",
    managerId: null,
    hrPartnerId: "SRN-0010",
    doj: "2019-04-01",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Ceo@123",
  },
  {
    id: "SRN-0002",
    name: "Saras Venkatesh",
    email: "saras@seereon.co.in",
    role: "CFO",
    designation: "Chief Financial Officer",
    dept: "Finance",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10002",
    managerId: "SRN-0001",
    hrPartnerId: "SRN-0010",
    doj: "2020-01-13",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Cfo@123",
  },
  {
    id: "SRN-0003",
    name: "Ashish Nayak",
    email: "ashish@seereon.co.in",
    role: "COO",
    designation: "Chief Operating Officer",
    dept: "Operations",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10003",
    managerId: "SRN-0001",
    hrPartnerId: "SRN-0010",
    doj: "2020-06-01",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Coo@123",
  },
  {
    id: "SRN-0009",
    name: "Vivek Raman",
    email: "vivek@seereon.co.in",
    role: "CTO",
    designation: "Chief Technology Officer",
    dept: "Technology",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10009",
    managerId: "SRN-0001",
    hrPartnerId: "SRN-0010",
    doj: "2019-09-02",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Cto@123",
  },
  {
    id: "SRN-0010",
    name: "Farah Khan",
    email: "farah@seereon.co.in",
    role: "CHRO",
    designation: "Chief Human Resources Officer",
    dept: "Human Resources",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10010",
    managerId: "SRN-0001",
    hrPartnerId: "SRN-0011",
    doj: "2020-02-17",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Chro@123",
  },
  {
    id: "SRN-0011",
    name: "Meera Iyer",
    email: "meera@seereon.co.in",
    role: "HR",
    designation: "Vice President — People Operations",
    dept: "Human Resources",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10011",
    managerId: "SRN-0010",
    hrPartnerId: "SRN-0011",
    doj: "2020-07-06",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Hrvp@123",
  },
  {
    id: "SRN-0004",
    name: "Varen Mishra",
    email: "varen@seereon.co.in",
    role: "HR",
    designation: "Head of Human Resources",
    dept: "Human Resources",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10004",
    managerId: "SRN-0011",
    hrPartnerId: "SRN-0011",
    doj: "2021-02-15",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Hr@123",
  },
  {
    id: "SRN-0012",
    name: "Ritu Bansal",
    email: "ritu@seereon.co.in",
    role: "HR",
    designation: "HR Business Partner — Engineering",
    dept: "Human Resources",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10012",
    managerId: "SRN-0004",
    hrPartnerId: "SRN-0004",
    doj: "2021-11-22",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Ritu@123",
  },
  {
    id: "SRN-0013",
    name: "Aditya Verma",
    email: "aditya@seereon.co.in",
    role: "HR",
    designation: "HR Business Partner — Operations & Sales",
    dept: "Human Resources",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10013",
    managerId: "SRN-0004",
    hrPartnerId: "SRN-0004",
    doj: "2022-01-10",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Aditya@123",
  },
  {
    id: "SRN-0005",
    name: "Subh Sahoo",
    email: "subh@seereon.co.in",
    role: "Manager",
    designation: "Engineering Manager",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10005",
    managerId: "SRN-0009",
    hrPartnerId: "SRN-0012",
    doj: "2021-08-09",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Manager@123",
  },
  {
    id: "SRN-0006",
    name: "Subham Das",
    email: "subham@seereon.co.in",
    role: "Employee",
    designation: "Senior Software Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10006",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0012",
    doj: "2022-03-21",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Employee@123",
  },
  {
    id: "SRN-0007",
    name: "Neha Kulkarni",
    email: "neha@seereon.co.in",
    role: "Employee",
    designation: "QA Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10007",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0012",
    doj: "2022-11-07",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Neha@123",
  },
  {
    id: "SRN-0008",
    name: "Rakesh Menon",
    email: "rakesh@seereon.co.in",
    role: "Employee",
    designation: "Data Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10008",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0012",
    doj: "2023-05-02",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Rakesh@123",
  },
  {
    id: "SRN-0014",
    name: "Ishita Bose",
    email: "ishita@seereon.co.in",
    role: "Employee",
    designation: "Software Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10014",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0012",
    doj: "2024-09-20",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Ishita@123",
  },
  {
    id: "SRN-0015",
    name: "Aravind Krishnan",
    email: "aravind@seereon.co.in",
    role: "Employee",
    designation: "DevOps Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10015",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0013",
    doj: "2024-09-09",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Aravind@123",
  },
  {
    id: "SRN-0016",
    name: "Tanvi Joshi",
    email: "tanvi@seereon.co.in",
    role: "Employee",
    designation: "Frontend Engineer",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10016",
    managerId: "SRN-0005",
    hrPartnerId: "SRN-0012",
    doj: "2025-09-18",
    orgId: ORGANIZATION.id,
    portal: "emp",
    password: "Tanvi@123",
  },
  {
    id: "SRN-0017",
    name: "Kiran Shetty",
    email: "kiran@seereon.co.in",
    role: "HOD",
    designation: "Head of Department — Operations",
    dept: "Operations",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 10017",
    managerId: "SRN-0003",
    hrPartnerId: "SRN-0013",
    doj: "2021-05-10",
    groupDoj: "2015-07-01",
    orgId: ORGANIZATION.id,
    portal: "org",
    password: "Hod@123",
  },
  // ----- Seereon SAP Practice (ORG-1042) -----
  {
    id: "SRN-2001",
    name: "Devraj Solanki",
    email: "devraj.solanki@sap.seereon.co.in",
    role: "HOD",
    designation: "Head of Department — SAP Delivery",
    dept: "SAP Delivery",
    branch: "Hyderabad Office",
    phone: "+91 98450 20001",
    managerId: null,
    hrPartnerId: "SRN-2003",
    doj: "2018-03-14",
    groupDoj: "2015-11-01",
    orgId: "ORG-1042",
    portal: "org",
    password: "Devraj@123",
  },
  {
    id: "SRN-2002",
    name: "Falguni Rathore",
    email: "falguni.rathore@sap.seereon.co.in",
    role: "HR",
    designation: "HR Business Partner",
    dept: "Human Resources",
    branch: "Hyderabad Office",
    phone: "+91 98450 20002",
    managerId: "SRN-2001",
    hrPartnerId: "SRN-2002",
    doj: "2019-06-01",
    orgId: "ORG-1042",
    portal: "org",
    password: "Falguni@123",
  },
  {
    id: "SRN-2003",
    name: "Manjeet Bhati",
    email: "manjeet.bhati@sap.seereon.co.in",
    role: "Employee",
    designation: "SAP ABAP Consultant",
    dept: "SAP Delivery",
    branch: "Hyderabad Office",
    phone: "+91 98450 20003",
    managerId: "SRN-2001",
    hrPartnerId: "SRN-2002",
    doj: "2020-09-12",
    orgId: "ORG-1042",
    portal: "emp",
    password: "Manjeet@123",
  },
  // ----- Seereon Cloud Services (ORG-1043) -----
  {
    id: "SRN-2101",
    name: "Ritesh Barman",
    email: "ritesh.barman@cloud.seereon.co.in",
    role: "HOD",
    designation: "Head of Department — Cloud & DevOps",
    dept: "Cloud & DevOps",
    branch: "Pune Office",
    phone: "+91 98450 21001",
    managerId: null,
    hrPartnerId: "SRN-2103",
    doj: "2017-08-20",
    groupDoj: "2017-08-20",
    orgId: "ORG-1043",
    portal: "org",
    password: "Ritesh@123",
  },
  {
    id: "SRN-2102",
    name: "Pallavi Chatterjee",
    email: "pallavi.chatterjee@cloud.seereon.co.in",
    role: "Manager",
    designation: "DevOps Lead",
    dept: "Cloud & DevOps",
    branch: "Pune Office",
    phone: "+91 98450 21002",
    managerId: "SRN-2101",
    hrPartnerId: "SRN-2103",
    doj: "2019-02-11",
    orgId: "ORG-1043",
    portal: "org",
    password: "Pallavi@123",
  },
  {
    id: "SRN-2103",
    name: "Soumen Ghosh",
    email: "soumen.ghosh@cloud.seereon.co.in",
    role: "Employee",
    designation: "Cloud Support Lead (Night)",
    dept: "Cloud & DevOps",
    branch: "Pune Office",
    phone: "+91 98450 21003",
    managerId: "SRN-2102",
    hrPartnerId: "SRN-2103",
    doj: "2021-04-05",
    orgId: "ORG-1043",
    portal: "emp",
    password: "Soumen@123",
  },
  // ----- Seereon Products (ORG-1044) -----
  {
    id: "SRN-2201",
    name: "Yashodhara Naik",
    email: "yashodhara.naik@products.seereon.co.in",
    role: "HOD",
    designation: "Head of Department — Product Engineering",
    dept: "Product Engineering",
    branch: "Kolkata Office",
    phone: "+91 98450 22001",
    managerId: null,
    hrPartnerId: "SRN-2202",
    doj: "2018-01-09",
    groupDoj: "2018-01-09",
    orgId: "ORG-1044",
    portal: "org",
    password: "Yashodhara@123",
  },
  {
    id: "SRN-2202",
    name: "Biraja Mohanty",
    email: "biraja.mohanty@products.seereon.co.in",
    role: "Employee",
    designation: "QA Automation Engineer",
    dept: "Product Engineering",
    branch: "Kolkata Office",
    phone: "+91 98450 22002",
    managerId: "SRN-2201",
    hrPartnerId: "SRN-2202",
    doj: "2022-07-18",
    orgId: "ORG-1044",
    portal: "emp",
    password: "Biraja@123",
  },
];

/** Entity administrators of the other companies in the Seereon group (Admin login, scoped to their company). */
SEEREON_USERS.push(
  {
    id: "SRN-ADMIN-1042",
    name: "Prakash Mishra",
    email: "admin@sap.seereon.co.in",
    role: "Admin",
    designation: "Entity Administrator",
    dept: "IT & Systems",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 20000",
    managerId: null,
    hrPartnerId: null,
    doj: "2021-06-01",
    orgId: "ORG-1042",
    groupId: "GRP-001",
    portal: "org",
    password: "Admin@123",
  },
  {
    id: "SRN-ADMIN-1043",
    name: "Ankita Sahu",
    email: "admin@cloud.seereon.co.in",
    role: "Admin",
    designation: "Entity Administrator",
    dept: "IT & Systems",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 30000",
    managerId: null,
    hrPartnerId: null,
    doj: "2022-01-10",
    orgId: "ORG-1043",
    groupId: "GRP-001",
    portal: "org",
    password: "Admin@123",
  },
  {
    id: "SRN-ADMIN-1044",
    name: "Rohan Das",
    email: "admin@products.seereon.co.in",
    role: "Admin",
    designation: "Entity Administrator",
    dept: "IT & Systems",
    branch: "Bhubaneswar HQ",
    phone: "+91 98450 40000",
    managerId: null,
    hrPartnerId: null,
    doj: "2022-08-01",
    orgId: "ORG-1044",
    groupId: "GRP-001",
    portal: "org",
    password: "Admin@123",
  },
  // Branch Admin demo — runs the Pune branch of Seereon Consulting & IT Services only.
  {
    id: "SRN-BA-PUNE",
    name: "Nikhil Deshpande",
    email: "pune.admin@seereon.co.in",
    role: "BranchAdmin",
    designation: "Branch Administrator — Pune",
    dept: "Administration",
    branch: "Pune",
    branchId: "ORG-SEEREON-BR-02",
    phone: "+91 98220 11223",
    managerId: null,
    hrPartnerId: null,
    doj: "2023-02-01",
    orgId: "ORG-SEEREON",
    groupId: "GRP-001",
    portal: "org",
    password: "Branch@123",
  },
);

/** HR Business Partners selectable when creating an employee. */
export const HR_PARTNERS = SEEREON_USERS.filter((u) => u.role === "HR" || u.role === "CHRO");

/** Organization ID typed on both login screens. */
export const ORG_ID = ORGANIZATION.code;

export const ADMIN_USER = SEEREON_USERS.find((u) => u.role === "Admin");
export const SUPER_ADMIN_USER = SEEREON_USERS.find((u) => u.role === "SuperAdmin");

/** Everyone except the administrators signs in through the employee login. */
export const PORTAL_USERS = SEEREON_USERS.filter(
  (u) => u.role !== "Admin" && u.role !== "SuperAdmin",
);

/** Users provisioned at runtime (new hires, tenant super-admins) — getters registered by their modules to avoid circular imports. */
const extraGetters = [];
export const registerExtraUsers = (getter) => {
  if (!extraGetters.includes(getter)) extraGetters.push(getter);
};
/**
 * Login-account overrides that follow HR movements — e.g. an inter-company transfer confirmed by Seereon moves the person's login to the destination company (orgId / branch / designation), so they sign in there from then on.
 * @typedef {Partial<Pick<AppUser, "orgId" | "branch" | "designation" | "dept" | "managerId" | "groupId">>} AccountPatch
 */
export const accountOverrideStore = createPersistentStore("seereon.auth.account-overrides.v1", {});
export const moveUserAccount = (userId, patch) =>
  accountOverrideStore.set((p) => ({ ...p, [userId]: { ...(p[userId] ?? {}), ...patch } }));
const withOverride = (u) => {
  const o = accountOverrideStore.get()[u.id];
  return o ? { ...u, ...o } : u;
};
export const allUsers = () =>
  [...SEEREON_USERS, ...extraGetters.flatMap((g) => g())].map(withOverride);

export const userByLogin = (identifier) => {
  const key = identifier.trim().toLowerCase();
  return (
    allUsers().find((u) => u.email.toLowerCase() === key || u.id.toLowerCase() === key) ?? null
  );
};

export const userById = (id) => allUsers().find((u) => u.id === id) ?? null;

// Runtime accounts (invited users, new hires, tenant admins) are included — the seeded roster alone missed them.
export const userByEmail = (email) =>
  allUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null;

/** Direct reports of a user. */
export const reportsOf = (id) => allUsers().filter((u) => u.managerId === id);

/** Everyone whose HR approvals this HR partner owns. */
export const partnerOf = (id) => allUsers().filter((u) => u.hrPartnerId === id);

/** Reporting chain from a user up to the CEO. */
export function chainUp(id) {
  const out = [];
  let cur = userById(id);
  let guard = 0;
  while (cur && guard++ < 12) {
    out.push(cur);
    cur = userById(cur.managerId);
  }
  return out;
}

export const roleInitials = (name) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ------------------------------------------------------------------ */
/* Navigation permissions — route path is the permission key           */
/* ------------------------------------------------------------------ */

const COMMON_ORG = [
  "/org/dashboard",
  "/org/announcements",
  "/org/support",
  "/org/holidays",
  "/org/exits",
  "/org/grievances",
  "/org/tours",
];

const RECRUITMENT = [
  "/org/recruitment",
  "/org/recruitment/masters",
  "/org/recruitment/locations",
  "/org/recruitment/postings",
  "/org/recruitment/candidates",
  "/org/recruitment/assessments",
  "/org/recruitment/rounds",
  "/org/recruitment/interviews",
  "/org/recruitment/offers",
];

const FINANCE = [
  "/org/finance",
  "/org/tax",
  "/org/claims",
  "/org/expenditure",
  "/org/reports",
  "/org/compliance",
];

const HR_FULL = [
  "/org/notifications",
  "/org/approvals",
  "/org/infrastructure",
  "/org/masters",
  "/org/settings",
  "/org/employees",
  "/org/team",
  "/org/roles",
  "/org/users",
  "/org/tasks",
  "/org/projects",
  "/org/delegation",
  "/org/attendance",
  "/org/leave",
  "/org/timesheets",
  "/org/performance",
  "/org/goals",
  "/org/training",
  "/org/archive",
  "/org/assets",
];

const PAYROLL_REPORTS = ["/org/payroll-reports"];

/** Group structure + cross-entity asset rollup — org-admin / CXO scope. */
const GROUP_ADMIN = ["/org/groups", "/org/asset-rollup"];

/** Screens an HOD owns: their department's people, approvals and assets. */
const HOD_NAV = [
  "/org/notifications",
  "/org/dashboard",
  "/org/announcements",
  "/org/support",
  "/org/holidays",
  "/org/exits",
  "/org/grievances",
  "/org/tours",
  "/org/team",
  "/org/employees",
  "/org/attendance",
  "/org/leave",
  "/org/timesheets",
  "/org/tasks",
  "/org/projects",
  "/org/goals",
  "/org/performance",
  "/org/training",
  "/org/assets",
  "/org/reports",
];

/** Branch Admin — runs the people operations of one branch; payroll, statutory, masters and roles stay with the company. */
const BRANCH_ADMIN_NAV = [
  "/org/dashboard",
  "/org/announcements",
  "/org/notifications",
  "/org/support",
  "/org/holidays",
  "/org/employees",
  "/org/team",
  "/org/attendance",
  "/org/leave",
  "/org/timesheets",
  "/org/tours",
  "/org/exits",
  "/org/grievances",
  "/org/assets",
  "/org/tasks",
  "/org/projects",
  "/org/training",
  "/org/reports",
];

/** `"*"` grants every screen. */
export const ROLE_NAV = {
  SuperAdmin: "*",
  Admin: "*",
  BranchAdmin: BRANCH_ADMIN_NAV,
  CEO: "*",
  // Operations command centre — no finance, payroll, recruitment or platform config.
  COO: [
    ...COMMON_ORG,
    "/org/infrastructure",
    "/org/masters",
    "/org/employees",
    "/org/tasks",
    "/org/projects",
    "/org/delegation",
    "/org/attendance",
    "/org/leave",
    "/org/timesheets",
    "/org/performance",
    "/org/goals",
    "/org/training",
    "/org/reports",
    "/org/archive",
  ],
  // Finance office — money, compliance and finance clearance on exits only.
  CFO: ["/org/asset-rollup", ...COMMON_ORG, ...FINANCE, ...PAYROLL_REPORTS, "/org/archive"],
  // Technology office — delivery, projects and engineering people operations.
  CTO: [
    ...COMMON_ORG,
    "/org/masters",
    "/org/employees",
    "/org/team",
    "/org/tasks",
    "/org/projects",
    "/org/attendance",
    "/org/leave",
    "/org/timesheets",
    "/org/infrastructure",
    "/org/performance",
    "/org/goals",
    "/org/training",
    "/org/reports",
  ],
  // People office — everything HR can do, plus reports and archive oversight.
  CHRO: [...GROUP_ADMIN, ...COMMON_ORG, ...RECRUITMENT, ...FINANCE, ...PAYROLL_REPORTS, ...HR_FULL],
  HR: [...COMMON_ORG, ...RECRUITMENT, ...FINANCE, ...PAYROLL_REPORTS, ...HR_FULL],
  // Head of Department — owns their department's people, approvals and assets.
  HOD: HOD_NAV,
  // Managers work through "My Team" and their own projects. No platform
  // administration: no masters, settings, infrastructure or approval engine.
  Manager: [
    "/org/dashboard",
    "/org/announcements",
    "/org/support",
    "/org/holidays",
    "/org/exits",
    "/org/tours",
    "/org/team",
    "/org/tasks",
    "/org/projects",
    "/org/attendance",
    "/org/leave",
    "/org/timesheets",
    "/org/performance",
    "/org/goals",
    "/org/training",
    "/org/reports",
  ],
  Employee: [],
};

/** Employee-portal screens each role can open. */
const EMP_COMMON = [
  "/emp/dashboard",
  "/emp/profile",
  "/emp/attendance",
  "/emp/leave",
  "/emp/payroll",
  "/emp/payslips",
  "/emp/loans",
  "/emp/handbook",
  "/emp/reports",
  "/emp/ytd",
  "/emp/it-statement",
  "/emp/it-declaration",
  "/emp/timesheets",
  "/emp/reimbursements",
  "/emp/tax",
  "/emp/tasks",
  "/emp/projects",
  "/emp/goals",
  "/emp/training",
  "/emp/support",
  "/emp/notices",
  "/emp/holidays",
  "/emp/movements",
  "/emp/referrals",
  "/emp/complaints",
  "/emp/grievances",
  "/emp/resignation",
  "/emp/assets",
  "/emp/tours",
  "/emp/appraisals",
];

export const ROLE_EMP_NAV = {
  SuperAdmin: [...EMP_COMMON, "/emp/reviews"],
  Admin: [...EMP_COMMON, "/emp/reviews"],
  BranchAdmin: [...EMP_COMMON, "/emp/reviews"],
  CEO: [...EMP_COMMON, "/emp/reviews"],
  COO: [...EMP_COMMON, "/emp/reviews"],
  CFO: [...EMP_COMMON, "/emp/reviews"],
  CTO: [...EMP_COMMON, "/emp/reviews"],
  CHRO: [...EMP_COMMON, "/emp/reviews"],
  HR: [...EMP_COMMON, "/emp/reviews"],
  HOD: [...EMP_COMMON, "/emp/reviews"],
  Manager: [...EMP_COMMON, "/emp/reviews"],
  Employee: EMP_COMMON,
};

/* ------------------------------------------------------------------ */
/* Access gates — registered by the tenancy layer (avoids a circular   */
/* import). They add the organisation's entitlements (Seereon ceiling  */
/* + the Super Admin's configuration) and the read-only collective     */
/* view on top of the role checks below.                               */
/* ------------------------------------------------------------------ */
let accessGate = { screen: () => true, action: () => true };
export const registerAccessGate = (gate) => {
  accessGate = { ...accessGate, ...gate };
};

/** Custom RBAC roles widen navigation beyond the built-in role matrix (registered by rbac-store). */
const navExtensions = [];
export const registerNavExtension = (fn) => {
  if (!navExtensions.includes(fn)) navExtensions.push(fn);
};
const extensionGrants = (pathname) =>
  navExtensions.some((fn) => {
    try {
      return fn(getCurrentUser(), pathname);
    } catch {
      return false;
    }
  });

export function canOpen(role, path) {
  if (path.startsWith("/helpdesk")) return accessGate.screen(path, role); // service desk is open to every signed-in user
  const roleOk = path.startsWith("/emp")
    ? (ROLE_EMP_NAV[role] ?? []).includes(path)
    : ROLE_NAV[role] === "*" || (ROLE_NAV[role] ?? []).includes(path) || extensionGrants(path);
  return roleOk && accessGate.screen(path, role);
}

/* ------------------------------------------------------------------ */
/* Action permissions                                                  */
/* ------------------------------------------------------------------ */

export const ACTIONS = [
  "exit.submit",
  "exit.manager.decide",
  "exit.hr.clearance",
  "exit.hr.approve",
  "exit.notice.configure",
  "exit.complete",
  "exit.viewAll",
  "finance.manage",
  "payroll.manage",
  "employee.manage",
  "role.manage",
  "recruitment.manage",
  "performance.manage",
  "task.assign",
  "goal.create",
  "asset.manage",
  "asset.issue",
  "asset.request",
  "asset.approve",
  "department.manage",
  "group.manage",
  "tour.submit",
  "tour.hod.decide",
  "tour.hr.decide",
  "tour.finance.decide",
  "tour.viewAll",
  "compoff.redeem",
  "compoff.hod.decide",
  "compoff.viewAll",
  // Payroll run workflow (maker–checker) and statutory filings
  "payroll.run",
  "payroll.approve",
  "payroll.process",
  "attendance.lock",
  "statutory.configure",
  "filing.generate",
  "filing.verify",
  "filing.approve",
  "filing.file",
  "contribution.approve",
  "announcement.manage",
];
/**
 * @typedef {(typeof ACTIONS)[number]} ActionKey
 */

export const ROLE_ACTIONS = {
  SuperAdmin: "*",
  Admin: "*",
  BranchAdmin: [
    "announcement.manage",
    "exit.submit",
    "exit.manager.decide",
    "exit.viewAll",
    "employee.manage",
    "task.assign",
    "goal.create",
    "asset.request",
    "asset.approve",
    "asset.issue",
    "tour.submit",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.viewAll",
  ],
  CEO: "*",
  COO: [
    "exit.submit",
    "exit.manager.decide",
    "exit.viewAll",
    "employee.manage",
    "performance.manage",
    "task.assign",
    "goal.create",
    "role.manage",
    "asset.request",
    "asset.approve",
    "tour.submit",
    "tour.hod.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.hod.decide",
    "compoff.viewAll",
    "attendance.lock",
  ],
  CFO: [
    "exit.submit",
    "exit.hr.clearance",
    "exit.viewAll",
    "finance.manage",
    "payroll.manage",
    "asset.request",
    "tour.submit",
    "tour.finance.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.viewAll",
    "payroll.approve",
    "payroll.process",
    "statutory.configure",
    "filing.generate",
    "filing.approve",
    "filing.file",
  ],
  CTO: [
    "exit.submit",
    "exit.manager.decide",
    "exit.viewAll",
    "employee.manage",
    "performance.manage",
    "task.assign",
    "goal.create",
    "asset.request",
    "asset.approve",
    "tour.submit",
    "tour.hod.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.hod.decide",
    "compoff.viewAll",
  ],
  CHRO: [
    "announcement.manage",
    "exit.submit",
    "exit.hr.clearance",
    "exit.hr.approve",
    "exit.notice.configure",
    "exit.complete",
    "exit.viewAll",
    "employee.manage",
    "recruitment.manage",
    "performance.manage",
    "payroll.manage",
    "finance.manage",
    "task.assign",
    "goal.create",
    "role.manage",
    "asset.manage",
    "asset.issue",
    "asset.request",
    "asset.approve",
    "department.manage",
    "tour.submit",
    "tour.hr.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.viewAll",
    "payroll.run",
    "payroll.approve",
    "payroll.process",
    "attendance.lock",
    "statutory.configure",
    "filing.generate",
    "filing.verify",
    "filing.approve",
    "filing.file",
    "contribution.approve",
  ],
  HR: [
    "announcement.manage",
    "exit.submit",
    "exit.hr.clearance",
    "exit.hr.approve",
    "exit.notice.configure",
    "exit.complete",
    "exit.viewAll",
    "employee.manage",
    "recruitment.manage",
    "performance.manage",
    "payroll.manage",
    "finance.manage",
    "task.assign",
    "goal.create",
    "asset.manage",
    "asset.issue",
    "asset.request",
    "asset.approve",
    "department.manage",
    "tour.submit",
    "tour.hr.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.viewAll",
    "payroll.run",
    "payroll.process",
    "attendance.lock",
    "filing.generate",
    "filing.verify",
    "filing.file",
    "contribution.approve",
  ],
  HOD: [
    "exit.submit",
    "exit.manager.decide",
    "exit.viewAll",
    "task.assign",
    "goal.create",
    "performance.manage",
    "employee.manage",
    "asset.request",
    "asset.approve",
    "tour.submit",
    "tour.hod.decide",
    "tour.viewAll",
    "compoff.redeem",
    "compoff.hod.decide",
    "compoff.viewAll",
  ],
  Manager: [
    "exit.submit",
    "exit.manager.decide",
    "task.assign",
    "goal.create",
    "performance.manage",
    "asset.request",
    "tour.submit",
    "compoff.redeem",
  ],
  Employee: ["exit.submit", "goal.create", "asset.request", "tour.submit", "compoff.redeem"],
};

/**
 * Access roles a person may give a new hire. The hire dialog offered CHRO / CFO / COO / CTO to anyone who could open it,
 * so a Branch Admin or HR could create a login more powerful than their own.
 */
const HIRE_ALL = ["Employee", "Manager", "HOD", "HR", "CTO", "CFO", "COO", "CHRO"];
export function hireableRoles(actorRole) {
  if (["SuperAdmin", "Admin", "CEO", "CHRO"].includes(actorRole)) return HIRE_ALL;
  if (actorRole === "BranchAdmin") return ["Employee", "Manager", "HOD"];
  return ["Employee", "Manager", "HOD", "HR"];
}

export function can(role, action) {
  const list = ROLE_ACTIONS[role] ?? [];
  const roleOk = list === "*" ? true : list.includes(action);
  return roleOk && accessGate.action(action, role);
}

/** Module-level CRUD matrix shown on the Roles & Permissions screen. */
export const ROLE_SUMMARY = {
  SuperAdmin: {
    description:
      "Group super administrator — the client's head of the company group. Collective dashboard across every entity, can switch into any single company, creates entities, branches and roles.",
    scope: "Whole group · All entities · All modules",
  },
  Admin: {
    description:
      "Company administrator — full control of one company: its branches, masters, people, payroll and configuration.",
    scope: "One company · All branches · Administration",
  },
  BranchAdmin: {
    description:
      "Branch administrator — runs the people operations of one branch: employees, attendance, leave, tours, assets and branch reporting.",
    scope: "One branch · People operations",
  },
  CEO: {
    description: "Unrestricted access to every module, screen and action across Seereon.",
    scope: "All modules · All permissions",
  },
  COO: {
    description: "Operations command — master data, people operations, resignations and approvals.",
    scope: "Operations · HR · Exits · Approvals",
  },
  CFO: {
    description: "Full control of finance, payroll, tax, claims and exit finance clearance.",
    scope: "Finance · Payroll · Tax · Claims",
  },
  CTO: {
    description:
      "Technology office — delivery, projects, engineering people operations and technical reviews.",
    scope: "Projects · Engineering · Performance",
  },
  CHRO: {
    description: "People office — owns the full HR charter, policy, hiring and the exit process.",
    scope: "All HR modules · Recruitment · Exits",
  },
  HR: {
    description: "End-to-end HR ownership from org setup to exit, payroll, appraisals and hiring.",
    scope: "All HR modules · Exit process · Recruitment",
  },
  HOD: {
    description:
      "Head of Department — owns the department's people, approvals (tours, comp-off, appraisals, asset requests) and departmental reporting.",
    scope: "My department · Approvals · Assets",
  },
  Manager: {
    description: "Team oversight — reviews, goals, tasks, approvals and team resignations.",
    scope: "My team · Reviews · Tasks · Resignations",
  },
  Employee: {
    description: "Self-service — profile, tasks, goals, appraisal requests and resignation.",
    scope: "Self-service only",
  },
};

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

const KEY = "seereon.session.user";
const API_USER_KEY = "seereon.session.api-user";
let apiUser = null;
if (typeof window !== "undefined") {
  try {
    const stored = JSON.parse(window.localStorage.getItem(API_USER_KEY) ?? "null");
    const hasToken =
      window.localStorage.getItem("super_admin_access_token") ||
      window.localStorage.getItem("access_token");
    if (stored?.id && hasToken) apiUser = stored;
  } catch {
    // Ignore an invalid saved profile and require a fresh sign-in.
  }
}
registerExtraUsers(() => apiUser ? [apiUser] : []);
const DEFAULT_ID = "SRN-0004";
/** Server-render / signed-out identity (Varen Mishra, HR) — the same person DEFAULT_ID points at. */
const DEFAULT_USER = SEEREON_USERS.find((u) => u.id === DEFAULT_ID) ?? SEEREON_USERS[0];

let currentId = DEFAULT_ID;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

let signedIn = false;
if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(KEY);
  if (stored) {
    currentId = stored;
    signedIn = true;
  } // validated lazily by userById (runtime users register after this module loads)
}

/* Self-service password changes (UI-only): stored per user id in localStorage. */
const PW_KEY = "seereon.session.passwords";
const readPw = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PW_KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writePw = (map) => {
  if (typeof window !== "undefined") window.localStorage.setItem(PW_KEY, JSON.stringify(map));
};
/** Modules that track "must change password" flags (rbac-store logins, tenant credentials) subscribe here — avoids circular imports. */
const pwListeners = [];
export const registerPasswordChanged = (fn) => {
  if (!pwListeners.includes(fn)) pwListeners.push(fn);
};
const notifyPasswordChanged = (userId) => pwListeners.forEach((f) => f(userId));
export const effectivePassword = (u) => readPw()[u.id] ?? u.password;
/**
 * Password rules — the defaults, replaced by the company's saved sign-in policy (Users & Logins → Sign-in policy, registered by rbac-store).
 * @typedef {Object} PasswordRules
 * @property {number} minLen
 * @property {boolean} upper
 * @property {boolean} number
 * @property {boolean} symbol
 */
const DEFAULT_PASSWORD_RULES = { minLen: 8, upper: true, number: true, symbol: true };
let passwordRules = () => DEFAULT_PASSWORD_RULES;
export const registerPasswordRules = (fn) => {
  passwordRules = fn;
};
export const currentPasswordRules = () => {
  try {
    return { ...DEFAULT_PASSWORD_RULES, ...passwordRules() };
  } catch {
    return DEFAULT_PASSWORD_RULES;
  }
};
/** Human-readable summary of the active password rules. */
export const passwordRulesText = (r = currentPasswordRules()) => {
  const parts = [
    r.upper && "an uppercase letter",
    r.number && "a number",
    r.symbol && "a symbol",
  ].filter(Boolean);
  return `at least ${Math.max(6, r.minLen)} characters${parts.length ? ` with ${parts.join(parts.length > 2 ? ", " : " and ").replace(/, (?=[^,]*$)/, " and ")}` : ""}`;
};
/** Password policy shared by self-service change, forgot-password reset and admin reset (follows the saved sign-in policy). */
export const passwordPolicyError = (next) => {
  const r = currentPasswordRules();
  const bad =
    next.length < Math.max(6, r.minLen) ||
    (r.upper && !/[A-Z]/.test(next)) ||
    (r.number && !/[0-9]/.test(next)) ||
    (r.symbol && !/[^A-Za-z0-9]/.test(next));
  return bad ? `Use ${passwordRulesText(r)}.` : null;
};
export function changePassword(userId, current, next) {
  const u = userById(userId);
  if (!u) return { ok: false, message: "User not found." };
  if (current !== effectivePassword(u))
    return { ok: false, message: "Current password is incorrect." };
  const policy = passwordPolicyError(next);
  if (policy) return { ok: false, message: policy };
  if (next === current)
    return { ok: false, message: "New password must differ from the current one." };
  writePw({ ...readPw(), [userId]: next });
  notifyPasswordChanged(userId);
  return { ok: true, message: "Password updated — use it from your next sign-in." };
}
/** Sets a user's sign-in password without knowing the current one (forgot-password OTP flow, admin temporary password). */
export function setPassword(userId, next, opts = {}) {
  const u = userById(userId);
  if (!u) return { ok: false, message: "User not found." };
  const policy = passwordPolicyError(next);
  if (policy) return { ok: false, message: policy };
  writePw({ ...readPw(), [userId]: next });
  if (opts.userChosen) notifyPasswordChanged(userId); // a temporary password issued by an admin keeps the "must change" flag
  return { ok: true, message: "Password updated — use it from your next sign-in." };
}
/** Drops a stored override so the user's base password (e.g. a freshly issued temporary one) applies again. */
export function clearPasswordOverride(userId) {
  const map = readPw();
  if (!(userId in map)) return;
  delete map[userId];
  writePw(map);
}

/* Forgot-password flow (UI-only): an OTP "e-mailed" to the account is kept in the browser for 5 minutes. */
const RESET_KEY = "seereon.session.reset";
/**
 * @typedef {Object} PasswordResetRequest
 * @property {string} userId
 * @property {string} email
 * @property {string} otp
 * @property {number} expiresAt
 */
export const pendingPasswordReset = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(RESET_KEY) ?? "null");
  } catch {
    return null;
  }
};
export function requestPasswordReset(identifier) {
  const u = identifier.trim() ? userByLogin(identifier) : null;
  if (!u) return { ok: false, message: "No account matches that e-mail / user ID." };
  const request = {
    userId: u.id,
    email: u.email,
    otp: String(Math.floor(100000 + Math.random() * 900000)),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  if (typeof window !== "undefined")
    window.localStorage.setItem(RESET_KEY, JSON.stringify(request));
  return { ok: true, message: `Verification code sent to ${u.email}`, request };
}
export function completePasswordReset(otp, next) {
  const req = pendingPasswordReset();
  if (!req)
    return { ok: false, message: "No reset request found — start again from Forgot password." };
  if (Date.now() > req.expiresAt)
    return { ok: false, message: "The verification code has expired — request a new one." };
  if (otp.trim() !== req.otp) return { ok: false, message: "Incorrect verification code." };
  const r = setPassword(req.userId, next, { userChosen: true });
  if (!r.ok) return r;
  if (typeof window !== "undefined") window.localStorage.removeItem(RESET_KEY);
  return { ok: true, message: "Password reset — sign in with your new password." };
}

/** Tenant scope hooks (set by group-data to avoid a circular import): entity lock for Admin / Employee, group view for SuperAdmin. */
let onSignInScope = () => {};
export const registerSignInScope = (fn) => {
  onSignInScope = fn;
};

export function signIn(identifier, password) {
  const match = userByLogin(identifier);
  if (!match) return null;
  if ((password ?? "") !== effectivePassword(match)) return null;
  currentId = match.id;
  signedIn = true;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, match.id);
  onSignInScope(match);
  emit();
  return match;
}

export function signInAs(id) {
  const match = userById(id);
  if (!match) return null;
  currentId = match.id;
  signedIn = true;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, match.id);
  onSignInScope(match);
  emit();
  return match;
}

/** Bridge the backend identity into the session used by portal guards and permissions. */
export function signInFromBackend(user) {
  if (!user?.id || !user.email) {
    throw new Error("Login response did not contain a valid user identity.");
  }

  const roleMap = {
    SUPER_ADMIN: "SuperAdmin",
    COMPANY_ADMIN: "Admin",
    BRANCH_ADMIN: "BranchAdmin",
    EMPLOYEE: "Employee",
  };

  const appRole = roleMap[user.role] || user.role || "Admin";

  apiUser = {
    id: user.id, // users-table ID
    email: user.email,
    name: user.full_name || user.name || user.email,
    role: appRole,
    backendRole: user.role,
    orgId: user.organization_id || ORGANIZATION.id,
    companyId: user.company_id || null,
    branchId: user.branch_id || null,
    portal: appRole === "Employee" ? "emp" : "org",
    designation: user.role ? String(user.role).replace(/_/g, " ") : "Administrator",
    dept: "",
    branch: "",
    phone: "",
    managerId: null,
    doj: "",
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(API_USER_KEY, JSON.stringify(apiUser));
  }
  return signInAs(apiUser.id);
}

export function signInSuperAdmin(user) {
  return signInFromBackend(user);
}

export function signOut() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(API_USER_KEY);
    window.localStorage.removeItem("super_admin_access_token");
    window.localStorage.removeItem("super_admin_refresh_token");
  }
  apiUser = null;
  currentId = DEFAULT_ID;
  signedIn = false;
  emit();
}

/**
 * Whether someone is actually signed in in this browser. Signing out used to fall back to the default identity
 * (Varen Mishra, HR), so /org/* and /emp/* stayed fully usable with HR permissions after "Sign out" or on a fresh
 * browser. The portal shells use this to send signed-out visitors to /login (server render assumes signed in so the
 * markup matches; the redirect happens right after hydration).
 */
export const isSignedIn = () => signedIn;
const noopSubscribe = () => () => {};
/**
 * false on the server and during the hydration render, true afterwards. The session lives in localStorage, so the
 * server can only render the default identity (Varen Mishra, HR): every portal page was first painted with HR's sidebar
 * and data — or "Access restricted" for screens outside HR's scope — before switching to the real user.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
export function useIsSignedIn() {
  return useSyncExternalStore(
    subscribe,
    () => signedIn,
    () => true,
  );
}

const subscribe = (cb) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

export function useCurrentUser() {
  const id = useSyncExternalStore(
    subscribe,
    () => currentId,
    () => DEFAULT_ID,
  );
  return userById(id) ?? DEFAULT_USER;
}

/** Non-reactive read, for stores and event handlers. */
export const getCurrentUser = () => userById(currentId) ?? DEFAULT_USER;

/** Prefix-aware permission check for the current pathname (handles child routes). */
export function canOpenPath(role, pathname) {
  const match = (list) => list.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (pathname.startsWith("/helpdesk")) return accessGate.screen(pathname, role); // open to every signed-in user (mirrors canOpen)
  const nav = ROLE_NAV[role];
  const roleOk = pathname.startsWith("/emp")
    ? match(ROLE_EMP_NAV[role] ?? [])
    : nav === "*" || match(nav ?? []) || extensionGrants(pathname);
  return roleOk && accessGate.screen(pathname, role);
}

/** Session change listeners (tenancy layer re-resolves the data namespace when the signed-in user changes). */
export const onSessionChange = (fn) => subscribe(fn);

export { usePermission, Can } from "@/features/auth/hooks/usePermission";
