// ---------------------------------------------------------------------------
// System-wide Archive: any module can archive a record instead of hard-deleting
// it. Archived records are auto-purged after a configurable number of days.
// UI-only — persisted in localStorage.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { getCurrentUser } from "@/features/auth/data/auth-session";
import { activeOrgStore } from "@/features/organization/data/group-data";

export const ARCHIVE_MODULES = [
  "Employees",
  "Leave",
  "Attendance",
  "Timesheets",
  "Claims & Insurance",
  "Payroll",
  "Tasks",
  "Goals",
  "Performance",
  "Support Tickets",
  "Announcements",
  "Recruitment",
  "Exit Management",
  "Master Data",
  "Reports",
];
/**
 * @typedef {(typeof ARCHIVE_MODULES)[number] | string} ArchiveModule
 */

/**
 * @typedef {Object} ArchivedRecord
 * @property {string} id
 * @property {ArchiveModule} module
 * @property {string} recordId
 * @property {string} title
 * @property {string} summary
 * @property {string} archivedOn
 * @property {string} archivedBy
 * @property {string} reason
 * @property {unknown} payload - Original row, so a restore can put it back.
 * @property {string} [orgId] - Entity the record belonged to — the archive is tenant-scoped (one company's deletions were visible to every Admin).
 */

/**
 * @typedef {Object} ArchiveConfig
 * @property {boolean} autoDeleteEnabled
 * @property {number} autoDeleteDays
 * @property {number} notifyBeforeDays
 */

export const archiveConfigStore = createPersistentStore("seereon.archive.config", {
  autoDeleteEnabled: true,
  autoDeleteDays: 30,
  notifyBeforeDays: 5,
});

export const archiveStore = createPersistentStore("seereon.archive.records", []);

export const useArchive = () => archiveStore.use();
export const useArchiveConfig = () => archiveConfigStore.use();

export const setArchiveConfig = (patch) => archiveConfigStore.set((c) => ({ ...c, ...patch }));

const now = () => new Date().toISOString();

/** Move a record into the archive. Returns the archive entry. */
export function archiveRecord(input) {
  const entry = {
    id: `ARC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    module: input.module,
    recordId: input.recordId,
    title: input.title,
    summary: input.summary ?? "",
    archivedOn: now(),
    archivedBy: getCurrentUser().name,
    reason: input.reason ?? "Deleted by user",
    payload: input.payload ?? null,
    orgId: input.orgId ?? activeOrgStore.get(),
  };
  archiveStore.set((p) => [entry, ...p]);
  return entry;
}

/* Restore handlers — modules register how to take an archived payload back (restore used to work for geofences only). */
/**
 * Restore handlers — modules register how to take an archived payload back (restore used to work for geofences only).
 * @typedef {(rec: ArchivedRecord) => boolean} Restorer
 */
const restorers = [];
export const registerArchiveRestorer = (fn) => {
  if (!restorers.includes(fn)) restorers.push(fn);
};
/** Puts the payload back through the first handler that accepts it; false when no module knows the record. */
export const restoreThroughHandlers = (rec) =>
  restorers.some((fn) => {
    try {
      return fn(rec);
    } catch {
      return false;
    }
  });

/** Archived records visible in the given entities (rows archived before tenant scoping have no org and stay visible). */
export const archiveFor = (rows, orgIds) =>
  orgIds ? rows.filter((r) => !r.orgId || orgIds.includes(r.orgId)) : rows;

/** Remove from the archive and hand the payload back to the caller. */
export function restoreRecord(id) {
  const found = archiveStore.get().find((r) => r.id === id) ?? null;
  if (found) archiveStore.set((p) => p.filter((r) => r.id !== id));
  return found;
}

export const purgeRecord = (id) => archiveStore.set((p) => p.filter((r) => r.id !== id));

export const purgeAll = (module) =>
  archiveStore.set((p) => (module ? p.filter((r) => r.module !== module) : []));

export function daysArchived(rec) {
  const ms = Date.now() - new Date(rec.archivedOn).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function daysUntilPurge(rec, cfg) {
  if (!cfg.autoDeleteEnabled) return Infinity;
  return cfg.autoDeleteDays - daysArchived(rec);
}

/** Drop everything past the retention window. Called when the archive screen opens. */
export function purgeExpired() {
  const cfg = archiveConfigStore.get();
  if (!cfg.autoDeleteEnabled) return 0;
  const before = archiveStore.get().length;
  archiveStore.set((p) => p.filter((r) => daysArchived(r) < cfg.autoDeleteDays));
  return before - archiveStore.get().length;
}
