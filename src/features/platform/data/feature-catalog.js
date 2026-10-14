// ---------------------------------------------------------------------------
// Feature catalog — the one tree every configuration screen and every access check reads.
//
//   Module  →  Sub-module (a screen / route)  →  Feature (a tab on that screen)
//                                             →  Action (a guarded operation: approve payroll, lock attendance …)
//
// Keys:   m:<module>   s:<route>   t:<route>#<tab>   a:<action>
//
// The Super Admin picks the organisation's modules in Organisation Setup and can switch anything inside that
// selection off — organisation-wide, per company or per branch — in Configuration. A key is available only when it
// and every ancestor are on at every layer. Screens and tabs are read from the code by
// tools/gen-feature-catalog.mjs, so the tree always matches what the product really renders.
// ---------------------------------------------------------------------------
import { SCREEN_TABS } from "@/features/platform/data/feature-tabs.generated";

/**
 * @typedef {Object} CatalogModule
 * @property {string} key
 * @property {string} name
 * @property {string} description
 * @property {boolean} [locked] - Always on (sign-in, dashboard, configuration) — cannot be switched off.
 * @property {{ route: string, name: string, locked?: boolean }[]} screens
 * @property {string[]} actions
 */

/** @type {CatalogModule[]} */
export const CATALOG_MODULES = [
  {
    key: "core",
    name: "Core platform",
    description:
      "Dashboard, master data, announcements, administration, approvals and self-service essentials.",
    locked: true,
    screens: [
      { route: "/org/dashboard", name: "Dashboard", locked: true },
      { route: "/org/masters", name: "Master Data" },
      { route: "/org/announcements", name: "Announcements" },
      { route: "/org/notifications", name: "Notification Centre" },
      { route: "/org/approvals", name: "Approval engine" },
      { route: "/org/infrastructure", name: "Infrastructure" },
      { route: "/org/holidays", name: "Holiday calendar" },
      { route: "/org/roles", name: "Roles & Permissions", locked: true },
      { route: "/org/users", name: "Users & Logins", locked: true },
      { route: "/org/delegation", name: "Role Delegation" },
      { route: "/org/archive", name: "System Archive & Soft Delete" },
      { route: "/org/settings", name: "Settings", locked: true },
      { route: "/org/configuration", name: "Configuration", locked: true },
      { route: "/org/organisation-setup", name: "Organisation Setup", locked: true },
      { route: "/org/groups", name: "Entities & Branches", locked: true },
      { route: "/emp/dashboard", name: "My self-service", locked: true },
      { route: "/emp/profile", name: "My profile", locked: true },
      { route: "/emp/notices", name: "My notices" },
      { route: "/emp/holidays", name: "My holidays" },
      { route: "/emp/handbook", name: "Employee handbook" },
      { route: "/emp/reports", name: "My reports" },
    ],
    actions: ["role.manage", "department.manage", "group.manage", "announcement.manage"],
  },
  {
    key: "employee",
    name: "Employee Management",
    description: "Employee directory, records, movements, people cases and team view.",
    screens: [
      { route: "/org/employees", name: "Employees" },
      { route: "/org/team", name: "My Team" },
      { route: "/emp/movements", name: "My movements" },
      { route: "/emp/referrals", name: "My referrals" },
    ],
    actions: ["employee.manage"],
  },
  {
    key: "recruitment",
    name: "Recruitment & Onboarding",
    description: "Job postings, candidates, interviews, offers and new-hire onboarding.",
    screens: [
      { route: "/org/recruitment", name: "Recruitment pipeline" },
      { route: "/org/recruitment/postings", name: "Job postings" },
      { route: "/org/recruitment/candidates", name: "Candidates" },
      { route: "/org/recruitment/interviews", name: "Interviews" },
      { route: "/org/recruitment/offers", name: "Offers" },
    ],
    actions: ["recruitment.manage"],
  },
  {
    key: "attendance",
    name: "Attendance & Timesheets",
    description: "Attendance, shifts, daily wages, work orders and timesheets.",
    screens: [
      { route: "/org/attendance", name: "Attendance & Shifts" },
      { route: "/org/timesheets", name: "Timesheets" },
      { route: "/emp/attendance", name: "My attendance" },
      { route: "/emp/timesheets", name: "My timesheets" },
    ],
    actions: ["attendance.lock"],
  },
  {
    key: "leave",
    name: "Leave & Comp-off",
    description: "Leave applications, balances, comp-off approvals and redemptions.",
    screens: [
      { route: "/org/leave", name: "Leave & Comp-off" },
      { route: "/emp/leave", name: "My leave" },
    ],
    actions: ["compoff.redeem", "compoff.hod.decide", "compoff.viewAll"],
  },
  {
    key: "tours",
    name: "Tours & Travel",
    description: "Business tours with HOD → HR → Finance approval and proof of visit.",
    screens: [
      { route: "/org/tours", name: "Tours & Travel" },
      { route: "/emp/tours", name: "My tours" },
    ],
    actions: [
      "tour.submit",
      "tour.hod.decide",
      "tour.hr.decide",
      "tour.finance.decide",
      "tour.viewAll",
    ],
  },
  {
    key: "payroll",
    name: "Payroll & Tax",
    description: "Payroll runs, payslips, loans, tax declarations and payroll reports.",
    screens: [
      { route: "/org/finance", name: "Payroll, Payslips & Loans" },
      { route: "/org/tax", name: "Proof of Investment" },
      { route: "/org/payroll-reports", name: "Payroll Reports" },
      { route: "/emp/payroll", name: "My payroll" },
      { route: "/emp/payslips", name: "My payslips" },
      { route: "/emp/loans", name: "My loans" },
      { route: "/emp/ytd", name: "My YTD" },
      { route: "/emp/it-statement", name: "My IT statement" },
      { route: "/emp/it-declaration", name: "My IT declaration" },
      { route: "/emp/tax", name: "My tax" },
    ],
    actions: ["payroll.manage", "payroll.run", "payroll.approve", "payroll.process"],
  },
  {
    key: "compliance",
    name: "Statutory Compliance",
    description: "PF, ESI, PT, LWF, TDS configuration, registers and filings.",
    screens: [{ route: "/org/compliance", name: "Statutory Compliance" }],
    actions: [
      "statutory.configure",
      "filing.generate",
      "filing.verify",
      "filing.approve",
      "filing.file",
      "contribution.approve",
    ],
  },
  {
    key: "expense",
    name: "Claims & Expenditure",
    description: "Claims, insurance and expenditure booking.",
    screens: [
      { route: "/org/claims", name: "Claims & Insurance" },
      { route: "/org/expenditure", name: "Expenditure Booking" },
      { route: "/emp/reimbursements", name: "My claims" },
    ],
    actions: ["finance.manage"],
  },
  {
    key: "performance",
    name: "Performance & Goals",
    description: "Reviews, appraisals, PIPs and goals.",
    screens: [
      { route: "/org/performance", name: "Reviews & Appraisals" },
      { route: "/org/goals", name: "Goals" },
      { route: "/emp/goals", name: "My goals" },
      { route: "/emp/appraisals", name: "My appraisals" },
      { route: "/emp/reviews", name: "Reviews I give" },
    ],
    actions: ["performance.manage", "goal.create"],
  },
  {
    key: "learning",
    name: "Training",
    description: "Training catalogue, assignments and trainers.",
    screens: [
      { route: "/org/training", name: "Training" },
      { route: "/emp/training", name: "My training" },
    ],
    actions: [],
  },
  {
    key: "projects",
    name: "Projects & Tasks",
    description: "Projects, assignments, milestones and tasks.",
    screens: [
      { route: "/org/projects", name: "Projects & Assignments" },
      { route: "/org/tasks", name: "Tasks" },
      { route: "/emp/projects", name: "My projects" },
      { route: "/emp/tasks", name: "My tasks" },
    ],
    actions: ["task.assign"],
  },
  {
    key: "assets",
    name: "Asset Lifecycle",
    description: "Asset register, issuance, requests, transfers and group rollup.",
    screens: [
      { route: "/org/assets", name: "Asset Lifecycle" },
      { route: "/org/asset-rollup", name: "Group Asset Rollup" },
      { route: "/emp/assets", name: "My assets" },
    ],
    actions: ["asset.manage", "asset.issue", "asset.request", "asset.approve"],
  },
  {
    key: "exit",
    name: "Exit, Retention & F&F",
    description: "Resignations, clearance, full & final settlement, retention and rejoin.",
    screens: [
      { route: "/org/exits", name: "Exit, Retention & F&F" },
      { route: "/emp/resignation", name: "My resignation" },
    ],
    actions: [
      "exit.submit",
      "exit.manager.decide",
      "exit.hr.clearance",
      "exit.hr.approve",
      "exit.notice.configure",
      "exit.complete",
      "exit.viewAll",
    ],
  },
  {
    key: "engagement",
    name: "Grievance Redressal",
    description: "Grievances and employee complaints.",
    screens: [
      { route: "/org/grievances", name: "Grievance Redressal" },
      { route: "/emp/complaints", name: "My complaints" },
    ],
    actions: [],
  },
  {
    key: "helpdesk",
    name: "Helpdesk",
    description: "Internal service desk with queues, catalogue and SLAs.",
    screens: [
      { route: "/helpdesk", name: "Helpdesk" },
      { route: "/org/support", name: "Support" },
      { route: "/emp/support", name: "My support" },
    ],
    actions: [],
  },
  {
    key: "analytics",
    name: "Reports & Analytics",
    description: "Cross-module reports and people analytics.",
    screens: [{ route: "/org/reports", name: "Reports & Analytics" }],
    actions: [],
  },
];

