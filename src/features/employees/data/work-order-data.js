// ---------------------------------------------------------------------------
// Work Orders — a contract/engagement with a specific client site or project,
// carrying its own shift requirement. Employees are assigned to a work order,
// which in turn determines their applicable shift. Sits on top of the
// existing Shifts system (attendance-data.ts) rather than replacing it.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { allShifts } from "@/features/attendance/data/attendance-data";

/**
 * @typedef {Object} WorkOrder
 * @property {string} id
 * @property {string} name
 * @property {string} clientSite
 * @property {string} office
 * @property {string} shiftId
 * @property {string} startDate
 * @property {string | null} endDate
 * @property {"Active" | "Completed" | "On Hold"} status
 * @property {string} [notes]
 * @property {string} orgId - Which Organization this work order belongs to.
 * @property {string} [purpose] - Enterprise detail (optional for legacy rows)
 * @property {{ name: string, role: string }} [demandedBy]
 * @property {{ name: string, role: string, on: string }} [approvedBy]
 * @property {string} [details]
 * @property {string[]} [locations]
 * @property {number} [headcount]
 * @property {"Low" | "Normal" | "High" | "Critical"} [priority]
 * @property {string} [clientContact]
 * @property {{ billingType: "Fixed price" | "Time & material" | "Per day / per shift" | "Milestone", poNumber: string, rateBasis: string, budget: number, currency: "INR" | "USD" | "EUR" | "SAR", paymentTerms: string, invoicingCycle: "Weekly" | "Fortnightly" | "Monthly" | "On milestone", costCentre: string }} [payment]
 * @property {{ shiftId: string, headcount: number, days: string }[]} [shifts]
 * @property {string[]} [attachments]
 * @property {string} [createdBy]
 * @property {string} [createdOn]
 */
export const WO_PURPOSES = [
  "Client site operations",
  "Project delivery (fixed scope)",
  "Managed services / support",
  "Seasonal / peak demand",
  "Facility & maintenance",
  "Event / short-term deployment",
  "Internal initiative",
];

export const WORK_ORDERS_SEED = [
  {
    id: "WO-001",
    name: "Seereon SAP Practice — Site Operations",
    clientSite: "Seereon SAP Practice, Rajasthan",
    office: "Hyderabad Office",
    shiftId: "SHF-01",
    startDate: "2026-01-01",
    endDate: null,
    status: "Active",
    orgId: "ORG-1042",
    purpose: "Client site operations",
    demandedBy: { name: "Manjeet Bhati", role: "Project Manager" },
    approvedBy: { name: "Santosh Nayak", role: "CEO", on: "2025-12-20" },
    details:
      "Round-the-clock L2 support and site operations for the SAP practice deployment; 6 engineers on rotation.",
    locations: ["Seereon SAP Practice, Rajasthan", "Hyderabad Office (backup)"],
    headcount: 6,
    priority: "High",
    clientContact: "Devraj Solanki · +91 98290 11002",
    payment: {
      billingType: "Time & material",
      poNumber: "PO-SAPP-2026-0114",
      rateBasis: "Per engineer-day",
      budget: 4800000,
      currency: "INR",
      paymentTerms: "Net 30",
      invoicingCycle: "Monthly",
      costCentre: "CC-SAP-OPS",
    },
    shifts: [
      { shiftId: "SHF-01", headcount: 4, days: "Mon–Sat" },
      { shiftId: "SHF-03", headcount: 2, days: "All days" },
    ],
    attachments: ["PO-SAPP-2026-0114.pdf", "sow-site-ops.pdf"],
    createdBy: "Ritu Bansal",
    createdOn: "2025-12-22",
  },
  {
    id: "WO-002",
    name: "Seereon Cloud Services — Night Extraction Crew",
    clientSite: "Seereon Cloud Services, Jharkhand",
    office: "Pune Office",
    shiftId: "SHF-03",
    startDate: "2026-02-15",
    endDate: null,
    status: "Active",
    orgId: "ORG-1043",
  },
  {
    id: "WO-003",
    name: "Seereon Products — Morning Plant Shift",
    clientSite: "Seereon Products, Odisha",
    office: "Kolkata Office",
    shiftId: "SHF-02",
    startDate: "2026-03-01",
    endDate: "2026-12-31",
    status: "Active",
    orgId: "ORG-1044",
  },
];

export const workOrderStore = createPersistentStore("seereon.workorders", WORK_ORDERS_SEED);
export const useWorkOrders = () => workOrderStore.use();

export function addWorkOrder(input) {
  // Highest existing serial + 1 — work orders can be removed, so a length-based counter would repeat an id.
  const serial =
    workOrderStore.get().reduce((m, w) => Math.max(m, Number(w.id.replace(/\D/g, "")) || 0), 0) + 1;
  const row = {
    ...input,
    id: `WO-${String(serial).padStart(3, "0")}`,
  };
  workOrderStore.set((p) => [row, ...p]);
  return row;
}

export const updateWorkOrder = (id, patch) =>
  workOrderStore.set((p) => p.map((w) => (w.id === id ? { ...w, ...patch } : w)));

export const removeWorkOrder = (id) => workOrderStore.set((p) => p.filter((w) => w.id !== id));

export const getWorkOrder = (id) => workOrderStore.get().find((w) => w.id === id) ?? null;

/* ------------------------- Employee assignment -------------------------- */

/**
 * @typedef {Object} WorkOrderAssignment
 * @property {string} employeeId
 * @property {string} workOrderId
 * @property {string} assignedOn
 */

export const workOrderAssignmentStore = createPersistentStore(
  "seereon.workorder.assignments",
  // Each work order belongs to one entity — only that entity's employees are deployed on it.
  [
    { employeeId: "SRN-2003", workOrderId: "WO-001", assignedOn: "2026-01-05" }, // Manjeet Bhati — SAP Practice (ORG-1042)
    { employeeId: "SRN-2103", workOrderId: "WO-002", assignedOn: "2026-02-18" }, // Soumen Ghosh — Cloud Services night crew (ORG-1043)
    { employeeId: "SRN-2202", workOrderId: "WO-003", assignedOn: "2026-03-02" }, // Biraja Mohanty — Products (ORG-1044)
  ],
);
export const useWorkOrderAssignments = () => workOrderAssignmentStore.use();

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function assignWorkOrder(employeeId, workOrderId) {
  workOrderAssignmentStore.set((p) => [
    { employeeId, workOrderId, assignedOn: todayLocal() },
    ...p.filter((a) => a.employeeId !== employeeId),
  ]);
}

export const unassignWorkOrder = (employeeId) =>
  workOrderAssignmentStore.set((p) => p.filter((a) => a.employeeId !== employeeId));

export function workOrderOfEmployee(employeeId) {
  const assignment = workOrderAssignmentStore.get().find((a) => a.employeeId === employeeId);
  return assignment ? getWorkOrder(assignment.workOrderId) : null;
}

export function useWorkOrderOfEmployee(employeeId) {
  useWorkOrderAssignments();
  useWorkOrders(); // re-render when the work order itself changes (status / shift), not only the assignment
  return workOrderOfEmployee(employeeId);
}

/** The shift that actually applies to an employee: their (non-completed) work order's shift if assigned, else the
 *  shift on their attendance record. A completed work order no longer dictates the employee's shift. */
export function effectiveShiftId(employeeId, fallbackShiftName) {
  const wo = workOrderOfEmployee(employeeId);
  if (wo && wo.status !== "Completed") return wo.shiftId;
  if (fallbackShiftName) return allShifts().find((s) => s.name === fallbackShiftName)?.id ?? null;
  return null;
}
