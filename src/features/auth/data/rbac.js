/**
 * @typedef {Object} ScreenDef
 * @property {string} key
 * @property {string} name
 * @property {PermissionAction[]} [actions]
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

// Preferred display order of the common actions. It is NOT the list of allowed actions: a screen may offer any
// action name in its `actions` array (e.g. "Reject", "Retain", "Re-hire") and it is picked up automatically —
// see PERMISSION_ACTIONS below RBAC_MODULES. The backend stores whatever action names are sent.
const COMMON_ACTIONS = ["Create", "View", "Edit", "Delete", "Export", "Import", "Bulk Upload", "Approve", "Reject"];
export const DEFAULT_SCREEN_ACTIONS = ["View"];
export const actionsForScreen = (screen) => screen.actions ?? DEFAULT_SCREEN_ACTIONS;
/**
 * @typedef {(typeof PERMISSION_ACTIONS)[number]} PermissionAction
 */

// The role matrix currently grants access at the same level as the visible organization sidebar.
const sidebarScreen = (moduleKey, moduleName, screenKey, screenName, section, submoduleKey, actions = ["View"]) => ({
  key: moduleKey,
  name: moduleName,
  ...(section ? { section } : {}),
  submodules: [
    {
      key: submoduleKey,
      name: moduleName,
      screens: [{ key: screenKey, name: screenName, actions }],
    },
  ],
});

