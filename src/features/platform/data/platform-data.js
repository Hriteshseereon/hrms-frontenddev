// Seereon platform console (owner-only): uptime / health, usage analytics, feature catalogue and documentation library.
import { createPersistentStore } from "@/lib/persist";

export const PLATFORM_HEALTH = {
  uptime30d: 99.97,
  uptime90d: 99.95,
  apiP95Ms: 312,
  incidents30d: 1,
  lastIncident: "2026-09-02 · 14 min · payslip PDF service",
  jobsQueued: 3,
  jobsFailed24h: 0,
  version: "Seereon HRMS 5.0.0 · build 2026.09.17",
  region: "ap-south-1 (Mumbai)",
  services: [
    { name: "Web app", status: "Operational" },
    { name: "API", status: "Operational" },
    { name: "Payroll engine", status: "Operational" },
    { name: "Document (PDF) service", status: "Operational" },
    { name: "E-mail / WhatsApp gateway", status: "Degraded" },
    { name: "Biometric sync", status: "Operational" },
  ],
  daily: Array.from({ length: 14 }, (_, i) => ({
    name: `D-${13 - i}`,
    "Uptime %": 100 - (i === 4 ? 0.9 : 0),
    "API p95 ms": 280 + ((i * 37) % 90),
  })),
};
export const USAGE = {
  monthlyActive: [
    { name: "Apr", MAU: 612 },
    { name: "May", MAU: 688 },
    { name: "Jun", MAU: 731 },
    { name: "Jul", MAU: 802 },
    { name: "Aug", MAU: 861 },
    { name: "Sep", MAU: 914 },
  ],
  moduleAdoption: [
    { name: "Attendance", value: 96 },
    { name: "Leave", value: 94 },
    { name: "Payroll", value: 88 },
    { name: "Helpdesk", value: 71 },
    { name: "Performance", value: 64 },
    { name: "Recruitment", value: 52 },
    { name: "Exit & F&F", value: 47 },
  ],
  logins7d: 4386,
  payslipsGenerated30d: 1720,
  ticketsResolved30d: 236,
};
/**
 * @typedef {Object} DocEntry
 * @property {string} id
 * @property {string} title
 * @property {"User guide" | "Admin guide" | "API" | "Release notes" | "Compliance" | "Training video"} kind
 * @property {string} version
 * @property {string} file
 * @property {"Clients" | "Internal" | "Both"} audience
 * @property {string} uploadedOn
 * @property {string} uploadedBy
 * @property {string} size
 */
export const docStore = createPersistentStore("seereon.platform.docs", [
  {
    id: "DOC-001",
    title: "Seereon HRMS Super Admin guide — group, entities, branches, roles",
    kind: "Admin guide",
    version: "5.0",
    file: "seereon-hrms-superadmin-guide-v5.pdf",
    audience: "Clients",
    uploadedOn: "2026-09-10",
    uploadedBy: "Seereon Management",
    size: "4.1 MB",
  },
  {
    id: "DOC-002",
    title: "Employee self-service quick start",
    kind: "User guide",
    version: "5.0",
    file: "seereon-hrms-employee-quickstart.pdf",
    audience: "Clients",
    uploadedOn: "2026-09-10",
    uploadedBy: "Seereon Management",
    size: "1.8 MB",
  },
  {
    id: "DOC-003",
    title: "Payroll & statutory (PF/ESI/TDS/PT/LWF) configuration",
    kind: "Admin guide",
    version: "5.0",
    file: "seereon-hrms-payroll-statutory.pdf",
    audience: "Clients",
    uploadedOn: "2026-09-12",
    uploadedBy: "Seereon Dev Team",
    size: "3.2 MB",
  },
  {
    id: "DOC-004",
    title: "Release notes — 5.0 (Sept 2026)",
    kind: "Release notes",
    version: "5.0",
    file: "release-notes-5.0.md",
    audience: "Both",
    uploadedOn: "2026-09-17",
    uploadedBy: "Seereon Dev Team",
    size: "60 KB",
  },
  {
    id: "DOC-005",
    title: "REST API reference (draft)",
    kind: "API",
    version: "0.9",
    file: "seereon-hrms-api-reference.html",
    audience: "Internal",
    uploadedOn: "2026-08-30",
    uploadedBy: "Seereon Dev Team",
    size: "780 KB",
  },
]);
export const useDocs = () => docStore.use();
export const addDoc = (d) =>
  docStore.set((l) => [{ ...d, id: `DOC-${String(l.length + 1).padStart(3, "0")}` }, ...l]);

/**
 * Platform-wide settings owned by the Seereon team (System Settings screen). `offeredModules` = modules the catalogue currently sells; the onboarding wizard only offers these.
 * @typedef {Object} PlatformSettings
 * @property {Record<string, boolean>} offeredModules
 * @property {{ platformName: string, supportEmail: string, primary: string, accent: string }} branding
 * @property {{ enforceMfa: boolean, rotate90: boolean, ipAllowlist: boolean, sessionTimeout30: boolean }} security
 * @property {{ timezone: string, currency: string, language: string }} localization
 */
export const DEFAULT_PLATFORM_SETTINGS = {
  offeredModules: {},
  branding: {
    platformName: "Seereon HRMS",
    supportEmail: "support@hrms.seereon.co.in",
    primary: "#0F6B50",
    accent: "#C8A951",
  },
  security: { enforceMfa: true, rotate90: true, ipAllowlist: true, sessionTimeout30: true },
  localization: { timezone: "Asia/Kolkata", currency: "INR", language: "English" },
};
export const platformSettingsStore = createPersistentStore(
  "seereon.platform.settings.v1",
  DEFAULT_PLATFORM_SETTINGS,
);
export const usePlatformSettings = () => platformSettingsStore.use();
export const isModuleOffered = (s, key) => s.offeredModules[key] !== false;
export const savePlatformSettings = (patch) =>
  platformSettingsStore.set((s) => ({ ...s, ...patch }));

/**
 * Per-user console preferences (My Profile → Preferences).
 * @typedef {Object} ConsolePrefs
 * @property {string} language
 * @property {string} timezone
 * @property {string} dateFormat
 * @property {Record<string, boolean>} notify
 */
export const DEFAULT_CONSOLE_PREFS = {
  language: "en",
  timezone: "Asia/Kolkata (UTC+05:30)",
  dateFormat: "DD/MM/YYYY",
  notify: {},
};
export const consolePrefsStore = createPersistentStore("seereon.platform.prefs.v1", {});
export const saveConsolePrefs = (userId, prefs) =>
  consolePrefsStore.set((p) => ({ ...p, [userId]: prefs }));
