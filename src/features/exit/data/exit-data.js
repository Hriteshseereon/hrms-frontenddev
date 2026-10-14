// ---------------------------------------------------------------------------
// Exit Management — UI-only workflow, persisted in localStorage so every portal
// sees the same state across reloads.
//
//   Resignation submitted → Manager Review → HR Review (acceptance + notice period)
//   → Notice Period  ──(Retain → "Retained", employment continues unchanged)
//                    ──(Move for clearance checklist)→ HR Clearance (officer-wise checklist)
//   → Final Settlement (Mark F&F settled · Mark exit interview) → Complete exit → Exit Completed
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from "react";
import { SEEREON_USERS, allUsers, userById } from "@/features/auth/data/auth-session";

/** The company's administrator (Company Admin, else Super Admin) — fallback approver when no manager is on record. */
const companyAdminOf = (orgId) =>
  allUsers().find((u) => u.orgId === orgId && u.role === "Admin") ??
  allUsers().find((u) => u.orgId === orgId && u.role === "SuperAdmin") ??
  SEEREON_USERS[0];
import { findEmployee, updateEmployeeRecord } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { suspendUser } from "@/features/auth/data/rbac-store";

/** Roles that may take the manager step on behalf of the recorded reporting manager. */
const MANAGER_OVERRIDE_ROLES = ["SuperAdmin", "Admin", "CHRO"];
/** Nobody processes their own exit file (clearance, settlement, completion). */
const isOwnExit = (r, by) => !!r && !!by && r.empId === by.id;

/**
 * @typedef {| "Manager Review" | "Manager Rejected" | "HR Review" | "HR Rejected" | "Notice Period" | "HR Clearance" | "Final Settlement" | "Exit Completed" | "Retained" | "Withdrawn"} ExitStage
 */

/** Stages where the resignation is still live (employee is leaving unless retained). */
export const ACTIVE_STAGES = [
  "Manager Review",
  "HR Review",
  "Notice Period",
  "HR Clearance",
  "Final Settlement",
];
export const CLOSED_STAGES = [
  "Exit Completed",
  "Manager Rejected",
  "HR Rejected",
  "Withdrawn",
  "Retained",
];

/**
 * @typedef {"finance" | "payroll" | "documents" | "projects" | "assets" | "it" | "admin"} ClearanceArea
 */

export const CLEARANCE_AREAS = [
  {
    key: "finance",
    label: "Finance clearance",
    owner: "Finance / CFO",
    defaultOfficer: "Saras Venkatesh",
    hint: "Salary advances, loans, reimbursements, petty cash, client-billable dues.",
    checklist: [
      "Loans & advances recovered or scheduled in F&F",
      "Pending reimbursements settled",
      "Petty cash / corporate card returned",
      "Client billing hand-off complete",
    ],
  },
  {
    key: "payroll",
    label: "Payroll & statutory",
    owner: "Payroll",
    defaultOfficer: "Farah Khan",
    hint: "Final payroll inputs, PF / ESI exit, Form 16, gratuity eligibility.",
    checklist: [
      "Attendance regularised till LWD",
      "Leave balance frozen for encashment",
      "PF / ESI exit date marked",
      "Form 16 & gratuity computed",
    ],
  },
  {
    key: "documents",
    label: "Document clearance",
    owner: "HR Operations",
    defaultOfficer: "Ritu Bansal",
    hint: "ID card, NDA, signed policies, education & KYC records, exit forms.",
    checklist: [
      "ID card & visiting cards returned",
      "NDA / IP assignment acknowledged",
      "Personal file complete (KYC, education)",
      "Exit forms signed",
    ],
  },
  {
    key: "projects",
    label: "Project & knowledge handover",
    owner: "Reporting Manager",
    defaultOfficer: "",
    hint: "Active project handover, client transitions, documentation, repo ownership.",
    checklist: [
      "Handover document approved",
      "Client / stakeholder communication done",
      "Repo & pipeline ownership transferred",
      "Open tickets reassigned",
    ],
  },
  {
    key: "assets",
    label: "Asset recovery",
    owner: "IT / Asset Custodian",
    defaultOfficer: "Aravind Krishnan",
    hint: "Laptop, peripherals, mobile, SIM, licensed software.",
    checklist: [
      "Laptop & charger returned (condition noted)",
      "Peripherals / mobile / SIM returned",
      "Software licences released",
      "Damage / non-return charges assessed",
    ],
  },
  {
    key: "it",
    label: "IT access & security",
    owner: "IT Security",
    defaultOfficer: "Aravind Krishnan",
    hint: "E-mail, VPN, client VDI, cloud consoles, MFA tokens, data-leak check.",
    checklist: [
      "E-mail forwarding & auto-reply set",
      "VPN / VDI / cloud console access revoked on LWD",
      "MFA tokens & hardware keys returned",
      "DLP review — no data exfiltration",
    ],
  },
  {
    key: "admin",
    label: "Admin & facilities",
    owner: "Admin",
    defaultOfficer: "Kiran Shetty",
    hint: "Access card, locker, parking, library, guest-house, insurance card.",
    checklist: [
      "Access card & locker keys returned",
      "Parking / transport pass cancelled",
      "Group insurance card returned",
      "Desk & drawer cleared",
    ],
  },
];

/**
 * @typedef {"Pending" | "Cleared" | "Blocked"} ClearanceStatus
 */

/**
 * @typedef {Object} ClearanceItem
 * @property {ClearanceStatus} status
 * @property {string} note
 * @property {string | null} by
 * @property {string | null} on
 * @property {string} officer - Officer assigned to give this clearance.
 * @property {string[]} ticked - Checklist items ticked by the officer.
 * @property {number} [amount] - Outstanding money (finance only).
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string} stage
 * @property {string} by
 * @property {string} role
 * @property {string} on
 * @property {string} note
 */

