import { createPersistentStore } from "@/lib/persist";

export const ANNOUNCEMENT_TYPES = ["Announcement", "Notice", "Event", "Circular"];
/**
 * @typedef {(typeof ANNOUNCEMENT_TYPES)[number]} AnnType
 */

/**
 * @typedef {Object} Announcement
 * @property {string} id
 * @property {AnnType} type
 * @property {string} subject
 * @property {string} description
 * @property {string} from
 * @property {string} to
 * @property {string} [document]
 * @property {string} [branch] - Branch name for a Branch Admin's branch-only notice (absent = whole company).
 * @property {string} [orgId] - Entity the announcement is published in (tenant scope). Seeds belong to Seereon (ORG-SEEREON).
 * @property {string} [publishedBy]
 * @property {string} [publishedOn]
 */

export const ANNOUNCEMENTS = [
  {
    id: "ANN-7001",
    type: "Announcement",
    subject: "Q3 All-Hands on 5th August",
    description:
      "Company-wide all-hands covering results, roadmap and awards. Attendance is mandatory for all Bhubaneswar HQ staff.",
    from: "2026-07-25",
    to: "2026-08-05",
  },
  {
    id: "ANN-7002",
    type: "Notice",
    subject: "Revised office access timings",
    description: "Badge access is restricted between 22:00 and 06:00 starting this month.",
    from: "2026-07-20",
    to: "2026-08-20",
    document: "access-policy.pdf",
  },
  {
    id: "ANN-7003",
    type: "Event",
    subject: "Independence Day celebration",
    description: "Flag hoisting at 08:30 followed by cultural programmes in the atrium.",
    from: "2026-08-15",
    to: "2026-08-15",
  },
  {
    id: "ANN-7004",
    type: "Circular",
    subject: "Updated travel reimbursement limits",
    description: "New per-diem and hotel limits applicable to all domestic travel.",
    from: "2026-07-01",
    to: "2026-12-31",
    document: "travel-circular.pdf",
  },
];

/**
 * Shared announcements store — the Org Admin module, the employee notices page, both dashboards and the acknowledgement
 * tracker read it. It used to be an in-memory list with no company on it: every publication vanished on reload and each
 * entity's employees saw every other entity's notices.
 */
export const announcementStore = createPersistentStore(
  "seereon.announcements.v1",
  ANNOUNCEMENTS.map((a) => ({ ...a, orgId: "ORG-SEEREON" })),
);
export const useAnnouncements = () => announcementStore.use();
/** Announcements visible in an entity (legacy rows without an org are treated as Seereon's). */
export const announcementsFor = (list, orgIds) => {
  const ids = Array.isArray(orgIds) ? orgIds : [orgIds];
  return list.filter((a) => ids.includes(a.orgId ?? "ORG-SEEREON"));
};
/** What one employee sees: their company's notices, minus branch-only notices of other branches. */
export const announcementsForEmployee = (list, emp) =>
  announcementsFor(list, emp?.orgId ?? "ORG-SEEREON").filter(
    (a) => !a.branch || a.branch === emp?.branch,
  );
/** Next free ANN number (max + 1). */
export const nextAnnouncementId = (list) =>
  `ANN-${list.reduce((m, r) => Math.max(m, Number(r.id.replace(/^ANN-/, "")) || 0), 7000) + 1}`;
export const publishAnnouncement = (a) => {
  const id = nextAnnouncementId(announcementStore.get());
  announcementStore.set((p) => [{ ...a, id }, ...p]);
  return id;
};
export const removeAnnouncement = (id) =>
  announcementStore.set((p) => p.filter((a) => a.id !== id));

export const ANNOUNCEMENT_TONE = {
  Announcement: "border-primary/30 bg-primary/10 text-primary",
  Notice: "border-destructive/30 bg-destructive/10 text-destructive",
  Event: "border-gold/30 bg-gold/10 text-gold",
  Circular: "border-border bg-muted text-muted-foreground",
};
