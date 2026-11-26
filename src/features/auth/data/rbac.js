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
{
  key: "employee",
  name: "Employees",
  sidebarLabel: "Employees",
  section: "People",
  submodules: [
    {
      key: "employee-management",
      name: "Employee Management",
      screens: [
        { key: "all-employees", name: "All Employees" },
        // { key: "add-employee", name: "Add Employee" },
        // { key: "employee-bulk-upload", name: "Bulk Upload" },
        // { key: "employee-export", name: "Export Employees" },
        { key: "employee-promotions", name: "Promotions" },
        { key: "employee-transfers", name: "Transfers" },
        { key: "employee-resignations", name: "Resignations" },
        { key: "employee-terminations", name: "Terminations" },
        { key: "employee-warnings", name: "Warnings" },
        { key: "employee-complaints", name: "Complaints" },
        { key: "employee-referrals", name: "Referrals" },
        { key: "employee-insurance", name: "Insurance" },
        { key: "employee-retirement", name: "Retirement" },
      ],
    },
  ],
}, 
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
