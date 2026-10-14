// Shared, UI-only store of organization users and their branch-scoped roles.
// Persisted in the browser (it used to be in-memory, so every assignment made in Roles & Permissions → User Assignment /
// Branch Access vanished on reload), and kept in step with the RBAC role store that Users & Logins and the role cards
// read — otherwise a role granted here never showed up anywhere else.
import { createPersistentStore } from "@/lib/persist";
import { ORG_USERS } from "@/features/auth/data/rbac";
import { userByLogin } from "@/features/auth/data/auth-session";
import { roleStore, grantRbacRole, revokeRbacRole } from "@/features/auth/data/rbac-store";

export const userStore = createPersistentStore(
  "seereon.rbac.org-users.v1",
  ORG_USERS.map((u) => ({ ...u })),
);

export const useOrgUsers = () => userStore.use();

/** Next free USR number — a count-based id reused the id of an existing user once the list was edited. */
const nextUserId = (list) =>
  `USR-${String(list.reduce((m, u) => Math.max(m, Number(u.id.replace(/^USR-/, "")) || 0), 0) + 1).padStart(2, "0")}`;

/** Adds a user (status Invited) and returns the new id; an existing e-mail returns that user's id instead of a duplicate. */
export function addOrgUser(name, email) {
  const key = email.trim().toLowerCase();
  const existing = userStore.get().find((u) => u.email.toLowerCase() === key);
  if (existing) return existing.id;
  const id = nextUserId(userStore.get());
  userStore.set((list) => [
    ...list,
    { id, name, email: email.trim(), status: "Invited", assignments: [] },
  ]);
  return id;
}

export const updateOrgUser = (id, patch) =>
  userStore.set((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));

/** Mirrors a user's branch → role-name map onto the RBAC roles (grant / update / revoke) when the e-mail is a real login. */
function syncRbac(user, by) {
  if (!user) return;
  const login = userByLogin(user.email);
  if (!login) return;
  roleStore.get().forEach((role) => {
    const branches = user.assignments
      .filter((a) => a.roles.includes(role.name))
      .map((a) => a.branchId);
    const current = role.assignedUsers[login.id] ?? [];
    const same = current.length === branches.length && current.every((b) => branches.includes(b));
    if (same) return;
    if (branches.length) grantRbacRole(login.id, role.id, branches, by);
    else if (current.length) revokeRbacRole(login.id, role.id, by);
  });
}

/** Grant a role to a user on a set of branches. */
export function grantRole(userId, role, branchIds, by = "System") {
  userStore.set((list) =>
    list.map((u) => {
      if (u.id !== userId) return u;
      // Copy the assignment objects too — mutating `existing.roles` in place edited the previous state snapshot.
      const assignments = u.assignments.map((a) => ({ ...a, roles: [...a.roles] }));
      branchIds.forEach((branchId) => {
        const existing = assignments.find((a) => a.branchId === branchId);
        if (existing) existing.roles = Array.from(new Set([...existing.roles, role]));
        else assignments.push({ branchId, roles: [role] });
      });
      return { ...u, assignments };
    }),
  );
  syncRbac(
    userStore.get().find((u) => u.id === userId),
    by,
  );
}

/** Replace the full branch → roles map for a user. */
export const setUserAssignments = (userId, assignments, by = "System") => {
  updateOrgUser(userId, { assignments });
  syncRbac(
    userStore.get().find((u) => u.id === userId),
    by,
  );
};
