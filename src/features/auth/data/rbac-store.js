// Persistent RBAC: roles created in Roles & Permissions live here (with their screens, permissions, branch scope
// and user assignments), plus login / account state for Users & Logins. UI-only, persisted in the browser.
import { createPersistentStore } from "@/lib/persist";
import { RBAC_MODULES, ROLES, ROLE_PERMISSION_PRESETS, screenId } from "@/features/auth/data/rbac";
import {
  SEEREON_USERS,
  allUsers,
  userById,
  ROLE_ACTIONS,
  ACTIONS,
  registerExtraUsers,
  registerNavExtension,
  registerPasswordChanged,
  registerPasswordRules,
  setPassword,
  ROLE_NAV,
} from "@/features/auth/data/auth-session";
import { delegationStore, effectiveStatus } from "@/features/administration/data/delegation-data";
import { orgsStore } from "@/features/organization/data/group-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { registerEmployee } from "@/features/employees/data/employee-directory";

/**
 * @typedef {RoleRecord & { permissions: PermissionSelection, branches: string[], assignedUsers: Record<string, string[]>, builtIn?: boolean, createdBy?: string, createdOn?: string, history: { at: string, by: string, action: string }[] }} RoleDef
 */

const today = () => new Date().toISOString().slice(0, 10);

/** Expand a module-level preset ("employee": View/Edit) into screen-level permissions. */
function presetToPermissions(preset) {
  const out = {};
  if (!preset) return out;
  RBAC_MODULES.forEach((m) => {
    const actions = preset[m.key];
    if (!actions) return;
    m.submodules.forEach((s) =>
      s.screens.forEach((sc) => {
        out[screenId(m.key, s.key, sc.key)] = {
          View: actions.includes("View"),
          Edit: actions.includes("Edit"),
          Delete: actions.includes("Delete"),
        };
      }),
    );
  });
  return out;
}

const SEED = ROLES.map((r) => {
  const permissions = presetToPermissions(ROLE_PERMISSION_PRESETS[r.name]);
  return {
    ...r,
    permissions,
    screens: Object.keys(permissions).length || r.screens,
    branches: [
      "Bhubaneswar HQ::Whitefield",
      "Bhubaneswar HQ::Koramangala",
      "Mumbai::BKC",
      "Pune::Hinjewadi",
      "Chennai::OMR",
    ],
    assignedUsers: {},
    builtIn: true,
    createdBy: "System",
    createdOn: "2026-05-01",
    history: [{ at: r.updated, by: "System", action: "Seeded role" }],
  };
});

export const roleStore = createPersistentStore("seereon.rbac.roles.v1", SEED);
export const useRoles = () => roleStore.use();
export const roleById = (id) => roleStore.get().find((r) => r.id === id);

/**
 * @typedef {Object} SaveRoleInput
 * @property {string} [id]
 * @property {string} name
 * @property {string} description
 * @property {PermissionSelection} permissions
 * @property {string[]} branches
 * @property {Record<string, string[]>} assignedUsers
 * @property {RoleDef["status"]} [status]
 * @property {string} by
 */
