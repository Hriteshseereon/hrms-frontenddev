// Timesheets — formats configured by the Org Admin in Masters, filled by employees.
import { createPersistentStore } from "@/lib/persist";

export const TIMESHEET_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"];
/**
 * @typedef {(typeof TIMESHEET_STATUSES)[number]} TimesheetStatus
 */

export const TASK_STATUSES = ["Not Started", "In Progress", "Completed", "Blocked"];

/**
 * @typedef {Object} TimesheetFormat
 * @property {string} id
 * @property {string} name
 * @property {"Daily" | "Weekly" | "Monthly"} frequency
 * @property {string} department
 * @property {string[]} fields
 * @property {string} description
 * @property {boolean} active
 */

export const TIMESHEET_FIELDS = [
  "Task Name",
  "Description",
  "Start Time",
  "End Time",
  "Hours",
  "Status",
  "Project",
  "Billable",
];

/** Persisted like the entries (formats added in Masters used to vanish on reload while entries kept their names). */
export const timesheetFormatStore = createPersistentStore("seereon.timesheets.formats.v1", [
  {
    id: "TSF-001",
    name: "Daily Engineering Timesheet",
    frequency: "Daily",
    department: "Engineering",
    fields: ["Task Name", "Description", "Start Time", "End Time", "Hours", "Status"],
    description: "Task-level daily logging for delivery teams.",
    active: true,
  },
  {
    id: "TSF-002",
    name: "Weekly Ops Timesheet",
    frequency: "Weekly",
    department: "Operations",
    fields: ["Task Name", "Description", "Hours", "Status"],
    description: "Consolidated weekly effort capture.",
    active: true,
  },
]);

/** Highest serial + 1 — `length + 1` could re-issue an existing id. */
export const addTimesheetFormat = (f) =>
  timesheetFormatStore.set((p) => [
    {
      ...f,
      id: `TSF-${String(p.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, "")) || 0), 0) + 1).padStart(3, "0")}`,
    },
    ...p,
  ]);

export const toggleTimesheetFormat = (id, active) =>
  timesheetFormatStore.set((p) => p.map((f) => (f.id === id ? { ...f, active } : f)));

/**
 * @typedef {Object} TimesheetEntry
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} format
 * @property {string} date
 * @property {string} task
 * @property {string} description
 * @property {string} start
 * @property {string} end
 * @property {number} hours
 * @property {string} taskStatus
 * @property {TimesheetStatus} status
 * @property {string} remarks
 * @property {string} [project]
 * @property {boolean} [billable]
 */

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const PROJECTS = [
  "Semtech — SAP CPI integration",
  "RCU — Funds management",
  "ZooPlus — KSeF rollout",
  "Infosys — Staff augmentation",
  "Spotlight — E-commerce migration",
  "Internal — Seereon HRMS product",
  "Internal — Pre-sales & admin",
];

/** Deterministic FY 2026-27 seed (Apr → Sep 2026) for the demo employees so day / week / month / YTD views have data. */
function seedEntries() {
  const people = [
    [
      "SRN-0006",
      "Subham Das",
      "Daily Engineering Timesheet",
      ["Semtech — SAP CPI integration", "Internal — Seereon HRMS product"],
    ],
    [
      "SRN-0007",
      "Neha Kulkarni",
      "Daily Engineering Timesheet",
      ["ZooPlus — KSeF rollout", "Spotlight — E-commerce migration"],
    ],
    [
      "SRN-0008",
      "Rakesh Menon",
      "Daily Engineering Timesheet",
      ["Semtech — SAP CPI integration", "RCU — Funds management"],
    ],
    [
      "SRN-0014",
      "Ishita Bose",
      "Daily Engineering Timesheet",
      ["Spotlight — E-commerce migration", "Internal — Seereon HRMS product"],
    ],
    [
      "SRN-0142",
      "Ananya Sharma",
      "Daily Engineering Timesheet",
      ["Infosys — Staff augmentation", "Internal — Seereon HRMS product"],
    ],
    [
      "SRN-0147",
      "Arjun Kapoor",
      "Daily Engineering Timesheet",
      ["RCU — Funds management", "Internal — Pre-sales & admin"],
    ],
  ];
  const tasks = [
    "Feature development",
    "Bug fixing & hardening",
    "Code review",
    "Client call & requirement clarification",
    "Unit & integration tests",
    "Deployment & release support",
    "Documentation",
    "Design discussion",
  ];
  const out = [];
  let n = 1;
  const today = new Date("2026-09-17T00:00:00");
  for (const [empId, employee, format, projects] of people) {
    for (let d = new Date("2026-04-01T00:00:00"); d <= today; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = isoLocal(d);
      const seed = (Number(iso.replace(/-/g, "")) * 7 + Number(empId.replace(/\D/g, ""))) % 97;
      if (seed % 19 === 0) continue; // leave / no entry day
      const h1 = 3 + (seed % 4) * 0.5,
        h2 = 8.5 - h1 - (seed % 3) * 0.5;
      const proj1 = projects[seed % projects.length],
        proj2 = projects[(seed + 1) % projects.length];
      const ageDays = Math.round((+today - +d) / 86400000);
      const status =
        ageDays > 7
          ? seed % 23 === 0
            ? "Rejected"
            : "Approved"
          : ageDays > 1
            ? "Submitted"
            : "Draft";
      out.push({
        id: `TSE-${String(n++).padStart(4, "0")}`,
        empId,
        employee,
        format,
        date: iso,
        task: tasks[seed % tasks.length],
        description: `${proj1.split(" — ")[0]} · ${tasks[seed % tasks.length].toLowerCase()}`,
        start: "09:30",
        end: `${String(9 + Math.floor(h1) + (h1 % 1 ? 1 : 0)).padStart(2, "0")}:${h1 % 1 ? "00" : "30"}`,
        hours: h1,
        taskStatus: seed % 5 === 0 ? "Completed" : "In Progress",
        status,
        remarks:
          status === "Rejected" ? "Task code does not match the SOW line — please correct." : "",
        project: proj1,
        billable: !proj1.startsWith("Internal"),
      });
      if (h2 > 0.5)
        out.push({
          id: `TSE-${String(n++).padStart(4, "0")}`,
          empId,
          employee,
          format,
          date: iso,
          task: tasks[(seed + 3) % tasks.length],
          description: `${proj2.split(" — ")[0]} · ${tasks[(seed + 3) % tasks.length].toLowerCase()}`,
          start: "14:00",
          end: `${String(14 + Math.floor(h2)).padStart(2, "0")}:${h2 % 1 ? "30" : "00"}`,
          hours: h2,
          taskStatus: "In Progress",
          status,
          remarks: "",
          project: proj2,
          billable: !proj2.startsWith("Internal"),
        });
    }
  }
  return out;
}

