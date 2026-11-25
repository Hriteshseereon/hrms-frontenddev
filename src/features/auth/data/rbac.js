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
 * @property {string} [sidebarLabel]
 * @property {SubmoduleDef[]} submodules
 */

export const PERMISSION_ACTIONS = ["View", "Edit", "Delete"];
/**
 * @typedef {(typeof PERMISSION_ACTIONS)[number]} PermissionAction
 */

// The role matrix currently grants access at the same level as the visible organization sidebar.
const sidebarScreen = (moduleKey, moduleName, screenKey, screenName, section, submoduleKey) => ({
  key: moduleKey,
  name: moduleName,
  ...(section ? { section } : {}),
  submodules: [
    {
      key: submoduleKey,
      name: moduleName,
      screens: [{ key: screenKey, name: screenName }],
    },
  ],
});

export const RBAC_MODULES = [
  sidebarScreen("overview", "Overview", "org-dashboard", "Dashboard", "Overview", "home"),
  sidebarScreen("master-data", "Master Data", "masters", "Master Data", "Overview", "master-data"),
  sidebarScreen("employee", "People", "all-employees", "Employees", "People", "directory"),
  {
    key: "attendance",
    name: "Attendance & Shifts",
    sidebarLabel: "Attendance & Shifts",
    section: "Time & Leave",
    submodules: [
      {
        key: "daily",
        name: "Attendance & Shifts",
        screens: [
          { key: "attendance-log", name: "Attendance" },
          { key: "attendance-report", name: "Attendance Report" },
          { key: "work-hours-overtime", name: "Work Hours & Overtime" },
          { key: "daily-wages", name: "Daily Wages" },
          { key: "attendance-payroll-lock", name: "Payroll Attendance Lock" },
          { key: "attendance-work-orders", name: "Work Orders" },
        ],
      },
    ],
  },
  sidebarScreen("leave", "Leave & Comp-off", "leave-requests", "Leave & Comp-off", "Time & Leave", "leave"),
  sidebarScreen("tours", "Tours & Travel", "all-tours", "Tours & Travel", "Time & Leave", "tours"),
{
  key: "payroll",
  name: "Payroll, Payslips & Loans",
  sidebarLabel: "Payroll, Payslips & Loans",
  section: "Payroll & Finance",
  submodules: [
    {
      key: "finance",
      name: "Payroll, Payslips & Loans",
      screens: [
        { key: "payroll-run", name: "Payroll" },
        { key: "payslips", name: "Payslips" },
        { key: "loan-requests", name: "Employee Loans" },
        { key: "wage-statutory-policy", name: "Wage & Statutory Policy" },
      ],
    },
  ],
},
  sidebarScreen("payroll", "Claims & Insurance", "reimbursements", "Claims & Insurance", "Payroll & Finance", "claims"),
  sidebarScreen("workplace", "Projects & Assignments", "projects", "Projects & Assignments", "Projects & Tasks", "projects"),
  sidebarScreen("workplace", "Tasks", "tasks", "Tasks", "Projects & Tasks", "work"),
  // sidebarScreen("workspace", "My Self-Service", "my-dashboard", "My Self-Service", "My Workspace", "self-service"),
  // sidebarScreen("workspace", "My Team", "my-team", "My Team", "My Workspace", "team"),
  // sidebarScreen("workspace", "My Attendance", "my-attendance", "My Attendance", "My Workspace", "attendance"),
  // sidebarScreen("workspace", "My Leave", "my-leave", "My Leave", "My Workspace", "leave"),
  // sidebarScreen("workspace", "My Payslips", "my-payslips", "My Payslips", "My Workspace", "payslips"),
  // sidebarScreen("workspace", "Employee Handbook", "employee-handbook", "Employee Handbook", "My Workspace", "handbook"),
  // sidebarScreen("workspace", "My Helpdesk Tickets", "my-helpdesk-tickets", "My Helpdesk Tickets", "My Workspace", "helpdesk"),
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

export const ORG_USERS = [];

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