export function saveRole(input) {
  const users = Object.values(input.assignedUsers).filter((b) => b.length > 0).length;
  const screens = Object.values(input.permissions).filter((p) => p.View).length;
  if (input.id) {
    // People newly given the role while editing are told too (only a brand-new role used to alert its assignees).
    const before = roleStore.get().find((r) => r.id === input.id)?.assignedUsers ?? {};
    Object.keys(input.assignedUsers)
      .filter((u) => input.assignedUsers[u].length && !(before[u] ?? []).length)
      .forEach((u) =>
        pushAlert({
          empId: u,
          kind: "general",
          to: "/emp/dashboard",
          title: `Role granted — ${input.name}`,
          body: `${input.by} granted you the "${input.name}" role on ${input.assignedUsers[u].length} branch(es).`,
        }),
      );
    roleStore.set((p) =>
      p.map((r) =>
        r.id === input.id
          ? {
              ...r,
              name: input.name,
              description: input.description,
              permissions: input.permissions,
              branches: input.branches,
              assignedUsers: input.assignedUsers,
              users,
              screens,
              status: input.status ?? r.status,
              updated: today(),
              history: [{ at: today(), by: input.by, action: "Role updated" }, ...r.history],
            }
          : r,
      ),
    );
    return input.id;
  }
  // Next free number — a count-based id would reuse the id of a surviving role after one was deleted.
  const n =
    roleStore.get().reduce((m, r) => Math.max(m, Number(r.id.replace(/^ROL-/, "")) || 0), 0) + 1;
  const id = `ROL-${String(n).padStart(2, "0")}`;
  roleStore.set((p) => [
    ...p,
    {
      id,
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      branches: input.branches,
      assignedUsers: input.assignedUsers,
      users,
      screens,
      status: input.status ?? "Active",
      updated: today(),
      createdBy: input.by,
      createdOn: today(),
      history: [{ at: today(), by: input.by, action: "Role created" }],
    },
  ]);
  Object.keys(input.assignedUsers)
    .filter((u) => input.assignedUsers[u].length)
    .forEach((u) =>
      pushAlert({
        empId: u,
        kind: "general",
        to: "/emp/dashboard",
        title: `Role granted — ${input.name}`,
        body: `${input.by} granted you the "${input.name}" role on ${input.assignedUsers[u].length} branch(es).`,
      }),
    );
  return id;
}
/** Deletes a custom role (built-ins are protected). Returns the removed role so the caller can archive it. */
export const deleteRole = (id) => {
  const role = roleStore.get().find((r) => r.id === id && !r.builtIn) ?? null;
  if (role) roleStore.set((p) => p.filter((r) => r.id !== id));
  return role;
};
/** Puts an archived role back (restore from System Archive); false when the id or name is taken again. */
export const restoreRole = (role) => {
  if (
    roleStore
      .get()
      .some(
        (r) => r.id === role.id || r.name.trim().toLowerCase() === role.name.trim().toLowerCase(),
      )
  )
    return false;
  roleStore.set((p) => [
    ...p,
    {
      ...role,
      history: [{ at: today(), by: "System", action: "Restored from archive" }, ...role.history],
    },
  ]);
  return true;
};
export const setRoleStatus = (id, status, by) =>
  roleStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? {
            ...r,
            status,
            updated: today(),
            history: [{ at: today(), by, action: `Status → ${status}` }, ...r.history],
          }
        : r,
    ),
  );

/** Screen names granted by a role (for review / delegation display). */
export function roleScreens(role) {
  const out = [];
  RBAC_MODULES.forEach((m) =>
    m.submodules.forEach((s) =>
      s.screens.forEach((sc) => {
        const p = role.permissions[screenId(m.key, s.key, sc.key)];
        if (p?.View)
          out.push({
            module: m.name,
            screen: sc.name,
            actions: ["View", "Edit", "Delete"].filter((a) => p[a]),
          });
      }),
    ),
  );
  return out;
}

/** RBAC roles granted to a user (across branches). */
export const rolesOfUser = (userId) =>
  roleStore.get().filter((r) => (r.assignedUsers[userId] ?? []).length > 0);

/* -------------------- RBAC roles widen navigation -------------------- */