/**
 * @typedef {Object} ExitInterviewRecord
 * @property {"Employee portal" | "HR interview" | "Uploaded form"} mode
 * @property {string} on
 * @property {string} by
 * @property {string} [file]
 * @property {string} note
 */

/**
 * @typedef {Object} ExitRequest
 * @property {string} id
 * @property {string} empId
 * @property {string} empName
 * @property {string} email
 * @property {string} designation
 * @property {string} dept
 * @property {string} branch
 * @property {string} managerId
 * @property {string} managerName
 * @property {string} appliedOn
 * @property {string} reason
 * @property {string} description
 * @property {string} requestedLwd - Date the employee requested as their last working day.
 * @property {string} document
 * @property {ExitStage} stage
 * @property {{ action: "Approved" | "Rejected", by: string, on: string, note: string } | null} managerDecision
 * @property {{ action: "Approved" | "Rejected", by: string, on: string, note: string } | null} hrDecision
 * @property {Record<ClearanceArea, ClearanceItem>} clearances
 * @property {string | null} clearanceStartedOn
 * @property {string | null} clearanceCompletedOn
 * @property {number | null} noticeDays
 * @property {string | null} noticeStart
 * @property {string | null} noticeEnd
 * @property {boolean} exitInterviewDone
 * @property {ExitInterviewRecord | null} exitInterview
 * @property {boolean} fnfSettled
 * @property {string | null} fnfRef
 * @property {string | null} retainedOn
 * @property {string | null} completedOn
 * @property {TimelineEntry[]} timeline
 */

/* ------------------------------ date helpers ------------------------------ */

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Whole computation in UTC: parsing at *local* midnight and formatting with `toISOString()` (UTC) shifted every
// result one day back for any timezone east of UTC (IST), so notice-end / LWD dates were off by one.
export const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (fromISO, toISO) =>
  Math.round(
    (new Date(toISO + "T00:00:00").getTime() - new Date(fromISO + "T00:00:00").getTime()) /
      86400000,
  );

export const fmtDate = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/** Remaining notice days (never negative) and completion %. */
export function noticeProgress(r) {
  if (!r.noticeStart || !r.noticeEnd || !r.noticeDays) return { served: 0, remaining: 0, pct: 0 };
  const served = Math.max(0, Math.min(r.noticeDays, daysBetween(r.noticeStart, todayISO())));
  const remaining = Math.max(0, r.noticeDays - served);
  return { served, remaining, pct: Math.round((served / r.noticeDays) * 100) };
}

export const RESIGNATION_REASONS = [
  "Better career opportunity",
  "Higher studies",
  "Relocation",
  "Compensation",
  "Work-life balance",
  "Health reasons",
  "Personal reasons",
  "Career change",
];

export const NOTICE_PRESETS = [15, 30, 45, 60, 90];

const emptyItem = (area, managerName = "") => ({
  status: "Pending",
  note: "",
  by: null,
  on: null,
  officer:
    area === "projects" ? managerName : CLEARANCE_AREAS.find((a) => a.key === area).defaultOfficer,
  ticked: [],
  ...(area === "finance" ? { amount: 0 } : {}),
});
const emptyClearances = (managerName = "") => ({
  finance: emptyItem("finance"),
  payroll: emptyItem("payroll"),
  documents: emptyItem("documents"),
  projects: emptyItem("projects", managerName),
  assets: emptyItem("assets"),
  it: emptyItem("it"),
  admin: emptyItem("admin"),
});
const cleared = (area, by, on, note, managerName = "") => ({
  ...emptyItem(area, managerName),
  status: "Cleared",
  by,
  on,
  note,
  ticked: CLEARANCE_AREAS.find((a) => a.key === area).checklist,
});

/* ------------------------------ seed data ------------------------------ */

/** Fixed anchor for the seed so the server and the client render the same records (a `todayISO()` seed changed with the clock). */
const SEED_TODAY = "2026-09-21";

