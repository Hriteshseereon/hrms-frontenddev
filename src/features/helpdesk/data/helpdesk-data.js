// -----------------------------------------------------------------------------
// Helpdesk — department-routed support ticketing (UI-only).
//
// Modelled on the ITSM / service-desk conventions of tools like Freshservice,
// Zendesk and ServiceNow:
//   • Every ticket belongs to a *service department* (IT & Systems, Finance &
//     Payroll, Human Resources, Admin & Facilities, SAP Support). The requester
//     picks the department, a category inside it and — optionally — the
//     concerned person (an agent of that department). If no person is chosen,
//     the category's default owner or the department head is assigned.
//   • Priority × SLA policy sets first-response and resolution targets; the
//     ticket shows On track / At risk / Breached against the clock.
//   • Status lifecycle: New → Assigned → In Progress → Waiting on Requester →
//     Resolved → Closed, with Reopened. Only the requester or the desk closes.
//   • Timeline holds public replies, internal notes (agents only), status,
//     assignment and attachment events. Watchers (other people involved) get
//     the same updates; e-mail channel tickets keep the thread reference.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { SEEREON_USERS, allUsers, userById } from "@/features/auth/data/auth-session";
import { findEmployee, directoryEmployees } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";

/* ------------------------------- Configuration ------------------------------ */

/**
 * @typedef {"Low" | "Medium" | "High" | "Critical"} Priority
 */
export const PRIORITIES = ["Low", "Medium", "High", "Critical"];
/**
 * @typedef {"Individual" | "Team" | "Department" | "Organisation"} Impact
 */
export const IMPACTS = ["Individual", "Team", "Department", "Organisation"];
/**
 * @typedef {"New" | "Assigned" | "In Progress" | "Waiting on Requester" | "Resolved" | "Closed" | "Reopened"} TicketStatus
 */
export const STATUSES = [
  "New",
  "Assigned",
  "In Progress",
  "Waiting on Requester",
  "Resolved",
  "Closed",
  "Reopened",
];
export const OPEN_STATUSES = ["New", "Assigned", "In Progress", "Waiting on Requester", "Reopened"];
/**
 * @typedef {"Portal" | "Email" | "Phone" | "Walk-in"} Channel
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string | null} defaultAgentId
 * @property {Priority} defaultPriority
 */

/**
 * @typedef {Object} ServiceDepartment
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} headId
 * @property {string[]} agentIds
 * @property {Category[]} categories
 * @property {string} mailbox
 * @property {string} businessHours
 */

/**
 * @typedef {Object} SlaPolicy
 * @property {Priority} priority
 * @property {number} firstResponseHours
 * @property {number} resolveHours
 */

/**
 * @typedef {Object} HelpdeskConfig
 * @property {ServiceDepartment[]} departments
 * @property {SlaPolicy[]} sla
 * @property {number} autoCloseDays
 * @property {boolean} allowRequesterPickAgent
 * @property {string} ticketPrefix
 */