/** Where each RBAC screen lives in the app — a granted screen opens its route for the holder. */
export const SCREEN_ROUTES = {
  "org-dashboard": "/org/dashboard",
  reports: "/org/reports",
  "all-employees": "/org/employees",
  "employee-profile": "/org/employees",
  "add-employee": "/org/employees",
  promotions: "/org/employees",
  transfers: "/org/employees",
  referrals: "/org/employees",
  "employee-docs": "/org/employees",
  warnings: "/org/employees",
  resignations: "/org/exits",
  terminations: "/org/exits",
  complaints: "/org/grievances",
  letters: "/org/masters",
  templates: "/org/masters",
  masters: "/org/masters",
  infrastructure: "/org/masters",
  policies: "/org/masters",
  "job-locations": "/org/masters",
  "recruitment-config": "/org/masters",
  insurance: "/org/claims",
  "insurance-claims": "/org/claims",
  reimbursements: "/org/claims",
  "attendance-log": "/org/attendance",
  regularization: "/org/attendance",
  "work-hours": "/org/attendance",
  penalties: "/org/attendance",
  "shift-master": "/org/attendance",
  roster: "/org/attendance",
  "leave-requests": "/org/leave",
  "leave-approvals": "/org/leave",
  "leave-balance": "/org/leave",
  "leave-types": "/org/leave",
  "holiday-calendar": "/org/holidays",
  "timesheet-log": "/org/timesheets",
  "timesheet-approvals": "/org/timesheets",
  "timesheet-formats": "/org/timesheets",
  "salary-structure": "/org/finance",
  "payroll-run": "/org/finance",
  payslips: "/org/finance",
  "loan-requests": "/org/finance",
  repayments: "/org/finance",
  "recruitment-pipeline": "/org/recruitment",
  "job-postings": "/org/recruitment/postings",
  "candidate-list": "/org/recruitment/candidates",
  assessments: "/org/recruitment/interviews",
  interviews: "/org/recruitment/interviews",
  rounds: "/org/recruitment/interviews",
  offers: "/org/recruitment/offers",
  "review-cycles": "/org/performance",
  "employee-reviews": "/org/performance",
  appraisals: "/org/performance",
  "perf-indicators": "/org/performance",
  "indicator-categories": "/org/performance",
  "goal-types": "/org/goals",
  trainings: "/org/training",
  "training-types": "/org/training",
  trainers: "/org/training",
  "support-tickets": "/helpdesk",
  announcements: "/org/announcements",
  tasks: "/org/tasks",
  settings: "/org/settings",
  users: "/org/users",
  roles: "/org/roles",
  "temporary-access": "/org/users",
  "asset-register": "/org/assets",
  "asset-licenses": "/org/assets",
  "asset-issuance": "/org/assets",
  "asset-transfers": "/org/assets",
  "asset-requests": "/org/assets",
  "my-assets": "/emp/assets",
  "my-tours": "/emp/tours",
  "all-tours": "/org/tours",
  "tour-approvals": "/org/tours",
};

/** Branch id of the branch a user works in (Branch Admins carry it; everyone else by branch name in their company). */
function userBranchId(user) {
  if (!user) return null;
  if (user.branchId) return user.branchId;
  const org = orgsStore.get().find((o) => o.id === user.orgId);
  return (org?.branches ?? []).find((b) => b.name === user.branch)?.id ?? null;
}
/**
 * Does a role assignment cover the user's branch? Assignments on real branch ids are honoured (the branch scope used to
 * be ignored, so a role granted "on Pune" opened its screens everywhere). Assignments saved with the retired demo
 * branch list ("Office::Branch") cannot be mapped to a branch and keep applying as before.
 */
function assignmentCovers(ids, user) {
  if (!ids.length) return false;
  if (ids.every((id) => id.includes("::"))) return true;
  const mine = userBranchId(user);
  return !mine || ids.includes(mine);
}

/** Routes a user's ACTIVE custom roles open for them (View permission on the screen, on the user's branch). */
export function rbacRoutesFor(userId) {
  const routes = new Set();
  const user = userById(userId);
  for (const role of roleStore.get()) {
    if (role.status !== "Active") continue;
    if (!assignmentCovers(role.assignedUsers[userId] ?? [], user)) continue;
    RBAC_MODULES.forEach((m) =>
      m.submodules.forEach((sm) =>
        sm.screens.forEach((sc) => {
          if (role.permissions[screenId(m.key, sm.key, sc.key)]?.View) {
            const route = SCREEN_ROUTES[sc.key];
            if (route) routes.add(route);
          }
        }),
      ),
    );
  }
  return routes;
}

// A screen granted through Roles & Permissions opens for the holder even when their base role's menu
// does not include it — the roles screen used to save assignments without actually widening access.
registerNavExtension((user, pathname) =>
  [...rbacRoutesFor(user.id)].some((p) => pathname === p || pathname.startsWith(p + "/")),
);

/* ---------------- Temporary access & delegations widen navigation ---------------- */

