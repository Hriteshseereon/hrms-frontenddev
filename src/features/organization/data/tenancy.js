// ---------------------------------------------------------------------------
// The organisation — Seereon HRMS is installed for one client organisation, owned end-to-end by its Super Admin:
//
//   • the organisation record: group of companies or an individual company, org type, structure, profile;
//   • organisation setup: which modules the organisation uses (chosen by the Super Admin, not by a vendor);
//   • configuration: screens, tabs and actions switched off — for the whole organisation, for one company or for
//     one branch — enforced on every screen, tab and guarded action;
//   • the working scope: Group (all companies) › Company › Branch, with the collective view read-only;
//   • master data: per company, or shared across the group when the Super Admin shares that master type.
//
// Structure (groups, companies, branches) stays in group-data.js; this module layers the organisation on top of it.
// ---------------------------------------------------------------------------
import { createPersistentStore, namespaceChanged, registerNamespaceResolver } from "@/lib/persist";
import { registerListResolver } from "@/lib/shared-list";
import { createStore } from "@/lib/store";
import { bumpFeatureGate, registerTabGate } from "@/lib/feature-gate";
import {
  allUsers,
  getCurrentUser,
  moveUserAccount,
  onSessionChange,
  registerAccessGate,
  useCurrentUser,
} from "@/features/auth/data/auth-session";
import {
  activeOrgStore,
  addBranch,
  addGroup,
  addOrg,
  assignOrgToGroup,
  getOrg,
  groupsStore,
  orgsStore,
  updateBranch,
  updateGroup,
  updateOrg,
  useActiveOrgId,
  useOrgs,
  useViewScope,
  viewScopeStore,
} from "@/features/organization/data/group-data";
import {
  directoryEmployees,
  findEmployee,
  updateEmployeeRecord,
} from "@/features/employees/data/employee-directory";
import { departmentsStore } from "@/features/organization/data/dept-data";
import {
  MODULE_KEYS,
  ancestry,
  isLockedKey,
  orgTypeByKey,
  screenOf,
  structureByKey,
} from "@/features/platform/data/feature-catalog";

/**
 * @typedef {Object} Organisation
 * @property {string} id
 * @property {string} name
 * @property {string} legalName
 * @property {"group" | "company"} kind
 * @property {string} structure - feature-catalog STRUCTURES key.
 * @property {string} orgType - feature-catalog ORG_TYPE_TEMPLATES key.
 * @property {string | null} groupId - Company group (kind = group).
 * @property {string} rootOrgId - The company the organisation started with (individual) or its first company.
 * @property {{ name: string, email: string, phone: string }} contact
 * @property {string} address
 * @property {string} [gstin]
 * @property {string} [pan]
 * @property {{ modules: string[], off: string[] }} entitlements - Organisation Setup: the modules in use.
 * @property {{ off: string[] }} config - Switched off for the whole organisation (Configuration).
 * @property {Record<string, string[]>} scopeConfig - Switched off for one company or branch (id → keys).
 * @property {Record<string, boolean>} sharedMasters - Master type → same across every company of the group.
 * @property {string} createdOn
 */

export const DEFAULT_TENANT_ID = "TEN-SEEREON";

