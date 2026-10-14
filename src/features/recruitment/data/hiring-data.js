// ---------------------------------------------------------------------------
// Employee Hiring Lifecycle — auto-provisioning and re-hire.
//
// The existing "Add Employee" form (org.employees.tsx) is presentation-only:
// every field is uncontrolled and "Create Employee" just closes the dialog
// without writing a record anywhere. Neither SEEREON_USERS nor EMPLOYEES is a
// reactive store (both are plain arrays, read synchronously from 40+ files
// across the app), so converting either into a live store directly is a much
// larger, riskier change than this priority calls for.
//
// Instead: new hires go into their own reactive store here, layered
// additively on top of the static rosters. `allKnownPeople()` merges both so
// anything that needs "every employee, including new hires" can get it, while
// every existing file that reads SEEREON_USERS/EMPLOYEES directly keeps
// working unchanged.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { saveWorkConfig } from "@/features/attendance/data/attendance-pattern";
import {
  SEEREON_USERS,
  allUsers,
  registerExtraUsers,
  userById,
} from "@/features/auth/data/auth-session";
import { EMPLOYEES, registerEmployee } from "@/features/employees/data/employee-directory";
import { getOrg } from "@/features/organization/data/group-data";

/** Known email domain per organisation, for auto-generating work email. Falls back to the org's slugified name. */
const ORG_DOMAINS = {
  "ORG-SEEREON": "seereon.co.in",
  "ORG-1042": "sap.seereon.co.in",
  "ORG-1043": "cloud.seereon.co.in",
  "ORG-1044": "products.seereon.co.in",
};

export function domainForOrg(orgId) {
  if (ORG_DOMAINS[orgId]) return ORG_DOMAINS[orgId];
  const org = getOrg(orgId);
  // The client's own mail domain (from the administrator e-mail given at onboarding) — new hires of a client used to get
  // an invented "<companyname>.com" address.
  const adminDomain = String(org?.adminEmail ?? "").split("@")[1];
  if (adminDomain) return adminDomain.toLowerCase();
  const slugified = (org?.name ?? "company").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slugified || "company"}.com`;
}

const slug = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** All existing work emails, across the static rosters and any new hires, for duplicate detection. */
function existingEmails() {
  const emails = new Set();
  // Every login on the platform (seeded, issued, invited, other organisations) — a work e-mail must be unique.
  for (const u of allUsers()) emails.add(u.email.toLowerCase());
  for (const e of EMPLOYEES) emails.add(e.email.toLowerCase());
  for (const h of newHiresStore.get()) emails.add(h.workEmail.toLowerCase());
  return emails;
}

/** firstname-lastname@domain, with a trailing number appended on collision. */
export function generateWorkEmail(firstName, lastName, orgId) {
  const domain = domainForOrg(orgId);
  // A single-word name (or a "—" placeholder surname) produced "first-@domain".
  const base = [slug(firstName), slug(lastName)].filter(Boolean).join("-") || "employee";
  const taken = existingEmails();
  let candidate = `${base}@${domain}`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${n}@${domain}`;
    n += 1;
  }
  return candidate;
}

/** True when a work e-mail is already issued to someone (rosters + new hires) — explicit overrides must be unique. */
export const isWorkEmailTaken = (email) => existingEmails().has(email.trim().toLowerCase());

/** Shared validation for every hire entry point (record form, Hire / Re-hire dialog, welcome e-mail). Returns an error or null. */
export function validateHireInput(input) {
  if (!input.firstName.trim()) return "First name is required.";
  if (input.personalEmail?.trim() && !/^\S+@\S+\.\S+$/.test(input.personalEmail.trim()))
    return "Personal e-mail is not valid.";
  if (input.workEmail?.trim()) {
    if (!/^\S+@\S+\.\S+$/.test(input.workEmail.trim())) return "Work e-mail is not valid.";
    if (isWorkEmailTaken(input.workEmail))
      return `${input.workEmail.trim()} is already issued to another employee.`;
  }
  if (input.phone?.trim() && input.phone.replace(/\D/g, "").length < 10)
    return "Mobile number must have at least 10 digits.";
  if (!input.doj || Number.isNaN(Date.parse(input.doj))) return "Date of joining is required.";
  if (input.dob) {
    const dob = new Date(`${input.dob}T00:00:00`);
    const doj = new Date(`${input.doj}T00:00:00`);
    if (Number.isNaN(+dob) || dob >= doj)
      return "Date of birth must be before the date of joining.";
    const age = (+doj - +dob) / (365.25 * 86_400_000);
    if (age < 18) return "The employee must be at least 18 years old on the date of joining.";
  }
  if (!(input.ctc > 0)) return "Annual CTC must be greater than zero.";
  return null;
}

/**
 * @typedef {Object} NewHireRecord
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} personalEmail
 * @property {string} workEmail
 * @property {string} phone
 * @property {string} dob
 * @property {string} gender
 * @property {string} orgId
 * @property {string} branch
 * @property {string} dept
 * @property {string} designation
 * @property {AppRole} role
 * @property {"Full-time" | "Part-time" | "Contract" | "Intern"} employmentType
 * @property {string | null} managerId
 * @property {string} doj
 * @property {number} probationMonths
 * @property {number} ctc
 * @property {string} [patternId] - Attendance pattern assigned at hire (attendance-pattern.ts).
 * @property {string} [grade] - Item 16 — grade drives the salary structure; wage type: Salaried / Monthly wage / Daily wage.
 * @property {"Salaried" | "Monthly wage" | "Daily wage"} [wageType]
 * @property {"Active" | "Re-hired"} status
 * @property {string} [rehireOfId] - If this hire matched a past employee record, that record's id.
 * @property {string} createdOn
 */