const SEED_TEMP_GRANTS = [
  {
    id: "TMP-001",
    user: "Priya Nair",
    branch: "Bhubaneswar HQ",
    from: "2026-07-25",
    to: "2026-08-08",
    reason: "Covering payroll while the Payroll Admin is on leave",
    screens: [
      {
        id: "payroll.run.payroll-run",
        label: "Payroll › Payroll Run › Process Payroll",
        perms: ["View", "Edit"],
      },
      { id: "payroll.run.payslips", label: "Payroll › Payroll Run › Payslips", perms: ["View"] },
    ],
    status: "Active",
  },
];
/** Time-boxed grants from Roles & Permissions → Temporary Access (moved here so access checks can read them). */
export const tempGrantStore = createPersistentStore(
  "seereon.rbac.temp-grants.v1",
  SEED_TEMP_GRANTS,
);
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Routes opened by the user's live temporary grants (Active, inside the from → to window, View permission). */
export function tempGrantRoutesFor(user) {
  const t = istToday();
  const routes = new Set();
  for (const g of tempGrantStore.get()) {
    if (g.status !== "Active" || g.from > t || g.to < t) continue;
    const mine = g.userEmail
      ? g.userEmail.toLowerCase() === user.email?.toLowerCase()
      : g.user === user.name;
    if (!mine) continue;
    g.screens.forEach((sc) => {
      if (!sc.perms.includes("View")) return;
      const route = SCREEN_ROUTES[sc.id.split(".").pop()];
      if (route) routes.add(route);
    });
  }
  return routes;
}

/** Delegated module → the admin-portal screen it covers. */
export const DELEGATION_ROUTES = {
  Leave: "/org/leave",
  Timesheets: "/org/timesheets",
  Tasks: "/org/tasks",
  Goals: "/org/goals",
  Performance: "/org/performance",
  Training: "/org/training",
  Recruitment: "/org/recruitment",
  Finance: "/org/finance",
  Claims: "/org/claims",
  Announcements: "/org/announcements",
  Employees: "/org/employees",
};
/** Delegations the user currently holds (approved, inside the start → end window). */
export function activeDelegationsTo(userId) {
  const t = today();
  return delegationStore
    .get()
    .filter((d) => d.toId === userId && effectiveStatus(d) === "Active" && d.start <= t);
}
/** Screens a live delegation hands over — only those the delegator could open themselves. */
export function delegationRoutesFor(user) {
  const routes = new Set();
  for (const d of activeDelegationsTo(user.id)) {
    const nav = ROLE_NAV[userById(d.fromId)?.role] ?? [];
    d.modules.forEach((m) => {
      const r = DELEGATION_ROUTES[m];
      if (r && (nav === "*" || nav.includes(r))) routes.add(r);
    });
  }
  return routes;
}
// Temporary access and approved delegations used to be recorded and listed but granted nothing.
registerNavExtension((user, pathname) =>
  [...tempGrantRoutesFor(user), ...delegationRoutesFor(user)].some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  ),
);

/* ------------------------------ Users & logins ------------------------------ */
/**
 * @typedef {"Active" | "Invited" | "Suspended" | "Locked"} LoginStatus
 */
/**
 * @typedef {Object} LoginRecord
 * @property {string} userId
 * @property {LoginStatus} status
 * @property {boolean} mfa
 * @property {string} [lastLogin]
 * @property {string} [lastIp]
 * @property {string} [lastDevice]
 * @property {number} failedAttempts
 * @property {string} [passwordChangedOn]
 * @property {boolean} mustReset
 * @property {number} sessions
 * @property {string} [revokedAt] - ISO time sessions were revoked / the account suspended; sessions opened before it end.
 * @property {string} [invitedOn]
 * @property {string} [invitedBy]
 * @property {string} [notes]
 * @property {{ at: string, by: string, action: string }[]} history
 */
/**
 * @typedef {AppUser & { invitedOn: string }} InvitedUser
 */

