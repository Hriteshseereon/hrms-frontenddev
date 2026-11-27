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

// Master Data is a single workspace with internal tabs. Keep tab ownership on the screen
// definition so role navigation and the workspace tab filter use the same catalog.
export const MASTER_DATA_TAB_BY_SCREEN = {
  "workspace-settings": "branding",
  department: "departments",
  designation: "designations",
  "department-grade": "deptgrades",
  category: "categories",
  "department-section": "sections",
  "doc-master": "docmaster",
  "employee-handbook": "handbook",
  "onboarding-document-master": "documents",
  "policies-circulars": "policies",
  "award-master": "awards",
  "job-types": "recmasters",
  "job-sources": "recmasters",
  "interview-types": "recmasters",
  "onboarding-checklists": "recmasters",
  "offer-letter-template": "recmasters",
  "interview-rounds-stages": "rounds",
  "job-locations": "locations",
  "assessment-evaluation-parameters": "assessparams",
  "shift-management": "shifts",
  "workday-configuration": "workday",
  "attendance-patterns-overrides": "patterns",
  "penalty-overtime-rules": "rules",
  "timesheet-formats": "timesheet",
  "holiday-calendars": "holidays",
  "leave-master-policy": "leavemaster",
  "pay-grades-bands": "paygrade",
  "salary-configuration": "salaryconfig",
  "statutory-configuration": "statutory",
  "state-policies": "states",
  "asset-master": "assetmaster",
  "termination-types": "termination",
  "warning-types": "warning",
};
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

/*
 * RBAC_MODULES is the single catalog behind the role permission screen. Grants for the signed-in user come from the
 * login / GET /me payload (assigned_modules + permissions); pages never hard-code roles for these actions.
 *
 * Adding something new:
 *  - New action on an existing tab: add the label to the screen's `actions` (e.g. "Archive"), then in the page
 *      const access = useScreenAccess("my-screen");   {access.can("Archive") && <Button …/>}
 *  - New tab: add a screen `{ key, name, actions }` to the module, then list it in the page's tabs:
 *      const tabs = useVisibleTabs([{ value: "mytab", screen: "my-screen" }, …]);
 *  - New module: add a module block here (plus its routes in module-routes.json / SCREEN_ROUTES in rbac-store.js).
 * The role screen, the API payload and the checks pick the new entries up automatically. In development, a check for a
 * screen or action that is missing here logs a "[permissions]" warning so it cannot be forgotten.
 */
