// Reporting hierarchy — assigned during employee onboarding and used to scope
// task, goal, PIP, review, training and timesheet visibility for managers.
import { createStore } from "@/lib/store";
import { EMPLOYEES } from "@/features/employees/data/employee-directory";

/**
 * @typedef {Object} ReportingLink
 * @property {string} empId
 * @property {string} reportingManager
 * @property {string} functionalManager
 */

export const reportingStore = createStore([
  { empId: "SRN-0142", reportingManager: "SRN-0149", functionalManager: "" },
  { empId: "SRN-0147", reportingManager: "SRN-0149", functionalManager: "SRN-0144" },
  { empId: "SRN-0149", reportingManager: "", functionalManager: "" },
  { empId: "SRN-0143", reportingManager: "SRN-0146", functionalManager: "" },
  { empId: "SRN-0148", reportingManager: "SRN-0146", functionalManager: "" },
  { empId: "SRN-0146", reportingManager: "", functionalManager: "" },
  { empId: "SRN-0145", reportingManager: "SRN-0146", functionalManager: "" },
  { empId: "SRN-0144", reportingManager: "", functionalManager: "" },
]);

export function setReporting(empId, reportingManager, functionalManager = "") {
  reportingStore.set((p) => {
    const rest = p.filter((r) => r.empId !== empId);
    return [...rest, { empId, reportingManager, functionalManager }];
  });
}

export const managerOf = (empId, links = reportingStore.get()) =>
  links.find((l) => l.empId === empId)?.reportingManager ?? "";

/** Direct reports only. */
export function directReports(managerId, links = reportingStore.get()) {
  return links
    .filter((l) => l.reportingManager === managerId || l.functionalManager === managerId)
    .map((l) => l.empId);
}

/** Direct + indirect reports (whole subtree, excluding the manager). */
export function allReports(managerId, links = reportingStore.get()) {
  const out = [];
  const walk = (id) => {
    for (const child of directReports(id, links)) {
      if (out.includes(child)) continue;
      out.push(child);
      walk(child);
    }
  };
  walk(managerId);
  return out;
}

export const isManager = (empId) => directReports(empId).length > 0;

/** Employee ids a user may see: themselves plus their reporting subtree. */
export const visibleEmployeeIds = (empId) => [empId, ...allReports(empId)];

export const empName = (id) => EMPLOYEES.find((e) => e.id === id)?.name ?? id;

export const useReporting = () => reportingStore.use();
