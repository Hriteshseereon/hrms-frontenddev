// HR Business Partner assignment: every employee has an HR partner who owns
// their HR-side approvals (leave escalations, reimbursements, exits, cases).
import { createPersistentStore } from "@/lib/persist";
import { EMPLOYEES, directoryEmployees } from "@/features/employees/data/employee-directory";
import { SEEREON_USERS, allUsers, userById } from "@/features/auth/data/auth-session";

/** empId -> HR partner empId */
const SEED = Object.fromEntries(
  SEEREON_USERS.filter((u) => u.hrPartnerId).map((u) => [u.id, u.hrPartnerId]),
);

// Legacy directory records default to the Engineering / Ops HR partners.
const LEGACY_DEFAULT = Object.fromEntries(
  EMPLOYEES.filter((e) => !SEED[e.id]).map((e) => [
    e.id,
    e.dept === "Engineering" || e.dept === "Technology" ? "SRN-0012" : "SRN-0013",
  ]),
);

// Persisted — the partner chosen on the employee record form (e.g. for a new hire) was lost on reload.
export const hrPartnerStore = createPersistentStore("seereon.org.hr-partners.v1", {
  ...LEGACY_DEFAULT,
  ...SEED,
});

export const useHrPartnerMap = () => hrPartnerStore.use();

export const setHrPartner = (empId, partnerId) =>
  hrPartnerStore.set((p) => ({ ...p, [empId]: partnerId }));

/** Selectable HR partners for the Add / Edit Employee form — limited to the entity the employee joins. */
export const hrPartnerOptions = (orgId) =>
  allUsers()
    .filter((u) => (u.role === "HR" || u.role === "CHRO") && (!orgId || u.orgId === orgId))
    .map((u) => ({
      id: u.id,
      name: u.name,
      designation: u.designation,
    }));

// Falls back to the partner on the person's account (organisations other than the seeded one keep it there).
export const hrPartnerIdOf = (empId) =>
  hrPartnerStore.get()[empId] ?? userById(empId)?.hrPartnerId ?? null;

export const hrPartnerNameOf = (map, empId) =>
  directoryEmployees().find((e) => e.id === map[empId])?.name ??
  userById(map[empId] ?? userById(empId)?.hrPartnerId)?.name ??
  "—";

/** Everyone this HR partner is responsible for. */
export const employeesOfPartner = (map, partnerId) =>
  directoryEmployees().filter((e) => map[e.id] === partnerId);