export const RBAC_MODULES = [
  sidebarScreen("dashboard", "Dashboard", "org-dashboard", "Dashboard", "Dashboard", "home", ["View"]),
  {
    key: "master-data", name: "Master Data", sidebarLabel: "Master Data", section: "Overview",
    submodules: [
      { key: "organisation", name: "Organisation", screens: [
        { key: "workspace-settings", name: "Colours & Branding, Security & Notifications", actions: ["View", "Edit"] },
      ] },
      { key: "company-configuration", name: "Company Configuration", screens: [
        { key: "department", name: "Department", actions: ["Create", "View", "Edit","Delete", "Export","Bulk Upload"] },
        { key: "designation", name: "Designation", actions: ["Create", "View", "Edit","Delete", "Export","Bulk Upload"] },
        { key: "department-grade", name: "Department Grade", actions: ["Create", "View", "Edit","Delete", "Export","Bulk Upload"] },
        { key: "category", name: "Category", actions: ["Create", "View", "Edit","Delete", "Export","Bulk Upload"] },
        { key: "department-section", name: "Department Section", actions: ["Create", "View", "Edit","Delete", "Export","Bulk Upload"] },
      ] },
      { key: "documents", name: "Documents", screens: [
        { key: "doc-master", name: "Doc Master", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-handbook", name: "Employee Handbook", actions: ["Create", "View", "Edit", "Delete", "Export"] },
        { key: "onboarding-document-master", name: "Onboarding Document Master", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "policies-circulars", name: "Policies & Circulars", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "award-master", name: "Award Master", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
      ] },
      { key: "recruitment", name: "Recruitment", screens: [
        { key: "job-types", name: "Job Types", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "job-sources", name: "Candidate Sources", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "interview-types", name: "Interview Types", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "onboarding-checklists", name: "Onboarding Checklists", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "offer-letter-template", name: "Offer Letter Template", actions: ["Create", "View", "Edit"] },
        { key: "interview-rounds-stages", name: "Interview Rounds & Stages", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "job-locations", name: "Job Locations", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "assessment-evaluation-parameters", name: "Assessment & Evaluation Parameters", actions: ["Create", "View", "Edit", "Delete"] },
      ] },
      { key: "attendance-time", name: "Attendance & Time", screens: [
        { key: "shift-management", name: "Shift Management", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "workday-configuration", name: "Workday Configuration", actions: ["Create", "View", "Edit"] },
        { key: "attendance-patterns-overrides", name: "Attendance Patterns & Overrides", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "penalty-overtime-rules", name: "Penalty & Overtime Rules", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "timesheet-formats", name: "Timesheet Formats", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "holiday-calendars", name: "Holiday Calendars", actions: ["Create", "View", "Edit", "Delete", "Export", "Bulk Upload"] },
      ] },
      { key: "leave", name: "Leave", screens: [
        { key: "leave-master-policy", name: "Leave Master & Leave Policy", actions: ["Create", "View", "Edit", "Delete", "Bulk Upload"] },
      ] },
      { key: "payroll-statutory", name: "Payroll & Statutory", screens: [
        { key: "pay-grades-bands", name: "Pay Grades & Bands", actions: ["Create", "View", "Edit", "Delete", "Export", "Bulk Upload"] },
        { key: "salary-configuration", name: "Salary Configuration & Payroll", actions: ["Create","View", "Edit"] },
        { key: "statutory-configuration", name: "Statutory Configuration — PF, ESI", actions: ["Create", "View", "Edit"] },
        { key: "state-policies", name: "State Policies — PT, LWF, Minimum Wages", actions: ["View", "Edit"] },
      ] },
      { key: "assets", name: "Assets", screens: [
        { key: "asset-master", name: "Asset Master", actions: ["Create", "View", "Edit", "Delete","Print"] },
      ] },
      { key: "exit-cases-grievance", name: "Exit, Cases & Grievance", screens: [
        { key: "termination-types", name: "Termination Types", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
        { key: "warning-types", name: "Warning Types", actions: ["Create", "View", "Edit", "Delete","Export","Print"] },
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
        { key: "all-employees", name: "All Employees", actions: ["Create", "View", "Edit",  "Export", "Bulk Upload","Download"] },
        { key: "employee-promotions", name: "Promotions", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-transfers", name: "Transfers", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-resignations", name: "Resignations", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-terminations", name: "Terminations", actions: ["Create", "View", "Edit", "Approve"] },
        { key: "employee-warnings", name: "Warnings", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-complaints", name: "Complaints", actions: ["Create", "View", "Edit", "Delete", "Approve"] },
        { key: "employee-referrals", name: "Referrals", actions: ["Create", "View", "Edit", "Delete"] },
        { key: "employee-insurance", name: "Insurance", actions: ["Create", "View", "Edit", "Approve","Export"] },
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
          { key: "attendance-log", name: "Attendance", actions: [ "View", "Edit", "Export"] },
          { key: "attendance-report", name: "Attendance Report", actions: ["View", "Export"] },
          { key: "work-hours-overtime", name: "Work Hours & Overtime", actions: ["View", "Edit", "Approve", "Export"] },
          { key: "daily-wages", name: "Daily Wages", actions: ["View", "Create", "Edit", "Approve", "Export"] },
          { key: "attendance-payroll-lock", name: "Payroll Attendance Lock", actions: ["View", "Lock"] },
          { key: "attendance-work-orders", name: "Work Orders", actions: ["Create", "View", "Edit", "Delete", "Export"] },
        ],
      },
    ],
  },
  {
    key: "leave",
    name: "Leave & Comp-off",
    sidebarLabel: "Leave & Comp-off",
    section: "Time & Leave",
    submodules: [
      {
        key: "leave",
        name: "Leave & Comp-off",
        screens: [
          // `leave-requests` keeps its original key so roles saved before the per-tab split keep their grants.
          { key: "leave-requests", name: "Leave Applications", actions: ["View", "Approve", "Reject", "Export", "Print"] },
          { key: "leave-balances", name: "Balance Leave", actions: ["View", "Export"] },
          { key: "comp-off-approvals", name: "Comp-off", actions: ["View", "Approve", "Reject"] },
        ],
      },
    ],
  },
  sidebarScreen("tours", "Tours & Travel", "all-tours", "Tours & Travel", "Time & Leave", "tours", ["Create", "View", "Edit", "Approve", "Reject", "Dispatch", "Settle", "Close", "Export"]),
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
        { key: "payroll-run", name: "Payroll", actions: ["Create", "View", "Edit", "Approve", "Reject", "Process", "Publish", "Export", "Bulk Upload"] },
        { key: "payslips", name: "Payslips", actions: ["View", "Edit", "Export"] },
        { key: "loan-requests", name: "Employee Loans", actions: ["Create", "View", "Edit", "Approve", "Reject", "Process", "Export"] },
        { key: "wage-statutory-policy", name: "Wage & Statutory Policy", actions: ["View", "Edit"] },
      ],
    },
  ],
},
  sidebarScreen("payroll", "Claims & Insurance", "reimbursements", "Claims & Insurance", "Payroll & Finance", "claims", ["Create", "View", "Edit", "Approve", "Reject", "Export"]),
  sidebarScreen("workplace", "Projects & Assignments", "projects", "Projects & Assignments", "Projects & Tasks", "projects", ["Create", "View", "Edit", "Delete", "Export"]),
  sidebarScreen("workplace", "Tasks", "tasks", "Tasks", "Projects & Tasks", "work", ["Create", "View", "Edit", "Delete", "Approve", "Reject", "Export"]),
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
 * Flat index of every screen in RBAC_MODULES, keyed by full screen_code ("module.submodule.screen") and, when the
 * screen key is unique, by the bare screen key too. Pages ask for access with either form, so a new module / tab /
 * action only has to be added to RBAC_MODULES — no permission code needs changing.
 */
export const SCREEN_INDEX = (() => {
  const byCode = new Map();
  const byKey = new Map();
  for (const module of RBAC_MODULES) {
    for (const submodule of module.submodules) {
      for (const screen of submodule.screens) {
        const code = screenId(module.key, submodule.key, screen.key);
        const entry = { ...screen, code, moduleKey: module.key, submoduleKey: submodule.key, actions: actionsForScreen(screen) };
        byCode.set(code.toLowerCase(), entry);
        byKey.set(screen.key, byKey.has(screen.key) ? null : entry); // null = ambiguous key, use the full code
      }
    }
  }
  return { byCode, byKey };
})();

/** "payslips" or "payroll.finance.payslips" -> catalog entry (or null when the screen is not on the permission screen). */
export const findScreen = (screen) => {
  const value = String(screen ?? "").trim();
  if (!value) return null;
  return SCREEN_INDEX.byCode.get(value.toLowerCase()) ?? SCREEN_INDEX.byKey.get(value) ?? null;
};

/** Full screen_code for a bare key or full code; unknown values are returned unchanged. */
export const resolveScreenCode = (screen) => findScreen(screen)?.code ?? String(screen ?? "");

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
