// Module entitlement of a company. Core modules are on for every company (never sent, never removable); the Super Admin
// picks the optional ones when creating a company and can change them later.
export const CORE_MODULES = ["employee", "attendance", "leave", "payroll", "documents"];

export const OPTIONAL_MODULES = [
  "performance",
  "recruitment",
  "learning",
  "engagement",
  "expense",
  "tours",
  "assets",
  "helpdesk",
  "compliance",
  "analytics",
  "exit",
];

const LABELS = {
  employee: "Employee",
  attendance: "Attendance & Shifts",
  leave: "Leave",
  payroll: "Payroll",
  documents: "Documents",
  performance: "Performance",
  recruitment: "Recruitment",
  learning: "Learning & Training",
  engagement: "Engagement",
  expense: "Expense & Claims",
  tours: "Tours & Travel",
  assets: "Assets",
  helpdesk: "Helpdesk",
  compliance: "Compliance",
  analytics: "Reports & Analytics",
  exit: "Exit",
};

export const moduleLabel = (key) =>
  LABELS[key] ?? String(key).replace(/^./, (c) => c.toUpperCase());

/** Optional keys among a company's enabled modules (core keys and unknown keys dropped). */
export const optionalOf = (modules) =>
  (Array.isArray(modules) ? modules : [])
    .map((m) => (typeof m === "string" ? m : (m?.key ?? m?.module_key)))
    .filter((k) => OPTIONAL_MODULES.includes(k));
