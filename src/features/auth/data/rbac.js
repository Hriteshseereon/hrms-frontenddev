/**
 * @typedef {Object} ScreenDef
 * @property {string} key
 * @property {string} name
 */
/**
 * @typedef {Object} SubmoduleDef
 * @property {string} key
 * @property {string} name
 * @property {ScreenDef[]} screens
 */
/**
 * @typedef {Object} RbacModuleDef
 * @property {string} key
 * @property {string} name
 * @property {SubmoduleDef[]} submodules
 */

export const PERMISSION_ACTIONS = ["View", "Edit", "Delete"];
/**
 * @typedef {(typeof PERMISSION_ACTIONS)[number]} PermissionAction
 */

export const RBAC_MODULES = [
  {
    key: "overview",
    name: "Overview",
    submodules: [
      {
        key: "home",
        name: "Dashboards",
        screens: [
          { key: "org-dashboard", name: "Organization Dashboard" },
          { key: "reports", name: "Reports" },
        ],
      },
    ],
  },
  {
    key: "employee",
    name: "Employee Management",
    submodules: [
      {
        key: "directory",
        name: "Directory",
        screens: [
          { key: "all-employees", name: "All Employees" },
          { key: "employee-profile", name: "Employee Profile" },
          { key: "add-employee", name: "Add Employee" },
        ],
      },
      {
        key: "movements",
        name: "Movements",
        screens: [
          { key: "promotions", name: "Promotions" },
          { key: "transfers", name: "Transfers" },
          { key: "resignations", name: "Resignations" },
          { key: "terminations", name: "Terminations" },
        ],
      },
      {
        key: "cases",
        name: "Cases",
        screens: [
          { key: "warnings", name: "Warnings" },
          { key: "complaints", name: "Complaints" },
          { key: "referrals", name: "Referrals" },
        ],
      },
      {
        key: "documents",
        name: "Documents",
        screens: [
          { key: "employee-docs", name: "Employee Documents" },
          { key: "letters", name: "Letters & Templates" },
          { key: "insurance", name: "Employee Insurance" },
        ],
      },
    ],
  },
  {
    key: "attendance",
    name: "Attendance",
    submodules: [
      {
        key: "daily",
        name: "Daily Attendance",
        screens: [
          { key: "attendance-log", name: "Attendance Log" },
          { key: "regularization", name: "Regularization Requests" },
          { key: "work-hours", name: "Work Hours & Overtime" },
          { key: "penalties", name: "Penalty Configuration" },
        ],
      },
      {
        key: "shifts",
        name: "Shifts & Roster",
        screens: [
          { key: "shift-master", name: "Shift Master" },
          { key: "roster", name: "Roster Planner" },
        ],
      },
    ],
  },
  {
    key: "leave",
    name: "Leave Management",
    submodules: [
      {
        key: "requests",
        name: "Requests",
        screens: [
          { key: "leave-requests", name: "Leave Requests" },
          { key: "leave-approvals", name: "Leave Approvals" },
          { key: "leave-balance", name: "Leave Balance" },
        ],
      },
      {
        key: "config",
        name: "Configuration",
        screens: [
          { key: "leave-types", name: "Leave Types" },
          { key: "holiday-calendar", name: "Holiday Calendar" },
        ],
      },
    ],
  },
  {
    key: "timesheet",
    name: "Timesheets",
    submodules: [
      {
        key: "entries",
        name: "Entries",
        screens: [
          { key: "timesheet-log", name: "Timesheet Log" },
          { key: "timesheet-approvals", name: "Timesheet Approvals" },
        ],
      },
      {
        key: "config",
        name: "Configuration",
        screens: [{ key: "timesheet-formats", name: "Timesheet Formats" }],
      },
    ],
  },
  {
    key: "payroll",
    name: "Finance & Payroll",
    submodules: [
      {
        key: "run",
        name: "Payroll Run",
        screens: [
          { key: "salary-structure", name: "Salary Structure" },
          { key: "payroll-run", name: "Process Payroll" },
          { key: "payslips", name: "Payslips" },
        ],
      },
      {
        key: "loans",
        name: "Loans & Advances",
        screens: [
          { key: "loan-requests", name: "Loan Requests" },
          { key: "repayments", name: "Repayment Schedule" },
        ],
      },
      {
        key: "claims",
        name: "Claims & Reimbursements",
        screens: [
          { key: "reimbursements", name: "Reimbursements" },
          { key: "insurance-claims", name: "Insurance Claims" },
        ],
      },
    ],
  },
  {
    key: "recruitment",
    name: "Recruitment",
    submodules: [
      {
        key: "pipeline",
        name: "Pipeline",
        screens: [
          { key: "recruitment-pipeline", name: "Hiring Pipeline" },
          { key: "job-postings", name: "Job Postings" },
          { key: "job-locations", name: "Job Locations" },
        ],
      },
      {
        key: "candidates",
        name: "Candidates",
        screens: [
          { key: "candidate-list", name: "Candidates" },
          { key: "assessments", name: "Assessments" },
          { key: "interviews", name: "Interviews" },
          { key: "offers", name: "Offer Letters" },
        ],
      },
      {
        key: "recruitment-masters",
        name: "Recruitment Masters",
        screens: [
          { key: "rounds", name: "Interview Rounds" },
          { key: "recruitment-config", name: "Recruitment Configuration" },
        ],
      },
    ],
  },
  {
    key: "performance",
    name: "Performance",
    submodules: [
      {
        key: "reviews",
        name: "Reviews",
        screens: [
          { key: "review-cycles", name: "Review Cycles" },
          { key: "employee-reviews", name: "Employee Reviews" },
          { key: "appraisals", name: "Appraisals" },
        ],
      },
      {
        key: "indicators",
        name: "Indicators",
        screens: [
          { key: "perf-indicators", name: "Performance Indicators" },
          { key: "indicator-categories", name: "Indicator Categories" },
          { key: "goal-types", name: "Goal Types" },
        ],
      },
    ],
  },
  {
    key: "training",
    name: "Training",
    submodules: [
      {
        key: "programs",
        name: "Programs",
        screens: [
          { key: "trainings", name: "Trainings" },
          { key: "training-types", name: "Training Types" },
          { key: "trainers", name: "Trainers" },
        ],
      },
    ],
  },
  {
    key: "workplace",
    name: "Workplace",
    submodules: [
      {
        key: "grievance",
        name: "Grievance",
        screens: [
          { key: "complaints", name: "Complaints" },
          { key: "support-tickets", name: "Support Tickets" },
        ],
      },
      {
        key: "comms",
        name: "Communication",
        screens: [
          { key: "announcements", name: "Announcements" },
          { key: "policies", name: "Policies & Docs" },
        ],
      },
      { key: "work", name: "Work Management", screens: [{ key: "tasks", name: "Tasks" }] },
    ],
  },
  {
    key: "configuration",
    name: "Configuration",
    submodules: [
      {
        key: "org-setup",
        name: "Organization Setup",
        screens: [
          { key: "infrastructure", name: "Infrastructure" },
          { key: "masters", name: "Masters" },
          { key: "templates", name: "Document Templates" },
          { key: "settings", name: "Settings" },
        ],
      },
      {
        key: "access",
        name: "Access Control",
        screens: [
          { key: "users", name: "Users" },
          { key: "roles", name: "Roles & Permissions" },
          { key: "temporary-access", name: "Temporary Access" },
        ],
      },
    ],
  },
  {
    key: "assets",
    name: "Assets",
    submodules: [
      {
        key: "register",
        name: "Asset Register",
        screens: [
          { key: "asset-register", name: "Asset Register" },
          { key: "asset-licenses", name: "Licenses & Renewals" },
        ],
      },
      {
        key: "issuance",
        name: "Issuance",
        screens: [
          { key: "asset-issuance", name: "Issuance & Returns" },
          { key: "asset-transfers", name: "Transfers & Handover" },
        ],
      },
      {
        key: "requests",
        name: "Requests",
        screens: [
          { key: "asset-requests", name: "Asset Requests" },
          { key: "my-assets", name: "My Assets (Self-Service)" },
        ],
      },
    ],
  },
  {
    key: "tours",
    name: "Tours",
    submodules: [
      {
        key: "requests",
        name: "Requests",
        screens: [
          { key: "my-tours", name: "My Tours (Self-Service)" },
          { key: "all-tours", name: "All Tours" },
        ],
      },
      {
        key: "approvals",
        name: "Approvals",
        screens: [{ key: "tour-approvals", name: "Tour Approvals (HOD/HR/Finance)" }],
      },
    ],
  },
];

