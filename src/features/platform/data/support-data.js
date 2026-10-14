// Org-level support tickets raised by employees
import { createPersistentStore } from "@/lib/persist";

export const TICKET_STATUSES = ["Unattended", "Attended", "Resolved"];
/**
 * @typedef {(typeof TICKET_STATUSES)[number]} TicketStatus
 */

export const ISSUE_TYPES = [
  "IT / Hardware",
  "Software Access",
  "SAP Logon",
  "Email",
  "HR Query",
  "Payroll",
  "Facilities",
  "Other",
];
export const TICKET_SEVERITIES = ["Low", "Medium", "High", "Critical"];

/**
 * @typedef {Object} OrgTicket
 * @property {string} id
 * @property {string} employee
 * @property {string} department
 * @property {string} designation
 * @property {string} issueType
 * @property {string} description
 * @property {string} associate
 * @property {string} severity
 * @property {string} date
 * @property {string} expected
 * @property {TicketStatus} status
 * @property {string} orgId
 * @property {"Portal" | "Email"} [source] - Where the ticket came from — "Email" tickets carry the original thread placeholder (integration pending).
 * @property {{ from: string, subject: string, receivedAt: string, snippet: string }} [emailThread]
 */

export const ORG_TICKETS = [
  {
    id: "TKT-1041",
    employee: "Ananya Sharma",
    department: "Engineering",
    designation: "Senior Engineer",
    issueType: "IT / Hardware",
    description: "Laptop battery drains within an hour.",
    associate: "Nitin Rao (IT)",
    severity: "High",
    date: "2026-07-21",
    expected: "2026-07-24",
    status: "Attended",
    orgId: "ORG-SEEREON",
  },
  {
    id: "TKT-1040",
    employee: "Vikram Iyer",
    department: "Sales",
    designation: "Account Executive",
    issueType: "Software Access",
    description: "No access to the CRM reporting dashboard.",
    associate: "Meera S. (IT Ops)",
    severity: "Medium",
    date: "2026-07-20",
    expected: "2026-07-22",
    status: "Unattended",
    orgId: "ORG-SEEREON",
  },
  {
    id: "TKT-1039",
    employee: "Rohit Deshmukh",
    department: "Finance",
    designation: "Financial Analyst",
    issueType: "Payroll",
    description: "June overtime not reflected in the payslip.",
    associate: "Payroll Desk",
    severity: "High",
    date: "2026-07-18",
    expected: "2026-07-21",
    status: "Resolved",
    orgId: "ORG-SEEREON",
  },
  {
    id: "TKT-1038",
    employee: "Kavya Menon",
    department: "Operations",
    designation: "Ops Manager",
    issueType: "Facilities",
    description: "Cafeteria seating shortage during second shift.",
    associate: "Admin Team",
    severity: "Low",
    date: "2026-07-16",
    expected: "2026-07-25",
    status: "Unattended",
    orgId: "ORG-SEEREON",
  },
  {
    id: "TKT-1042",
    employee: "Manjeet Bhati",
    department: "SAP Delivery",
    designation: "SAP ABAP Consultant",
    issueType: "SAP Logon",
    description: "SAP GUI login fails with error S002 after password reset.",
    associate: "IT Ops",
    severity: "Critical",
    date: "2026-08-10",
    expected: "2026-08-10",
    status: "Unattended",
    orgId: "ORG-1042",
  },
  {
    id: "TKT-1044",
    employee: "Ritesh Barman",
    department: "Cloud & DevOps",
    designation: "Head of Department — Cloud & DevOps",
    issueType: "SAP Logon",
    description: "SAP GUI password reset request received via support inbox.",
    associate: "IT Helpdesk",
    severity: "Medium",
    date: "2026-08-10",
    expected: "2026-08-12",
    status: "Unattended",
    orgId: "ORG-1043",
    source: "Email",
    emailThread: {
      from: "ritesh.barman@cloud.seereon.co.in",
      subject: "SAP GUI locked — password reset",
      receivedAt: "2026-08-10 08:42",
      snippet:
        "Hi team, my SAP GUI account got locked after three attempts this morning. Could you reset it before the shift handover?",
    },
  },
  {
    id: "TKT-1043",
    employee: "Soumen Ghosh",
    department: "Cloud & DevOps",
    designation: "Cloud Support Lead (Night)",
    issueType: "Email",
    description: "Not receiving shift-roster emails since last week.",
    associate: "IT Helpdesk",
    severity: "Medium",
    date: "2026-08-08",
    expected: "2026-08-11",
    status: "Attended",
    orgId: "ORG-1043",
  },
];