export const DEFAULT_HELPDESK_CONFIG = {
  ticketPrefix: "SRN-TKT",
  autoCloseDays: 5,
  allowRequesterPickAgent: true,
  sla: [
    { priority: "Critical", firstResponseHours: 1, resolveHours: 8 },
    { priority: "High", firstResponseHours: 4, resolveHours: 24 },
    { priority: "Medium", firstResponseHours: 8, resolveHours: 72 },
    { priority: "Low", firstResponseHours: 24, resolveHours: 120 },
  ],
  departments: [
    {
      id: "IT",
      name: "IT & Systems",
      description: "Laptops, access, e-mail, VPN, SAP logon, software licences.",
      headId: "SRN-0009",
      agentIds: ["SRN-ADMIN", "SRN-0009", "SRN-2101"],
      mailbox: "itsupport@seereon.co.in",
      businessHours: "Mon–Sat 08:00–20:00",
      categories: [
        {
          id: "IT-ACCESS",
          name: "Access & Accounts",
          description: "SSO, AD, password resets, MFA, new accounts",
          defaultAgentId: "SRN-ADMIN",
          defaultPriority: "High",
        },
        {
          id: "IT-SAP",
          name: "SAP Logon / GUI",
          description: "SAP GUI, Fiori launchpad, locked users, roles",
          defaultAgentId: "SRN-2101",
          defaultPriority: "High",
        },
        {
          id: "IT-HW",
          name: "Hardware & Devices",
          description: "Laptop, monitor, peripherals, biometric device",
          defaultAgentId: "SRN-ADMIN",
          defaultPriority: "Medium",
        },
        {
          id: "IT-EMAIL",
          name: "E-mail & Collaboration",
          description: "Mailbox, Teams/Slack, calendar, distribution lists",
          defaultAgentId: "SRN-ADMIN",
          defaultPriority: "Medium",
        },
        {
          id: "IT-NET",
          name: "Network & VPN",
          description: "Wi-Fi, VPN, connectivity, firewall rules",
          defaultAgentId: "SRN-0009",
          defaultPriority: "High",
        },
        {
          id: "IT-SW",
          name: "Software & Licences",
          description: "Installations, licence keys, tool access",
          defaultAgentId: "SRN-ADMIN",
          defaultPriority: "Low",
        },
      ],
    },
    {
      id: "FIN",
      name: "Finance & Payroll",
      description: "Salary, payslips, TDS, PF/ESI, reimbursements, loans.",
      headId: "SRN-0002",
      agentIds: ["SRN-0002", "SRN-0004"],
      mailbox: "payroll@seereon.co.in",
      businessHours: "Mon–Fri 09:30–18:30",
      categories: [
        {
          id: "FIN-PAY",
          name: "Salary & Payslip",
          description: "Incorrect pay, missing components, LOP queries",
          defaultAgentId: "SRN-0004",
          defaultPriority: "High",
        },
        {
          id: "FIN-TDS",
          name: "TDS & Form 16",
          description: "Tax deduction, regime, Form 16 / 12BB",
          defaultAgentId: "SRN-0002",
          defaultPriority: "Medium",
        },
        {
          id: "FIN-PF",
          name: "PF / ESI / Statutory",
          description: "UAN, PF passbook, ESI card, VPF/NPS",
          defaultAgentId: "SRN-0004",
          defaultPriority: "Medium",
        },
        {
          id: "FIN-CLAIM",
          name: "Reimbursements & Claims",
          description: "Expense claims, settlement delays",
          defaultAgentId: "SRN-0002",
          defaultPriority: "Medium",
        },
        {
          id: "FIN-LOAN",
          name: "Loans & Advances",
          description: "Salary advance, loan EMI, recovery",
          defaultAgentId: "SRN-0002",
          defaultPriority: "Low",
        },
      ],
    },
    {
      id: "HR",
      name: "Human Resources",
      description: "Leave, attendance, policies, letters, onboarding, exit.",
      headId: "SRN-0010",
      agentIds: ["SRN-0010", "SRN-0011", "SRN-0004", "SRN-0012", "SRN-0013"],
      mailbox: "hr@seereon.co.in",
      businessHours: "Mon–Fri 09:30–18:30",
      categories: [
        {
          id: "HR-LEAVE",
          name: "Leave & Attendance",
          description: "Regularisation, balances, comp-off, holidays",
          defaultAgentId: "SRN-0012",
          defaultPriority: "Medium",
        },
        {
          id: "HR-LETTER",
          name: "Letters & Documents",
          description: "Experience, salary certificate, address proof, visa letters",
          defaultAgentId: "SRN-0013",
          defaultPriority: "Low",
        },
        {
          id: "HR-POLICY",
          name: "Policy & Handbook",
          description: "Clarifications on HR policies",
          defaultAgentId: "SRN-0011",
          defaultPriority: "Low",
        },
        {
          id: "HR-ONB",
          name: "Onboarding & Exit",
          description: "Joining formalities, relieving, F&F",
          defaultAgentId: "SRN-0004",
          defaultPriority: "Medium",
        },
        {
          id: "HR-INS",
          name: "Insurance & Benefits",
          description: "Mediclaim, e-cards, dependants",
          defaultAgentId: "SRN-0011",
          defaultPriority: "Medium",
        },
        {
          id: "HR-GRIEV",
          name: "Grievance (confidential)",
          description: "Routed only to the CHRO",
          defaultAgentId: "SRN-0010",
          defaultPriority: "High",
        },
      ],
    },
    {
      id: "ADM",
      name: "Admin & Facilities",
      description: "Office, seating, ID cards, travel desk, assets & stationery.",
      headId: "SRN-0003",
      agentIds: ["SRN-0003", "SRN-0017"],
      mailbox: "admin@seereon.co.in",
      businessHours: "Mon–Sat 09:00–19:00",
      categories: [
        {
          id: "ADM-FAC",
          name: "Facilities & Seating",
          description: "AC, lighting, desk, meeting rooms",
          defaultAgentId: "SRN-0017",
          defaultPriority: "Low",
        },
        {
          id: "ADM-ID",
          name: "ID Card & Access Card",
          description: "New/replacement cards, door access",
          defaultAgentId: "SRN-0017",
          defaultPriority: "Medium",
        },
        {
          id: "ADM-TRAVEL",
          name: "Travel Desk",
          description: "Bookings, visas, cabs",
          defaultAgentId: "SRN-0003",
          defaultPriority: "Medium",
        },
        {
          id: "ADM-ASSET",
          name: "Asset Issue / Return",
          description: "Company assets, stationery, consumables",
          defaultAgentId: "SRN-0017",
          defaultPriority: "Low",
        },
      ],
    },
    {
      id: "SAP",
      name: "SAP Support (Internal)",
      description: "Internal SAP landscape — ABAP, CPI, authorisations, transports.",
      headId: "SRN-2001",
      agentIds: ["SRN-2001", "SRN-2101", "SRN-0009"],
      mailbox: "sapsupport@seereon.co.in",
      businessHours: "Mon–Sat 08:00–22:00 (project shifts)",
      categories: [
        {
          id: "SAP-AUTH",
          name: "Authorisations & Roles",
          description: "Missing t-code, role assignment, SU53",
          defaultAgentId: "SRN-2101",
          defaultPriority: "High",
        },
        {
          id: "SAP-TR",
          name: "Transports & Landscape",
          description: "Transport requests, client copies, refresh",
          defaultAgentId: "SRN-2001",
          defaultPriority: "Medium",
        },
        {
          id: "SAP-CPI",
          name: "CPI / Integration",
          description: "iFlows, connectivity, certificates",
          defaultAgentId: "SRN-0009",
          defaultPriority: "High",
        },
        {
          id: "SAP-PERF",
          name: "Performance / Dumps",
          description: "Short dumps, slow reports, locks",
          defaultAgentId: "SRN-2001",
          defaultPriority: "Medium",
        },
      ],
    },
  ],
};

export const helpdeskConfigStore = createPersistentStore(
  "seereon.helpdesk.config",
  DEFAULT_HELPDESK_CONFIG,
);
export const useHelpdeskConfig = () => helpdeskConfigStore.use();
export const getHelpdeskConfig = () => helpdeskConfigStore.get();
export const saveHelpdeskConfig = (c) => helpdeskConfigStore.set(c);

export const departmentById = (id) =>
  getHelpdeskConfig().departments.find((d) => d.id === id) ?? null;
export const slaFor = (p, cfg = getHelpdeskConfig()) =>
  cfg.sla.find((s) => s.priority === p) ?? cfg.sla[2];

/* ---------------------------------- People --------------------------------- */

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} dept
 * @property {string} designation
 */

export const personById = (id) => {
  const u = userById(id);
  if (u)
    return { id: u.id, name: u.name, email: u.email, dept: u.dept, designation: u.designation };
  const e = findEmployee(id);
  return e ? { id: e.id, name: e.name, email: e.email, dept: e.dept, designation: e.role } : null;
};