/** Tabs that switch a view mode rather than a feature — not offered as configurable features. */
const VIEW_MODES = new Set(["day", "week", "month", "year", "all"]);

export const featuresOf = (route) =>
  (SCREEN_TABS[route] ?? []).filter((t) => !VIEW_MODES.has(t.value));

export const MODULE_KEYS = CATALOG_MODULES.map((m) => m.key);
export const SELLABLE_MODULES = CATALOG_MODULES.filter((m) => !m.locked);
export const moduleByKey = (k) => CATALOG_MODULES.find((m) => m.key === k) ?? null;

/** Route → module key (longest matching screen route wins: /org/recruitment/offers before /org/recruitment). */
const ROUTE_INDEX = CATALOG_MODULES.flatMap((m) =>
  m.screens.map((s) => ({ route: s.route, module: m.key, locked: !!s.locked })),
).sort((a, b) => b.route.length - a.route.length);

export function screenOf(pathname) {
  return (
    ROUTE_INDEX.find((r) => pathname === r.route || pathname.startsWith(r.route + "/")) ?? null
  );
}

const ACTION_INDEX = Object.fromEntries(
  CATALOG_MODULES.flatMap((m) => m.actions.map((a) => [a, m.key])),
);
export const moduleOfAction = (action) => ACTION_INDEX[action] ?? null;

