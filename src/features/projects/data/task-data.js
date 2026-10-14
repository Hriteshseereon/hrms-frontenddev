// -----------------------------------------------------------------------------
// Tasks — ONE store for every task in the system. A task may belong to a project
// (projectId) or stand alone (Miscellaneous); the Projects workspace, the Tasks
// module, My Team and the employee portal all read from here, so a task added
// under a project appears in every list and vice-versa.
// -----------------------------------------------------------------------------
import { useMemo } from "react";
import { createPersistentStore } from "@/lib/persist";
import { activeOrgStore } from "@/features/organization/data/group-data";
import { ORGANIZATION } from "@/features/auth/data/auth-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { useScopeMatch } from "@/features/organization/data/tenancy";

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const TASK_STATUSES = ["Not Started", "In Progress", "On Hold", "Completed"];
export const TASK_CATEGORIES = [
  "Development",
  "Testing / QA",
  "Design",
  "Documentation",
  "Client deliverable",
  "Support / maintenance",
  "Data / reporting",
  "Compliance",
  "Internal / admin",
  "Research",
];
export const TASK_PURPOSES = [
  "Client deliverable",
  "Internal improvement",
  "Bug fix / incident",
  "Compliance / statutory",
  "Onboarding / enablement",
  "Sales / pre-sales",
  "Research / POC",
  "Operations",
];

/**
 * @typedef {(typeof TASK_PRIORITIES)[number]} TaskPriority
 */
/**
 * @typedef {(typeof TASK_STATUSES)[number]} TaskStatus
 */
/**
 * @typedef {"Pending" | "Approved" | "Rejected" | "Not Submitted"} ApprovalState
 */

/**
 * @typedef {Object} TaskUpdate
 * @property {string} at
 * @property {string} by
 * @property {string} note
 * @property {number} [hours]
 * @property {number} [progress]
 * @property {TaskStatus} [status]
 */
/**
 * @typedef {Object} TaskLink
 * @property {string} label
 * @property {string} url
 */
/**
 * @typedef {Object} TaskChecklistItem
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string | null} projectId - null → miscellaneous task not tied to a project
 * @property {string[]} assignees
 * @property {TaskPriority} priority
 * @property {TaskStatus} status
 * @property {number} estimatedHours
 * @property {number} loggedHours
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} dueDate
 * @property {string} deadline - Estimated delivery date & time (ISO local, "YYYY-MM-DDTHH:mm")
 * @property {string} [attachment]
 * @property {string} createdBy
 * @property {string} [createdById]
 * @property {number} progress
 * @property {TaskUpdate[]} updates
 * @property {ApprovalState} approval
 * @property {(typeof TASK_PURPOSES)[number] | string} [purpose] - Detailed task (v5)
 * @property {string} [details]
 * @property {(typeof TASK_CATEGORIES)[number] | string} [category]
 * @property {string} [deliverables]
 * @property {string} [acceptanceCriteria]
 * @property {boolean} [teamTask]
 * @property {string} [teamName]
 * @property {string} [concernedManagerId]
 * @property {string} [concernedManager]
 * @property {string} [concernedPersonId]
 * @property {string} [concernedPerson]
 * @property {string} [client]
 * @property {string[]} [tags]
 * @property {TaskLink[]} [links]
 * @property {string[]} [attachments]
 * @property {TaskChecklistItem[]} [checklist]
 * @property {string[]} [dependsOn]
 * @property {boolean} [billable]
 * @property {string} [createdOn]
 * @property {string} [orgId] - Owning entity (company). Seeds without it belong to the Seereon entity.
 */