export const hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
};

export const timesheetStore = createPersistentStore("seereon.timesheets.v3", seedEntries());

/** Highest serial + 1, padded like the seed ids (TSE-0001). `length + 1` would collide once entries can be removed. */
export const addTimesheetEntry = (e) =>
  timesheetStore.set((p) => [
    {
      ...e,
      id: `TSE-${String(p.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`,
    },
    ...p,
  ]);

/** Allowed status moves: Draft → Submitted, Rejected → Submitted (resubmit), Submitted → Approved / Rejected. */
const TS_TRANSITIONS = {
  Draft: ["Submitted"],
  Submitted: ["Approved", "Rejected"],
  Rejected: ["Submitted"],
  Approved: [],
};
/**
 * Correct a Draft / Rejected entry (task, description, times, hours, project…) and send it for approval. Approved and
 * Submitted entries are not editable. Returns false when the entry cannot be corrected.
 */
export function correctTimesheetEntry(id, patch) {
  const e = timesheetStore.get().find((x) => x.id === id);
  if (!e || (e.status !== "Rejected" && e.status !== "Draft")) return false;
  const allowed = [
    "task",
    "description",
    "start",
    "end",
    "hours",
    "taskStatus",
    "project",
    "billable",
  ];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  timesheetStore.set((p) =>
    p.map((x) =>
      x.id === id
        ? {
            ...x,
            ...clean,
            status: "Submitted",
            remarks: "",
            previousRemarks: e.remarks || x.previousRemarks,
          }
        : x,
    ),
  );
  return true;
}

export const setTimesheetStatus = (id, status, remarks = "") =>
  timesheetStore.set((p) =>
    p.map((e) =>
      e.id === id && TS_TRANSITIONS[e.status].includes(status) ? { ...e, status, remarks } : e,
    ),
  );

/* ------------------------------ Views & YTD ------------------------------ */
export const FY_START = "2026-04-01";
export const fyMonths = (from = FY_START, to = isoLocal(new Date())) => {
  const out = [];
  let y = Number(from.slice(0, 4)),
    m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4)),
    em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
};
export const monthLabel = (m) =>
  new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
export const weekOf = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return isoLocal(x);
  });
};
export function ytdSummary(entries, empId, upto = isoLocal(new Date())) {
  const mine = entries.filter((e) => e.empId === empId && e.date >= FY_START && e.date <= upto);
  const months = fyMonths(FY_START, upto).map((m) => {
    const rows = mine.filter((e) => e.date.startsWith(m));
    const hours = rows.reduce((s, e) => s + e.hours, 0);
    return {
      month: m,
      label: monthLabel(m),
      entries: rows.length,
      days: new Set(rows.map((e) => e.date)).size,
      hours: +hours.toFixed(1),
      billable: +rows
        .filter((e) => e.billable)
        .reduce((s, e) => s + e.hours, 0)
        .toFixed(1),
      approved: +rows
        .filter((e) => e.status === "Approved")
        .reduce((s, e) => s + e.hours, 0)
        .toFixed(1),
      submitted: rows.filter((e) => e.status === "Submitted").length,
      rejected: rows.filter((e) => e.status === "Rejected").length,
    };
  });
  const byProject = Object.entries(
    mine.reduce((acc, e) => {
      const k = e.project ?? "Unassigned";
      acc[k] = (acc[k] ?? 0) + e.hours;
      return acc;
    }, {}),
  )
    .map(([project, hours]) => ({ project, hours: +hours.toFixed(1) }))
    .sort((a, b) => b.hours - a.hours);
  const total = +mine.reduce((s, e) => s + e.hours, 0).toFixed(1);
  const billable = +mine
    .filter((e) => e.billable)
    .reduce((s, e) => s + e.hours, 0)
    .toFixed(1);
  const days = new Set(mine.map((e) => e.date)).size;
  return {
    months,
    byProject,
    total,
    billable,
    days,
    avgPerDay: days ? +(total / days).toFixed(2) : 0,
    approvedPct: total
      ? Math.round(
          (mine.filter((e) => e.status === "Approved").reduce((s, e) => s + e.hours, 0) / total) *
            100,
        )
      : 0,
    entries: mine.length,
  };
}