/** The key chain of a node, most general first — used to cascade a switched-off parent to its children. */
export function ancestry(key) {
  if (key.startsWith("m:")) return [key];
  if (key.startsWith("a:")) {
    const m = moduleOfAction(key.slice(2));
    return m ? [`m:${m}`, key] : [key];
  }
  if (key.startsWith("t:")) {
    const route = key.slice(2, key.indexOf("#"));
    return [...ancestry(`s:${route}`), key];
  }
  if (key.startsWith("s:")) {
    const sc = screenOf(key.slice(2));
    if (!sc) return [key];
    const chain = [`m:${sc.module}`];
    if (sc.route !== key.slice(2)) chain.push(`s:${sc.route}`);
    chain.push(key);
    return chain;
  }
  return [key];
}

/** Keys that can never be switched off (prevents an organisation locking itself out of configuration). */
export function isLockedKey(key) {
  if (key === "m:core") return true;
  // Tabs of a locked screen (Configuration, Settings, Users …) stay available with it.
  if (key.startsWith("t:")) return isLockedKey(`s:${key.slice(2, key.indexOf("#"))}`);
  if (key.startsWith("s:")) {
    const sc = screenOf(key.slice(2));
    const def = sc && moduleByKey(sc.module)?.screens.find((s) => s.route === sc.route);
    return !!def?.locked;
  }
  return false;
}