export const POLICY_DOCS = [
  {
    id: "PLC-001",
    name: "Employee Handbook 2026",
    category: "HR Policy",
    description: "Complete handbook covering conduct, benefits and leave.",
    file: "employee-handbook-2026.pdf",
    updated: "2026-04-01",
  },
  {
    id: "PLC-002",
    name: "POSH Policy",
    category: "Compliance",
    description: "Prevention of sexual harassment policy and committee details.",
    file: "posh-policy.pdf",
    updated: "2026-01-15",
  },
  {
    id: "PLC-003",
    name: "Travel & Reimbursement",
    category: "Finance",
    description: "Travel classes, per-diem limits and claim process.",
    file: "travel-policy.pdf",
    updated: "2026-05-20",
  },
];

export const POLICY_CATEGORIES = [
  "HR Policy",
  "Compliance",
  "Finance",
  "IT & Security",
  "Health & Safety",
];

/* ------------------------------------------------------------------ */
/* Seereon platform support queue (client organisation → Seereon)      */
/* ------------------------------------------------------------------ */

export const PLATFORM_TICKET_STATUSES = ["Open", "In Progress", "Waiting", "Resolved"];
/**
 * @typedef {(typeof PLATFORM_TICKET_STATUSES)[number]} PlatformTicketStatus
 */
export const PLATFORM_TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"];
/**
 * @typedef {(typeof PLATFORM_TICKET_PRIORITIES)[number]} PlatformTicketPriority
 */
/**
 * @typedef {Object} PlatformTicket
 * @property {string} id
 * @property {string} org
 * @property {string} subj
 * @property {string} requester
 * @property {PlatformTicketPriority} priority
 * @property {PlatformTicketStatus} status
 * @property {string} assignee
 * @property {string} updated
 * @property {string} [description]
 * @property {{ at: string, by: string, action: string }[]} [history]
 */
const PLATFORM_TICKETS_SEED = [
  {
    id: "TCK-8842",
    org: "ORG-1042",
    subj: "Payroll not generating for June",
    requester: "Priya Menon",
    priority: "High",
    status: "Open",
    assignee: "Rohan K.",
    updated: "2026-09-21",
  },
  {
    id: "TCK-8841",
    org: "ORG-1044",
    subj: "SSO with Azure AD failing",
    requester: "Dr. Sana Ali",
    priority: "Critical",
    status: "In Progress",
    assignee: "Meera S.",
    updated: "2026-09-21",
  },
  {
    id: "TCK-8840",
    org: "ORG-1043",
    subj: "Bulk import CSV template",
    requester: "Rahul Iyer",
    priority: "Low",
    status: "Waiting",
    assignee: "Nitin R.",
    updated: "2026-09-21",
  },
  {
    id: "TCK-8839",
    org: "ORG-2001",
    subj: "WhatsApp OTP delay",
    requester: "Elena Rossi",
    priority: "Medium",
    status: "Open",
    assignee: "Rohan K.",
    updated: "2026-09-20",
  },
  {
    id: "TCK-8838",
    org: "ORG-2001",
    subj: "Enterprise upgrade billing question",
    requester: "A. Okafor",
    priority: "Medium",
    status: "Resolved",
    assignee: "Meera S.",
    updated: "2026-09-20",
  },
  {
    id: "TCK-8837",
    org: "ORG-3001",
    subj: "Geo-fence radius not saving",
    requester: "Miguel Santos",
    priority: "High",
    status: "In Progress",
    assignee: "Nitin R.",
    updated: "2026-09-19",
  },
];
export const platformTicketStore = createPersistentStore(
  "seereon.platform.tickets.v1",
  PLATFORM_TICKETS_SEED,
);
export const usePlatformTickets = () => platformTicketStore.use();
const todayIso = () => new Date().toISOString().slice(0, 10);
export function raisePlatformTicket(input, by) {
  const n =
    platformTicketStore
      .get()
      .reduce((m, t) => Math.max(m, Number(t.id.replace(/^TCK-/, "")) || 0), 8800) + 1;
  const row = {
    id: `TCK-${n}`,
    org: input.org,
    subj: input.subj.trim(),
    requester: input.requester.trim(),
    priority: input.priority,
    status: "Open",
    assignee: input.assignee?.trim() || "Unassigned",
    updated: todayIso(),
    description: input.description?.trim() || undefined,
    history: [{ at: todayIso(), by, action: "Ticket raised" }],
  };
  platformTicketStore.set((l) => [row, ...l]);
  return row;
}
export function updatePlatformTicket(id, patch, by) {
  platformTicketStore.set((l) =>
    l.map((t) =>
      t.id === id
        ? {
            ...t,
            ...patch,
            updated: todayIso(),
            history: [
              {
                at: todayIso(),
                by,
                action: Object.entries(patch)
                  .map(([k, v]) => `${k} → ${v}`)
                  .join(", "),
              },
              ...(t.history ?? []),
            ],
          }
        : t,
    ),
  );
}
