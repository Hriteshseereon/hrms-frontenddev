// Grievance Redressal System (UI-only): employee raises → HR acknowledges (SLA) → assigns to redressal officer /
// committee (POSH / Ethics / Payroll) → investigation → resolution → employee feedback / appeal → closure.
import { createPersistentStore } from "@/lib/persist";
import { allUsers } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";

export const GRIEVANCE_CATEGORIES = [
  "Harassment (POSH)",
  "Discrimination",
  "Workplace safety",
  "Payroll / salary dispute",
  "Leave / attendance",
  "Manager behaviour",
  "Facilities",
  "Policy violation",
  "Other",
];
/**
 * @typedef {(typeof GRIEVANCE_CATEGORIES)[number]} GrievanceCategory
 */
/**
 * @typedef {"Submitted" | "Acknowledged" | "Under investigation" | "Resolved" | "Appealed" | "Closed" | "Withdrawn"} GrievanceStatus
 */
export const GRIEVANCE_STEPS = [
  "Submitted",
  "Acknowledged",
  "Under investigation",
  "Resolved",
  "Closed",
];
/**
 * @typedef {"Low" | "Medium" | "High" | "Critical"} Severity
 */
/** Category → committee / redressal owner and SLA (working days) for acknowledgement and resolution. */
export const ROUTING = {
  "Harassment (POSH)": {
    owner: "Farah Khan",
    committee: "Internal Committee (POSH)",
    ackDays: 1,
    resolveDays: 90,
  },
  Discrimination: {
    owner: "Farah Khan",
    committee: "Ethics Committee",
    ackDays: 2,
    resolveDays: 30,
  },
  "Workplace safety": {
    owner: "Aditya Verma",
    committee: "Safety Officer",
    ackDays: 1,
    resolveDays: 7,
  },
  "Payroll / salary dispute": {
    owner: "Saras Venkatesh",
    committee: "Payroll & Finance",
    ackDays: 2,
    resolveDays: 10,
  },
  "Leave / attendance": {
    owner: "Ritu Bansal",
    committee: "HR Operations",
    ackDays: 2,
    resolveDays: 7,
  },
  "Manager behaviour": {
    owner: "Farah Khan",
    committee: "HR Head + Unit Head",
    ackDays: 2,
    resolveDays: 15,
  },
  Facilities: {
    owner: "Aditya Verma",
    committee: "Admin & Facilities",
    ackDays: 2,
    resolveDays: 7,
  },
  "Policy violation": {
    owner: "Farah Khan",
    committee: "Ethics Committee",
    ackDays: 2,
    resolveDays: 30,
  },
  Other: { owner: "Ritu Bansal", committee: "HR Operations", ackDays: 3, resolveDays: 15 },
};

/**
 * @typedef {Object} Grievance
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} dept
 * @property {string} branch
 * @property {boolean} anonymous
 * @property {GrievanceCategory} category
 * @property {Severity} severity
 * @property {string} subject
 * @property {string} description
 * @property {string} against
 * @property {string[]} attachments
 * @property {string} raisedOn
 * @property {GrievanceStatus} status
 * @property {string} owner
 * @property {string} committee
 * @property {string} ackDue
 * @property {string} resolveDue
 * @property {string} [acknowledgedOn]
 * @property {string} [resolvedOn]
 * @property {string} [closedOn]
 * @property {{ at: string, by: string, note: string, visibleToEmployee: boolean }[]} investigation
 * @property {string} resolution
 * @property {string} actionTaken
 * @property {number | null} employeeRating
 * @property {string} employeeFeedback
 * @property {string} appealReason
 * @property {{ at: string, by: string, action: string }[]} history
 */