const SEED = [
  {
    id: "TSK-1001",
    projectId: null,
    name: "Q3 payroll data reconciliation",
    description:
      "Reconcile the June payroll register against the bank advice and flag any variance above ₹500.",
    assignees: ["SRN-0145", "SRN-0142"],
    priority: "High",
    status: "In Progress",
    estimatedHours: 16,
    loggedHours: 9,
    startDate: "2026-07-20",
    endDate: "2026-07-31",
    dueDate: "2026-07-31",
    deadline: "2026-07-31T18:00",
    attachment: "june-payroll-register.xlsx",
    createdBy: "Varen Mishra",
    createdById: "SRN-0004",
    progress: 55,
    approval: "Approved",
    purpose: "Compliance / statutory",
    category: "Data / reporting",
    details:
      "Use the bank advice export from HDFC CMS; variances above ₹500 go to Finance with the employee ID and reason.",
    deliverables: "Reconciliation sheet + variance list",
    acceptanceCriteria: "Zero unexplained variances; CFO sign-off",
    teamTask: true,
    teamName: "Payroll ops",
    concernedManagerId: "SRN-0002",
    concernedManager: "Saras Venkatesh",
    concernedPersonId: "SRN-0004",
    concernedPerson: "Varen Mishra",
    tags: ["payroll", "finance"],
    createdOn: "2026-07-19",
    updates: [
      {
        at: "2026-07-24",
        by: "Rohit Deshmukh",
        note: "4 variances identified, awaiting bank statement.",
      },
    ],
  },
  {
    id: "TSK-1002",
    projectId: null,
    name: "Onboarding kit revamp",
    description:
      "Refresh the onboarding checklist, welcome deck and day-one email templates for FY27.",
    assignees: ["SRN-0144"],
    priority: "Medium",
    status: "Not Started",
    estimatedHours: 24,
    loggedHours: 0,
    startDate: "2026-08-01",
    endDate: "2026-08-20",
    dueDate: "2026-08-20",
    deadline: "2026-08-20T17:30",
    createdBy: "Varen Mishra",
    createdById: "SRN-0004",
    progress: 0,
    approval: "Not Submitted",
    purpose: "Onboarding / enablement",
    category: "Documentation",
    concernedManagerId: "SRN-0004",
    concernedManager: "Varen Mishra",
    tags: ["onboarding"],
    createdOn: "2026-07-28",
    updates: [],
  },
  {
    id: "TSK-1003",
    projectId: null,
    name: "Latency fix for attendance sync",
    description:
      "Biometric sync from Chennai office is delayed by ~20 mins. Investigate and patch the ingest worker.",
    assignees: ["SRN-0142", "SRN-0147", "SRN-0149"],
    priority: "Critical",
    status: "In Progress",
    estimatedHours: 12,
    loggedHours: 7.5,
    startDate: "2026-07-27",
    endDate: "2026-07-30",
    dueDate: "2026-07-30",
    deadline: "2026-07-30T12:00",
    attachment: "sync-trace.log",
    createdBy: "Manish Patel",
    createdById: "SRN-0149",
    progress: 70,
    approval: "Approved",
    purpose: "Bug fix / incident",
    category: "Support / maintenance",
    teamTask: true,
    teamName: "Platform",
    concernedManagerId: "SRN-0149",
    concernedManager: "Manish Patel",
    concernedPersonId: "SRN-0017",
    concernedPerson: "Kiran Shetty",
    tags: ["attendance", "incident"],
    createdOn: "2026-07-27",
    updates: [
      {
        at: "2026-07-28",
        by: "Ananya Sharma",
        note: "Root caused to batch window; fix in review.",
      },
    ],
  },
  {
    id: "TSK-1004",
    projectId: null,
    name: "Regional holiday calendar sign-off",
    description:
      "Collect regional holiday inputs from all five offices and publish the FY27 calendar.",
    assignees: ["SRN-0144", "SRN-0146"],
    priority: "Low",
    status: "Completed",
    estimatedHours: 8,
    loggedHours: 8,
    startDate: "2026-06-15",
    endDate: "2026-07-10",
    dueDate: "2026-07-10",
    deadline: "2026-07-10T18:00",
    createdBy: "Varen Mishra",
    createdById: "SRN-0004",
    progress: 100,
    approval: "Approved",
    purpose: "Operations",
    category: "Internal / admin",
    concernedManagerId: "SRN-0004",
    concernedManager: "Varen Mishra",
    createdOn: "2026-06-14",
    updates: [{ at: "2026-07-09", by: "Kavya Menon", note: "All offices confirmed. Published." }],
  },
  {
    id: "PTK-001",
    projectId: "PRJ-001",
    name: "Design ledger event-sourcing schema",
    description: "Finalise the append-only event schema for the double-entry ledger microservice.",
    assignees: ["SRN-0006"],
    priority: "Critical",
    status: "Completed",
    estimatedHours: 40,
    loggedHours: 42,
    startDate: "2026-03-05",
    endDate: "2026-03-25",
    dueDate: "2026-03-25",
    deadline: "2026-03-25T18:00",
    progress: 100,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Approved",
    purpose: "Client deliverable",
    category: "Design",
    client: "Royal Commission for AlUla (RCU)",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    deliverables: "Event schema doc + ADR",
    createdOn: "2026-03-04",
    updates: [
      {
        at: "2026-03-24",
        by: "Subham Das",
        note: "Schema reviewed with the client architecture board and signed off.",
        hours: 42,
        progress: 100,
        status: "Completed",
      },
    ],
  },
  {
    id: "PTK-002",
    projectId: "PRJ-001",
    name: "Build account-balance reconciliation service",
    description:
      "Implement the nightly reconciliation batch that compares new ledger balances against the legacy mainframe extract.",
    assignees: ["SRN-0006", "SRN-0008"],
    priority: "High",
    status: "In Progress",
    estimatedHours: 60,
    loggedHours: 34,
    startDate: "2026-04-01",
    endDate: "2026-07-20",
    dueDate: "2026-07-20",
    deadline: "2026-07-20T18:00",
    progress: 55,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Approved",
    purpose: "Client deliverable",
    category: "Development",
    client: "Royal Commission for AlUla (RCU)",
    teamTask: true,
    teamName: "Ledger squad",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-03-30",
    updates: [
      {
        at: "2026-07-10",
        by: "Rakesh Menon",
        note: "Batch job processes 2M records/night; tuning the diff algorithm next.",
        hours: 30,
        progress: 50,
        status: "In Progress",
      },
    ],
  },
  {
    id: "PTK-003",
    projectId: "PRJ-001",
    name: "Cutover rehearsal — dry run 2",
    description: "Execute the second dry-run cutover in the UAT environment and log timing gaps.",
    assignees: ["SRN-0008"],
    priority: "Critical",
    status: "Not Started",
    estimatedHours: 20,
    loggedHours: 0,
    startDate: "2026-07-15",
    endDate: "2026-07-28",
    dueDate: "2026-07-28",
    deadline: "2026-07-28T20:00",
    progress: 0,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Not Submitted",
    purpose: "Client deliverable",
    category: "Testing / QA",
    client: "Royal Commission for AlUla (RCU)",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-07-12",
    updates: [],
  },
  {
    id: "PTK-004",
    projectId: "PRJ-002",
    name: "Store inventory sync service",
    description:
      "Build the near-real-time inventory sync between store POS terminals and the central ERP.",
    assignees: ["SRN-0006"],
    priority: "High",
    status: "In Progress",
    estimatedHours: 50,
    loggedHours: 38,
    startDate: "2026-05-15",
    endDate: "2026-08-01",
    dueDate: "2026-08-01",
    deadline: "2026-08-01T18:00",
    progress: 70,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Approved",
    purpose: "Client deliverable",
    category: "Development",
    client: "ZooPlus SE (Germany)",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-05-12",
    updates: [
      {
        at: "2026-07-20",
        by: "Subham Das",
        note: "Sync latency down to 4s; load-testing across 30 concurrent stores.",
        hours: 12,
        progress: 70,
        status: "In Progress",
      },
    ],
  },
  {
    id: "PTK-005",
    projectId: "PRJ-002",
    name: "UAT sign-off for pilot stores",
    description: "Run UAT scripts across the 5 pilot stores and capture defects for triage.",
    assignees: ["SRN-0007"],
    priority: "Medium",
    status: "In Progress",
    estimatedHours: 30,
    loggedHours: 14,
    startDate: "2026-06-20",
    endDate: "2026-07-30",
    dueDate: "2026-07-30",
    deadline: "2026-07-30T18:00",
    progress: 40,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Pending",
    purpose: "Client deliverable",
    category: "Testing / QA",
    client: "ZooPlus SE (Germany)",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-06-18",
    updates: [
      {
        at: "2026-07-27",
        by: "Neha Kulkarni",
        note: "3 pilot stores UAT complete, 2 remaining with minor barcode-scan defects.",
        hours: 6,
        progress: 45,
        status: "In Progress",
      },
    ],
  },
  {
    id: "PTK-006",
    projectId: "PRJ-002",
    name: "Store manager training rollout",
    description: "Conduct POS training sessions for store managers ahead of go-live.",
    assignees: ["SRN-0007", "SRN-0006"],
    priority: "Low",
    status: "Not Started",
    estimatedHours: 24,
    loggedHours: 0,
    startDate: "2026-07-05",
    endDate: "2026-07-18",
    dueDate: "2026-07-18",
    deadline: "2026-07-18T17:00",
    progress: 0,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Not Submitted",
    purpose: "Onboarding / enablement",
    category: "Client deliverable",
    client: "ZooPlus SE (Germany)",
    teamTask: true,
    teamName: "Rollout",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-07-02",
    updates: [],
  },
  {
    id: "PTK-007",
    projectId: "PRJ-003",
    name: "Appointment booking module QA",
    description: "Full regression pass on the appointment booking and reminder-notification flows.",
    assignees: ["SRN-0007"],
    priority: "Medium",
    status: "Completed",
    estimatedHours: 26,
    loggedHours: 27,
    startDate: "2026-05-20",
    endDate: "2026-06-15",
    dueDate: "2026-06-15",
    deadline: "2026-06-15T18:00",
    progress: 100,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Approved",
    purpose: "Client deliverable",
    category: "Testing / QA",
    client: "Semtech Corporation",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-05-18",
    updates: [
      {
        at: "2026-06-14",
        by: "Neha Kulkarni",
        note: "All 48 test cases passed; signed off for release.",
        hours: 27,
        progress: 100,
        status: "Completed",
      },
    ],
  },
  {
    id: "PTK-008",
    projectId: null,
    name: "Internal — refresh onboarding tech stack wiki",
    description:
      "Update the internal engineering wiki with the current tech stack and setup guide for new joiners.",
    assignees: ["SRN-0006"],
    priority: "Low",
    status: "In Progress",
    estimatedHours: 8,
    loggedHours: 3,
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    dueDate: "2026-07-10",
    deadline: "2026-07-10T18:00",
    progress: 30,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Not Submitted",
    purpose: "Internal improvement",
    category: "Documentation",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-06-30",
    updates: [],
  },
  {
    id: "PTK-009",
    projectId: null,
    name: "Internal — client demo environment refresh",
    description:
      "Reset and refresh the shared client-demo sandbox environment with the latest release build.",
    assignees: ["SRN-0008"],
    priority: "Medium",
    status: "Not Started",
    estimatedHours: 6,
    loggedHours: 0,
    startDate: "2026-07-18",
    endDate: "2026-07-22",
    dueDate: "2026-07-22",
    deadline: "2026-07-22T18:00",
    progress: 0,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Not Submitted",
    purpose: "Sales / pre-sales",
    category: "Support / maintenance",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-07-16",
    updates: [],
  },
  {
    id: "PTK-010",
    projectId: null,
    name: "Internal — annual security awareness training",
    description: "Complete the mandatory annual security-awareness training module and quiz.",
    assignees: ["SRN-0007", "SRN-0006", "SRN-0008"],
    priority: "Low",
    status: "On Hold",
    estimatedHours: 4,
    loggedHours: 1,
    startDate: "2026-06-01",
    endDate: "2026-06-25",
    dueDate: "2026-06-25",
    deadline: "2026-06-25T18:00",
    progress: 15,
    createdBy: "Subh Sahoo",
    createdById: "SRN-0005",
    approval: "Rejected",
    purpose: "Compliance / statutory",
    category: "Compliance",
    teamTask: true,
    teamName: "Engineering",
    concernedManagerId: "SRN-0005",
    concernedManager: "Subh Sahoo",
    createdOn: "2026-05-30",
    updates: [
      {
        at: "2026-06-24",
        by: "Rakesh Menon",
        note: "Marked complete but quiz score below passing threshold.",
        hours: 1,
        progress: 100,
        status: "Completed",
      },
    ],
  },
];