// Fixed anchor so server and client render identical "last sign-in" times (no hydration mismatch).
const SEED_ANCHOR = Date.parse("2026-09-17T09:15:00+05:30");
const seedLogin = (u, i) => ({
  userId: u.id,
  status: "Active",
  mfa: u.role === "SuperAdmin" || u.role === "Admin" || u.role === "CFO" || u.role === "CHRO",
  lastLogin: new Date(SEED_ANCHOR - (i % 7) * 86400000 - ((i * 37) % 24) * 3600000).toISOString(),
  lastIp: `10.20.${(i * 7) % 255}.${(i * 13) % 255}`,
  lastDevice:
    i % 3 === 0 ? "Chrome · Windows 11" : i % 3 === 1 ? "Safari · macOS" : "Chrome · Android",
  failedAttempts: 0,
  passwordChangedOn: `2026-0${(i % 6) + 1}-1${i % 9}`,
  mustReset: false,
  sessions: i % 4 === 0 ? 2 : 1,
  history: [{ at: "2026-05-01", by: "System", action: "Account provisioned" }],
});
const LOGIN_SEED = Object.fromEntries(SEEREON_USERS.map((u, i) => [u.id, seedLogin(u, i)]));
// A couple of realistic states
if (LOGIN_SEED["SRN-0016"])
  LOGIN_SEED["SRN-0016"] = {
    ...LOGIN_SEED["SRN-0016"],
    status: "Locked",
    failedAttempts: 5,
    history: [
      ...LOGIN_SEED["SRN-0016"].history,
      { at: "2026-09-16", by: "System", action: "Locked after 5 failed attempts" },
    ],
  };
if (LOGIN_SEED["SRN-0015"]) LOGIN_SEED["SRN-0015"] = { ...LOGIN_SEED["SRN-0015"], mustReset: true };

export const loginStore = createPersistentStore("seereon.rbac.logins.v1", LOGIN_SEED);
export const invitedStore = createPersistentStore("seereon.rbac.invited.v1", []);
export const useLogins = () => loginStore.use();
export const useInvited = () => invitedStore.use();
// Invited users can sign in with the welcome password until they reset it.
registerExtraUsers(() => invitedStore.get());
/** An invited user also needs an employee-directory record, otherwise the Employee portal falls back to another person's profile. */
const invitedToEmployee = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  dept: u.dept,
  role: u.designation,
  branch: u.branch,
  status: "Active",
  orgId: u.orgId,
});
// Invitations persisted from earlier sessions are re-registered on load (client only — the store is empty on the server).
invitedStore.get().forEach((u) => registerEmployee(invitedToEmployee(u)));
export const loginOf = (userId) =>
  loginStore.get()[userId] ?? {
    userId,
    status: "Active",
    mfa: false,
    failedAttempts: 0,
    mustReset: false,
    sessions: 0,
    history: [],
  };

const patchLogin = (userId, by, action, patch) =>
  loginStore.set((p) => {
    const cur = p[userId] ?? loginOf(userId);
    return {
      ...p,
      [userId]: { ...cur, ...patch, history: [{ at: today(), by, action }, ...cur.history] },
    };
  });
// A user who sets their own password (self-service or forgot-password) clears the "reset pending" flag on their login record.
registerPasswordChanged((userId) => {
  if (!loginStore.get()[userId]) return;
  patchLogin(userId, userById(userId)?.name ?? userId, "Password changed by user", {
    mustReset: false,
    passwordChangedOn: today(),
    failedAttempts: 0,
  });
});

/** Admin-chosen temporary password (User Assignment): applies it and flags the login so the user must replace it. */
export function issueTemporaryPassword(userId, password, by) {
  const r = setPassword(userId, password);
  if (!r.ok) return r;
  patchLogin(userId, by, "Temporary password set by administrator", {
    mustReset: true,
    failedAttempts: 0,
  });
  pushAlert({
    empId: userId,
    kind: "general",
    to: "/emp/profile",
    title: "A temporary password was set for you",
    body: `${by} set a temporary password. Sign in and choose your own from My Profile → Sign-in & security.`,
  });
  return r;
}