const today = () => new Date().toISOString().slice(0, 10);
// Pure UTC arithmetic on "YYYY-MM-DD" (mixing a UTC parse with local setDate can shift the date in some timezones).
const plusDays = (d, n) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const grievanceStore = createPersistentStore("seereon.grievances", [
  {
    id: "GRV-2026-0007",
    empId: "SRN-0007",
    employee: "Neha Kulkarni",
    dept: "Engineering",
    branch: "Bhubaneswar HQ",
    anonymous: false,
    category: "Payroll / salary dispute",
    severity: "Medium",
    subject: "Overtime for ZooPlus go-live weekend not paid",
    description:
      "Worked 14 & 15 Aug for the KSeF go-live; comp-off credited but weekend OT allowance missing in the August payslip.",
    against: "Payroll",
    attachments: ["timesheet-aug-w2.pdf"],
    raisedOn: "2026-09-04",
    status: "Under investigation",
    owner: "Saras Venkatesh",
    committee: "Payroll & Finance",
    ackDue: "2026-09-08",
    resolveDue: "2026-09-18",
    acknowledgedOn: "2026-09-05",
    investigation: [
      {
        at: "2026-09-05",
        by: "Saras Venkatesh",
        note: "Timesheet verified — OT policy applies for client go-live weekends. Arrear being processed in September run.",
        visibleToEmployee: true,
      },
    ],
    resolution: "",
    actionTaken: "",
    employeeRating: null,
    employeeFeedback: "",
    appealReason: "",
    history: [
      { at: "2026-09-04", by: "Neha Kulkarni", action: "Submitted" },
      {
        at: "2026-09-05",
        by: "Saras Venkatesh",
        action: "Acknowledged · assigned to Payroll & Finance",
      },
      { at: "2026-09-05", by: "Saras Venkatesh", action: "Investigation started" },
    ],
  },
  {
    id: "GRV-2026-0006",
    empId: "SRN-0017",
    employee: "Anonymous",
    dept: "Operations",
    branch: "Bhubaneswar HQ",
    anonymous: true,
    category: "Manager behaviour",
    severity: "High",
    subject: "Repeated public criticism in stand-ups",
    description:
      "Team member singled out in daily stand-ups in front of the client team. Request a confidential discussion.",
    against: "Reporting manager",
    attachments: [],
    raisedOn: "2026-08-26",
    status: "Resolved",
    owner: "Farah Khan",
    committee: "HR Head + Unit Head",
    ackDue: "2026-08-28",
    resolveDue: "2026-09-10",
    acknowledgedOn: "2026-08-26",
    resolvedOn: "2026-09-08",
    investigation: [
      {
        at: "2026-08-29",
        by: "Farah Khan",
        note: "Spoke with the team and the manager separately. Manager coached on feedback norms.",
        visibleToEmployee: false,
      },
      {
        at: "2026-09-08",
        by: "Farah Khan",
        note: "Feedback now given 1:1; stand-up format changed. Will review in 30 days.",
        visibleToEmployee: true,
      },
    ],
    resolution: "Manager counselled; feedback moved to 1:1s; 30-day check-in scheduled.",
    actionTaken: "Coaching + written feedback norms circulated",
    employeeRating: null,
    employeeFeedback: "",
    appealReason: "",
    history: [
      { at: "2026-08-26", by: "Anonymous", action: "Submitted" },
      { at: "2026-08-26", by: "Farah Khan", action: "Acknowledged" },
      { at: "2026-09-08", by: "Farah Khan", action: "Resolved" },
    ],
  },
  {
    id: "GRV-2026-0005",
    empId: "SRN-0146",
    employee: "Kavya Menon",
    dept: "Operations",
    branch: "Chennai",
    anonymous: false,
    category: "Facilities",
    severity: "Low",
    subject: "AC not working on 3rd floor A-wing",
    description: "Cooling out for four working days.",
    against: "Facilities",
    attachments: [],
    raisedOn: "2026-07-14",
    status: "Closed",
    owner: "Aditya Verma",
    committee: "Admin & Facilities",
    ackDue: "2026-07-16",
    resolveDue: "2026-07-21",
    acknowledgedOn: "2026-07-14",
    resolvedOn: "2026-07-17",
    closedOn: "2026-07-18",
    investigation: [
      {
        at: "2026-07-17",
        by: "Aditya Verma",
        note: "Compressor replaced by AMC vendor.",
        visibleToEmployee: true,
      },
    ],
    resolution: "AC repaired under AMC.",
    actionTaken: "Vendor AMC call",
    employeeRating: 5,
    employeeFeedback: "Quick fix, thanks.",
    appealReason: "",
    history: [
      { at: "2026-07-14", by: "Kavya Menon", action: "Submitted" },
      { at: "2026-07-14", by: "Aditya Verma", action: "Acknowledged" },
      { at: "2026-07-17", by: "Aditya Verma", action: "Resolved" },
      { at: "2026-07-18", by: "Kavya Menon", action: "Closed with rating 5/5" },
    ],
  },
  {
    id: "GRV-2026-0004",
    empId: "SRN-0144",
    employee: "Priya Nair",
    dept: "HR",
    branch: "Bhubaneswar HQ",
    anonymous: false,
    category: "Harassment (POSH)",
    severity: "Critical",
    subject: "Inappropriate remarks in team meeting",
    description: "Escalated to the Internal Committee under POSH.",
    against: "Vikram Iyer",
    attachments: ["statement.pdf"],
    raisedOn: "2026-07-02",
    status: "Under investigation",
    owner: "Farah Khan",
    committee: "Internal Committee (POSH)",
    ackDue: "2026-07-03",
    resolveDue: "2026-09-30",
    acknowledgedOn: "2026-07-02",
    investigation: [
      {
        at: "2026-07-06",
        by: "Farah Khan",
        note: "IC constituted; statements recorded from both parties and two witnesses.",
        visibleToEmployee: true,
      },
    ],
    resolution: "",
    actionTaken: "",
    employeeRating: null,
    employeeFeedback: "",
    appealReason: "",
    history: [
      { at: "2026-07-02", by: "Priya Nair", action: "Submitted" },
      { at: "2026-07-02", by: "Farah Khan", action: "Acknowledged · IC (POSH) constituted" },
    ],
  },
]);
export const useGrievances = () => grievanceStore.use();