/** Flat count used on summary cards. */
export function catalogStats() {
  const screens = CATALOG_MODULES.reduce((n, m) => n + m.screens.length, 0);
  const features = CATALOG_MODULES.reduce(
    (n, m) => n + m.screens.reduce((k, s) => k + featuresOf(s.route).length, 0),
    0,
  );
  const actions = CATALOG_MODULES.reduce((n, m) => n + m.actions.length, 0);
  return { modules: CATALOG_MODULES.length, screens, features, actions };
}

/** Industry templates offered when an organisation is created — they pre-select modules (Seereon can still edit). */
export const ORG_TYPE_TEMPLATES = [
  {
    key: "it",
    name: "IT & Consulting",
    description: "Projects, timesheets, performance and recruitment-heavy knowledge workforce.",
    modules: MODULE_KEYS.filter((k) => k !== "core"),
  },
  {
    key: "mining",
    name: "Mining & Heavy Industry",
    description:
      "Shift attendance, daily wages, work orders, statutory compliance and asset control across sites.",
    modules: [
      "employee",
      "recruitment",
      "attendance",
      "leave",
      "tours",
      "payroll",
      "compliance",
      "expense",
      "performance",
      "learning",
      "assets",
      "exit",
      "engagement",
      "helpdesk",
      "analytics",
    ],
  },
  {
    key: "education",
    name: "Education & Institutes",
    description: "Faculty and staff HR — attendance, leave, payroll, appraisals and training.",
    modules: [
      "employee",
      "recruitment",
      "attendance",
      "leave",
      "payroll",
      "compliance",
      "performance",
      "learning",
      "exit",
      "engagement",
      "helpdesk",
      "analytics",
    ],
  },
  {
    key: "manufacturing",
    name: "Manufacturing",
    description: "Plant workforce — shifts, wages, payroll, compliance and assets.",
    modules: [
      "employee",
      "attendance",
      "leave",
      "payroll",
      "compliance",
      "expense",
      "assets",
      "exit",
      "engagement",
      "helpdesk",
      "analytics",
    ],
  },
  {
    key: "general",
    name: "General / Other",
    description: "Core HR set — choose the rest module by module.",
    modules: ["employee", "attendance", "leave", "payroll", "exit", "helpdesk"],
  },
];
export const orgTypeByKey = (k) => ORG_TYPE_TEMPLATES.find((t) => t.key === k) ?? null;

/** The four organisation structures a client can have. They decide which steps the onboarding wizard shows. */
export const STRUCTURES = [
  {
    key: "group-companies-branches",
    kind: "group",
    name: "Group › Companies › Branches › Employees",
    description: "A group of companies; each company runs several branches.",
    companies: true,
    branches: true,
  },
  {
    key: "group-companies",
    kind: "group",
    name: "Group › Companies › Employees",
    description: "A group of companies; employees sit directly in each company (no branches).",
    companies: true,
    branches: false,
  },
  {
    key: "company-branches",
    kind: "company",
    name: "Company › Branches › Employees",
    description: "One company operating from several branches.",
    companies: false,
    branches: true,
  },
  {
    key: "company",
    kind: "company",
    name: "Company › Employees",
    description: "One company; every employee works from the head office.",
    companies: false,
    branches: false,
  },
];
export const structureByKey = (k) => STRUCTURES.find((s) => s.key === k) ?? null;
