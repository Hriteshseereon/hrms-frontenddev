// ---------------------------------------------------------------------------
// Company Group structure (org.* scope).
//
// A Company Group sits ABOVE individual Organizations (legal entities) within
// the same client group — e.g. Seereon's consulting, SAP, cloud and product entities. Any
// Organization Admin can view/manage groups and org membership from
// `org.groups.tsx`; each organization keeps its own branding, modules and
// employees. This is separate from Seereon's own SuperAdmin (`app.*`) layer,
// which only manages which client organizations exist and which modules are
// sold to them — Seereon does not manage group structure on a client's
// behalf. UI-only — everything lives in a reactive in-memory store.
// ---------------------------------------------------------------------------
import { createStore } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";

import {
  ORGANIZATION,
  SEEREON_USERS,
  getCurrentUser,
  registerSignInScope,
  userById,
} from "@/features/auth/data/auth-session";

/**
 * @typedef {Object} CompanyGroup
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {string} holdingEntity
 * @property {string} country
 * @property {string} createdOn
 * @property {string} notes
 */

/**
 * @typedef {Object} GroupOrg
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string} legalName
 * @property {string | null} groupId
 * @property {string} industry
 * @property {string} country
 * @property {number} employees
 * @property {"Active" | "Trial" | "Suspended" | "Inactive"} status
 * @property {string[]} modules - Module keys enabled for this organization by Seereon.
 * @property {string} [contact] - SuperAdmin onboarding metadata (optional for seeded rows).
 * @property {string} [email]
 * @property {string} [plan]
 * @property {number} [licenses]
 * @property {string} [createdOn]
 * @property {string} [subdomain]
 * @property {string} [adminEmail]
 * @property {string[]} [integrations]
 * @property {{ id: string, name: string, city: string, state: string, address: string, head: string, hidden?: boolean }[]} [branches] - Branches (locations) of this entity — employees and branch-specific masters hang off these. A `hidden` branch is the implicit head office of a company that has no branches.
 * @property {"branches" | "none"} [branchMode] - "none" = employees sit directly in the company (one hidden head-office branch).
 * @property {boolean} [isHolding] - The group's own holding company — carries employees / branches placed "directly under the group".
 */

const DEFAULT_MODULES = [
  "employee",
  "attendance",
  "leave",
  "payroll",
  "performance",
  "exit",
  "helpdesk",
];

export const GROUPS_SEED = [
  {
    id: "GRP-001",
    name: "Seereon Group",
    code: "SRNG",
    holdingEntity: "Seereon Holdings Pvt. Ltd.",
    country: "India",
    createdOn: "2016-04-01",
    notes: "Parent holding for Seereon's consulting, SAP, cloud and product entities.",
  },
];

export const ORGS_SEED = [
  {
    id: ORGANIZATION.id,
    code: ORGANIZATION.code,
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    groupId: "GRP-001",
    industry: "Consulting & IT Services",
    country: "India",
    employees: 24,
    status: "Active",
    modules: [...DEFAULT_MODULES, "assets", "documents", "analytics", "expense", "tours"],
  },
  {
    id: "ORG-1042",
    code: "ORG-1042",
    name: "Seereon SAP Practice",
    legalName: "Seereon SAP Practice Pvt. Ltd.",
    groupId: "GRP-001",
    industry: "SAP Consulting",
    country: "India",
    employees: 812,
    status: "Active",
    modules: [...DEFAULT_MODULES, "assets", "compliance", "tours"],
  },
  {
    id: "ORG-1043",
    code: "ORG-1043",
    name: "Seereon Cloud Services",
    legalName: "Seereon Cloud Services Pvt. Ltd.",
    groupId: "GRP-001",
    industry: "Cloud Services",
    country: "India",
    employees: 298,
    status: "Active",
    modules: [...DEFAULT_MODULES, "assets", "tours"],
  },
  {
    id: "ORG-1044",
    code: "ORG-1044",
    name: "Seereon Products",
    legalName: "Seereon Products Pvt. Ltd.",
    groupId: "GRP-001",
    industry: "Software Products",
    country: "India",
    employees: 402,
    status: "Active",
    modules: [...DEFAULT_MODULES, "tours"],
  },
];

// Persisted in the browser: companies / branches / admins created by the Super Admin must still exist after a
// reload, otherwise an issued login belongs to a company that no longer exists.
// v3: single-organisation build — earlier multi-tenant demo rows are retired.
export const groupsStore = createPersistentStore("seereon.group.groups.v3", GROUPS_SEED);
export const orgsStore = createPersistentStore("seereon.group.orgs.v3", ORGS_SEED);