function seed() {
  const t = SEED_TODAY;
  const base = {
    managerDecision: null,
    hrDecision: null,
    clearanceStartedOn: null,
    clearanceCompletedOn: null,
    noticeDays: null,
    noticeStart: null,
    noticeEnd: null,
    exitInterviewDone: false,
    exitInterview: null,
    fnfSettled: false,
    fnfRef: null,
    retainedOn: null,
    completedOn: null,
  };
  return [
    {
      // Completed exit two days ago — rejoin within 3 days keeps continuity.
      ...base,
      id: "EXT-0998",
      empId: "SRN-0146",
      empName: "Kavya Menon",
      email: "kavya.m@seereon.co.in",
      designation: "Ops Manager",
      dept: "Operations",
      branch: "Chennai",
      managerId: "SRN-0003",
      managerName: "Ashish Nayak",
      appliedOn: addDays(t, -62),
      reason: "Personal reasons",
      description: "Relocating with family; may return if circumstances change.",
      requestedLwd: addDays(t, -2),
      document: "resignation-letter-kavya.pdf",
      stage: "Exit Completed",
      managerDecision: {
        action: "Approved",
        by: "Ashish Nayak",
        on: addDays(t, -60),
        note: "Approved with handover plan.",
      },
      hrDecision: {
        action: "Approved",
        by: "Varen Mishra",
        on: addDays(t, -58),
        note: "60 day notice applied.",
      },
      clearances: {
        finance: cleared("finance", "Saras Venkatesh", addDays(t, -4), "No dues."),
        payroll: cleared(
          "payroll",
          "Farah Khan",
          addDays(t, -4),
          "PF exit marked; gratuity not eligible.",
        ),
        documents: cleared(
          "documents",
          "Ritu Bansal",
          addDays(t, -4),
          "All statutory documents on file.",
        ),
        projects: cleared(
          "projects",
          "Ashish Nayak",
          addDays(t, -5),
          "Ops roster and vendor handover complete.",
          "Ashish Nayak",
        ),
        assets: cleared(
          "assets",
          "Aravind Krishnan",
          addDays(t, -2),
          "Laptop and access card returned.",
        ),
        it: cleared("it", "Aravind Krishnan", addDays(t, -2), "Access revoked at 18:30 on LWD."),
        admin: cleared("admin", "Kiran Shetty", addDays(t, -2), "Locker & parking cleared."),
      },
      clearanceStartedOn: addDays(t, -10),
      clearanceCompletedOn: addDays(t, -2),
      noticeDays: 60,
      noticeStart: addDays(t, -62),
      noticeEnd: addDays(t, -2),
      exitInterviewDone: true,
      exitInterview: {
        mode: "Employee portal",
        on: addDays(t, -6),
        by: "Kavya Menon",
        note: "Submitted from the employee portal.",
      },
      fnfSettled: true,
      fnfRef: "HDFC-UTR-2609-4471",
      completedOn: addDays(t, -2),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Kavya Menon",
          role: "Employee",
          on: addDays(t, -62),
          note: "Resignation submitted.",
        },
        {
          stage: "Manager Approved",
          by: "Ashish Nayak",
          role: "COO",
          on: addDays(t, -60),
          note: "Approved.",
        },
        {
          stage: "HR Accepted · Notice Period Started",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -58),
          note: "Notice period 60 days.",
        },
        {
          stage: "Moved to Clearance Checklist",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -10),
          note: "All seven clearance officers notified.",
        },
        {
          stage: "Clearance Completed · Final Settlement",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -2),
          note: "",
        },
        {
          stage: "Exit Interview Completed",
          by: "Kavya Menon",
          role: "Employee",
          on: addDays(t, -6),
          note: "Survey submitted from the portal.",
        },
        {
          stage: "F&F Settled",
          by: "Saras Venkatesh",
          role: "CFO",
          on: addDays(t, -2),
          note: "HDFC-UTR-2609-4471",
        },
        {
          stage: "Exit Completed",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -2),
          note: "Relieved on last working day. Relieving letter issued.",
        },
      ],
    },
    {
      ...base,
      id: "EXT-1001",
      empId: "SRN-0007",
      empName: "Neha Kulkarni",
      email: "neha@seereon.co.in",
      designation: "QA Engineer",
      dept: "Engineering",
      branch: "Bhubaneswar HQ",
      managerId: "SRN-0005",
      managerName: "Subh Sahoo",
      appliedOn: addDays(t, -3),
      reason: "Better career opportunity",
      description:
        "I have accepted an offer with a product company closer to my hometown. Happy to ensure a clean handover of the automation suite.",
      requestedLwd: addDays(t, 30),
      document: "resignation-letter-neha.pdf",
      stage: "Manager Review",
      clearances: emptyClearances("Subh Sahoo"),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Neha Kulkarni",
          role: "Employee",
          on: addDays(t, -3),
          note: "Resignation submitted for manager review.",
        },
      ],
    },
    {
      ...base,
      id: "EXT-1002",
      empId: "SRN-0008",
      empName: "Rakesh Menon",
      email: "rakesh@seereon.co.in",
      designation: "Data Engineer",
      dept: "Engineering",
      branch: "Bhubaneswar HQ",
      managerId: "SRN-0005",
      managerName: "Subh Sahoo",
      appliedOn: addDays(t, -12),
      reason: "Compensation",
      description:
        "Received a 30 % higher offer from a product company; open to staying for the right data-platform role.",
      requestedLwd: addDays(t, 48),
      document: "resignation-letter-rakesh.pdf",
      stage: "Retained",
      managerDecision: {
        action: "Approved",
        by: "Subh Sahoo",
        on: addDays(t, -10),
        note: "Approved; recommended retention discussion.",
      },
      hrDecision: {
        action: "Approved",
        by: "Varen Mishra",
        on: addDays(t, -9),
        note: "60 day notice applied pending retention discussion.",
      },
      clearances: emptyClearances("Subh Sahoo"),
      noticeDays: 60,
      noticeStart: addDays(t, -9),
      noticeEnd: addDays(t, 51),
      retainedOn: addDays(t, -5),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Rakesh Menon",
          role: "Employee",
          on: addDays(t, -12),
          note: "Resignation submitted.",
        },
        {
          stage: "Manager Approved",
          by: "Subh Sahoo",
          role: "Manager",
          on: addDays(t, -10),
          note: "Approved; recommended retention discussion.",
        },
        {
          stage: "HR Accepted · Notice Period Started",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -9),
          note: "60 day notice period applied.",
        },
        {
          stage: "Retention Started",
          by: "Ritu Bansal",
          role: "HR",
          on: addDays(t, -8),
          note: "Employee status → Retention in progress.",
        },
        {
          stage: "Retained · Resignation Withdrawn",
          by: "Ritu Bansal",
          role: "HR",
          on: addDays(t, -5),
          note: "RET-2026-001 — 12 % correction + Semtech data-platform pod. Employment continues on the original records.",
        },
      ],
    },
    {
      ...base,
      id: "EXT-1003",
      empId: "SRN-0006",
      empName: "Subham Das",
      email: "subham@seereon.co.in",
      designation: "Senior Software Engineer",
      dept: "Engineering",
      branch: "Bhubaneswar HQ",
      managerId: "SRN-0005",
      managerName: "Subh Sahoo",
      appliedOn: addDays(t, -24),
      reason: "Relocation",
      description:
        "Relocating to Pune for family reasons. Will complete the platform migration before my last day.",
      requestedLwd: addDays(t, 36),
      document: "resignation-letter-subham.pdf",
      stage: "HR Clearance",
      managerDecision: {
        action: "Approved",
        by: "Subh Sahoo",
        on: addDays(t, -22),
        note: "Approved with a clean handover plan.",
      },
      hrDecision: {
        action: "Approved",
        by: "Varen Mishra",
        on: addDays(t, -18),
        note: "60 day notice period applied as per grade G4.",
      },
      clearances: {
        finance: {
          ...emptyItem("finance"),
          status: "Blocked",
          note: "Loan LN-2026-011 balance ₹2,75,000 outstanding — to be recovered in F&F.",
          by: "Saras Venkatesh",
          on: addDays(t, -2),
          amount: 275000,
          ticked: ["Pending reimbursements settled", "Petty cash / corporate card returned"],
        },
        payroll: emptyItem("payroll"),
        documents: cleared(
          "documents",
          "Ritu Bansal",
          addDays(t, -3),
          "NDA, KYC and education records verified.",
        ),
        projects: cleared(
          "projects",
          "Subh Sahoo",
          addDays(t, -4),
          "Platform migration handover to Neha tracked as EXIT-TASK-14.",
          "Subh Sahoo",
        ),
        assets: { ...emptyItem("assets"), ticked: ["Software licences released"] },
        it: emptyItem("it"),
        admin: cleared(
          "admin",
          "Kiran Shetty",
          addDays(t, -3),
          "Locker and parking pass surrendered.",
        ),
      },
      clearanceStartedOn: addDays(t, -5),
      noticeDays: 60,
      noticeStart: addDays(t, -18),
      noticeEnd: addDays(t, 42),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Subham Das",
          role: "Employee",
          on: addDays(t, -24),
          note: "Resignation submitted.",
        },
        {
          stage: "Manager Approved",
          by: "Subh Sahoo",
          role: "Manager",
          on: addDays(t, -22),
          note: "Approved with a clean handover plan.",
        },
        {
          stage: "HR Accepted · Notice Period Started",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -18),
          note: "60 day notice period applied. Last working day " + fmtDate(addDays(t, 42)) + ".",
        },
        {
          stage: "Moved to Clearance Checklist",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -5),
          note: "Clearance officers assigned and notified.",
        },
        {
          stage: "Project & knowledge handover Cleared",
          by: "Subh Sahoo",
          role: "Manager",
          on: addDays(t, -4),
          note: "Platform migration handover to Neha tracked as EXIT-TASK-14.",
        },
        {
          stage: "Document clearance Cleared",
          by: "Ritu Bansal",
          role: "HR",
          on: addDays(t, -3),
          note: "NDA, KYC and education records verified.",
        },
        {
          stage: "Admin & facilities Cleared",
          by: "Kiran Shetty",
          role: "HOD",
          on: addDays(t, -3),
          note: "Locker and parking pass surrendered.",
        },
        {
          stage: "Finance clearance Blocked",
          by: "Saras Venkatesh",
          role: "CFO",
          on: addDays(t, -2),
          note: "Loan LN-2026-011 balance ₹2,75,000 outstanding — to be recovered in F&F.",
        },
      ],
    },
    {
      ...base,
      id: "EXT-1004",
      empId: "SRN-0016",
      empName: "Tanvi Joshi",
      email: "tanvi@seereon.co.in",
      designation: "Frontend Engineer",
      dept: "Engineering",
      branch: "Bhubaneswar HQ",
      managerId: "SRN-0005",
      managerName: "Subh Sahoo",
      appliedOn: addDays(t, -6),
      reason: "Higher studies",
      description: "Admitted to an MS programme starting in January; requesting a 45-day notice.",
      requestedLwd: addDays(t, 45),
      document: "resignation-letter-tanvi.pdf",
      stage: "HR Review",
      managerDecision: {
        action: "Approved",
        by: "Subh Sahoo",
        on: addDays(t, -4),
        note: "Approved. Frontend ownership moves to Subham.",
      },
      clearances: emptyClearances("Subh Sahoo"),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Tanvi Joshi",
          role: "Employee",
          on: addDays(t, -6),
          note: "Resignation submitted for manager review.",
        },
        {
          stage: "Manager Approved",
          by: "Subh Sahoo",
          role: "Manager",
          on: addDays(t, -4),
          note: "Approved. Frontend ownership moves to Subham.",
        },
      ],
    },
    {
      ...base,
      id: "EXT-1005",
      empId: "SRN-0013",
      empName: "Aditya Verma",
      email: "aditya@seereon.co.in",
      designation: "HR Business Partner — Operations & Sales",
      dept: "Human Resources",
      branch: "Bhubaneswar HQ",
      managerId: "SRN-0010",
      managerName: "Farah Khan",
      appliedOn: addDays(t, -70),
      reason: "Better career opportunity",
      description: "Moving to a regional HR lead role.",
      requestedLwd: addDays(t, -1),
      document: "resignation-letter-aditya.pdf",
      stage: "Final Settlement",
      managerDecision: {
        action: "Approved",
        by: "Farah Khan",
        on: addDays(t, -68),
        note: "Approved.",
      },
      hrDecision: {
        action: "Approved",
        by: "Varen Mishra",
        on: addDays(t, -66),
        note: "60 day notice applied.",
      },
      clearances: {
        finance: cleared("finance", "Saras Venkatesh", addDays(t, -3), "No dues."),
        payroll: cleared(
          "payroll",
          "Farah Khan",
          addDays(t, -3),
          "Attendance regularised; leave frozen: EL 9 days.",
        ),
        documents: cleared("documents", "Ritu Bansal", addDays(t, -4), "Personal file complete."),
        projects: cleared(
          "projects",
          "Farah Khan",
          addDays(t, -6),
          "BP portfolio handed to Ritu Bansal.",
          "Farah Khan",
        ),
        assets: cleared(
          "assets",
          "Aravind Krishnan",
          addDays(t, -1),
          "Laptop returned, minor scratch — no charge.",
        ),
        it: cleared("it", "Aravind Krishnan", addDays(t, -1), "Access revoked."),
        admin: cleared("admin", "Kiran Shetty", addDays(t, -1), "Cleared."),
      },
      clearanceStartedOn: addDays(t, -8),
      clearanceCompletedOn: addDays(t, -1),
      noticeDays: 60,
      noticeStart: addDays(t, -66),
      noticeEnd: addDays(t, -6),
      timeline: [
        {
          stage: "Resignation Submitted",
          by: "Aditya Verma",
          role: "Employee",
          on: addDays(t, -70),
          note: "Resignation submitted.",
        },
        {
          stage: "Manager Approved",
          by: "Farah Khan",
          role: "CHRO",
          on: addDays(t, -68),
          note: "Approved.",
        },
        {
          stage: "HR Accepted · Notice Period Started",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -66),
          note: "60 day notice applied.",
        },
        {
          stage: "Moved to Clearance Checklist",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -8),
          note: "",
        },
        {
          stage: "Clearance Completed · Final Settlement",
          by: "Varen Mishra",
          role: "HR",
          on: addDays(t, -1),
          note: "All seven clearances received. F&F and exit interview pending.",
        },
      ],
    },
  ];
}