/**
 * @typedef {Record<PermissionAction, boolean>} ScreenPermissions
 */
/**
 * screenId -> permissions. screenId = `${moduleKey}.${submoduleKey}.${screenKey}`
 * @typedef {Record<string, ScreenPermissions>} PermissionSelection
 */

export const screenId = (m, s, sc) => `${m}.${s}.${sc}`;

/**
 * @typedef {Object} RoleRecord
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} users
 * @property {number} screens
 * @property {"Active" | "Draft"} status
 * @property {string} updated
 */

export const ROLES = [
  {
    id: "ROL-01",
    name: "Organization Admin",
    description: "Full access to every module and setting.",
    users: 2,
    screens: 26,
    status: "Active",
    updated: "2026-07-12",
  },
  {
    id: "ROL-02",
    name: "HR Manager",
    description: "Manage employees, leave, attendance and policies.",
    users: 5,
    screens: 18,
    status: "Active",
    updated: "2026-07-08",
  },
  {
    id: "ROL-03",
    name: "Payroll Admin",
    description: "Process payroll, payslips and statutory filings.",
    users: 3,
    screens: 9,
    status: "Active",
    updated: "2026-06-30",
  },
  {
    id: "ROL-04",
    name: "Recruiter",
    description: "Manage job openings, candidates and interviews.",
    users: 4,
    screens: 7,
    status: "Active",
    updated: "2026-06-22",
  },
  {
    id: "ROL-05",
    name: "Reporting Manager",
    description: "View team, approve leave and attendance.",
    users: 24,
    screens: 6,
    status: "Active",
    updated: "2026-05-19",
  },
  {
    id: "ROL-06",
    name: "Employee Self-Service",
    description: "Self-service for own attendance, leave and payslips.",
    users: 448,
    screens: 5,
    status: "Draft",
    updated: "2026-05-02",
  },
];