export const RBAC_MODULES = [
  sidebarScreen("overview", "Overview", "org-dashboard", "Dashboard", "Overview", "home", ["View"]),
  {
    key: "master-data", name: "Master Data", sidebarLabel: "Master Data", section: "Overview",
    submodules: [
      { key: "organisation", name: "Organisation", screens: [
        { key: "workspace-settings", name: "Colours & Branding, Security & Notifications", actions: ["View", "Edit"] },
      ] },
      { key: "company-configuration", name: "Company Configuration", screens: [
        { key: "department", name: "Department", actions: ["Create", "View", "Delete", "Export"] },
        { key: "designation", name: "Designation", actions: ["View"] },
        { key: "department-grade", name: "Department Grade", actions: ["Create", "View", "Edit", "Delete", "Export"] },
        { key: "category", name: "Category", actions: ["Create", "View", "Edit", "Delete", "Export"] },
        { key: "department-section", name: "Department Section", actions: ["Create", "View", "Edit", "Delete", "Export"] },
      ] },
      { key: "documents", name: "Documents", screens: [
        { key: "doc-master", name: "Doc Master", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-handbook", name: "Employee Handbook", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "onboarding-document-master", name: "Onboarding Document Master", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "policies-circulars", name: "Policies & Circulars", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "award-master", name: "Award Master", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
      { key: "recruitment", name: "Recruitment", screens: [
        { key: "job-types", name: "Job Types", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "job-sources", name: "Job Sources", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "interview-rounds-stages", name: "Interview Rounds & Stages", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "job-locations", name: "Job Locations", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "assessment-evaluation-parameters", name: "Assessment & Evaluation Parameters", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
      { key: "attendance-time", name: "Attendance & Time", screens: [
        { key: "shift-management", name: "Shift Management", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "workday-configuration", name: "Workday Configuration", actions: ["View", "Edit"] },
        { key: "attendance-patterns-overrides", name: "Attendance Patterns & Overrides", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "penalty-overtime-rules", name: "Penalty & Overtime Rules", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "timesheet-formats", name: "Timesheet Formats", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "holiday-calendars", name: "Holiday Calendars", actions: ["Create", "View", "Edit", "Delete", "Export", "Bulk Upload"] },
      ] },
      { key: "leave", name: "Leave", screens: [
        { key: "leave-master-policy", name: "Leave Master & Leave Policy", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
      { key: "payroll-statutory", name: "Payroll & Statutory", screens: [
        { key: "pay-grades-bands", name: "Pay Grades & Bands", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "salary-configuration", name: "Salary Configuration & Payroll", actions: ["View", "Edit"] },
        { key: "statutory-configuration", name: "Statutory Configuration — PF, ESI", actions: ["View", "Edit"] },
        { key: "state-policies", name: "State Policies — PT, LWF, Minimum Wages", actions: ["View", "Edit"] },
      ] },
      { key: "assets", name: "Assets", screens: [
        { key: "asset-master", name: "Asset Master", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
      { key: "exit-cases-grievance", name: "Exit, Cases & Grievance", screens: [
        { key: "termination-types", name: "Termination Types", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "warning-types", name: "Warning Types", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
    ],
  },
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
        { key: "all-employees", name: "All Employees", actions: ["Create", "View", "Edit", "Delete", "Export", "Bulk Upload"] },
        { key: "employee-promotions", name: "Promotions", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-transfers", name: "Transfers", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-resignations", name: "Resignations", actions: ["View", "Edit", "Approve"] },
        { key: "employee-terminations", name: "Terminations", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-warnings", name: "Warnings", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-complaints", name: "Complaints", actions: ["Create", "View", "Edit", "Delete", "Approve"] },
        { key: "employee-referrals", name: "Referrals", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-insurance", name: "Insurance", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-retirement", name: "Retirement", actions: ["View", "Edit", "Approve"] },
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
          { key: "attendance-log", name: "Attendance", actions: ["Create", "View", "Edit", "Delete", "Bulk Upload"] },
          { key: "attendance-report", name: "Attendance Report", actions: ["View", "Export"] },
          { key: "work-hours-overtime", name: "Work Hours & Overtime", actions: ["View", "Edit", "Approve", "Export"] },
          { key: "daily-wages", name: "Daily Wages", actions: ["View", "Edit", "Approve", "Export"] },
          { key: "attendance-payroll-lock", name: "Payroll Attendance Lock", actions: ["View", "Edit"] },
          { key: "attendance-work-orders", name: "Work Orders", actions: ["Create", "View", "Edit", "Delete"] },
        ],
      },
    ],
  },
  sidebarScreen("leave", "Leave & Comp-off", "leave-requests", "Leave & Comp-off", "Time & Leave", "leave", ["Create", "View", "Edit", "Approve"]),
  sidebarScreen("tours", "Tours & Travel", "all-tours", "Tours & Travel", "Time & Leave", "tours", ["Create", "View", "Edit", "Approve", "Export"]),
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
        { key: "payroll-run", name: "Payroll", actions: ["Create", "View", "Edit", "Approve", "Export"] },
        { key: "payslips", name: "Payslips", actions: ["View", "Export"] },
        { key: "loan-requests", name: "Employee Loans", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "wage-statutory-policy", name: "Wage & Statutory Policy", actions: ["View", "Edit"] },
      ],
    },
  ],
},
  sidebarScreen("payroll", "Claims & Insurance", "reimbursements", "Claims & Insurance", "Payroll & Finance", "claims", ["Create", "View", "Edit", "Approve", "Export"]),
  sidebarScreen("workplace", "Projects & Assignments", "projects", "Projects & Assignments", "Projects & Tasks", "projects", ["Create", "View", "Edit", "Delete"]),
  sidebarScreen("workplace", "Tasks", "tasks", "Tasks", "Projects & Tasks", "work", ["Create", "View", "Edit", "Delete", "Approve"]),
];

/**
 * Every action some screen offers, derived from RBAC_MODULES: adding a new action name to any screen's `actions`
 * is all it takes for the role wizard, the permission matrix and the API payload to carry it.
 */
const USED_ACTIONS = new Set(
  RBAC_MODULES.flatMap((m) => m.submodules.flatMap((s) => s.screens.flatMap((sc) => actionsForScreen(sc)))),
);
export const PERMISSION_ACTIONS = [
  ...COMMON_ACTIONS.filter((action) => USED_ACTIONS.has(action)),
  ...[...USED_ACTIONS].filter((action) => !COMMON_ACTIONS.includes(action)),
];

/** "Bulk Upload" -> "bulk_upload": the action part of a permission string, same rule as the backend. */
export const actionSlug = (action) =>
  String(action ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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