/* ------------------------------ store ------------------------------ */

const KEY = "seereon.exit.requests.v3";

// Same contract as persist.ts: the server (and the client's hydration pass) always sees the seed; the browser copy is
// read lazily on the first client read. Reading localStorage at module load made React hydrate against data the
// server never rendered.
const initial = seed();
let state = initial;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) state = parsed;
  } catch {
    /* malformed cache — keep the seed */
  }
}

const current = () => {
  hydrate();
  return state;
};
const subs = new Set();

function commit(next) {
  hydrate();
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }
  subs.forEach((f) => f());
}

const subscribe = (cb) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

export const useExitRequests = () => useSyncExternalStore(subscribe, current, () => initial);
export const getExitRequests = () => current();

export function resetExitData() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  commit(seed());
}

const patch = (id, fn) => commit(current().map((r) => (r.id === id ? fn(r) : r)));
const log = (r, entry) => ({ ...r, timeline: [...r.timeline, entry] });
const entry = (stage, by, note = "") => ({
  stage,
  by: by.name,
  role: by.role,
  on: todayISO(),
  note,
});

/* ------------------------------ notifications ------------------------------ */
/** HR / CHRO of the leaver's entity (exit decisions previously notified nobody). */
const hrTeamOf = (r) => {
  const org = findEmployee(r.empId)?.orgId ?? userById(r.empId)?.orgId;
  return allUsers().filter(
    (u) => (u.role === "HR" || u.role === "CHRO") && (!org || u.orgId === org) && u.id !== r.empId,
  );
};
const notify = (ids, title, body, to = "/org/exits") =>
  [...new Set(ids.filter(Boolean))].forEach((empId) =>
    pushAlert({ empId, kind: "general", to, title, body }),
  );
