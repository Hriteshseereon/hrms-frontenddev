// Acknowledgement tracking for circulars, notices, announcements and events.
import { createPersistentStore } from "@/lib/persist";
import { directoryEmployees } from "@/features/employees/data/employee-directory";

/**
 * @typedef {Object} Acknowledgement
 * @property {string} id
 * @property {string} announcementId
 * @property {string} empId
 * @property {string} employee
 * @property {string} acknowledgedAt
 * @property {boolean} notifiedHr
 */

// Persisted — acknowledgements were in memory only, so every "I have read this" was lost on reload.
export const ackStore = createPersistentStore("seereon.acks.v1", [
  {
    id: "ACK-001",
    announcementId: "ANN-7002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    acknowledgedAt: "2026-07-21 09:14",
    notifiedHr: true,
  },
  {
    id: "ACK-002",
    announcementId: "ANN-7002",
    empId: "SRN-0144",
    employee: "Priya Nair",
    acknowledgedAt: "2026-07-21 10:02",
    notifiedHr: true,
  },
  {
    id: "ACK-003",
    announcementId: "ANN-7004",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    acknowledgedAt: "2026-07-02 16:41",
    notifiedHr: true,
  },
]);

const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

export function acknowledge(announcementId, empId, employee) {
  const existing = ackStore
    .get()
    .find((a) => a.announcementId === announcementId && a.empId === empId);
  if (existing) return existing;
  const rec = {
    id: `ACK-${String(ackStore.get().reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(3, "0")}`,
    announcementId,
    empId,
    employee,
    acknowledgedAt: stamp(),
    // UI-only prototype: the email to HR/Admin is recorded as dispatched.
    notifiedHr: true,
  };
  ackStore.set((p) => [rec, ...p]);
  return rec;
}

export const hasAcknowledged = (announcementId, empId, acks) =>
  acks.some((a) => a.announcementId === announcementId && a.empId === empId);

/**
 * @typedef {Object} AckRollup
 * @property {Acknowledgement[]} acknowledged
 * @property {{ empId: string, employee: string }[]} pending
 * @property {{ empId: string, employee: string }[]} overdue
 */

export function rollup(announcementId, dueDate, acks, orgId, branch) {
  const done = acks.filter((a) => a.announcementId === announcementId);
  // Pending list = active employees of the announcing entity (it listed every entity's staff and missed new hires),
  // narrowed to the branch for a Branch Admin's branch-only notice.
  const audience = directoryEmployees().filter(
    (e) =>
      (!orgId || e.orgId === orgId) && (!branch || e.branch === branch) && e.status !== "Notice",
  );
  const pendingEmps = audience
    .filter((e) => !done.some((a) => a.empId === e.id))
    .map((e) => ({
      empId: e.id,
      employee: e.name,
    }));
  const isOverdue = dueDate < new Date().toISOString().slice(0, 10);
  return {
    acknowledged: done,
    pending: isOverdue ? [] : pendingEmps,
    overdue: isOverdue ? pendingEmps : [],
  };
}

export const useAcks = () => ackStore.use();
