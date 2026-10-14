// Per-employee in-app alerts (bell icon in the employee portal): comp-off credited, leave credited, loan approved,
// grievance acknowledged, review launched … Mirrors what production would push by e-mail / WhatsApp.
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} EmployeeAlert
 * @property {string} id
 * @property {string} empId
 * @property {string} at
 * @property {string} title
 * @property {string} body
 * @property {"leave" | "compoff" | "payroll" | "loan" | "grievance" | "review" | "general"} kind
 * @property {string} [to]
 * @property {boolean} read
 */
export const alertStore = createPersistentStore("seereon.employee.alerts", [
  {
    id: "AL-0001",
    empId: "SRN-0006",
    at: "2026-09-15T09:00:00",
    title: "Comp-off credited",
    body: "1 day comp-off credited for Sat 12 Sep (client go-live). Apply within 7 days — expires 19 Sep.",
    kind: "compoff",
    to: "/emp/leave",
    read: false,
  },
  {
    id: "AL-0002",
    empId: "SRN-0006",
    at: "2026-07-01T08:00:00",
    title: "Quarterly leave credit",
    body: "Q2 credit posted: CL +3, SL +2.5, EL +4.5 (pro-rata).",
    kind: "leave",
    to: "/emp/leave",
    read: true,
  },
  {
    id: "AL-0003",
    empId: "SRN-0007",
    at: "2026-09-04T18:10:00",
    title: "Salary advance approved",
    body: "ADV-2026-004 ₹40,000 approved — recovered from October salary.",
    kind: "loan",
    to: "/emp/loans",
    read: false,
  },
]);
export const useAlerts = () => alertStore.use();
export const useMyAlerts = (empId) =>
  alertStore
    .use()
    .filter((a) => a.empId === empId)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
export function pushAlert(a) {
  alertStore.set((l) => [
    {
      ...a,
      id: `AL-${String(l.length + 1).padStart(4, "0")}`,
      at: new Date().toISOString(),
      read: false,
    },
    ...l,
  ]);
}
export const markAlertsRead = (empId) =>
  alertStore.set((l) => l.map((a) => (a.empId === empId ? { ...a, read: true } : a)));