const idsByName = (name) =>
  allUsers()
    .filter((u) => u.name === name)
    .map((u) => u.id);

/* ------------------------------ actions ------------------------------ */

/** Next id from the highest existing number (the seed already contains EXT-1001…1005, so `1001 + length` could collide). */
const nextExitId = () =>
  `EXT-${Math.max(1000, ...current().map((r) => Number(r.id.replace(/\D/g, "")) || 0)) + 1}`;

export function submitResignation(input) {
  // One live resignation per employee — a double click / second tab used to create two parallel exit files.
  const live = current().find(
    (r) => r.empId === input.employee.id && ACTIVE_STAGES.includes(r.stage),
  );
  if (live) return live;
  // No manager on record → the company's administrator (it fell back to Seereon's CEO for every organisation).
  const manager = userById(input.employee.managerId) ?? companyAdminOf(input.employee.orgId);
  const req = {
    id: nextExitId(),
    empId: input.employee.id,
    empName: input.employee.name,
    email: input.employee.email,
    designation: input.employee.designation,
    dept: input.employee.dept,
    branch: input.employee.branch,
    managerId: manager.id,
    managerName: manager.name,
    appliedOn: todayISO(),
    reason: input.reason,
    description: input.description,
    requestedLwd: input.requestedLwd,
    document: input.document,
    stage: "Manager Review",
    managerDecision: null,
    hrDecision: null,
    clearances: emptyClearances(manager.name),
    clearanceStartedOn: null,
    clearanceCompletedOn: null,
    noticeDays: null,
    noticeStart: null,
    noticeEnd: null,
    exitInterviewDone: false,
    exitInterview: null,
    fnfSettled: false,
    fnfRef: null,
    retainedOn: null,
    completedOn: null,
    timeline: [
      {
        stage: "Resignation Submitted",
        by: input.employee.name,
        role: input.employee.role,
        on: todayISO(),
        note: `Submitted to ${manager.name} for review. Requested last working day ${fmtDate(input.requestedLwd)}.`,
      },
    ],
  };
  commit([req, ...current()]);
  notify(
    [manager.id],
    `Resignation to review — ${req.empName}`,
    `${req.reason} · requested last day ${fmtDate(req.requestedLwd)}. Accept or reject under Exit Management → Resignations.`,
  );
  return req;
}

/**
 * Termination executed from People cases: the approvals already happened on the termination case, so the exit file
 * opens straight at the clearance checklist with the notice running to the letter's last working day.
 */