/** Routing owner + the HR / CHRO team of the complainant's entity — nobody was told a grievance had been raised. */
const handlersFor = (g) => {
  const org = findEmployee(g.empId)?.orgId;
  return allUsers().filter(
    (u) =>
      u.id !== g.empId &&
      (u.name === g.owner || ((u.role === "HR" || u.role === "CHRO") && (!org || u.orgId === org))),
  );
};

export function raiseGrievance(input) {
  if (!input.empId) return { ok: false, message: "Choose the employee raising the grievance." };
  if (!input.subject.trim() || !input.description.trim())
    return { ok: false, message: "Subject and description are required." };
  if (input.subject.trim().length > 150)
    return { ok: false, message: "Keep the subject under 150 characters." };
  const r = ROUTING[input.category];
  const d = today();
  const nextNo =
    Math.max(0, ...grievanceStore.get().map((g) => Number(g.id.match(/(\d+)$/)?.[1]) || 0)) + 1;
  const row = {
    ...input,
    subject: input.subject.trim(),
    description: input.description.trim(),
    employee: input.anonymous ? "Anonymous" : input.employee,
    id: `GRV-2026-${String(nextNo).padStart(4, "0")}`,
    raisedOn: d,
    status: "Submitted",
    owner: r.owner,
    committee: r.committee,
    ackDue: plusDays(d, r.ackDays),
    resolveDue: plusDays(d, r.resolveDays),
    investigation: [],
    resolution: "",
    actionTaken: "",
    employeeRating: null,
    employeeFeedback: "",
    appealReason: "",
    history: [
      {
        at: d,
        by: input.anonymous ? "Anonymous" : input.employee,
        action: `Submitted · routed to ${r.committee}`,
      },
    ],
  };
  grievanceStore.set((l) => [row, ...l]);
  handlersFor(row).forEach((u) =>
    pushAlert({
      empId: u.id,
      kind: "grievance",
      to: "/org/grievances",
      title: `New grievance ${row.id} — ${row.category}`,
      body: `${row.severity} · ${row.subject} · raised by ${row.employee}. Acknowledge by ${row.ackDue}.`,
    }),
  );
  return {
    ok: true,
    message: `${row.id} raised · routed to ${r.committee} · acknowledgement due ${row.ackDue}.`,
    id: row.id,
  };
}
const patch = (id, fn) => grievanceStore.set((l) => l.map((g) => (g.id === id ? fn(g) : g)));
/** A handler named in the "against" field must not act on the grievance raised about them. */
export const isAccused = (g, by) =>
  !!g?.against && !!by?.name && g.against.toLowerCase().includes(by.name.toLowerCase());