/** The organization the signed-in org user is currently working inside. Admin / Employee logins are locked to their own entity. */
export const activeOrgStore = createStore(ORGANIZATION.id);
/** SuperAdmin only: "group" = collective view across every entity of the client's group; "entity" = one company. */
export const viewScopeStore = createStore("entity");
const SCOPE_KEY = "seereon.scope";
/** Applies the signed-in user's tenant scope after hydration (SSR renders the default so markup matches). */
export function applyTenantScope(u) {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(SCOPE_KEY) ?? "null");
  } catch {
    stored = null;
  }
  // The collective (all companies) view exists only for a Super Admin whose organisation has several companies.
  const multi = u.role === "SuperAdmin" && accessibleOrgs(u).length > 1;
  if (stored && stored.user === u.id && accessibleOrgs(u).some((o) => o.id === stored.orgId)) {
    activeOrgStore.set(stored.orgId);
    viewScopeStore.set(multi ? stored.scope : "entity");
    return;
  }
  activeOrgStore.set(u.orgId || ORGANIZATION.id);
  viewScopeStore.set(multi ? "group" : "entity");
}
const persistScope = () => {
  try {
    const u = getCurrentUser();
    window.localStorage.setItem(
      SCOPE_KEY,
      JSON.stringify({ user: u.id, orgId: activeOrgStore.get(), scope: viewScopeStore.get() }),
    );
  } catch {
    /* ignore */
  }
};
if (typeof window !== "undefined") {
  activeOrgStore.subscribe(persistScope);
  viewScopeStore.subscribe(persistScope);
}
export const useViewScope = () => viewScopeStore.use();
export const setViewScope = (s) => viewScopeStore.set(s);
/** Tenant lock applied at every sign-in (item: Admin / Employee see only their company; SuperAdmin sees the group). */
registerSignInScope((u) => {
  try {
    window.localStorage.removeItem(SCOPE_KEY);
  } catch {
    /* ignore */
  }
  applyTenantScope(u);
});
/** Entities the signed-in user may work in: SuperAdmin → every entity of the group; everyone else → their own company. */
export function accessibleOrgs(u = getCurrentUser()) {
  const all = orgsStore.get();
  if (u.role === "SuperAdmin") {
    const g = u.groupId ?? all.find((o) => o.id === u.orgId)?.groupId ?? null;
    return g ? all.filter((o) => o.groupId === g) : all.filter((o) => o.id === u.orgId);
  }
  // Company Admin, Branch Admin and every other role: their own company only.
  return all.filter((o) => o.id === u.orgId);
}
export const groupOf = (u = getCurrentUser()) =>
  getGroup(u.groupId ?? orgsStore.get().find((o) => o.id === u.orgId)?.groupId ?? null);

export const useGroups = () => groupsStore.use();
export const useOrgs = () => orgsStore.use();
export const useActiveOrgId = () => activeOrgStore.use();

export const getOrg = (id) => orgsStore.get().find((o) => o.id === id) ?? null;
export const getGroup = (id) => groupsStore.get().find((g) => g.id === id) ?? null;

export const orgsOfGroup = (groupId) => orgsStore.get().filter((o) => o.groupId === groupId);

export function addGroup(input) {
  // Next free number — a count-based id collided with a surviving group after one was removed (two groups, one id).
  const n =
    groupsStore.get().reduce((m, g) => Math.max(m, Number(g.id.replace(/^GRP-/, "")) || 0), 0) + 1;
  const id = `GRP-${String(n).padStart(3, "0")}`;
  const row = { ...input, id, createdOn: new Date().toISOString().slice(0, 10) };
  groupsStore.set((p) => [...p, row]);
  return row;
}

export function addOrg(input) {
  const existing = orgsStore.get();
  let n = 1050 + existing.length;
  while (existing.some((o) => o.id === `ORG-${n}`)) n++;
  const id = input.id ?? `ORG-${n}`;
  const row = {
    branches: [],
    ...input,
    id,
    createdOn: input.createdOn ?? new Date().toISOString().slice(0, 10),
  };
  orgsStore.set((p) => [...p, row]);
  return row;
}

export const updateOrg = (id, patch) =>
  orgsStore.set((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));

export const updateGroup = (id, patch) =>
  groupsStore.set((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));

export const removeGroup = (id) => {
  groupsStore.set((p) => p.filter((g) => g.id !== id));
  orgsStore.set((p) => p.map((o) => (o.groupId === id ? { ...o, groupId: null } : o)));
};