export function openTerminationExit(input, by) {
  if (current().some((r) => r.empId === input.empId && ACTIVE_STAGES.includes(r.stage)))
    return null;
  const manager = userById(input.managerId) ?? companyAdminOf(userById(input.empId)?.orgId);
  const t = todayISO();
  const noticeDays = Math.max(0, daysBetween(t, input.lastWorkingDay));
  const req = {
    id: nextExitId(),
    empId: input.empId,
    empName: input.empName,
    email: input.email,
    designation: input.designation,
    dept: input.dept,
    branch: input.branch,
    managerId: manager.id,
    managerName: manager.name,
    appliedOn: t,
    reason: `Termination — ${input.reason}`,
    description: input.description,
    requestedLwd: input.lastWorkingDay,
    document: `${input.letterRef}.pdf`,
    stage: "HR Clearance",
    managerDecision: { action: "Approved", by: by.name, on: t, note: "Termination case approved" },
    hrDecision: {
      action: "Approved",
      by: by.name,
      on: t,
      note: `Termination letter ${input.letterRef} issued`,
    },
    clearances: emptyClearances(manager.name),
    clearanceStartedOn: t,
    clearanceCompletedOn: null,
    noticeDays,
    noticeStart: t,
    noticeEnd: input.lastWorkingDay,
    exitInterviewDone: false,
    exitInterview: null,
    fnfSettled: false,
    fnfRef: null,
    retainedOn: null,
    completedOn: null,
    timeline: [
      {
        stage: "Termination Initiated",
        by: by.name,
        role: by.role,
        on: t,
        note: `${input.reason}. Letter ${input.letterRef}; last working day ${fmtDate(input.lastWorkingDay)}.`,
      },
      {
        stage: "Moved to Clearance Checklist",
        by: by.name,
        role: by.role,
        on: t,
        note: `Clearance officers notified: ${CLEARANCE_AREAS.map((a) => `${a.label} — ${a.key === "projects" ? manager.name : a.defaultOfficer}`).join("; ")}`,
      },
    ],
  };
  commit([req, ...current()]);
  return req;
}

/** Step 1 — reporting manager accepts or rejects. Accepted resignations go to HR for acceptance and notice-period fixing. */
export function managerDecide(id, action, by, note) {
  const cur = current().find((x) => x.id === id);
  if (!cur || cur.stage !== "Manager Review" || cur.empId === by.id) return false;
  // Only the recorded reporting manager decides, unless the actor holds an override role.
  if (by.id !== cur.managerId && !MANAGER_OVERRIDE_ROLES.includes(by.role)) return false;
  patch(id, (r) =>
    log(
      {
        ...r,
        stage: action === "Approved" ? "HR Review" : "Manager Rejected",
        managerDecision: { action, by: by.name, on: todayISO(), note },
      },
      entry(action === "Approved" ? "Manager Approved" : "Manager Rejected", by, note),
    ),
  );
  notify(
    [cur.empId],
    `Resignation ${action === "Approved" ? "accepted by your manager" : "rejected by your manager"}`,
    `${by.name}: ${note}${action === "Approved" ? " — HR will now confirm your notice period." : ""}`,
    "/emp/resignation",
  );
  if (action === "Approved")
    notify(
      hrTeamOf(cur).map((u) => u.id),
      `Resignation awaiting HR acceptance — ${cur.empName}`,
      `Manager ${by.name} accepted. Fix the notice period under Exit Management → Resignations.`,
    );
  return true;
}

/** Step 2 — HR accepts the resignation and starts the notice period. */
export function hrApprove(id, by, noticeDays, note) {
  const cur = current().find((x) => x.id === id);
  if (!cur || cur.stage !== "HR Review" || !(noticeDays > 0) || cur.empId === by.id) return false;
  // Maker-checker: the HR acceptance must come from someone other than the manager-stage decider.
  if (cur.managerDecision?.by === by.name) return false;
  const start = todayISO();
  const end = addDays(start, noticeDays);
  patch(id, (r) =>
    log(
      {
        ...r,
        stage: "Notice Period",
        hrDecision: { action: "Approved", by: by.name, on: start, note },
        noticeDays,
        noticeStart: start,
        noticeEnd: end,
      },
      entry(
        "HR Accepted · Notice Period Started",
        by,
        `${noticeDays} day notice period applied. Last working day ${fmtDate(end)}. ${note}`.trim(),
      ),
    ),
  );
  // The employee record mirrors the exit stage (the directory has a "Notice" status that was never set by resignations).
  updateEmployeeRecord(cur.empId, { status: "Notice" });
  notify(
    [cur.empId],
    "Resignation accepted — notice period started",
    `${noticeDays} day notice from ${fmtDate(start)}; last working day ${fmtDate(end)}.`,
    "/emp/resignation",
  );
  notify(
    [cur.managerId],
    `${cur.empName} is serving notice`,
    `HR (${by.name}) accepted the resignation; last working day ${fmtDate(end)}.`,
  );
  return true;
}
/** Employment continues (retained / withdrawn): clear the "Notice" flag set when the notice period started. */
const reinstateRecord = (empId) => {
  if (findEmployee(empId)?.status === "Notice") updateEmployeeRecord(empId, { status: "Active" });
};

export function hrReject(id, by, note) {
  const cur = current().find((x) => x.id === id);
  if (!cur || cur.stage !== "HR Review" || cur.empId === by.id) return false;
  patch(id, (r) =>
    log(
      {
        ...r,
        stage: "HR Rejected",
        hrDecision: { action: "Rejected", by: by.name, on: todayISO(), note },
      },
      entry("HR Rejected", by, note),
    ),
  );
  notify([cur.empId], "Resignation not accepted by HR", `${by.name}: ${note}`, "/emp/resignation");
  return true;
}

export function updateNoticePeriod(id, by, noticeDays, note) {
  if (!(noticeDays > 0)) return false;
  patch(id, (r) => {
    const start = r.noticeStart ?? todayISO();
    return log(
      { ...r, noticeDays, noticeStart: start, noticeEnd: addDays(start, noticeDays) },
      entry(
        "Notice Period Revised",
        by,
        `Notice period set to ${noticeDays} days. Last working day ${fmtDate(addDays(start, noticeDays))}. ${note}`.trim(),
      ),
    );
  });
}

