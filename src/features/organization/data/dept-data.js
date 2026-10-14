// Department master with an assignable Head of Department (HOD).
// Org Admin owns this; every workflow that routes to "the HOD" resolves here.
import { createPersistentStore } from "@/lib/persist";
import { userById } from "@/features/auth/data/auth-session";

/**
 * @typedef {Object} Department
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {string | null} hodId - Employee id of the assigned Head of Department.
 * @property {string} costCentre
 * @property {string} location
 * @property {string} orgId - Which Organization this department belongs to.
 */

export const DEPARTMENTS_SEED = [
  {
    id: "DEP-01",
    name: "Engineering",
    code: "ENG",
    hodId: "SRN-0005",
    costCentre: "CC-1001",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-02",
    name: "Human Resources",
    code: "HR",
    hodId: "SRN-0004",
    costCentre: "CC-1002",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-03",
    name: "Finance",
    code: "FIN",
    hodId: "SRN-0002",
    costCentre: "CC-1003",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-04",
    name: "Operations",
    code: "OPS",
    hodId: "SRN-0017",
    costCentre: "CC-1004",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-05",
    name: "Technology",
    code: "TECH",
    hodId: "SRN-0009",
    costCentre: "CC-1005",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-06",
    name: "Executive",
    code: "EXE",
    hodId: "SRN-0001",
    costCentre: "CC-1000",
    location: "Bhubaneswar HQ",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-07",
    name: "Sales",
    code: "SLS",
    hodId: null,
    costCentre: "CC-1006",
    location: "Mumbai",
    orgId: "ORG-SEEREON",
  },
  {
    id: "DEP-08",
    name: "Marketing",
    code: "MKT",
    hodId: null,
    costCentre: "CC-1007",
    location: "Mumbai",
    orgId: "ORG-SEEREON",
  },
  // ----- Seereon SAP Practice -----
  {
    id: "DEP-09",
    name: "SAP Delivery",
    code: "SAP",
    hodId: "SRN-2001",
    costCentre: "CC-2001",
    location: "Hyderabad Office",
    orgId: "ORG-1042",
  },
  {
    id: "DEP-10",
    name: "Human Resources",
    code: "HR",
    hodId: null,
    costCentre: "CC-2002",
    location: "Hyderabad Office",
    orgId: "ORG-1042",
  },
  // ----- Seereon Cloud Services -----
  {
    id: "DEP-11",
    name: "Cloud & DevOps",
    code: "CLD",
    hodId: "SRN-2101",
    costCentre: "CC-2101",
    location: "Pune Office",
    orgId: "ORG-1043",
  },
  // ----- Seereon Products -----
  {
    id: "DEP-12",
    name: "Product Engineering",
    code: "PRD",
    hodId: "SRN-2201",
    costCentre: "CC-2201",
    location: "Kolkata Office",
    orgId: "ORG-1044",
  },
];

// Persisted: added departments and HOD reassignments used to vanish on reload (in-memory store), while every other
// master survived — HOD approval routing then silently reverted to the seed.
export const departmentsStore = createPersistentStore(
  "seereon.masters.departments.v1",
  DEPARTMENTS_SEED,
);
export const useDepartments = () => departmentsStore.use();

export const departmentByName = (name, orgId) =>
  departmentsStore
    .get()
    .find(
      (d) => d.name.toLowerCase() === (name || "").toLowerCase() && (!orgId || d.orgId === orgId),
    ) ?? null;

/** The HOD user for a given department name within a specific organisation. */
export const hodOfDepartment = (deptName, orgId) =>
  userById(departmentByName(deptName, orgId)?.hodId ?? null);

/** The HOD who approves for a given employee — matched within their own organisation. */
export const hodForEmployee = (employeeId) => {
  const user = userById(employeeId); // seeded roster + new hires / invited users
  return user ? hodOfDepartment(user.dept, user.orgId) : null;
};

export function useHodForEmployee(employeeId) {
  departmentsStore.use();
  return hodForEmployee(employeeId);
}

export const setHod = (deptId, hodId) =>
  departmentsStore.set((p) => p.map((d) => (d.id === deptId ? { ...d, hodId } : d)));

/** "Set as HOD" from an employee record — assigns them to their own department. */
export function makeHodOfOwnDepartment(employeeId) {
  const user = userById(employeeId);
  if (!user) return null;
  // Same-named departments exist in several entities (e.g. "Human Resources") — scope to the employee's own organisation.
  const dept = departmentByName(user.dept, user.orgId);
  if (!dept) return null;
  setHod(dept.id, employeeId);
  return dept;
}

export function addDepartment(input) {
  const clash = departmentsStore
    .get()
    .find(
      (d) =>
        d.orgId === input.orgId &&
        (d.name.toLowerCase() === input.name.trim().toLowerCase() ||
          d.code.toLowerCase() === input.code.trim().toLowerCase()),
    );
  if (clash) return clash.id;
  // Next free number — a count-based id would reuse the id of a surviving department after one was removed.
  const n =
    departmentsStore
      .get()
      .reduce((m, d) => Math.max(m, Number(d.id.replace(/^DEP-/, "")) || 0), 0) + 1;
  const id = `DEP-${String(n).padStart(2, "0")}`;
  departmentsStore.set((p) => [...p, { ...input, id }]);
  return id;
}

export const updateDepartment = (id, patch) =>
  departmentsStore.set((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));

export const removeDepartment = (id) => departmentsStore.set((p) => p.filter((d) => d.id !== id));