/** Master data a group can share across its companies (one toggle per type). */
export const MASTER_TYPES = [
  {
    key: "designations",
    name: "Designations",
    hint: "Job titles used on records, offers and letters.",
    stores: [],
    lists: [/^infra-designations:/],
  },
  {
    key: "leave",
    name: "Leave types & leave policy",
    hint: "Leave types, entitlements, carry-forward and encashment rules.",
    stores: [
      "seereon.masters.leave-policy",
      "seereon.masters.leave",
      "seereon.masters.holiday-calendars",
    ],
    lists: ["leave-types"],
  },
  {
    key: "attendance",
    name: "Shifts, workday, geofence & IP rules",
    hint: "Shift timings, working days, attendance geofences and IP restrictions.",
    stores: [
      "seereon.attendance.shifts.v1",
      "seereon.payroll.workconfig",
      "seereon.payroll.patterns",
      "seereon.attendance.halfday-policy.v1",
      "seereon.attendance.overtime-rules.v1",
      "seereon.attendance.penalty-rules.v1",
    ],
    lists: ["workday-config", "geofence-rules", "ip-rules"],
  },
  {
    key: "payroll",
    name: "Pay components & payroll policy",
    hint: "Salary components, structures and payroll policy. Statutory state rules always follow each branch's state.",
    stores: [
      "seereon.payroll.policy",
      "seereon.masters.salary-structures",
      "seereon.statutory.config",
      "seereon.payroll.statutory-profiles.v2",
      "seereon.payroll.payslip-config",
    ],
    lists: ["pay-components"],
  },
  {
    key: "loans",
    name: "Loan & advance policy",
    hint: "Loan types, limits and EMI rules.",
    stores: ["seereon.finance.loan-policy"],
    lists: [],
  },
  {
    key: "performance",
    name: "Review cycles & appraisal workflow",
    hint: "Review indicators, cycles and the appraisal approval chain.",
    stores: [
      "seereon.performance.reviews",
      "seereon.appraisal.workflow",
      "seereon.masters.eval-params",
    ],
    lists: [],
  },
  {
    key: "exit",
    name: "Exit, F&F, HR policy & case types",
    hint: "Notice periods, F&F rules, HR policy, termination / warning / complaint types.",
    stores: ["seereon.exit.fnf-config", "seereon.hr.policy"],
    lists: ["master-TTY", "master-WTY", "master-CTY"],
  },
  {
    key: "documents",
    name: "Documents, handbook & templates",
    hint: "Document master, letter styles, handbook and award master.",
    stores: ["seereon.docmaster.styles", "seereon.docmaster.templates.v3", "seereon.handbook"],
    lists: ["master-DOC", "master-AWD"],
  },
  {
    key: "recruitment",
    name: "Recruitment masters",
    hint: "Career site settings, interview types and checklists.",
    stores: ["seereon.recruitment.career-settings.v1", "seereon.masters.assessment-params"],
    lists: ["master-INT", "master-INC"],
  },
  {
    key: "claims",
    name: "Reimbursement categories & insurance plans",
    hint: "Claim categories, limits and insurance / benefit plans.",
    stores: ["seereon.masters.insurance-plans"],
    lists: ["master-RMC"],
  },
  {
    key: "approvals",
    name: "Approval workflows",
    hint: "Approval engine workflows per module.",
    stores: ["seereon.approvals.workflows.v1"],
    lists: [],
  },
  {
    key: "general",
    name: "Other masters",
    hint: "Asset master, training catalogue, helpdesk set-up and every other master list.",
    stores: [
      "seereon.assets.master.v1",
      "seereon.training.catalog.v1",
      "seereon.helpdesk.config",
      "seereon.archive.config",
      /^seereon\.crud\./,
    ],
    lists: [/^master-/],
  },
];

/** Stores that belong to the whole installation (accounts, structure, branding, integrations). */
const GLOBAL_KEYS = new Set([
  "seereon.auth.account-overrides.v1",
  "seereon.rbac.logins.v1",
  "seereon.rbac.invited.v1",
  "seereon.hiring.newhires",
  "seereon.appearance.user.v1",
  "seereon.brand.orgs.v1",
  "seereon.appearance.org.v1",
  "seereon.org.settings.toggles.v1",
  "seereon.employee.alerts",
  "seereon.integrations.ad",
  "seereon.integrations.sso",
  "seereon.integrations.biometric",
  "seereon.integrations.email-ticket",
]);
const GLOBAL_PREFIXES = ["seereon.platform.", "seereon.group.", "seereon.support."];
const isGlobalKey = (key) => GLOBAL_KEYS.has(key) || GLOBAL_PREFIXES.some((p) => key.startsWith(p));

const matches = (pattern, key) =>
  typeof pattern === "string" ? pattern === key : pattern.test(key);
const masterTypeOfStore = (key) =>
  MASTER_TYPES.find((m) => m.stores.some((p) => matches(p, key)))?.key ?? null;
const masterTypeOfList = (key) =>
  MASTER_TYPES.find((m) => m.lists.some((p) => matches(p, key)))?.key ?? null;

/* ------------------------------------------------------------------ */
/* Seed — the organisation                                             */
/* ------------------------------------------------------------------ */