/** Step 3 — from the Notice Period tab: hand the employee to the clearance officers. */
export function moveToClearance(id, by, officers) {
  const r = current().find((x) => x.id === id);
  if (!r) return { ok: false, message: "Not found." };
  if (isOwnExit(r, by)) return { ok: false, message: "You cannot process your own exit file." };
  if (officers && Object.values(officers).includes(r.empName))
    return { ok: false, message: `${r.empName} cannot be a clearance officer on their own exit.` };
  if (r.stage !== "Notice Period")
    return {
      ok: false,
      message: "Only employees serving notice can be moved to the clearance checklist.",
    };
  patch(id, (x) =>
    log(
      {
        ...x,
        stage: "HR Clearance",
        clearanceStartedOn: todayISO(),
        clearances: Object.fromEntries(
          CLEARANCE_AREAS.map((a) => [
            a.key,
            {
              ...x.clearances[a.key],
              officer:
                officers?.[a.key] ||
                x.clearances[a.key].officer ||
                a.defaultOfficer ||
                x.managerName,
            },
          ]),
        ),
      },
      entry(
        "Moved to Clearance Checklist",
        by,
        `Clearance officers notified: ${CLEARANCE_AREAS.map((a) => `${a.label} — ${officers?.[a.key] || x.clearances[a.key].officer || a.defaultOfficer || x.managerName}`).join("; ")}`,
      ),
    ),
  );
  const moved = current().find((x) => x.id === id);
  notify(
    CLEARANCE_AREAS.flatMap((a) => idsByName(moved.clearances[a.key].officer)),
    `Exit clearance assigned — ${r.empName}`,
    `Give or block your clearance for ${r.empName} (${r.id}, LWD ${fmtDate(r.noticeEnd)}) under Exit Management → HR Clearance.`,
  );
  notify(
    [r.empId],
    "Clearance checklist started",
    "Return your assets and complete the handover — each clearance officer records their sign-off.",
    "/emp/resignation",
  );
  return {
    ok: true,
    message: `${r.empName} moved to the HR clearance checklist; ${CLEARANCE_AREAS.length} officers notified.`,
  };
}

export function assignClearanceOfficer(id, area, officer, by) {
  const label = CLEARANCE_AREAS.find((a) => a.key === area)?.label ?? area;
  const cur = current().find((x) => x.id === id);
  // The leaver can neither assign officers on their own file nor be named their own clearance officer.
  if (!cur || isOwnExit(cur, by) || officer === cur.empName) return false;
  patch(id, (r) =>
    log(
      { ...r, clearances: { ...r.clearances, [area]: { ...r.clearances[area], officer } } },
      entry(`${label} — officer assigned`, by, officer),
    ),
  );
  return true;
}

export function setClearance(id, area, status, by, note, amount, ticked) {
  const cur = current().find((x) => x.id === id);
  if (!cur || cur.stage !== "HR Clearance" || isOwnExit(cur, by)) return false;
  if (amount !== undefined && amount < 0) return false;
  const label = CLEARANCE_AREAS.find((a) => a.key === area)?.label ?? area;
  patch(id, (r) =>
    log(
      {
        ...r,
        clearances: {
          ...r.clearances,
          [area]: {
            ...r.clearances[area],
            status,
            note,
            by: by.name,
            on: todayISO(),
            amount,
            ticked: ticked ?? r.clearances[area].ticked,
          },
        },
      },
      entry(`${label} ${status}`, by, note),
    ),
  );
  if (status === "Blocked")
    notify(
      hrTeamOf(cur).map((u) => u.id),
      `Clearance blocked — ${cur.empName}`,
      `${label}: ${note || "dues pending"} (${by.name}).`,
    );
  return true;
}

export const allCleared = (r) =>
  CLEARANCE_AREAS.every((a) => r.clearances[a.key]?.status === "Cleared");
export const blockedAreas = (r) =>
  CLEARANCE_AREAS.filter((a) => r.clearances[a.key]?.status === "Blocked");
export const clearedCount = (r) =>
  CLEARANCE_AREAS.filter((a) => r.clearances[a.key]?.status === "Cleared").length;

/** Step 4 — every officer has cleared: the file moves to final settlement (F&F + exit interview). */
export function completeClearance(id, by, note = "") {
  const r = current().find((x) => x.id === id);
  if (!r) return { ok: false, message: "Not found." };
  if (isOwnExit(r, by)) return { ok: false, message: "You cannot process your own exit file." };
  if (r.stage !== "HR Clearance")
    return {
      ok: false,
      message: "Only a file in the clearance checklist can be moved to final settlement.",
    };
  if (!allCleared(r))
    return {
      ok: false,
      message: `${CLEARANCE_AREAS.length - clearedCount(r)} clearance(s) still pending or blocked.`,
    };
  patch(id, (x) =>
    log(
      { ...x, stage: "Final Settlement", clearanceCompletedOn: todayISO() },
      entry(
        "Clearance Completed · Final Settlement",
        by,
        note || "All clearances received. F&F and exit interview pending.",
      ),
    ),
  );
  notify(
    [r.empId],
    "All clearances received",
    "Your full & final settlement is being processed. Submit the exit survey if you haven't already.",
    "/emp/resignation",
  );
  return {
    ok: true,
    message: "Clearance complete — F&F settlement and exit interview can now be closed.",
  };
}

/** Step 5a — F&F reviewed and paid (statement must exist; caller passes the payment reference). */
export function markFnfSettled(id, by, ref, netPayable) {
  const cur = current().find((x) => x.id === id);
  if (!cur) return { ok: false, message: "Not found." };
  if (isOwnExit(cur, by)) return { ok: false, message: "You cannot settle your own F&F." };
  // Paid only once every clearance is in (a blocked finance clearance used to be bypassed by an early payment).
  if (cur.stage !== "Final Settlement")
    return { ok: false, message: `F&F cannot be settled while the file is at "${cur.stage}".` };
  if (cur.fnfSettled) return { ok: false, message: `F&F already settled (${cur.fnfRef}).` };
  if (!ref.trim()) return { ok: false, message: "Enter the payment reference." };
  patch(id, (r) =>
    log(
      { ...r, fnfSettled: true, fnfRef: ref },
      entry("F&F Settled", by, `Net ₹${Math.round(netPayable).toLocaleString("en-IN")} · ${ref}`),
    ),
  );
  notify(
    [cur.empId],
    "Full & final settlement paid",
    `Net ₹${Math.round(netPayable).toLocaleString("en-IN")} · reference ${ref}.`,
    "/emp/resignation",
  );
  return { ok: true, message: `F&F marked settled (${ref}).` };
}

