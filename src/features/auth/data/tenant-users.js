// Tenant accounts provisioned from the Seereon platform console (client Super Admins) and by Super Admins
// (entity Admins). Persisted in the browser and registered with auth-session so they can sign in.
import { createPersistentStore } from "@/lib/persist";
import {
  clearPasswordOverride,
  registerExtraUsers,
  registerPasswordChanged,
} from "@/features/auth/data/auth-session";

/**
 * @typedef {Object} TenantCredential
 * @property {AppUser} user
 * @property {string} createdOn
 * @property {string} createdBy
 * @property {string} temporaryPassword - Shown once to the Seereon team and included in the credentials e-mail; the client changes it on first sign-in.
 * @property {string} [sharedOn]
 * @property {string} [sharedTo]
 * @property {boolean} forceChange
 */
export const tenantUserStore = createPersistentStore("seereon.platform.tenant-users", []);
export const useTenantUsers = () => tenantUserStore.use();
registerExtraUsers(() => tenantUserStore.get().map((t) => t.user));
// Once the client sets their own password the "change on first sign-in" requirement is satisfied.
registerPasswordChanged((userId) => {
  if (!tenantUserStore.get().some((t) => t.user.id === userId && t.forceChange)) return;
  tenantUserStore.set((l) =>
    l.map((t) => (t.user.id === userId ? { ...t, forceChange: false } : t)),
  );
});
/** True when this account still has to replace its temporary password (checked at sign-in). */
export const mustChangeTemporaryPassword = (userId) =>
  tenantUserStore.get().some((t) => t.user.id === userId && t.forceChange);

export const generatePassword = (seed) =>
  `${
    seed
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 4)
      .replace(/^./, (c) => c.toUpperCase()) || "Seer"
  }@${Math.floor(1000 + Math.random() * 9000)}!`;