const ALL_MODULES = MODULE_KEYS.filter((k) => k !== "core");
const allShared = (overrides = {}) => ({
  ...Object.fromEntries(MASTER_TYPES.map((m) => [m.key, true])),
  ...overrides,
});

/** @type {Organisation[]} */
export const TENANTS_SEED = [
  {
    id: DEFAULT_TENANT_ID,
    name: "Seereon Group",
    legalName: "Seereon Holdings Pvt. Ltd.",
    kind: "group",
    structure: "group-companies-branches",
    orgType: "it",
    groupId: "GRP-001",
    rootOrgId: "ORG-SEEREON",
    contact: {
      name: "Group Administrator",
      email: "superadmin@seereon.co.in",
      phone: "+91 90 9070 5533",
    },
    address: "Khandagiri, Bhubaneswar 751003, Odisha",
    gstin: "21AAICS1234A1Z5",
    pan: "AAICS1234A",
    entitlements: { modules: [...ALL_MODULES], off: [] },
    config: { off: [] },
    scopeConfig: {},
    // v6 kept one copy of every master for the whole group and one designation list per company — preserved.
    sharedMasters: allShared({ designations: false }),
    createdOn: "2016-04-01",
  },
];

export const tenantStore = createPersistentStore("seereon.platform.organisation.v3", TENANTS_SEED);
export const useTenants = () => tenantStore.use();
export const getTenants = () => tenantStore.get();
export const getTenant = (id) => tenantStore.get().find((t) => t.id === id) ?? null;

/** The one organisation this installation runs for. */
export const theOrganisation = () => tenantStore.get()[0] ?? null;
export const useOrganisation = () => useTenants()[0] ?? null;

/** Which organisation a company belongs to (the single organisation, kept for call-site clarity). */
export function tenantOfOrg(orgId, tenants = tenantStore.get(), orgs = orgsStore.get()) {
  if (!orgId) return null;
  const org = orgs.find((o) => o.id === orgId);
  return (
    tenants.find((t) => t.rootOrgId === orgId) ??
    (org?.groupId ? tenants.find((t) => t.groupId && t.groupId === org.groupId) : null) ??
    tenants[0] ??
    null
  );
}
export const tenantOfUser = (u) => (!u ? null : tenantOfOrg(u.orgId));

/** Companies (legal entities) of the organisation. */
export function companiesOf(tenant, orgs = orgsStore.get()) {
  if (!tenant) return [];
  return orgs.filter(
    (o) => o.id === tenant.rootOrgId || (tenant.groupId && o.groupId === tenant.groupId),
  );
}