export const assignOrgToGroup = (orgId, groupId) =>
  orgsStore.set((p) => p.map((o) => (o.id === orgId ? { ...o, groupId } : o)));

export const setOrgModules = (orgId, modules) =>
  orgsStore.set((p) => p.map((o) => (o.id === orgId ? { ...o, modules } : o)));

export const toggleOrgModule = (orgId, key) =>
  orgsStore.set((p) =>
    p.map((o) =>
      o.id === orgId
        ? {
            ...o,
            modules: o.modules.includes(key)
              ? o.modules.filter((m) => m !== key)
              : [...o.modules, key],
          }
        : o,
    ),
  );

export const isModuleEnabled = (orgId, key) => getOrg(orgId)?.modules.includes(key) ?? false;

export function useModuleEnabled(key) {
  const orgs = useOrgs();
  const orgId = useActiveOrgId();
  return orgs.find((o) => o.id === orgId)?.modules.includes(key) ?? false;
}

/* ------------------------------------------------------------------ */
/* Group joining dates + gratuity                                      */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} GroupEmployment
 * @property {string} employeeId
 * @property {string} name
 * @property {string} groupJoiningDate - First joining date anywhere in the group — drives gratuity.
 * @property {{ orgId: string, joiningDate: string, endDate?: string, designation: string, current: boolean }[]} records - Employment records across the group's legal entities.
 */

/** Employees whose group tenure predates their current entity (inter-company transfers). */
const GROUP_TRANSFERS = {
  "SRN-0005": {
    groupJoiningDate: "2017-06-12",
    from: {
      orgId: "ORG-1042",
      joiningDate: "2017-06-12",
      endDate: "2021-08-08",
      designation: "Systems Lead — SAP Basis",
    },
  },
  "SRN-0004": {
    groupJoiningDate: "2018-03-05",
    from: {
      orgId: "ORG-1043",
      joiningDate: "2018-03-05",
      endDate: "2021-02-14",
      designation: "HR Manager — Cloud Services",
    },
  },
  "SRN-0002": {
    groupJoiningDate: "2016-08-01",
    from: {
      orgId: "ORG-1044",
      joiningDate: "2016-08-01",
      endDate: "2020-01-12",
      designation: "Finance Controller",
    },
  },
};

const overrides = createStore({});

/** Group joining date for an employee (falls back to their org joining date). */
export function groupJoiningDate(employeeId, orgJoiningDate) {
  const manual = overrides.get()[employeeId];
  if (manual) return manual;
  const seeded = GROUP_TRANSFERS[employeeId]?.groupJoiningDate;
  if (seeded) return seeded;
  const user = userById(employeeId);
  // `groupDoj` on the user record is the first joining date anywhere in the group (drives gratuity) — it must win
  // over the current entity's joining date.
  return user?.groupDoj || orgJoiningDate || user?.doj || "2022-01-01";
}

export function useGroupJoiningDate(employeeId, orgJoiningDate) {
  overrides.use();
  return groupJoiningDate(employeeId, orgJoiningDate);
}

export const setGroupJoiningDate = (employeeId, date) =>
  overrides.set((p) => ({ ...p, [employeeId]: date }));

/**
 * @typedef {Object} Gratuity
 * @property {number} years
 * @property {number} months
 * @property {string} tenureLabel
 * @property {boolean} eligible
 * @property {number} countedYears - Completed years counted for gratuity (>= 6 months rounds up).
 * @property {number} lastDrawnBasic
 * @property {number} accrued
 * @property {string} nextMilestone
 */