/** Unique account id: a second Super Admin / Admin issued for the same organisation (different e-mail) must not share the id of the first. */
function nextTenantId(prefix, orgId, email) {
  const base = `${prefix}-${orgId.replace(/[^0-9A-Z]/gi, "").slice(-6)}`;
  const taken = (id) =>
    tenantUserStore.get().some((x) => x.user.id === id && x.user.email !== email);
  if (!taken(base)) return base;
  let n = 2;
  while (taken(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function provisionSuperAdmin(input) {
  const pw = input.password?.trim() || generatePassword(input.orgName);
  const email = input.email.trim().toLowerCase();
  const user = {
    id: nextTenantId("SA", input.orgId, email),
    name: input.name?.trim() || `${input.orgName} Super Admin`,
    email,
    role: "SuperAdmin",
    designation: "Group Super Administrator",
    dept: "Administration",
    branch: "Head office",
    phone: "",
    managerId: null,
    hrPartnerId: null,
    doj: new Date().toISOString().slice(0, 10),
    orgId: input.orgId,
    groupId: input.groupId ?? undefined,
    portal: "org",
    password: pw,
  };
  const row = {
    user,
    createdOn: new Date().toISOString().slice(0, 10),
    createdBy: input.by,
    temporaryPassword: pw,
    forceChange: input.forceChange ?? true,
  };
  tenantUserStore.set((l) => [row, ...l.filter((x) => x.user.email !== user.email)]);
  clearPasswordOverride(user.id); // a re-issued account starts from the temporary password again
  return row;
}
export function provisionEntityAdmin(input) {
  const pw = input.password?.trim() || generatePassword(input.orgName);
  const email = input.email.trim().toLowerCase();
  const user = {
    id: nextTenantId("AD", input.orgId, email),
    name: input.name?.trim() || `${input.orgName} Admin`,
    email,
    role: "Admin",
    designation: "Entity Administrator",
    dept: "Administration",
    branch: "Head office",
    phone: "",
    managerId: null,
    hrPartnerId: null,
    doj: new Date().toISOString().slice(0, 10),
    orgId: input.orgId,
    groupId: input.groupId ?? undefined,
    portal: "org",
    password: pw,
  };
  const row = {
    user,
    createdOn: new Date().toISOString().slice(0, 10),
    createdBy: input.by,
    temporaryPassword: pw,
    forceChange: true,
  };
  tenantUserStore.set((l) => [row, ...l.filter((x) => x.user.email !== user.email)]);
  clearPasswordOverride(user.id);
  return row;
}
/** Company Admin of one company / Branch Admin of one branch — issued by the Super Admin or by Seereon support. */
export function provisionBranchAdmin(input) {
  const pw = input.password?.trim() || generatePassword(input.orgName);
  const email = input.email.trim().toLowerCase();
  const user = {
    id: nextTenantId("BA", `${input.orgId}${input.branchId.split("-BR-")[1] ?? ""}`, email),
    name: input.name?.trim() || `${input.branchName} Branch Admin`,
    email,
    role: "BranchAdmin",
    designation: `Branch Administrator — ${input.branchName}`,
    dept: "Administration",
    branch: input.branchName,
    branchId: input.branchId,
    phone: "",
    managerId: null,
    hrPartnerId: null,
    doj: new Date().toISOString().slice(0, 10),
    orgId: input.orgId,
    groupId: input.groupId ?? undefined,
    portal: "org",
    password: pw,
  };
  const row = {
    user,
    createdOn: new Date().toISOString().slice(0, 10),
    createdBy: input.by,
    temporaryPassword: pw,
    forceChange: true,
  };
  tenantUserStore.set((l) => [row, ...l.filter((x) => x.user.email !== user.email)]);
  clearPasswordOverride(user.id);
  return row;
}
export const markShared = (email, to) =>
  tenantUserStore.set((l) =>
    l.map((x) =>
      x.user.email === email
        ? { ...x, sharedOn: new Date().toISOString().slice(0, 10), sharedTo: to }
        : x,
    ),
  );
export const resetTenantPassword = (email, orgName) => {
  const pw = generatePassword(orgName);
  tenantUserStore.set((l) =>
    l.map((x) =>
      x.user.email === email
        ? {
            ...x,
            user: { ...x.user, password: pw },
            temporaryPassword: pw,
            forceChange: true,
            sharedOn: undefined,
          }
        : x,
    ),
  );
  // A password the client changed themselves is stored as an override in auth-session — drop it so the new temporary password is what signs in.
  tenantUserStore
    .get()
    .filter((x) => x.user.email === email)
    .forEach((x) => clearPasswordOverride(x.user.id));
  return pw;
};
const roleLabel = (r) =>
  r === "SuperAdmin" ? "Super Admin" : r === "BranchAdmin" ? "Branch Admin" : "Company Admin";
/**
 * The credentials e-mail Seereon (or the Super Admin) sends to a new administrator. `loginUrl` is the organisation's
 * own login URL (/o/<slug> or its subdomain).
 */
export const credentialsEmail = (c, orgCode, loginUrl) => ({
  to: c.user.email,
  subject: `Your Seereon HRMS ${roleLabel(c.user.role)} access — ${orgCode}`,
  body: `Hello ${c.user.name},\n\nYour Seereon HRMS workspace is ready.\n\nSign in: ${loginUrl} → ${c.user.role === "SuperAdmin" ? "Super Admin" : "Admin"} tab\nUsername: ${c.user.email}\nTemporary password: ${c.temporaryPassword}${c.forceChange ? " (you will be asked to change it on first sign-in)" : ""}\n\nWhat you can do first:\n${
    c.user.role === "SuperAdmin"
      ? "1. Open Companies & Branches and complete your companies, branches and their administrators.\n2. Open Configuration and switch off anything your organisation will not use.\n3. Complete Master Data — departments, designations, leave & holiday calendars, salary structures."
      : c.user.role === "BranchAdmin"
        ? `1. Check the employees of ${c.user.branch}.\n2. Review attendance, leave and tours for your branch.`
        : "1. Complete Master Data for your company.\n2. Create roles & permissions and invite your HR team.\n3. Add employees (or import) — each employee receives their own login."
  }\n\nSupport: support@seereon.co.in · +91 90 9070 5533\nSeereon Consulting & IT Services Pvt. Ltd., Bhubaneswar`,
});