export const newHiresStore = createPersistentStore("seereon.hiring.newhires", []);
export const useNewHires = () => newHiresStore.use();

/* ------------------------------ Re-hire ---------------------------------- */

/**
 * @typedef {Object} PastEmployeeMatch
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} dept
 * @property {string} role
 * @property {string} orgId
 * @property {"roster" | "new-hire"} source
 */

/** Search past/current people (both rosters + new hires) by name or email, for the re-hire lookup step. */
export function searchPastEmployees(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results = [];

  for (const u of SEEREON_USERS) {
    if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
      results.push({
        id: u.id,
        name: u.name,
        email: u.email,
        dept: u.dept,
        role: u.role,
        orgId: u.orgId,
        source: "roster",
      });
    }
  }
  for (const e of EMPLOYEES) {
    if (results.some((r) => r.id === e.id)) continue;
    if (e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) {
      results.push({
        id: e.id,
        name: e.name,
        email: e.email,
        dept: e.dept,
        role: e.role,
        orgId: e.orgId,
        source: "roster",
      });
    }
  }
  for (const h of newHiresStore.get()) {
    const fullName = `${h.firstName} ${h.lastName}`;
    if (fullName.toLowerCase().includes(q) || h.workEmail.toLowerCase().includes(q)) {
      results.push({
        id: h.id,
        name: fullName,
        email: h.workEmail,
        dept: h.dept,
        role: h.role,
        orgId: h.orgId,
        source: "new-hire",
      });
    }
  }
  return results.slice(0, 8);
}

/* ------------------------------ Hire / re-hire ---------------------------- */

// Highest existing number + 1 — `length + 1` re-issued an id (and therefore a login) after `removeNewHire`.
const nextHireId = () =>
  `NHR-${String(newHiresStore.get().reduce((m, h) => Math.max(m, Number(h.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;

export function hireEmployee(input) {
  // An explicit address that is already issued would create two logins with the same user name — fall back to a generated one.
  const explicit = input.workEmail?.trim();
  const workEmail =
    explicit && !isWorkEmailTaken(explicit)
      ? explicit
      : generateWorkEmail(input.firstName, input.lastName, input.orgId);
  const row = {
    ...input,
    id: nextHireId(),
    workEmail,
    status: input.rehireOfId ? "Re-hired" : "Active",
    createdOn: new Date().toISOString().slice(0, 10),
  };
  newHiresStore.set((p) => [row, ...p]);
  saveWorkConfig({
    empId: row.id,
    patternId: row.patternId ?? "PAT-01",
    workday: null,
    updatedBy: "Hiring",
  });
  registerHire(row);
  return row;
}

/* --------------- Runtime provisioning: directory + sign-in ---------------- */

const hireToEmployee = (h) => ({
  id: h.id,
  name: `${h.firstName} ${h.lastName}`.trim(),
  email: h.workEmail,
  phone: h.phone,
  dept: h.dept,
  role: h.designation,
  branch: h.branch,
  status: "Active",
  orgId: h.orgId,
});

/** Temporary password issued with the welcome email: Welcome@<last 4 of employee id>. */
export const temporaryPassword = (h) => `Welcome@${h.id.slice(-4)}`;

const hireToUser = (h) => ({
  id: h.id,
  name: `${h.firstName} ${h.lastName}`.trim(),
  email: h.workEmail,
  role: h.role,
  designation: h.designation,
  dept: h.dept,
  branch: h.branch,
  phone: h.phone,
  managerId: h.managerId,
  hrPartnerId: null,
  doj: h.doj,
  orgId: h.orgId,
  portal: h.role === "Employee" ? "emp" : "org",
  password: temporaryPassword(h),
});

function registerHire(h) {
  registerEmployee(hireToEmployee(h), {
    ctc: h.ctc,
    doj: h.doj,
    probationMonths: h.probationMonths,
    employmentType: h.employmentType,
    dob: h.dob,
    gender: h.gender,
    managerName: userById(h.managerId)?.name ?? "",
    grade: h.grade,
    wageType: h.wageType,
  });
}

registerExtraUsers(() => newHiresStore.get().map(hireToUser));
// Hires persisted from earlier sessions are re-registered on load (client only — store is empty on the server).
newHiresStore.get().forEach(registerHire);

export const removeNewHire = (id) => newHiresStore.set((p) => p.filter((h) => h.id !== id));

/* ------------------------------ Merged view -------------------------------- */

/** Every known person — static rosters plus any new hires — for screens that need the full picture. */
export function allKnownPeople() {
  const rosterIds = new Set(SEEREON_USERS.map((u) => u.id));
  const newHires = newHiresStore.get().map((h) => ({
    id: h.id,
    name: `${h.firstName} ${h.lastName}`,
    email: h.workEmail,
    dept: h.dept,
    role: h.role,
    orgId: h.orgId,
    designation: h.designation,
    status: h.status,
  }));
  return {
    roster: SEEREON_USERS,
    newHires: newHires.filter((h) => !rosterIds.has(h.id)),
  };
}