/** Everyone who can be a requester / watcher. */
export const allPeople = () => {
  const seen = new Map();
  allUsers().forEach((u) =>
    seen.set(u.id, {
      id: u.id,
      name: u.name,
      email: u.email,
      dept: u.dept,
      designation: u.designation,
    }),
  );
  directoryEmployees().forEach((e) => {
    if (!seen.has(e.id))
      seen.set(e.id, { id: e.id, name: e.name, email: e.email, dept: e.dept, designation: e.role });
  });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const agentsOf = (deptId) =>
  (departmentById(deptId)?.agentIds ?? []).map(personById).filter((p) => !!p);

export const HELPDESK_ADMIN_ROLES = ["SuperAdmin", "Admin", "CEO", "CTO", "CHRO"];
export const isHelpdeskAdmin = (u) => HELPDESK_ADMIN_ROLES.includes(u.role);
export const isAgent = (u, deptId) =>
  getHelpdeskConfig().departments.some(
    (d) => (!deptId || d.id === deptId) && (d.agentIds.includes(u.id) || d.headId === u.id),
  );
export const agentDepartments = (u) =>
  getHelpdeskConfig().departments.filter((d) => d.agentIds.includes(u.id) || d.headId === u.id);

/* ---------------------------------- Ticket --------------------------------- */

/**
 * @typedef {Object} Attachment
 * @property {string} id
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {string} addedBy
 * @property {string} at
 */
/**
 * @typedef {Object} TimelineEvent
 * @property {string} id
 * @property {string} at
 * @property {string} byId
 * @property {string} by
 * @property {"reply" | "internal" | "status" | "assignment" | "attachment" | "system" | "escalation"} type
 * @property {string} text
 */

/**
 * @typedef {Object} Ticket
 * @property {string} id
 * @property {string} orgId
 * @property {string} subject
 * @property {string} description
 * @property {string} departmentId
 * @property {string} categoryId
 * @property {Priority} priority
 * @property {Impact} impact
 * @property {TicketStatus} status
 * @property {Channel} channel
 * @property {string} requesterId
 * @property {string} requesterName
 * @property {string} requesterDept
 * @property {string} [onBehalfOfId]
 * @property {string | null} assigneeId
 * @property {string | null} assigneeName
 * @property {{ id: string, name: string }[]} watchers
 * @property {Attachment[]} attachments
 * @property {string[]} tags
 * @property {{ kind: "Employee" | "Asset" | "Payroll period" | "Leave request" | "Other", ref: string }} [related]
 * @property {{ from: string, messageId: string, receivedAt: string }} [emailThread]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} firstResponseDue
 * @property {string} resolveDue
 * @property {string} [firstResponseAt]
 * @property {string} [resolvedAt]
 * @property {string} [closedAt]
 * @property {string} [resolution]
 * @property {number} reopenCount
 * @property {string} [reopenedAt] - Last reopen — the resolution clock restarts from here.
 * @property {string} [pausedAt] - Set while "Waiting on Requester" (the SLA clock is paused).
 * @property {number} [pausedMs] - Time spent paused since the clock last started (added to resolveDue).
 * @property {{ rating: 1 | 2 | 3 | 4 | 5, comment: string, at: string }} [satisfaction]
 * @property {TimelineEvent[]} timeline
 */

const nowIso = () => new Date().toISOString();
const addHours = (iso, h) => new Date(+new Date(iso) + h * 3600_000).toISOString();
let seq = 0;
const evId = () => `EV-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * SLA pause: entering "Waiting on Requester" stamps pausedAt; leaving it pushes resolveDue out by the time spent
 * waiting (the screen promised a paused clock but the deadline never moved, so the ticket breached while it waited).
 */
const withSlaStatus = (x, status, at = nowIso()) => {
  if (status === "Waiting on Requester")
    return x.pausedAt ? { ...x, status } : { ...x, status, pausedAt: at };
  if (!x.pausedAt) return { ...x, status };
  const waited = Math.max(0, +new Date(at) - +new Date(x.pausedAt));
  return {
    ...x,
    status,
    pausedAt: undefined,
    pausedMs: (x.pausedMs ?? 0) + waited,
    resolveDue: new Date(+new Date(x.resolveDue) + waited).toISOString(),
  };
};
/** Resolution target for a priority, measured from the clock start (last reopen, else creation) plus paused time. */
const resolveDueFor = (x, hours) =>
  new Date(
    +new Date(addHours(x.reopenedAt ?? x.createdAt, hours)) +
      (x.pausedMs ?? 0) +
      (x.pausedAt ? Math.max(0, Date.now() - +new Date(x.pausedAt)) : 0),
  ).toISOString();

const mk = (o) => {
  const r = personById(o.requesterId);
  const a = o.assigneeId ? personById(o.assigneeId) : null;
  const sla = slaFor(o.priority, DEFAULT_HELPDESK_CONFIG);
  return {
    // Tenant of the requester (SAP Practice / Cloud Services tickets were all filed under ORG-SEEREON).
    orgId: userById(o.requesterId)?.orgId ?? findEmployee(o.requesterId)?.orgId ?? "ORG-SEEREON",
    impact: "Individual",
    channel: "Portal",
    requesterName: r.name,
    requesterDept: r.dept,
    assigneeId: a?.id ?? null,
    assigneeName: a?.name ?? null,
    watchers: [],
    attachments: [],
    tags: [],
    updatedAt: o.createdAt,
    firstResponseDue: addHours(o.createdAt, sla.firstResponseHours),
    resolveDue: addHours(o.createdAt, sla.resolveHours),
    reopenCount: 0,
    timeline: [],
    ...o,
  };
};

const T = (d, h = "09:30") => `${d}T${h}:00.000Z`;
const ev = (at, byId, type, text) => ({
  id: `EV-SEED-${at}-${byId}-${type}`.replace(/[^A-Za-z0-9-]/g, ""),
  at,
  byId,
  by: personById(byId)?.name ?? byId,
  type,
  text,
});

const SEED_TICKETS = [
  mk({
    id: "SRN-TKT-2026-0031",
    subject: "July payslip shows 3 LOP days but I was on approved leave",
    description:
      "My July 2026 payslip deducts 3 days as LOP. I had approved Earned Leave from 14–16 July (LVA-5003). Please correct and reissue the payslip.",
    departmentId: "FIN",
    categoryId: "FIN-PAY",
    priority: "High",
    impact: "Individual",
    requesterId: "SRN-0006",
    assigneeId: "SRN-0004",
    status: "In Progress",
    createdAt: T("2026-09-10", "04:12"),
    firstResponseAt: T("2026-09-10", "06:40"),
    related: { kind: "Payroll period", ref: "PR-202607" },
    tags: ["payroll", "lop"],
    watchers: [{ id: "SRN-0005", name: "Subh Sahoo" }],
    timeline: [
      ev(
        T("2026-09-10", "04:12"),
        "SRN-0006",
        "system",
        "Ticket created via Portal → Finance & Payroll / Salary & Payslip",
      ),
      ev(
        T("2026-09-10", "04:12"),
        "SRN-0006",
        "assignment",
        "Auto-assigned to Varen Mishra (category default)",
      ),
      ev(
        T("2026-09-10", "06:40"),
        "SRN-0004",
        "reply",
        "Checked the attendance register — the leave is approved but the month was locked before the approval was posted. We will re-run the LOP for July and issue a supplementary payslip.",
      ),
      ev(T("2026-09-10", "06:41"), "SRN-0004", "status", "Status → In Progress"),
      ev(
        T("2026-09-11", "10:05"),
        "SRN-0004",
        "internal",
        "Supplementary run needed after attendance unlock — coordinate with CFO before the 15th ECR cut-off.",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0032",
    subject: "SAP GUI locked after three attempts",
    description:
      "SAP GUI (client 100) locked my user ID DSOLANKI after three failed logins this morning. Need it unlocked before the 2 PM client call.",
    departmentId: "IT",
    categoryId: "IT-SAP",
    priority: "Critical",
    impact: "Individual",
    requesterId: "SRN-2001",
    assigneeId: "SRN-2101",
    status: "Resolved",
    channel: "Email",
    createdAt: T("2026-09-12", "03:20"),
    firstResponseAt: T("2026-09-12", "03:45"),
    resolvedAt: T("2026-09-12", "04:10"),
    resolution: "User unlocked in SU01 and password reset; MFA re-enrolled.",
    emailThread: {
      from: "devraj.solanki@sap.seereon.co.in",
      messageId: "<9a1f@mail.seereon>",
      receivedAt: T("2026-09-12", "03:20"),
    },
    tags: ["sap", "access"],
    timeline: [
      ev(
        T("2026-09-12", "03:20"),
        "SRN-2001",
        "system",
        "Ticket created from e-mail thread <9a1f@mail.seereon> → IT & Systems / SAP Logon",
      ),
      ev(
        T("2026-09-12", "03:45"),
        "SRN-2101",
        "reply",
        "Unlocked. Temporary password sent to your registered e-mail.",
      ),
      ev(
        T("2026-09-12", "04:10"),
        "SRN-2101",
        "status",
        "Status → Resolved: User unlocked in SU01 and password reset; MFA re-enrolled.",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0033",
    subject: "Experience letter for visa application",
    description:
      "I need an experience-cum-salary certificate on letterhead for a Schengen visa appointment on 25 Sep.",
    departmentId: "HR",
    categoryId: "HR-LETTER",
    priority: "Medium",
    requesterId: "SRN-0007",
    assigneeId: "SRN-0013",
    status: "Assigned",
    createdAt: T("2026-09-13", "09:00"),
    tags: ["letter"],
    timeline: [
      ev(
        T("2026-09-13", "09:00"),
        "SRN-0007",
        "system",
        "Ticket created via Portal → Human Resources / Letters & Documents",
      ),
      ev(
        T("2026-09-13", "09:00"),
        "SRN-0007",
        "assignment",
        "Auto-assigned to Aditya Verma (category default)",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0034",
    subject: "VPN drops every 20 minutes from Hyderabad office",
    description:
      "GlobalProtect VPN disconnects roughly every 20 minutes on the Hyderabad office Wi-Fi. Affects the whole SAP delivery pod.",
    departmentId: "IT",
    categoryId: "IT-NET",
    priority: "High",
    impact: "Team",
    requesterId: "SRN-2101",
    assigneeId: "SRN-0009",
    status: "Waiting on Requester",
    createdAt: T("2026-09-11", "07:30"),
    firstResponseAt: T("2026-09-11", "09:10"),
    tags: ["vpn", "hyderabad"],
    watchers: [{ id: "SRN-2001", name: "Devraj Solanki" }],
    timeline: [
      ev(
        T("2026-09-11", "07:30"),
        "SRN-2101",
        "system",
        "Ticket created via Portal → IT & Systems / Network & VPN",
      ),
      ev(
        T("2026-09-11", "09:10"),
        "SRN-0009",
        "reply",
        "Please share the GlobalProtect client logs (Settings → Troubleshooting → Collect logs) so we can check the DTLS keepalive.",
      ),
      ev(T("2026-09-11", "09:11"), "SRN-0009", "status", "Status → Waiting on Requester"),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0035",
    subject: "Replacement access card — lost",
    description:
      "Lost my access card during the client visit. Need a replacement and the old card deactivated.",
    departmentId: "ADM",
    categoryId: "ADM-ID",
    priority: "Medium",
    requesterId: "SRN-0015",
    assigneeId: "SRN-0017",
    status: "Closed",
    createdAt: T("2026-09-05", "05:15"),
    firstResponseAt: T("2026-09-05", "06:00"),
    resolvedAt: T("2026-09-06", "04:30"),
    closedAt: T("2026-09-08", "05:00"),
    resolution: "Old card deactivated; new card issued (ACC-2026-118).",
    satisfaction: {
      rating: 5,
      comment: "Quick turnaround, thank you.",
      at: T("2026-09-08", "05:00"),
    },
    timeline: [
      ev(
        T("2026-09-05", "05:15"),
        "SRN-0015",
        "system",
        "Ticket created via Portal → Admin & Facilities / ID Card & Access Card",
      ),
      ev(
        T("2026-09-05", "06:00"),
        "SRN-0017",
        "reply",
        "Old card blocked. Collect the new card from the front desk tomorrow.",
      ),
      ev(
        T("2026-09-06", "04:30"),
        "SRN-0017",
        "status",
        "Status → Resolved: Old card deactivated; new card issued (ACC-2026-118).",
      ),
      ev(
        T("2026-09-08", "05:00"),
        "SRN-0015",
        "status",
        "Status → Closed by requester · rated 5/5",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0036",
    subject: "Missing authorisation for ME23N in QA client",
    description:
      "SU53 shows missing M_BEST_BSA for ME23N in QAS 200. Blocking the ZooPlus KSeF testing.",
    departmentId: "SAP",
    categoryId: "SAP-AUTH",
    priority: "High",
    impact: "Team",
    requesterId: "SRN-0014",
    assigneeId: "SRN-2101",
    status: "New",
    createdAt: T("2026-09-15", "06:45"),
    related: { kind: "Other", ref: "ZooPlus — KSeF e-Invoicing Rollout" },
    tags: ["sap", "authorisation"],
    timeline: [
      ev(
        T("2026-09-15", "06:45"),
        "SRN-0014",
        "system",
        "Ticket created via Portal → SAP Support / Authorisations & Roles",
      ),
      ev(
        T("2026-09-15", "06:45"),
        "SRN-0014",
        "assignment",
        "Auto-assigned to Ritesh Barman (category default)",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0037",
    subject: "August TDS higher than expected — previous employer TDS not adjusted",
    description:
      "I declared my previous employer's salary and TDS in Form 12BB in April, but August TDS looks like it ignores the TDS already deducted there.",
    departmentId: "FIN",
    categoryId: "FIN-TDS",
    priority: "Medium",
    requesterId: "SRN-0016",
    assigneeId: "SRN-0002",
    status: "Assigned",
    createdAt: T("2026-09-14", "10:20"),
    tags: ["tds", "regime"],
    timeline: [
      ev(
        T("2026-09-14", "10:20"),
        "SRN-0016",
        "system",
        "Ticket created via Portal → Finance & Payroll / TDS & Form 16",
      ),
      ev(
        T("2026-09-14", "10:20"),
        "SRN-0016",
        "assignment",
        "Auto-assigned to Saras Venkatesh (category default)",
      ),
    ],
  }),
  mk({
    id: "SRN-TKT-2026-0038",
    subject: "Mediclaim e-card for newborn dependant",
    description:
      "Need to add my newborn (DOB 02-Sep-2026) to the group mediclaim and get the e-card.",
    departmentId: "HR",
    categoryId: "HR-INS",
    priority: "Medium",
    requesterId: "SRN-0008",
    assigneeId: "SRN-0011",
    status: "In Progress",
    createdAt: T("2026-09-09", "08:00"),
    firstResponseAt: T("2026-09-09", "11:30"),
    timeline: [
      ev(
        T("2026-09-09", "08:00"),
        "SRN-0008",
        "system",
        "Ticket created via Portal → Human Resources / Insurance & Benefits",
      ),
      ev(
        T("2026-09-09", "11:30"),
        "SRN-0011",
        "reply",
        "Congratulations! Please upload the birth certificate; the insurer needs it for mid-term addition.",
      ),
      ev(
        T("2026-09-10", "05:20"),
        "SRN-0008",
        "attachment",
        "Attached birth-certificate.pdf (412 KB)",
      ),
      ev(T("2026-09-10", "06:00"), "SRN-0011", "status", "Status → In Progress"),
    ],
    attachments: [
      {
        id: "ATT-1",
        name: "birth-certificate.pdf",
        size: 421_000,
        type: "application/pdf",
        addedBy: "Rakesh Menon",
        at: T("2026-09-10", "05:20"),
      },
    ],
  }),
];

export const ticketStore = createPersistentStore("seereon.helpdesk.tickets", SEED_TICKETS);
export const useTickets = () => ticketStore.use();
export const ticketById = (id) => ticketStore.get().find((t) => t.id === id) ?? null;

const update = (id, fn) =>
  ticketStore.set((l) => l.map((t) => (t.id === id ? fn({ ...t, updatedAt: nowIso() }) : t)));
const push = (t, byId, type, text) => ({
  ...t,
  timeline: [
    ...t.timeline,
    { id: evId(), at: nowIso(), byId, by: personById(byId)?.name ?? byId, type, text },
  ],
});

/**
 * @typedef {Object} Result
 * @property {boolean} ok
 * @property {string} message
 * @property {string} [id]
 */

/** Grievance tickets are confidential — only the requester, the assignee and the HR desk head (CHRO) see them. */
export const CONFIDENTIAL_CATEGORIES = ["HR-GRIEV"];
export const isConfidential = (t) => CONFIDENTIAL_CATEGORIES.includes(t.categoryId);
const MAX_ATTACHMENT = 10 * 1024 * 1024;

/** In-app alert to everyone on the ticket except the actor (requester, raiser, assignee, watchers). */
function notify(t, actorId, title, body, only) {
  const ids = new Set();
  if (only !== "assignee") {
    ids.add(t.requesterId);
    if (t.onBehalfOfId) ids.add(t.onBehalfOfId);
    if (!only) t.watchers.forEach((w) => ids.add(w.id));
  }
  if (only !== "requester" && t.assigneeId) ids.add(t.assigneeId);
  ids.delete(actorId);
  ids.forEach((empId) =>
    pushAlert({ empId, kind: "general", to: `/helpdesk/tickets/${t.id}`, title, body }),
  );
}

export function nextTicketId(cfg = getHelpdeskConfig()) {
  const y = new Date().getFullYear();
  const max = ticketStore
    .get()
    .reduce((m, t) => Math.max(m, Number(t.id.split("-").pop()) || 0), 30);
  return `${cfg.ticketPrefix}-${y}-${String(max + 1).padStart(4, "0")}`;
}

export function createTicket(input) {
  const cfg = getHelpdeskConfig();
  const dept = cfg.departments.find((d) => d.id === input.departmentId);
  const cat = dept?.categories.find((c) => c.id === input.categoryId);
  if (!dept || !cat) return { ok: false, message: "Choose a service department and category." };
  if (input.subject.trim().length < 8)
    return { ok: false, message: "Subject must be at least 8 characters." };
  if (input.description.trim().length < 20)
    return {
      ok: false,
      message:
        "Describe the issue in at least 20 characters (what happened, when, what you expected).",
    };
  const requester = input.onBehalfOfId
    ? personById(input.onBehalfOfId)
    : personById(input.requester.id);
  if (!requester) return { ok: false, message: "Requester not found." };
  if ((input.attachments ?? []).some((a) => a.size > MAX_ATTACHMENT))
    return { ok: false, message: "Attachments are limited to 10 MB each." };
  // Confidential categories always go to their fixed owner — the requester cannot route a grievance to any HR agent.
  const assigneeId =
    input.assigneeId &&
    dept.agentIds.includes(input.assigneeId) &&
    !CONFIDENTIAL_CATEGORIES.includes(cat.id)
      ? input.assigneeId
      : (cat.defaultAgentId ?? dept.headId);
  const assignee = personById(assigneeId);
  const at = nowIso();
  const sla = slaFor(input.priority, cfg);
  const id = nextTicketId(cfg);
  const t = {
    id,
    orgId: input.requester.orgId,
    subject: input.subject.trim(),
    description: input.description.trim(),
    departmentId: dept.id,
    categoryId: cat.id,
    priority: input.priority,
    impact: input.impact,
    status: "Assigned",
    channel: input.channel ?? "Portal",
    requesterId: requester.id,
    requesterName: requester.name,
    requesterDept: requester.dept,
    onBehalfOfId:
      input.onBehalfOfId && input.onBehalfOfId !== input.requester.id
        ? input.requester.id
        : undefined,
    assigneeId,
    assigneeName: assignee?.name ?? null,
    watchers: (input.watcherIds ?? [])
      .filter((w) => w !== requester.id)
      .map((w) => ({ id: w, name: personById(w)?.name ?? w })),
    attachments: (input.attachments ?? []).map((a, i) => ({
      id: `ATT-${Date.now()}-${i}`,
      name: a.name,
      size: a.size,
      type: a.type,
      addedBy: input.requester.name,
      at,
    })),
    tags: input.tags ?? [],
    related: input.related,
    createdAt: at,
    updatedAt: at,
    firstResponseDue: addHours(at, sla.firstResponseHours),
    resolveDue: addHours(at, sla.resolveHours),
    reopenCount: 0,
    timeline: [],
  };
  let seeded = push(
    t,
    input.requester.id,
    "system",
    `Ticket created via ${t.channel} → ${dept.name} / ${cat.name}${input.onBehalfOfId ? ` on behalf of ${requester.name}` : ""}`,
  );
  seeded = push(
    seeded,
    input.requester.id,
    "assignment",
    input.assigneeId
      ? `Assigned to ${assignee?.name} (chosen by requester)`
      : `Auto-assigned to ${assignee?.name} (${cat.defaultAgentId ? "category default" : "department head"})`,
  );
  if (t.attachments.length)
    seeded = push(
      seeded,
      input.requester.id,
      "attachment",
      `Attached ${t.attachments.map((a) => a.name).join(", ")}`,
    );
  ticketStore.set((l) => [seeded, ...l]);
  notify(
    seeded,
    input.requester.id,
    `New ticket ${id} assigned to you`,
    `${seeded.subject} · ${dept.name} / ${cat.name} · ${seeded.priority} priority · from ${requester.name}.`,
    "assignee",
  );
  return {
    ok: true,
    id,
    message: `${id} raised with ${dept.name} — ${assignee?.name} will respond within ${sla.firstResponseHours} h.`,
  };
}

/** Desk admins, agents, HR and CHRO work their own company's tickets; only the Super Admin spans the group. */
const sameCompany = (u, t) =>
  u.role === "SuperAdmin" || !t.orgId || !u.orgId || t.orgId === u.orgId;
export const canWorkTicket = (u, t) =>
  t.assigneeId === u.id ||
  (sameCompany(u, t) &&
    (isConfidential(t)
      ? departmentById(t.departmentId)?.headId === u.id || u.role === "CHRO"
      : isHelpdeskAdmin(u) || isAgent(u, t.departmentId)));
export const canViewTicket = (u, t) =>
  canWorkTicket(u, t) ||
  t.requesterId === u.id ||
  t.onBehalfOfId === u.id ||
  t.watchers.some((w) => w.id === u.id) ||
  (sameCompany(u, t) && !isConfidential(t) && (u.role === "HR" || u.role === "CHRO"));

export function assignTicket(id, assigneeId, by, note = "") {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canWorkTicket(by, t))
    return { ok: false, message: "Only agents of this department can assign tickets." };
  const dept = departmentById(t.departmentId);
  if (!dept || !(dept.agentIds.includes(assigneeId) || dept.headId === assigneeId))
    return {
      ok: false,
      message:
        "The assignee must be an agent of the ticket's department. Transfer the ticket to change department.",
    };
  const p = personById(assigneeId);
  update(id, (x) =>
    push(
      {
        ...x,
        assigneeId,
        assigneeName: p?.name ?? null,
        status: x.status === "New" ? "Assigned" : x.status,
      },
      by.id,
      "assignment",
      `Reassigned to ${p?.name}${note ? ` — ${note}` : ""}`,
    ),
  );
  return { ok: true, message: `Assigned to ${p?.name}.` };
}

export function transferTicket(id, departmentId, categoryId, by, reason) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canWorkTicket(by, t)) return { ok: false, message: "Only agents can transfer a ticket." };
  if (!reason.trim()) return { ok: false, message: "Give a reason for the transfer." };
  const dept = departmentById(departmentId);
  const cat = dept?.categories.find((c) => c.id === categoryId);
  if (!dept || !cat) return { ok: false, message: "Choose the target department and category." };
  const assigneeId = cat.defaultAgentId ?? dept.headId;
  const p = personById(assigneeId);
  update(id, (x) =>
    push(
      {
        ...withSlaStatus(x, "Assigned"),
        departmentId,
        categoryId,
        assigneeId,
        assigneeName: p?.name ?? null,
      },
      by.id,
      "assignment",
      `Transferred to ${dept.name} / ${cat.name} → ${p?.name}: ${reason.trim()}`,
    ),
  );
  return { ok: true, message: `Transferred to ${dept.name}.` };
}

export function addReply(id, by, text, internal = false) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!text.trim()) return { ok: false, message: "Write a message first." };
  if (internal && !canWorkTicket(by, t))
    return { ok: false, message: "Internal notes are for agents only." };
  if (!internal && !canViewTicket(by, t))
    return { ok: false, message: "You are not part of this ticket." };
  update(id, (x) => {
    let n = push(x, by.id, internal ? "internal" : "reply", text.trim());
    const agentReply = !internal && canWorkTicket(by, x) && by.id !== x.requesterId;
    if (agentReply && !n.firstResponseAt) n = { ...n, firstResponseAt: nowIso() };
    if (agentReply && (n.status === "New" || n.status === "Assigned" || n.status === "Reopened"))
      n = push(withSlaStatus(n, "In Progress"), by.id, "status", "Status → In Progress");
    if (!agentReply && by.id === x.requesterId && n.status === "Waiting on Requester")
      n = push(
        withSlaStatus(n, "In Progress"),
        by.id,
        "status",
        "Requester replied — status → In Progress",
      );
    return n;
  });
  if (!internal) {
    const agentReply = canWorkTicket(by, t) && by.id !== t.requesterId;
    notify(
      t,
      by.id,
      agentReply ? `Reply on ${t.id} from the desk` : `${by.name} replied on ${t.id}`,
      `${t.subject} — ${text.trim().slice(0, 140)}`,
    );
  }
  return { ok: true, message: internal ? "Internal note added." : "Reply posted." };
}

export function setStatus(id, status, by, note = "") {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canWorkTicket(by, t)) return { ok: false, message: "Only agents can change the status." };
  if (!STATUSES.includes(status)) return { ok: false, message: "Choose a valid status." };
  if (t.status === "Closed")
    return { ok: false, message: "The ticket is closed — reopen it first." };
  if (status === "Resolved" && !note.trim())
    return { ok: false, message: "A resolution note is required to resolve." };
  if (status === "Closed") return closeTicket(id, by);
  update(id, (x) =>
    push(
      {
        ...withSlaStatus(x, status),
        resolvedAt: status === "Resolved" ? nowIso() : x.resolvedAt,
        resolution: status === "Resolved" ? note.trim() : x.resolution,
        firstResponseAt: x.firstResponseAt ?? (by.id !== x.requesterId ? nowIso() : undefined),
      },
      by.id,
      "status",
      `Status → ${status}${note ? `: ${note.trim()}` : ""}`,
    ),
  );
  if (status === "Resolved")
    notify(
      t,
      by.id,
      `Ticket ${t.id} resolved`,
      `${t.subject} — ${note.trim().slice(0, 140)}. Confirm & close, or reopen if the issue persists.`,
    );
  else if (status === "Waiting on Requester")
    notify(
      t,
      by.id,
      `Ticket ${t.id} needs your input`,
      `${t.subject} — the desk is waiting on you.${note ? ` ${note.trim()}` : ""}`,
      "requester",
    );
  return { ok: true, message: `Status set to ${status}.` };
}

export function closeTicket(id, by) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (t.status !== "Resolved")
    return { ok: false, message: "Only resolved tickets can be closed." };
  if (!(by.id === t.requesterId || by.id === t.onBehalfOfId || canWorkTicket(by, t)))
    return { ok: false, message: "Only the requester or the desk can close." };
  update(id, (x) =>
    push(
      { ...x, status: "Closed", closedAt: nowIso() },
      by.id,
      "status",
      `Status → Closed by ${by.id === x.requesterId ? "requester" : "desk"}`,
    ),
  );
  return { ok: true, message: "Ticket closed." };
}

/**
 * Auto-close: resolved tickets the requester neither closed nor reopened within `autoCloseDays` are closed by the
 * system (Desk Settings promised this, but nothing ever closed them). Returns how many were closed.
 */
export function autoCloseResolved(cfg = getHelpdeskConfig(), now = Date.now()) {
  const days = Number(cfg.autoCloseDays);
  if (!Number.isFinite(days) || days < 1) return 0;
  const cutoff = now - days * 86_400_000;
  const due = ticketStore
    .get()
    .filter((t) => t.status === "Resolved" && t.resolvedAt && +new Date(t.resolvedAt) <= cutoff);
  if (!due.length) return 0;
  const ids = new Set(due.map((t) => t.id));
  const at = new Date(now).toISOString();
  ticketStore.set((l) =>
    l.map((t) =>
      ids.has(t.id)
        ? {
            ...t,
            status: "Closed",
            closedAt: at,
            updatedAt: at,
            timeline: [
              ...t.timeline,
              {
                id: evId(),
                at,
                byId: "system",
                by: "System",
                type: "status",
                text: `Status → Closed automatically (${days} day(s) after resolution)`,
              },
            ],
          }
        : t,
    ),
  );
  return due.length;
}

export function reopenTicket(id, by, reason) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (t.status !== "Resolved" && t.status !== "Closed")
    return { ok: false, message: "Only resolved / closed tickets can be reopened." };
  if (!reason.trim()) return { ok: false, message: "Tell the desk why the issue persists." };
  if (!canViewTicket(by, t)) return { ok: false, message: "You are not part of this ticket." };
  // "Goes back to the assignee with a fresh clock" — restart the resolution target from the reopen time.
  const sla = slaFor(t.priority);
  update(id, (x) =>
    push(
      {
        ...x,
        status: "Reopened",
        reopenCount: x.reopenCount + 1,
        reopenedAt: nowIso(),
        pausedAt: undefined,
        pausedMs: 0,
        resolvedAt: undefined,
        closedAt: undefined,
        resolveDue: addHours(nowIso(), sla.resolveHours),
      },
      by.id,
      "status",
      `Reopened: ${reason.trim()}`,
    ),
  );
  notify(t, by.id, `Ticket ${t.id} reopened`, `${t.subject} — ${reason.trim().slice(0, 140)}`);
  return { ok: true, message: "Ticket reopened and sent back to the assignee." };
}

export function escalateTicket(id, by, reason) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canViewTicket(by, t)) return { ok: false, message: "You are not part of this ticket." };
  if (!reason.trim()) return { ok: false, message: "Give a reason for escalation." };
  const dept = departmentById(t.departmentId);
  // A department removed from Desk Settings has no head to escalate to (this used to throw on dept.headId).
  if (!dept)
    return { ok: false, message: "Department no longer exists — transfer the ticket first." };
  const head = personById(dept.headId);
  const next = t.priority === "Low" ? "Medium" : t.priority === "Medium" ? "High" : "Critical";
  const sla = slaFor(next);
  update(id, (x) =>
    push(
      {
        ...x,
        priority: next,
        // Same clock rules as a priority change: from the last reopen (not creation), paused time included.
        firstResponseDue: x.firstResponseAt
          ? x.firstResponseDue
          : addHours(x.createdAt, sla.firstResponseHours),
        resolveDue: resolveDueFor(x, sla.resolveHours),
        watchers: x.watchers.some((w) => w.id === dept.headId)
          ? x.watchers
          : [...x.watchers, { id: dept.headId, name: head?.name ?? dept.headId }],
      },
      by.id,
      "escalation",
      `Escalated to ${head?.name} (${dept.name} head) · priority → ${next}: ${reason.trim()}`,
    ),
  );
  return { ok: true, message: `Escalated to ${head?.name}; priority raised to ${next}.` };
}

export function setPriority(id, priority, by) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canWorkTicket(by, t)) return { ok: false, message: "Only agents can change priority." };
  const sla = slaFor(priority);
  update(id, (x) =>
    push(
      {
        ...x,
        priority,
        firstResponseDue: x.firstResponseAt
          ? x.firstResponseDue
          : addHours(x.createdAt, sla.firstResponseHours),
        resolveDue: resolveDueFor(x, sla.resolveHours),
      },
      by.id,
      "system",
      `Priority → ${priority} (SLA recalculated: respond ${sla.firstResponseHours} h · resolve ${sla.resolveHours} h)`,
    ),
  );
  return { ok: true, message: `Priority set to ${priority}.` };
}

export function addWatcher(id, personId, by) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canViewTicket(by, t)) return { ok: false, message: "You are not part of this ticket." };
  const p = personById(personId);
  if (!p) return { ok: false, message: "Person not found." };
  if (t.watchers.some((w) => w.id === personId) || personId === t.requesterId)
    return { ok: false, message: `${p.name} is already on this ticket.` };
  update(id, (x) =>
    push(
      { ...x, watchers: [...x.watchers, { id: p.id, name: p.name }] },
      by.id,
      "system",
      `${p.name} added as a watcher`,
    ),
  );
  return { ok: true, message: `${p.name} will receive updates.` };
}

export function removeWatcher(id, personId, by) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  // Agents manage the watcher list; anyone else may only take themselves off it.
  if (!(canWorkTicket(by, t) || personId === by.id))
    return { ok: false, message: "Only the desk can remove other watchers." };
  update(id, (x) =>
    push(
      { ...x, watchers: x.watchers.filter((w) => w.id !== personId) },
      by.id,
      "system",
      `${personById(personId)?.name ?? personId} removed from watchers`,
    ),
  );
  return { ok: true, message: "Watcher removed." };
}

export function addAttachments(id, files, by) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (!canViewTicket(by, t)) return { ok: false, message: "You are not part of this ticket." };
  if (!files.length) return { ok: false, message: "Pick a file." };
  if (files.some((f) => f.size > MAX_ATTACHMENT))
    return { ok: false, message: "Attachments are limited to 10 MB each." };
  const at = nowIso();
  update(id, (x) =>
    push(
      {
        ...x,
        attachments: [
          ...x.attachments,
          ...files.map((f, i) => ({
            id: `ATT-${Date.now()}-${i}`,
            name: f.name,
            size: f.size,
            type: f.type,
            addedBy: by.name,
            at,
          })),
        ],
      },
      by.id,
      "attachment",
      `Attached ${files.map((f) => f.name).join(", ")}`,
    ),
  );
  return { ok: true, message: `${files.length} file(s) attached.` };
}

export function rateTicket(id, by, rating, comment) {
  const t = ticketById(id);
  if (!t) return { ok: false, message: "Ticket not found." };
  if (by.id !== t.requesterId)
    return { ok: false, message: "Only the requester can rate the resolution." };
  if (t.status !== "Resolved" && t.status !== "Closed")
    return { ok: false, message: "Rate after the ticket is resolved." };
  update(id, (x) =>
    push(
      { ...x, satisfaction: { rating, comment: comment.trim(), at: nowIso() } },
      by.id,
      "system",
      `Requester rated ${rating}/5${comment ? ` — ${comment.trim()}` : ""}`,
    ),
  );
  return { ok: true, message: "Thanks for the feedback." };
}

/* ----------------------------------- SLA ----------------------------------- */

/**
 * @typedef {"On track" | "At risk" | "Breached" | "Met" | "Paused"} SlaState
 */

export function slaState(t, now = Date.now()) {
  const response = t.firstResponseAt
    ? t.firstResponseAt <= t.firstResponseDue
      ? "Met"
      : "Breached"
    : now > +new Date(t.firstResponseDue)
      ? "Breached"
      : now > +new Date(t.firstResponseDue) - 3600_000
        ? "At risk"
        : "On track";
  const done = t.status === "Resolved" || t.status === "Closed";
  const resolve = done
    ? (t.resolvedAt ?? t.closedAt ?? "") <= t.resolveDue
      ? "Met"
      : "Breached"
    : t.status === "Waiting on Requester"
      ? "Paused"
      : now > +new Date(t.resolveDue)
        ? "Breached"
        : now > +new Date(t.resolveDue) - 4 * 3600_000
          ? "At risk"
          : "On track";
  return { response, resolve, hoursLeft: Math.round((+new Date(t.resolveDue) - now) / 3600_000) };
}

export const statusTone = (s) =>
  s === "Resolved" || s === "Closed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "In Progress" || s === "Assigned"
      ? "border-gold/40 bg-gold/15 text-gold"
      : s === "Waiting on Requester"
        ? "border-border bg-muted text-muted-foreground"
        : s === "Reopened"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300";
export const priorityTone = (p) =>
  p === "Critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : p === "High"
      ? "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300"
      : p === "Medium"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";
export const slaTone = (s) =>
  s === "Breached"
    ? "text-destructive"
    : s === "At risk"
      ? "text-orange-600 dark:text-orange-400"
      : s === "Met"
        ? "text-primary"
        : "text-muted-foreground";

// Fixed to IST so the server (UTC) and the browser print the same clock time — a timezone-dependent format
// produced a hydration mismatch on every timestamp.
export const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
export const fmtSize = (n) =>
  n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

/** Departments visible to a requester when raising a ticket (grievance category only shows for the requester themselves). */
export const requesterDepartments = () => getHelpdeskConfig().departments;

// Keep `SEEREON_USERS` referenced for tooling that tree-shakes seed people.
void SEEREON_USERS;