export function updateTenant(id, patch) {
  tenantStore.set((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  syncOrgModules(id);
  namespaceChanged();
  bumpFeatureGate();
}

/** Keeps each company's `modules` list (read by older screens) equal to the organisation's module selection. */
function syncOrgModules(tenantId) {
  const t = getTenant(tenantId);
  if (!t) return;
  const ids = new Set(companiesOf(t).map((o) => o.id));
  orgsStore.set((p) =>
    p.map((o) => (ids.has(o.id) ? { ...o, modules: [...t.entitlements.modules] } : o)),
  );
}

export const structureByKeyName = (k) => structureByKey(k)?.name ?? k;

/** Where a signed-out visitor signs in: the single organisation's login page. */
export const workspaceLoginPath = () => "/login";
export const lastWorkspacePath = () => "/login";

/* ------------------------------------------------------------------ */
/* Current organisation                                                */
/* ------------------------------------------------------------------ */

export function currentTenant() {
  return theOrganisation();
}

export function useCurrentTenant() {
  return useOrganisation();
}

/* ------------------------------------------------------------------ */
/* Modules & configuration                                             */
/* ------------------------------------------------------------------ */

/** Organisation Setup: is this node part of the modules the organisation uses? */
export function ceilingAllows(tenant, key) {
  if (!tenant) return true;
  const chain = ancestry(key);
  const head = chain[0];
  if (head.startsWith("m:")) {
    const m = head.slice(2);
    if (m !== "core" && !tenant.entitlements.modules.includes(m)) return false;
  }
  return !chain.some((k) => !isLockedKey(k) && (tenant.entitlements.off ?? []).includes(k));
}

/** Organisation Setup AND the organisation-wide configuration. */
export function isEnabled(tenant, key) {
  if (!tenant) return true;
  if (!ceilingAllows(tenant, key)) return false;
  return !ancestry(key).some((k) => !isLockedKey(k) && (tenant.config?.off ?? []).includes(k));
}

/**
 * Effective state for a company / branch: organisation-wide switches plus everything switched off for the given
 * scope ids (a company id, a branch id, or both).
 */
export function isEnabledAt(tenant, key, scopeIds = []) {
  if (!isEnabled(tenant, key)) return false;
  const chains = ancestry(key);
  return !scopeIds.some(
    (id) =>
      id && (tenant.scopeConfig?.[id] ?? []).some((k) => chains.includes(k) && !isLockedKey(k)),
  );
}

/** Scope ids whose configuration applies to a user right now (their company and branch — or the active scope for admins). */
export function configScopeIdsFor(u = getCurrentUser()) {
  const ids = [];
  if (u.role === "SuperAdmin" || u.role === "Admin") {
    if (!isCollectiveView(u)) {
      ids.push(activeOrgStore.get());
      const b = u.role === "BranchAdmin" ? u.branchId : activeBranchStore.get();
      if (b) ids.push(b);
    }
    return ids;
  }
  if (u.orgId) ids.push(u.orgId);
  if (u.branchId) ids.push(u.branchId);
  else if (u.branch) {
    const b = (getOrg(u.orgId)?.branches ?? []).find((x) => x.name === u.branch);
    if (b) ids.push(b.id);
  }
  return ids;
}

/** Toggle a node in Organisation Setup (the modules the organisation uses). Re-syncs the companies' module list. */
export function setCeiling(tenantId, key, on) {
  const t = getTenant(tenantId);
  if (!t || isLockedKey(key)) return;
  const ent = { modules: [...t.entitlements.modules], off: [...(t.entitlements.off ?? [])] };
  if (key.startsWith("m:")) {
    const m = key.slice(2);
    ent.modules = on ? [...new Set([...ent.modules, m])] : ent.modules.filter((x) => x !== m);
  } else {
    ent.off = on ? ent.off.filter((k) => k !== key) : [...new Set([...ent.off, key])];
  }
  updateTenant(tenantId, { entitlements: ent });
}

/** Toggle a node in the organisation-wide configuration (Super Admin → Configuration). */
export function setConfig(tenantId, key, on) {
  const t = getTenant(tenantId);
  if (!t || isLockedKey(key) || !ceilingAllows(t, key)) return;
  const off = new Set(t.config?.off ?? []);
  if (on) off.delete(key);
  else off.add(key);
  updateTenant(tenantId, { config: { ...(t.config ?? {}), off: [...off] } });
}

/** Toggle a node for ONE company or branch (Super Admin → Configuration → that company / branch). */
export function setScopeConfig(tenantId, targetId, key, on) {
  const t = getTenant(tenantId);
  if (!t || !targetId || isLockedKey(key)) return;
  const current = new Set(t.scopeConfig?.[targetId] ?? []);
  if (on) current.delete(key);
  else current.add(key);
  const scopeConfig = { ...(t.scopeConfig ?? {}) };
  if (current.size) scopeConfig[targetId] = [...current];
  else delete scopeConfig[targetId];
  updateTenant(tenantId, { scopeConfig });
}

export function setMasterShared(tenantId, type, shared) {
  const t = getTenant(tenantId);
  if (!t) return;
  updateTenant(tenantId, { sharedMasters: { ...(t.sharedMasters ?? {}), [type]: shared } });
}

/* ------------------------------------------------------------------ */
/* Scope — Group › Company › Branch                                    */
/* ------------------------------------------------------------------ */

/** Selected branch inside the active company (null = all branches of the company). */
export const activeBranchStore = createStore(null);
const BRANCH_KEY = "seereon.scope.branch";

const isSuper = (u) => u.role === "SuperAdmin";

/** Branch Admins are locked to their branch; everyone else may pick one (or all). */
function restoreBranch(u) {
  if (u.role === "BranchAdmin") {
    activeBranchStore.set(u.branchId ?? null);
    return;
  }
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(BRANCH_KEY) ?? "null");
  } catch {
    stored = null;
  }
  const org = getOrg(activeOrgStore.get());
  activeBranchStore.set(
    stored && stored.user === u.id && (org?.branches ?? []).some((b) => b.id === stored.branchId)
      ? stored.branchId
      : null,
  );
}