/** Step 5b — exit interview recorded (employee portal submission, HR-conducted interview, or uploaded signed form). */
export function markExitInterview(id, by, rec) {
  const cur = current().find((x) => x.id === id);
  if (
    !cur ||
    CLOSED_STAGES.includes(cur.stage) ||
    cur.stage === "Manager Review" ||
    cur.stage === "HR Review"
  )
    return {
      ok: false,
      message: "The exit interview can be recorded only once the resignation is accepted.",
    };
  if (cur.exitInterviewDone) return { ok: false, message: "Exit interview already recorded." };
  patch(id, (r) =>
    log(
      { ...r, exitInterviewDone: true, exitInterview: { ...rec, on: todayISO(), by: by.name } },
      entry(
        "Exit Interview Completed",
        by,
        `${rec.mode}${rec.file ? ` · ${rec.file}` : ""}${rec.note ? ` — ${rec.note}` : ""}`,
      ),
    ),
  );
  return { ok: true, message: "Exit interview recorded." };
}

/** Step 6 — the employee has officially resigned; relieving letter issued. */
export function completeExit(id, by, note) {
  const r = current().find((x) => x.id === id);
  if (!r) return { ok: false, message: "Not found." };
  if (isOwnExit(r, by)) return { ok: false, message: "You cannot close your own exit file." };
  if (r.stage !== "Final Settlement")
    return {
      ok: false,
      message:
        "Complete the clearance checklist first — only files in final settlement can be closed.",
    };
  // Relieving before the last working day is an early release — allowed, but only with a recorded reason.
  if (r.noticeEnd && todayISO() < r.noticeEnd && !note.trim())
    return {
      ok: false,
      message: `The last working day is ${fmtDate(r.noticeEnd)} — enter the early-release reason in the closing note to relieve now.`,
    };
  if (!r.fnfSettled || !r.exitInterviewDone)
    return {
      ok: false,
      message: `Complete the ${[!r.fnfSettled && "F&F settlement", !r.exitInterviewDone && "exit interview"].filter(Boolean).join(" and ")} first.`,
    };
  patch(id, (x) =>
    log(
      { ...x, stage: "Exit Completed", completedOn: todayISO() },
      entry(
        "Exit Completed",
        by,
        `${r.noticeEnd && todayISO() < r.noticeEnd ? `Early release before LWD ${fmtDate(r.noticeEnd)} — ` : ""}${note || "Employee relieved; relieving & experience letters issued."}`,
      ),
    ),
  );
  updateEmployeeRecord(r.empId, { status: "Exited" });
  // The login goes with the employment — an exited employee could still sign in.
  suspendUser(r.empId, by.name, "Exited");
  return {
    ok: true,
    message: `${r.empName}'s exit is complete — relieving letter issued, record archived.`,
  };
}

/** Retained: resignation closed, employment continues on the existing records. */
export function markRetained(id, by, note) {
  const cur = current().find((x) => x.id === id);
  if (!cur || !ACTIVE_STAGES.includes(cur.stage)) return false;
  patch(id, (r) =>
    log(
      { ...r, stage: "Retained", retainedOn: todayISO() },
      entry("Retained · Resignation Withdrawn", by, note),
    ),
  );
  reinstateRecord(cur.empId);
  return true;
}

export function withdrawResignation(id, by, note) {
  const cur = current().find((x) => x.id === id);
  // The employee may withdraw only before the manager has decided; later stages go through the retention path.
  if (!cur || cur.stage !== "Manager Review") return false;
  patch(id, (r) => log({ ...r, stage: "Withdrawn" }, entry("Resignation Withdrawn", by, note)));
  reinstateRecord(cur.empId);
  notify([cur.managerId], `Resignation withdrawn — ${cur.empName}`, note);
  return true;
}

/* ------------------------------ selectors ------------------------------ */

export const myExit = (list, empId) =>
  list.find((r) => r.empId === empId && ACTIVE_STAGES.includes(r.stage)) ??
  list.find((r) => r.empId === empId) ??
  null;

export const myExitHistory = (list, empId) => list.filter((r) => r.empId === empId);

export const teamExits = (list, managerId) => list.filter((r) => r.managerId === managerId);

export const stageTone = (stage) => {
  switch (stage) {
    case "Manager Review":
    case "HR Review":
      return "border-gold/40 bg-gold/10 text-gold";
    case "HR Clearance":
    case "Final Settlement":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "Notice Period":
    case "Retained":
      return "border-primary/30 bg-primary/10 text-primary";
    case "Exit Completed":
    case "Withdrawn":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-destructive/30 bg-destructive/10 text-destructive";
  }
};

export const clearanceTone = (s) =>
  s === "Cleared"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Blocked"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/40 bg-gold/10 text-gold";

/** Workflow steps for the stepper UI. */
export const EXIT_STEPS = [
  "Submitted",
  "Manager approval",
  "HR acceptance",
  "Notice period",
  "Clearance checklist",
  "F&F & exit interview",
  "Exit complete",
];

export function stepIndex(stage) {
  switch (stage) {
    case "Manager Review":
      return 1;
    case "HR Review":
      return 2;
    case "Notice Period":
      return 3;
    case "HR Clearance":
      return 4;
    case "Final Settlement":
      return 5;
    case "Exit Completed":
      return 6;
    case "Retained":
      return 3;
    default:
      return 1;
  }
}