/** Day after which HR may close a resolved grievance the employee has not answered (7-day confirm / appeal window). */
export const closeWindowEnds = (g) => (g.resolvedOn ? plusDays(g.resolvedOn, 7) : null);
const find = (id) => grievanceStore.get().find((x) => x.id === id);
// Alerts go only to the complainant's own inbox, so anonymous complainants are notified too without being revealed.
export function acknowledgeGrievance(id, by, owner) {
  const cur = find(id);
  if (!cur || cur.status !== "Submitted")
    return { ok: false, message: "Only a newly submitted grievance can be acknowledged." };
  if (isAccused(cur, by) || cur.empId === by.id)
    return { ok: false, message: "You are a party to this grievance — another handler must act." };
  patch(id, (g) => ({
    ...g,
    status: "Acknowledged",
    acknowledgedOn: today(),
    owner: owner ?? g.owner,
    history: [
      ...g.history,
      { at: today(), by: by.name, action: `Acknowledged${owner ? ` · assigned to ${owner}` : ""}` },
    ],
  }));
  const g = find(id);
  if (g)
    pushAlert({
      empId: g.empId,
      kind: "grievance",
      to: "/emp/complaints",
      title: "Grievance acknowledged",
      body: `${g.id} acknowledged by ${by.name} · handled by ${g.committee} · resolution due ${g.resolveDue}.`,
    });
  return { ok: true, message: "Acknowledged — employee notified." };
}
export function addInvestigationNote(id, by, note, visibleToEmployee) {
  if (!note.trim()) return { ok: false, message: "Enter a note." };
  const cur = find(id);
  if (!cur || ["Resolved", "Closed", "Withdrawn"].includes(cur.status))
    return {
      ok: false,
      message: `The grievance is ${cur?.status.toLowerCase() ?? "not found"} — notes can no longer be added.`,
    };
  if (isAccused(cur, by))
    return { ok: false, message: "You are named in this grievance — another handler must act." };
  patch(id, (g) => ({
    ...g,
    status:
      g.status === "Acknowledged" || g.status === "Submitted" ? "Under investigation" : g.status,
    investigation: [
      ...g.investigation,
      { at: today(), by: by.name, note: note.trim(), visibleToEmployee },
    ],
    history: [
      ...g.history,
      {
        at: today(),
        by: by.name,
        action:
          g.status === "Acknowledged" || g.status === "Submitted"
            ? "Investigation started"
            : "Investigation note added",
      },
    ],
  }));
  return { ok: true, message: "Note added." };
}
export function resolveGrievance(id, by, resolution, actionTaken) {
  if (!resolution.trim()) return { ok: false, message: "Enter the resolution." };
  const cur = find(id);
  if (!cur || !["Acknowledged", "Under investigation", "Appealed"].includes(cur.status))
    return {
      ok: false,
      message:
        cur?.status === "Submitted"
          ? "Acknowledge the grievance before resolving it."
          : "This grievance cannot be resolved in its current status.",
    };
  if (isAccused(cur, by) || cur.empId === by.id)
    return { ok: false, message: "You are a party to this grievance — another handler must act." };
  patch(id, (g) => ({
    ...g,
    status: "Resolved",
    resolvedOn: today(),
    resolution,
    actionTaken,
    history: [
      ...g.history,
      { at: today(), by: by.name, action: "Resolved — awaiting employee confirmation" },
    ],
  }));
  const g = find(id);
  if (g)
    pushAlert({
      empId: g.empId,
      kind: "grievance",
      to: "/emp/complaints",
      title: "Grievance resolved — please confirm",
      body: `${g.id}: ${resolution}. Accept & close, or appeal within 7 days.`,
    });
  return { ok: true, message: "Resolved — employee asked to confirm or appeal within 7 days." };
}
export function closeGrievance(id, by, rating, feedback) {
  const cur = find(id);
  if (!cur || cur.status !== "Resolved")
    return { ok: false, message: "Only a resolved grievance can be closed." };
  if (rating !== null && (rating < 1 || rating > 5))
    return { ok: false, message: "Rating must be 1–5." };
  // Anyone other than the complainant may close only after the 7-day confirmation / appeal window.
  if (by.id !== cur.empId) {
    const ends = closeWindowEnds(cur);
    if (ends && today() < ends)
      return {
        ok: false,
        message: `The employee can confirm or appeal until ${ends} — close after that date.`,
      };
  }
  patch(id, (g) => ({
    ...g,
    status: "Closed",
    closedOn: today(),
    employeeRating: rating,
    employeeFeedback: feedback,
    history: [
      ...g.history,
      {
        at: today(),
        by: g.anonymous && by.id === g.empId ? "Anonymous" : by.name,
        action: rating ? `Closed with rating ${rating}/5` : "Closed",
      },
    ],
  }));
  return { ok: true, message: "Grievance closed." };
}
export function appealGrievance(id, by, reason) {
  if (!reason.trim()) return { ok: false, message: "Enter the reason for appeal." };
  const cur = find(id);
  if (!cur || cur.status !== "Resolved")
    return { ok: false, message: "Only a resolved grievance can be appealed." };
  if (cur.empId !== by.id) return { ok: false, message: "Only the complainant can appeal." };
  // The appeal goes to the CHRO of the complainant's own company (was a hard-coded name and every company's CHRO).
  const org = findEmployee(cur.empId)?.orgId;
  const chros = allUsers().filter((u) => u.role === "CHRO" && (!org || u.orgId === org));
  const chro = chros[0];
  patch(id, (g) => ({
    ...g,
    status: "Appealed",
    appealReason: reason,
    owner: chro?.name ?? g.owner,
    committee: "CHRO / Appellate",
    resolveDue: plusDays(today(), 15),
    history: [
      ...g.history,
      {
        at: today(),
        by: g.anonymous ? "Anonymous" : by.name,
        action: "Appealed — escalated to CHRO",
      },
    ],
  }));
  chros.forEach((u) =>
    pushAlert({
      empId: u.id,
      kind: "grievance",
      to: "/org/grievances",
      title: `Grievance appealed — ${cur.id}`,
      body: `${cur.category} · ${reason.trim()}`,
    }),
  );
  return { ok: true, message: "Appeal lodged — escalated to the CHRO with a 15-day SLA." };
}
export function withdrawGrievance(id, by) {
  const cur = find(id);
  if (!cur || !["Submitted", "Acknowledged"].includes(cur.status))
    return { ok: false, message: "This grievance can no longer be withdrawn." };
  if (cur.empId !== by.id) return { ok: false, message: "Only the complainant can withdraw." };
  patch(id, (g) => ({
    ...g,
    status: "Withdrawn",
    closedOn: today(),
    history: [
      ...g.history,
      { at: today(), by: g.anonymous ? "Anonymous" : by.name, action: "Withdrawn by employee" },
    ],
  }));
  return { ok: true, message: "Withdrawn." };
}

export const grievanceTone = (s) =>
  s === "Closed" || s === "Resolved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Appealed"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Withdrawn"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";
export const severityTone = (s) =>
  s === "Critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : s === "High"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border";
export const isOverdue = (g) =>
  (g.status === "Submitted" && g.ackDue < today()) ||
  (["Acknowledged", "Under investigation", "Appealed"].includes(g.status) &&
    g.resolveDue < today());
export const daysToResolve = (g) =>
  g.resolvedOn ? Math.round((+new Date(g.resolvedOn) - +new Date(g.raisedOn)) / 86400000) : null;