export function setActiveCompany(orgId) {
  activeOrgStore.set(orgId);
  viewScopeStore.set("entity");
  activeBranchStore.set(null);
  persistBranch();
}
export function setActiveScopeBranch(branchId) {
  if (getCurrentUser().role === "BranchAdmin") return;
  activeBranchStore.set(branchId);
  persistBranch();
}
export function setGroupView() {
  viewScopeStore.set("group");
  activeBranchStore.set(null);
  persistBranch();
}
function persistBranch() {
  try {
    const u = getCurrentUser();
    window.localStorage.setItem(
      BRANCH_KEY,
      JSON.stringify({ user: u.id, branchId: activeBranchStore.get() }),
    );
  } catch {
    /* ignore */
  }
}

/** True when the signed-in user is looking at several companies at once (read-only collective view). */
export function isCollectiveView(u = getCurrentUser()) {
  if (!isSuper(u) || viewScopeStore.get() !== "group") return false;
  const t = tenantOfUser(u);
  return companiesOf(t).length > 1;
}

/**
 * @typedef {Object} Scope
 * @property {"group" | "company" | "branch"} level
 * @property {Organisation | null} tenant
 * @property {GroupOrg[]} companies - Companies in view.
 * @property {GroupOrg | null} company - Active company (null in the collective view).
 * @property {{ id: string, name: string } | null} branch - Active branch (null = all branches).
 * @property {boolean} readOnly - Collective view: writes need a company first.
 */

/** Reactive working scope of the signed-in user. */
export function useScope() {
  const me = useCurrentUser();
  const orgs = useOrgs();
  const orgId = useActiveOrgId();
  const view = useViewScope();
  const branchId = activeBranchStore.use();
  const tenants = useTenants();
  const tenant = tenantOfOrg(me.orgId, tenants, orgs) ?? null;
  const all = tenant ? companiesOf(tenant, orgs) : orgs;
  const companies = isSuper(me) ? all : all.filter((o) => o.id === me.orgId);
  const collective = isSuper(me) && view === "group" && companies.length > 1;
  const company = collective
    ? null
    : (companies.find((o) => o.id === orgId) ?? companies[0] ?? null);
  const lockedBranch = me.role === "BranchAdmin" ? me.branchId : null;
  const bId = lockedBranch ?? branchId;
  let branch =
    !collective && company ? ((company.branches ?? []).find((b) => b.id === bId) ?? null) : null;
  // A Branch Admin whose branch can no longer be resolved (removed / unknown id) stays locked to their own branch name —
  // falling back to "all branches" widened their view to the whole company.
  if (lockedBranch && !branch) branch = { id: lockedBranch, name: me.branch ?? "—" };
  return {
    level: collective ? "group" : branch && !branch.hidden ? "branch" : "company",
    tenant,
    companies: collective ? companies : company ? [company] : [],
    company,
    branch: branch && !branch.hidden ? branch : null,
    readOnly: collective,
  };
}

/**
 * Record filter for list screens: does a record of company `orgId` (optionally for employee `empId`, or at branch
 * `branchName`) fall inside the current scope? Records without a company are kept (they predate entity tagging and
 * already live in this organisation's own namespace).
 */
export function useScopeMatch() {
  const scope = useScope();
  const ids = new Set(scope.companies.map((o) => o.id));
  const branchName = scope.branch?.name ?? null;
  return (orgId, empId, recordBranch) => {
    const org = orgId ?? (empId ? findEmployee(empId)?.orgId : undefined);
    if (org && !ids.has(org)) return false;
    if (!branchName) return true;
    const b = recordBranch ?? (empId ? findEmployee(empId)?.branch : undefined);
    return b == null ? true : b === branchName;
  };
}

/* ------------------------------------------------------------------ */
/* Access gates                                                        */
/* ------------------------------------------------------------------ */

/** Actions that act on the organisation itself rather than on one company's records.
 *  department.manage covers the master-data screens — masters shared by the group are organisation-level data,
 *  so the Super Admin maintains them (and their delete buttons work) from the collective view too. */