/* ---------------- Multi-branch role assignment ---------------- */

/**
 * @typedef {Object} BranchRoleAssignment
 * @property {string} branchId - branch id from ALL_MANAGED_BRANCHES
 * @property {string[]} roles
 */

/**
 * @typedef {Object} OrgUserRecord
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {"Active" | "Invited" | "Suspended"} status
 * @property {BranchRoleAssignment[]} assignments
 */

export const ORG_USERS = [
  {
    id: "USR-01",
    name: "Seereon Administrator",
    email: "admin@seereon.co.in",
    status: "Active",
    assignments: [
      { branchId: "Bhubaneswar HQ::Whitefield", roles: ["Organization Admin"] },
      { branchId: "Mumbai::BKC", roles: ["Organization Admin"] },
      { branchId: "Pune::Hinjewadi", roles: ["Organization Admin"] },
    ],
  },
  {
    id: "USR-02",
    name: "Priya Nair",
    email: "priya.n@seereon.co.in",
    status: "Active",
    assignments: [
      { branchId: "Bhubaneswar HQ::Whitefield", roles: ["HR Manager", "Reporting Manager"] },
      { branchId: "Bhubaneswar HQ::Koramangala", roles: ["HR Manager"] },
    ],
  },
  {
    id: "USR-03",
    name: "Aditya Singh",
    email: "aditya.s@seereon.co.in",
    status: "Active",
    assignments: [
      { branchId: "Mumbai::BKC", roles: ["Payroll Admin"] },
      { branchId: "Chennai::OMR", roles: ["Payroll Admin"] },
    ],
  },
  {
    id: "USR-04",
    name: "Neha Verma",
    email: "neha.v@seereon.co.in",
    status: "Invited",
    assignments: [{ branchId: "Pune::Hinjewadi", roles: ["Recruiter"] }],
  },
  {
    id: "USR-05",
    name: "Karan Bhatia",
    email: "karan.b@seereon.co.in",
    status: "Active",
    assignments: [{ branchId: "Chennai::OMR", roles: ["Reporting Manager", "Recruiter"] }],
  },
];

/* ---------------- Role → permission presets (UI-only) ---------------- */

/** Module-level permissions granted by each role, used by the user detail view. */
export const ROLE_PERMISSION_PRESETS = {
  "Organization Admin": Object.fromEntries(
    RBAC_MODULES.map((m) => [m.key, ["View", "Edit", "Delete"]]),
  ),
  "HR Manager": {
    employee: ["View", "Edit"],
    attendance: ["View", "Edit"],
    leave: ["View", "Edit"],
    payroll: ["View"],
    workplace: ["View", "Edit"],
    configuration: ["View"],
  },
  "Payroll Admin": {
    employee: ["View"],
    attendance: ["View"],
    leave: ["View"],
    payroll: ["View", "Edit", "Delete"],
    workplace: ["View"],
    configuration: ["View"],
  },
  Recruiter: { employee: ["View", "Edit"], workplace: ["View"] },
  "Asset Manager": { assets: ["View", "Edit", "Delete"], employee: ["View"] },
  "Reporting Manager": {
    employee: ["View"],
    attendance: ["View", "Edit"],
    leave: ["View", "Edit"],
  },
  "Employee Self-Service": {
    employee: ["View"],
    attendance: ["View"],
    leave: ["View"],
    payroll: ["View"],
    assets: ["View"],
    tours: ["View", "Edit"],
  },
  "Head of Department": {
    employee: ["View"],
    attendance: ["View", "Edit"],
    leave: ["View", "Edit"],
    assets: ["View", "Edit"],
    tours: ["View", "Edit"],
  },
};

export const moduleName = (key) => RBAC_MODULES.find((m) => m.key === key)?.name ?? key;

/** Merge the permissions of several roles into one module → actions map. */
export function mergeRolePermissions(roles) {
  const out = {};
  roles.forEach((r) => {
    Object.entries(ROLE_PERMISSION_PRESETS[r] ?? {}).forEach(([mod, actions]) => {
      out[mod] = out[mod] ?? new Set();
      actions.forEach((a) => out[mod].add(a));
    });
  });
  return Object.entries(out).map(([mod, set]) => ({
    module: moduleName(mod),
    actions: PERMISSION_ACTIONS.filter((a) => set.has(a)),
  }));
}