export function computeGratuity(fromDate, lastDrawnBasicMonthly = 62500) {
  const start = new Date(fromDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const countedYears = rem >= 6 ? years + 1 : years;
  const eligible = months >= 12 * 5;
  const accrued = Math.round((15 / 26) * lastDrawnBasicMonthly * countedYears);
  const toFive = Math.max(0, 60 - months);
  return {
    years,
    months: rem,
    tenureLabel: `${years} yr ${rem} mo`,
    eligible,
    countedYears,
    lastDrawnBasic: lastDrawnBasicMonthly,
    accrued,
    nextMilestone: eligible
      ? "Vested — payable on separation"
      : `${Math.floor(toFive / 12)} yr ${toFive % 12} mo to 5-year vesting`,
  };
}

/** Group-level directory: one row per person, with all their group employments. */
export function groupDirectory(groupId) {
  const orgIds = orgsOfGroup(groupId).map((o) => o.id);
  return SEEREON_USERS.filter((u) => orgIds.includes(u.orgId)).map((u) => {
    const prior = GROUP_TRANSFERS[u.id];
    const records = [];
    if (prior && orgIds.includes(prior.from.orgId)) {
      records.push({ ...prior.from, current: false });
    }
    records.push({ orgId: u.orgId, joiningDate: u.doj, designation: u.designation, current: true });
    return {
      employeeId: u.id,
      name: u.name,
      groupJoiningDate: groupJoiningDate(u.id, u.doj),
      records,
    };
  });
}

/** Cross-org directory grouped by company group, used by the group-wide view (org.groups.tsx). */
export function allGroupDirectories() {
  return groupsStore.get().map((g) => ({ group: g, people: groupDirectory(g.id) }));
}

export const addBranch = (orgId, b) =>
  orgsStore.set((p) =>
    p.map((o) => {
      if (o.id !== orgId) return o;
      const list = o.branches ?? [];
      // Next free number — a count-based id would collide with a surviving branch after one was removed.
      const n = list.reduce((m, x) => Math.max(m, Number(x.id.split("-BR-")[1]) || 0), 0) + 1;
      return {
        ...o,
        branches: [...list, { ...b, id: `${orgId}-BR-${String(n).padStart(2, "0")}` }],
      };
    }),
  );
export const removeBranch = (orgId, branchId) =>
  orgsStore.set((p) =>
    p.map((o) =>
      o.id === orgId ? { ...o, branches: (o.branches ?? []).filter((b) => b.id !== branchId) } : o,
    ),
  );
/** Seed branches so the Group › Company › Branch tree is visible for the Seereon Group demo. Branch names match the
 *  `branch` of the employees in each company, so branch-level views and Branch Admins see the right people. */
// Only the seeded Seereon entities get demo branches — an organisation onboarded from the console keeps exactly the
// branches it was created with.
const SEEREON_BRANCHES = {
  [ORGANIZATION.id]: [
    ["Bhubaneswar HQ", "Bhubaneswar", "Odisha", "Khandagiri, Bhubaneswar 751003", "Santosh Nayak"],
    ["Pune", "Pune", "Maharashtra", "Hinjewadi Phase 1, Pune 411057", "Nikhil Deshpande"],
    ["Mumbai", "Mumbai", "Maharashtra", "Andheri East, Mumbai 400069", "Branch head"],
    ["Chennai", "Chennai", "Tamil Nadu", "OMR, Chennai 600097", "Branch head"],
  ],
  "ORG-1042": [
    [
      "Hyderabad Office",
      "Hyderabad",
      "Telangana",
      "Cyber Towers, HITEC City, Hyderabad 500081",
      "Devraj Solanki",
    ],
    ["Bhubaneswar HQ", "Bhubaneswar", "Odisha", "Khandagiri, Bhubaneswar 751003", "Prakash Mishra"],
  ],
  "ORG-1043": [
    [
      "Pune Office",
      "Pune",
      "Maharashtra",
      "Tower B, Hinjewadi Phase 1, Pune 411057",
      "Ritesh Barman",
    ],
    ["Bhubaneswar HQ", "Bhubaneswar", "Odisha", "Khandagiri, Bhubaneswar 751003", "Ankita Sahu"],
  ],
  "ORG-1044": [
    [
      "Kolkata Office",
      "Kolkata",
      "West Bengal",
      "Sector V, Salt Lake, Kolkata 700091",
      "Yashodhara Naik",
    ],
    ["Bhubaneswar HQ", "Bhubaneswar", "Odisha", "Khandagiri, Bhubaneswar 751003", "Rohan Das"],
  ],
};
orgsStore.set((p) =>
  p.map((o) =>
    o.branches || !SEEREON_BRANCHES[o.id]
      ? o
      : {
          ...o,
          branchMode: "branches",
          branches: SEEREON_BRANCHES[o.id].map(([name, city, state, address, head], i) => ({
            id: `${o.id}-BR-${String(i + 1).padStart(2, "0")}`,
            name,
            city,
            state,
            address,
            head,
          })),
        },
  ),
);

/** Branches a person can pick or be placed in (hidden head offices and deactivated branches are not offered). */
export const visibleBranches = (org) =>
  (org?.branches ?? []).filter((b) => !b.hidden && b.status !== "Inactive");

/** Every real (non-hidden) branch, active or not — for the structure screens. */
export const allBranches = (org) => (org?.branches ?? []).filter((b) => !b.hidden);

/** Edit a branch in place (name, location, head, status). */
export const updateBranch = (orgId, branchId, patch) =>
  orgsStore.set((p) =>
    p.map((o) =>
      o.id === orgId
        ? {
            ...o,
            branches: (o.branches ?? []).map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
          }
        : o,
    ),
  );