const ORG_LEVEL_ACTIONS = new Set(["role.manage", "group.manage", "department.manage"]);

/** Super Admin only. */
const SUPER_ONLY_ROUTES = ["/org/configuration", "/org/organisation-setup"];

registerAccessGate({
  screen: (path, role) => {
    const u = getCurrentUser();
    if (SUPER_ONLY_ROUTES.some((r) => path === r || path.startsWith(r + "/")))
      return (role ?? u.role) === "SuperAdmin";
    const sc = screenOf(path);
    if (!sc) return true;
    return isEnabledAt(currentTenant(), `s:${sc.route}`, configScopeIdsFor(u));
  },
  action: (action, role) => {
    const u = getCurrentUser();
    if (!isEnabledAt(currentTenant(), `a:${action}`, configScopeIdsFor(u))) return false;
    // Collective (all-companies) view is read-only for the signed-in Super Admin: pick a company to act. Organisation-level
    // administration (roles, companies & branches) is not company data and stays available there.
    if (
      (role ?? u.role) === u.role &&
      isCollectiveView(u) &&
      !action.endsWith(".viewAll") &&
      !ORG_LEVEL_ACTIONS.has(action)
    )
      return false;
    return true;
  },
});

registerTabGate((pathname, value) => {
  const u = getCurrentUser();
  const sc = screenOf(pathname);
  if (!sc) return true;
  return isEnabledAt(currentTenant(), `t:${sc.route}#${value}`, configScopeIdsFor(u));
});

/* ------------------------------------------------------------------ */
/* Data namespaces                                                     */
/* ------------------------------------------------------------------ */

function masterResolution(key, type, t, isList) {
  const shared = t.sharedMasters?.[type] !== false;
  // Designation lists are already one per company (key carries the company id).
  if (type === "designations" && isList) {
    if (!shared) return { storageKey: key, initial: "seed" };
    return { storageKey: "infra-designations:@group", initial: "seed" };
  }
  if (shared || t.kind !== "group") return { storageKey: key, initial: "seed" };
  return {
    storageKey: `${key}#${activeOrgStore.get()}`,
    initial: "inherit",
    inheritKey: key,
  };
}

registerNamespaceResolver((key) => {
  if (isGlobalKey(key)) return { storageKey: key, initial: "seed" };
  const t = currentTenant();
  if (!t) return { storageKey: key, initial: "seed" };
  const type = masterTypeOfStore(key);
  if (type) return masterResolution(key, type, t, false);
  return { storageKey: key, initial: "seed" };
});

registerListResolver((key) => {
  const t = currentTenant();
  if (!t) return { storageKey: key, initial: "seed" };
  const type = masterTypeOfList(key) ?? "general";
  return masterResolution(key, type, t, true);
});

/** Which storage a master type is reading right now — shown on the Configuration screen. */
export function masterStorageLabel(tenant, type) {
  if (!tenant || tenant.kind !== "group") return "Company";
  return tenant.sharedMasters?.[type] !== false ? "Shared by the group" : "Per company";
}

if (typeof window !== "undefined") {
  onSessionChange(() => {
    namespaceChanged();
    bumpFeatureGate();
    try {
      restoreBranch(getCurrentUser());
    } catch {
      /* ignore */
    }
  });
  activeOrgStore.subscribe(() => namespaceChanged());
  viewScopeStore.subscribe(() => bumpFeatureGate());
}

/** Applies the scope after first render (the shells call this with the signed-in user). */
export function applyBranchScope(u = getCurrentUser()) {
  if (typeof window === "undefined") return;
  restoreBranch(u);
  namespaceChanged();
  bumpFeatureGate();
}

/* ------------------------------------------------------------------ */
/* Structure operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Is a branch still in use? People of the company placed there (counted across the whole company, not the scope on
 * screen) or a Branch Admin locked to it — removing it would orphan them.
 */
export function branchInUse(orgId, branch) {
  const staff = directoryEmployees().filter(
    (e) => e.orgId === orgId && e.branch === branch.name && e.status !== "Exited",
  ).length;
  const admins = allUsers().filter(
    (u) => u.role === "BranchAdmin" && u.orgId === orgId && u.branchId === branch.id,
  ).length;
  return staff > 0 || admins > 0 ? { staff, admins } : null;
}