export function resetPassword(userId, by) {
  // Long enough for the saved sign-in policy (a fixed 10 characters was rejected by a stricter policy while the
  // administrator was still shown it as the new password).
  const len = Math.max(10, signInPolicy().minLen || 0);
  let core = "";
  while (core.length < len - 6) core += Math.random().toString(36).slice(2).toUpperCase();
  const temp = `Srn@${core.slice(0, len - 6)}${Math.floor(Math.random() * 90 + 10)}`;
  // the issued temporary password is what the user signs in with from now on
  if (!setPassword(userId, temp).ok) return null;
  patchLogin(userId, by, "Password reset — temporary password issued", {
    mustReset: true,
    failedAttempts: 0,
    status: loginOf(userId).status === "Locked" ? "Active" : loginOf(userId).status,
  });
  pushAlert({
    empId: userId,
    kind: "general",
    to: "/emp/profile",
    title: "Your password was reset",
    body: `${by} issued a temporary password. Sign in and set a new one from My Profile → Sign-in & security.`,
  });
  return temp;
}
/* ------------------------------ Sign-in policy ------------------------------ */
/**
 * @typedef {Object} SignInPolicyConfig
 * @property {number} minLen
 * @property {boolean} upper
 * @property {boolean} number
 * @property {boolean} symbol
 * @property {number} expiryDays
 * @property {number} lockAfter
 * @property {number} lockMinutes
 * @property {boolean} mfaAdmins
 * @property {boolean} mfaAll
 * @property {number} sessionMinutes
 * @property {number} rememberDays
 * @property {boolean} sso
 * @property {string} [updatedOn]
 * @property {string} [updatedBy]
 */
export const DEFAULT_SIGNIN_POLICY = {
  minLen: 8,
  upper: true,
  number: true,
  symbol: true,
  expiryDays: 90,
  lockAfter: 5,
  lockMinutes: 30,
  mfaAdmins: true,
  mfaAll: false,
  sessionMinutes: 30,
  rememberDays: 14,
  sso: false,
};
/** Saved from Users & Logins → Sign-in policy. The screen promised "enforced at sign-in and on password change" but nothing read it —
 *  the password rules and the lock-out threshold now come from here. */
export const signInPolicyStore = createPersistentStore(
  "seereon.rbac.signin-policy.v1",
  DEFAULT_SIGNIN_POLICY,
);
export const signInPolicy = () => ({ ...DEFAULT_SIGNIN_POLICY, ...signInPolicyStore.get() });
registerPasswordRules(() => {
  const p = signInPolicy();
  return { minLen: p.minLen, upper: p.upper, number: p.number, symbol: p.symbol };
});

/** Wrong password at sign-in: counted on the login record and locked after the policy's attempt limit (default 5). */
export function recordFailedSignIn(userId) {
  const cur = loginOf(userId);
  const failedAttempts = cur.failedAttempts + 1;
  const limit = Math.max(3, signInPolicy().lockAfter || 5);
  if (failedAttempts >= limit && cur.status !== "Locked")
    patchLogin(userId, "System", `Locked after ${limit} failed attempts`, {
      failedAttempts,
      status: "Locked",
    });
  else loginStore.set((p) => ({ ...p, [userId]: { ...(p[userId] ?? cur), failedAttempts } }));
  return failedAttempts;
}
/** Successful sign-in: clears the failed-attempt counter and stamps the last login. */
export const recordSignIn = (userId) =>
  loginStore.set((p) => {
    const cur = p[userId] ?? loginOf(userId);
    return {
      ...p,
      [userId]: {
        ...cur,
        failedAttempts: 0,
        lastLogin: new Date().toISOString(),
        sessions: Math.max(1, cur.sessions),
      },
    };
  });
export const suspendUser = (userId, by, reason) =>
  patchLogin(userId, by, `Suspended — ${reason}`, {
    status: "Suspended",
    sessions: 0,
    notes: reason,
    revokedAt: new Date().toISOString(),
  });
export const reactivateUser = (userId, by) =>
  patchLogin(userId, by, "Reactivated", { status: "Active", failedAttempts: 0 });
export const unlockUser = (userId, by) =>
  patchLogin(userId, by, "Unlocked", { status: "Active", failedAttempts: 0 });
export const revokeSessions = (userId, by) =>
  patchLogin(userId, by, "All sessions revoked", {
    sessions: 0,
    revokedAt: new Date().toISOString(),
  });
/**
 * Must the open browser session of this user end now? Suspended accounts, and sessions revoked after the user last
 * signed in (Revoke all sessions / Suspend) — the shells used to keep such a user working until they signed out.
 * Locked accounts keep their open session (someone else's failed attempts must not throw the owner out).
 */