export const taskStore = createPersistentStore("seereon.tasks.v2", SEED);
export const getTasks = () => taskStore.get();
/** Entity the record belongs to (older records without orgId are the Seereon entity's). */
export const orgOfRecord = (r) => r.orgId ?? ORGANIZATION.id;
/** Tasks of the entity in view (all entities in the Super Admin group view). */
export const useTasks = () => {
  const all = taskStore.use();
  const inScope = useScopeMatch();
  return useMemo(() => all.filter((t) => inScope(orgOfRecord(t))), [all, inScope]);
};

const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Local calendar date (YYYY-MM-DD). `toISOString()` is UTC and is a day behind in IST before 05:30. */
export const todayIso = today;

/**
 * The employee's progress update awaiting approval — the newest entry that carries hours / progress / status.
 * `updates[0]` is not reliable: a manager note or "Task details edited" entry can be prepended after the post.
 */
export const pendingUpdateOf = (t) =>
  t.approval === "Pending"
    ? t.updates.find(
        (u) => u.hours !== undefined || u.progress !== undefined || u.status !== undefined,
      )
    : undefined;
// Next free number per prefix — a count-based id would reuse a surviving id after a task is deleted.
const nextId = (prefix) => {
  const max = taskStore
    .get()
    .filter((t) => t.id.startsWith(`${prefix}-`))
    .reduce((m, t) => Math.max(m, Number(t.id.slice(prefix.length + 1)) || 0), 0);
  return prefix === "PTK"
    ? `PTK-${String(max + 1).padStart(3, "0")}`
    : `TSK-${Math.max(max, 1000) + 1}`;
};