/**
 * Edits a branch and, when its name changes, carries the people with it. Records point at their branch by name, so a
 * rename used to drop every employee, login and department of the branch out of branch-scoped views (and its headcount
 * to 0, which unlocked deleting it). Returns false when another branch of the company already has the new name.
 */
export function renameBranch(orgId, branchId, patch) {
  const org = getOrg(orgId);
  const cur = (org?.branches ?? []).find((b) => b.id === branchId);
  if (!cur) return false;
  const name = (patch.name ?? cur.name).trim();
  if (
    (org.branches ?? []).some(
      (b) => b.id !== branchId && !b.hidden && b.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return false;
  updateBranch(orgId, branchId, { ...patch, name });
  if (name !== cur.name) {
    directoryEmployees()
      .filter((e) => e.orgId === orgId && e.branch === cur.name)
      .forEach((e) => updateEmployeeRecord(e.id, { branch: name }));
    allUsers()
      .filter((u) => u.orgId === orgId && u.branch === cur.name)
      .forEach((u) => moveUserAccount(u.id, { branch: name }));
    departmentsStore.set((p) =>
      p.map((d) => (d.orgId === orgId && d.location === cur.name ? { ...d, location: name } : d)),
    );
  }
  return true;
}

/** Hidden head office for a company that has no branches. */
export const headOfficeBranch = (orgId, city = "", state = "", address = "", head = "") => ({
  id: `${orgId}-BR-HO`,
  name: "Head Office",
  city,
  state,
  address,
  head,
  hidden: true,
});

/**
 * Adds a company to the organisation. An individual-company organisation that adds its first extra company becomes
 * a group (the original company is placed in it) — the organisation record follows.
 */
export function addCompany(tenantId, input) {
  const t = getTenant(tenantId);
  if (!t) throw new Error("Unknown organisation");
  let groupId = t.groupId;
  if (!groupId) {
    const root = getOrg(t.rootOrgId);
    const g = addGroup({
      name: `${t.name} Group`,
      code: `${(root?.code ?? t.name)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 8)}-GRP`,
      holdingEntity: t.legalName,
      country: root?.country ?? "India",
      notes: "Created when the first additional company was added",
    });
    if (root) assignOrgToGroup(root.id, g.id);
    groupId = g.id;
    const current = structureByKey(t.structure);
    updateTenant(t.id, {
      kind: "group",
      groupId,
      structure: current?.branches ? "group-companies-branches" : "group-companies",
    });
  }
  const noBranches = input.branchMode === "none";
  const row = addOrg({
    code: input.code,
    name: input.name,
    legalName: input.legalName || input.name,
    groupId,
    industry: input.industry || orgTypeByKey(t.orgType)?.name || "",
    country: input.country || "India",
    employees: 0,
    status: "Active",
    modules: [...t.entitlements.modules],
    branchMode: noBranches ? "none" : "branches",
    branches: [],
    isHolding: !!input.isHolding,
    city: input.city ?? "",
    state: input.state ?? "",
    address: input.address ?? "",
    gstin: input.gstin ?? "",
  });
  if (noBranches)
    updateOrg(row.id, {
      branches: [headOfficeBranch(row.id, input.city, input.state, input.address, input.head)],
    });
  else if (input.firstBranch?.trim())
    addBranch(row.id, {
      name: input.firstBranch.trim(),
      city: input.city ?? "",
      state: input.state ?? "",
      address: input.address ?? "",
      head: input.head ?? "",
    });
  namespaceChanged();
  return getOrg(row.id);
}

/**
 * The group's own holding company — the place for employees and branches that sit "directly under the group".
 * Payroll, PF, ESI and TDS are always run by a legal entity, so a group never employs anyone itself.
 */
export function ensureHoldingCompany(tenantId, opts = {}) {
  const t = getTenant(tenantId);
  if (!t || t.kind !== "group") return null;
  const existing = companiesOf(t).find((o) => o.isHolding);
  if (existing) return existing;
  const g = groupsStore.get().find((x) => x.id === t.groupId);
  return addCompany(tenantId, {
    code: `${g?.code ?? "GRP"}-HQ`,
    name: `${g?.name ?? t.name} — Group Office`,
    legalName: g?.holdingEntity || t.legalName,
    branchMode: opts.withBranches ? "branches" : "none",
    city: opts.city ?? "",
    state: opts.state ?? "",
    isHolding: true,
  });
}

/** Branch → its company and label, for pickers. */
export function branchesOfTenant(tenant) {
  return companiesOf(tenant).flatMap((o) =>
    (o.branches ?? []).map((b) => ({ ...b, orgId: o.id, orgName: o.name })),
  );
}

/**
 * Organisation Setup (Super Admin): applies the whole setup in one step — profile, kind & structure, module
 * selection, and any companies / branches that do not exist yet. Existing companies and their data are never removed.
 *
 * @param {Object} input
 * @param {"group" | "company"} input.kind
 * @param {string} input.structure
 * @param {string} input.orgType
 * @param {string} input.name
 * @param {string} [input.legalName]
 * @param {string} [input.code]
 * @param {string} [input.address]
 * @param {string} [input.city]
 * @param {string} [input.state]
 * @param {string} [input.gstin]
 * @param {string} [input.pan]
 * @param {{ name: string, email: string, phone: string }} [input.contact]
 * @param {{ modules: string[], off: string[] }} input.entitlements
 * @param {{ name: string, code?: string, legalName?: string, city?: string, state?: string, gstin?: string, branches?: { name: string, city?: string, state?: string }[] }[]} [input.companies]
 */
export function setupOrganisation(input) {
  const t = theOrganisation();
  if (!t) return { ok: false, message: "No organisation record." };
  const struct = structureByKey(input.structure);
  const withBranches = !!struct?.branches;

  // 1. Profile + module selection on the organisation record.
  updateTenant(t.id, {
    name: input.name?.trim() || t.name,
    legalName: input.legalName?.trim() || input.name?.trim() || t.legalName,
    kind: input.kind ?? t.kind,
    structure: input.structure ?? t.structure,
    orgType: input.orgType ?? t.orgType,
    address: input.address ?? t.address,
    gstin: input.gstin ?? t.gstin,
    pan: input.pan ?? t.pan,
    contact: input.contact ?? t.contact,
    entitlements: {
      modules: [...(input.entitlements?.modules ?? t.entitlements.modules)],
      off: [...(input.entitlements?.off ?? t.entitlements.off ?? [])],
    },
  });

  // 2. Group record follows the organisation profile.
  if (t.groupId)
    updateGroup(t.groupId, {
      name: input.name?.trim() || t.name,
      holdingEntity: input.legalName?.trim() || t.legalName,
    });

  // 3. Companies and branches that do not exist yet are created (matched by name, case-insensitive).
  const existing = companiesOf(getTenant(t.id));
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();
  for (const c of input.companies ?? []) {
    if (!norm(c.name)) continue;
    let org = existing.find((o) => norm(o.name) === norm(c.name));
    if (!org) {
      org = addCompany(t.id, {
        name: c.name.trim(),
        legalName: c.legalName,
        code:
          c.code?.trim() ||
          c.name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "")
            .slice(0, 8),
        branchMode: withBranches && (c.branches ?? []).length ? "branches" : "none",
        city: c.city,
        state: c.state,
        gstin: c.gstin,
      });
    }
    for (const b of c.branches ?? []) {
      if (!b?.name?.trim()) continue;
      const have = (getOrg(org.id)?.branches ?? []).some((x) => norm(x.name) === norm(b.name));
      if (!have)
        addBranch(org.id, {
          name: b.name.trim(),
          // A branch inside the company defaults to the company's own location.
          city: b.city?.trim() || c.city?.trim() || input.city || "",
          state: b.state?.trim() || c.state?.trim() || input.state || "",
          address: b.address?.trim() || "",
          head: b.head?.trim() || "",
        });
    }
  }
  namespaceChanged();
  bumpFeatureGate();
  return { ok: true, tenant: getTenant(t.id) };
}

/** Every sign-in account of the organisation. */
export function usersOfTenant(tenant) {
  const ids = new Set(companiesOf(tenant).map((o) => o.id));
  return allUsers().filter((u) => ids.has(u.orgId));
}