export function sessionEnded(userId) {
  const l = loginStore.get()[userId];
  if (!l) return false;
  if (l.status === "Suspended") return true;
  return !!l.revokedAt && (!l.lastLogin || l.lastLogin < l.revokedAt);
}
export const setMfa = (userId, on, by) =>
  patchLogin(userId, by, on ? "MFA enforced" : "MFA relaxed", { mfa: on });
export const grantRbacRole = (userId, roleId, branches, by) => {
  roleStore.set((p) =>
    p.map((r) =>
      r.id === roleId
        ? {
            ...r,
            assignedUsers: { ...r.assignedUsers, [userId]: branches },
            users: Object.values({ ...r.assignedUsers, [userId]: branches }).filter((b) => b.length)
              .length,
            history: [
              { at: today(), by, action: `Granted to ${userById(userId)?.name ?? userId}` },
              ...r.history,
            ],
          }
        : r,
    ),
  );
  patchLogin(userId, by, `Role granted — ${roleById(roleId)?.name ?? roleId}`, {});
};
export const revokeRbacRole = (userId, roleId, by) => {
  roleStore.set((p) =>
    p.map((r) => {
      if (r.id !== roleId) return r;
      const next = { ...r.assignedUsers };
      delete next[userId];
      return {
        ...r,
        assignedUsers: next,
        users: Object.values(next).filter((b) => b.length).length,
        history: [
          { at: today(), by, action: `Revoked from ${userById(userId)?.name ?? userId}` },
          ...r.history,
        ],
      };
    }),
  );
  patchLogin(userId, by, `Role revoked — ${roleById(roleId)?.name ?? roleId}`, {});
};

export function inviteUser(input, by) {
  const n =
    invitedStore
      .get()
      .reduce((m, u) => Math.max(m, Number(u.id.replace(/^SRN-INV-/, "")) || 0), 0) + 1;
  const id = `SRN-INV-${String(n).padStart(3, "0")}`;
  // The e-mail is the sign-in identifier — a second account on it would be unreachable.
  if (allUsers().some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))
    throw new Error(`An account already exists for ${input.email}`);
  const user = {
    id,
    name: input.name,
    email: input.email,
    role: input.role,
    designation: input.designation,
    dept: input.dept,
    branch: input.branch,
    // Branch Admins are locked to their branch by id (scope lookup) — it was never stored for invited accounts.
    ...(input.role === "BranchAdmin" && input.branchId ? { branchId: input.branchId } : {}),
    phone: input.phone ?? "",
    managerId: input.managerId ?? null,
    hrPartnerId: null,
    doj: today(),
    orgId: input.orgId,
    groupId: input.groupId ?? "GRP-001",
    portal: input.role === "Employee" ? "emp" : "org",
    password: "Welcome@123",
    invitedOn: today(),
  };
  invitedStore.set((p) => [...p, user]);
  registerEmployee(invitedToEmployee(user));
  loginStore.set((p) => ({
    ...p,
    [id]: {
      userId: id,
      status: "Invited",
      mfa: input.role !== "Employee",
      failedAttempts: 0,
      mustReset: true,
      sessions: 0,
      invitedOn: today(),
      invitedBy: by,
      history: [{ at: today(), by, action: "Invitation sent" }],
    },
  }));
  (input.roleIds ?? []).forEach((rid) => grantRbacRole(id, rid, input.branches ?? [], by));
  return user;
}
export const resendInvite = (userId, by) =>
  patchLogin(userId, by, "Invitation re-sent", { invitedOn: today() });

/** Everyone who can sign in: seeded users + invited. */
export const useLoginUsers = () => {
  invitedStore.use(); // re-render when invitations change (invited users are registered as extra users)
  const seen = new Set();
  return allUsers().filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
};

/** Action-level permissions from the app role (what the role can DO), grouped by module prefix. */
export function roleActionGroups(role) {
  const list = ROLE_ACTIONS[role] === "*" ? [...ACTIONS] : ROLE_ACTIONS[role];
  const groups = {};
  list.forEach((a) => {
    const [mod, ...rest] = a.split(".");
    (groups[mod] = groups[mod] ?? []).push(rest.join("."));
  });
  return Object.entries(groups).map(([module, actions]) => ({ module, actions }));
}