/**
 * @typedef {Omit<Task, "id" | "loggedHours" | "progress" | "updates" | "status" | "approval" | "endDate" | "deadline" | "createdOn"> & { status?: TaskStatus, endDate?: string, deadline?: string }} NewTaskInput
 */

/** Create a task anywhere (Tasks module, project, My Team, employee portal). Returns the new id. */
export function addTask(t) {
  const id = nextId(t.projectId ? "PTK" : "TSK");
  const row = {
    ...t,
    id,
    orgId: t.orgId ?? activeOrgStore.get(),
    status: t.status ?? "Not Started",
    loggedHours: 0,
    progress: 0,
    updates: [],
    approval: "Not Submitted",
    endDate: t.endDate ?? t.dueDate,
    deadline: t.deadline ?? `${t.dueDate}T18:00`,
    createdOn: today(),
  };
  taskStore.set((p) => [row, ...p]);
  return id;
}

export function updateTask(id, patch) {
  taskStore.set((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}
export function deleteTask(id) {
  taskStore.set((p) => p.filter((t) => t.id !== id));
}

export function addTaskUpdate(id, by, note) {
  taskStore.set((p) =>
    p.map((t) => (t.id === id ? { ...t, updates: [{ at: today(), by, note }, ...t.updates] } : t)),
  );
}

/** Employee posts progress (hours / % / status) — waits for manager approval. */
export function postTaskUpdate(id, by, note, patch) {
  taskStore.set((p) =>
    p.map((t) =>
      t.id === id
        ? {
            ...t,
            approval: "Pending",
            updates: [{ at: today(), by, note, ...patch }, ...t.updates],
          }
        : t,
    ),
  );
}
/**
 * Maker–checker: the person deciding must not be the one who posted the update, nor an assignee of the task
 * (an assignee approving their own progress is self-approval). `approverId` is the decider's employee id.
 */
export function canDecideTaskUpdate(task, approverId, approverName) {
  if (!task || task.approval !== "Pending" || !approverId) return false;
  if (task.assignees.includes(approverId)) return false;
  const latest = pendingUpdateOf(task);
  if (latest?.byId ? latest.byId === approverId : latest?.by === approverName) return false;
  return true;
}

export function approveTaskUpdate(id, by, approverId) {
  const task = taskStore.get().find((t) => t.id === id);
  if (!canDecideTaskUpdate(task, approverId, by)) return false;
  const latest = pendingUpdateOf(task);
  taskStore.set((p) =>
    p.map((t) => {
      if (t.id !== id) return t;
      const status = latest?.status ?? t.status;
      const progress =
        status === "Completed"
          ? 100
          : latest?.progress !== undefined
            ? latest.progress
            : t.progress;
      return {
        ...t,
        approval: "Approved",
        loggedHours: latest?.hours !== undefined ? latest.hours : t.loggedHours,
        progress,
        status,
        updates: [{ at: today(), by, note: "Update approved." }, ...t.updates],
      };
    }),
  );
  task.assignees.forEach((empId) =>
    pushAlert({
      empId,
      kind: "general",
      to: "/emp/tasks",
      title: `Task update approved — ${task.name}`,
      body: `${by} approved the latest progress update on ${task.id}.`,
    }),
  );
  return true;
}
export function rejectTaskUpdate(id, by, reason, approverId) {
  const task = taskStore.get().find((t) => t.id === id);
  if (!canDecideTaskUpdate(task, approverId, by) || !reason.trim()) return false;
  taskStore.set((p) =>
    p.map((t) =>
      t.id === id
        ? {
            ...t,
            approval: "Rejected",
            updates: [{ at: today(), by, note: `Rejected: ${reason}` }, ...t.updates],
          }
        : t,
    ),
  );
  task.assignees.forEach((empId) =>
    pushAlert({
      empId,
      kind: "general",
      to: "/emp/tasks",
      title: `Task update sent back — ${task.name}`,
      body: `${by}: ${reason}`,
    }),
  );
  return true;
}
export const toggleChecklist = (id, itemId) =>
  taskStore.set((p) =>
    p.map((t) =>
      t.id === id
        ? {
            ...t,
            checklist: (t.checklist ?? []).map((c) =>
              c.id === itemId ? { ...c, done: !c.done } : c,
            ),
          }
        : t,
    ),
  );

export const priorityClass = (p) =>
  p === "Critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : p === "High"
      ? "border-gold/40 bg-gold/15 text-gold"
      : p === "Medium"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border bg-muted text-muted-foreground";

export const statusClass = (s) =>
  s === "Completed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "In Progress"
      ? "border-gold/40 bg-gold/15 text-gold"
      : s === "On Hold"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

export const approvalClass = (a) =>
  a === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : a === "Pending"
      ? "border-gold/40 bg-gold/15 text-gold"
      : a === "Rejected"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

/** A task is delayed when its due date has passed and it is not completed. */
export const isDelayed = (t) => t.status !== "Completed" && !!t.dueDate && t.dueDate < today();

export const dueDateClass = (t) =>
  isDelayed(t)
    ? "text-destructive font-semibold"
    : t.status === "Completed"
      ? "text-primary font-semibold"
      : t.status === "In Progress"
        ? "text-[oklch(0.62_0.16_55)] font-semibold"
        : "text-muted-foreground";

export const statusToneClass = (t) =>
  isDelayed(t)
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : t.status === "Completed"
      ? "border-primary/30 bg-primary/10 text-primary"
      : t.status === "In Progress"
        ? "border-[oklch(0.62_0.16_55)]/40 bg-[oklch(0.62_0.16_55)]/12 text-[oklch(0.5_0.16_55)]"
        : "border-border bg-muted text-muted-foreground";
