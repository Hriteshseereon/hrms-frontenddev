// Projects & assignments: managers create projects, staff project tasks, and
// employees post progress updates that require manager approval. UI-only.
import { useMemo } from "react";
import { createPersistentStore } from "@/lib/persist";
import { activeOrgStore } from "@/features/organization/data/group-data";
import {
  taskStore,
  addTask,
  updateTask,
  deleteTask,
  postTaskUpdate as postUpdate,
  approveTaskUpdate as approveUpdate,
  rejectTaskUpdate as rejectUpdate,
  pendingUpdateOf as pendingOf,
  useTasks,
  orgOfRecord,
} from "@/features/projects/data/task-data";
import { useScopeMatch } from "@/features/organization/data/tenancy";

export const PROJECT_PRIORITIES = ["Low", "Medium", "High", "Critical"];
/**
 * @typedef {(typeof PROJECT_PRIORITIES)[number]} ProjectPriority
 */

export const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed"];
/**
 * @typedef {(typeof PROJECT_STATUSES)[number]} ProjectStatus
 */

export const PROJECT_TASK_STATUSES = ["Not Started", "In Progress", "On Hold", "Completed"];
/**
 * @typedef {TaskStatus} ProjectTaskStatus
 */
/**
 * @typedef {TaskApproval} ApprovalState
 */

export const PROJECT_TYPES = [
  "Client engagement",
  "Internal product",
  "Support & maintenance (AMC)",
  "Implementation / rollout",
  "Consulting / advisory",
  "R&D / POC",
  "Infrastructure",
];
export const BILLING_TYPES = [
  "Fixed price",
  "Time & material",
  "Retainer",
  "Milestone based",
  "Non-billable (internal)",
];
export const PROJECT_PHASES = [
  "Initiation",
  "Planning",
  "Execution",
  "UAT",
  "Go-live",
  "Hypercare",
  "Closure",
];

/**
 * @typedef {Object} ProjectMember
 * @property {string} empId
 * @property {string} name
 * @property {string} role
 */
/**
 * @typedef {Object} ProjectMilestone
 * @property {string} id
 * @property {string} title
 * @property {string} due
 * @property {boolean} done
 */
/**
 * @typedef {Object} ProjectLink
 * @property {string} label
 * @property {string} url
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {string} client
 * @property {string} description
 * @property {string} manager
 * @property {string} managerId
 * @property {ProjectMember[]} members
 * @property {string} startDate
 * @property {string} endDate
 * @property {ProjectPriority} priority
 * @property {ProjectStatus} status
 * @property {number} progress
 * @property {(typeof PROJECT_TYPES)[number]} [type] - Detailed project (v5)
 * @property {string} [purpose]
 * @property {string} [objectives]
 * @property {string} [scope]
 * @property {string} [deliverables]
 * @property {string} [department]
 * @property {string} [branch]
 * @property {string} [sponsorId]
 * @property {string} [sponsor]
 * @property {string} [clientContact]
 * @property {string} [clientEmail]
 * @property {(typeof BILLING_TYPES)[number]} [billingType]
 * @property {number} [budget]
 * @property {string} [currency]
 * @property {string} [costCentre]
 * @property {string} [poNumber]
 * @property {(typeof PROJECT_PHASES)[number]} [phase]
 * @property {ProjectMilestone[]} [milestones]
 * @property {string} [risks]
 * @property {ProjectLink[]} [links]
 * @property {string[]} [attachments]
 * @property {string[]} [tags]
 * @property {string} [createdBy]
 * @property {string} [createdOn]
 * @property {string} [orgId] - Owning entity (company). Seeds without it belong to the Seereon entity.
 * @property {{ at: string, by: string, action: string }[]} [history]
 */

/**
 * A project task is simply a task with a projectId — same store as the Tasks module.
 * @typedef {Task} ProjectTask
 */
/**
 * @typedef {Task["updates"][number]} TaskUpdate
 */

// Local calendar date — toISOString() is UTC and flips a day late in IST (before 05:30) for "overdue" / created-on.
const nowIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let PROJECTS = [
  {
    id: "PRJ-001",
    name: "NorthBridge Bank — Core Ledger Migration",
    code: "NBB-CLM",
    client: "Royal Commission for AlUla (RCU)",
    description:
      "Migrate the legacy COBOL ledger to a cloud-native microservices platform with zero downtime cutover.",
    manager: "Subh Sahoo",
    managerId: "SRN-0005",
    members: [
      { empId: "SRN-0005", name: "Subh Sahoo", role: "Engagement Manager" },
      { empId: "SRN-0006", name: "Subham Das", role: "Backend Lead" },
      { empId: "SRN-0008", name: "Rakesh Menon", role: "Data Engineer" },
    ],
    startDate: "2026-03-01",
    endDate: "2026-12-15",
    priority: "Critical",
    status: "Active",
    progress: 46,
  },
  {
    id: "PRJ-002",
    name: "ZooPlus — KSeF e-Invoicing Rollout",
    code: "ARV-POS",
    client: "ZooPlus SE (Germany)",
    description:
      "Roll out a unified POS and inventory platform across 120 stores, integrating with the existing ERP.",
    manager: "Subh Sahoo",
    managerId: "SRN-0005",
    members: [
      { empId: "SRN-0005", name: "Subh Sahoo", role: "Delivery Manager" },
      { empId: "SRN-0007", name: "Neha Kulkarni", role: "QA Lead" },
      { empId: "SRN-0006", name: "Subham Das", role: "Integration Engineer" },
    ],
    startDate: "2026-05-10",
    endDate: "2026-09-30",
    priority: "High",
    status: "Active",
    progress: 62,
  },
  {
    id: "PRJ-003",
    name: "Vantara Health — Patient Portal Revamp",
    code: "VNT-PHP",
    client: "Semtech Corporation",
    description:
      "Redesign and rebuild the patient self-service portal with appointment booking and e-prescriptions.",
    manager: "Subh Sahoo",
    managerId: "SRN-0005",
    members: [
      { empId: "SRN-0005", name: "Subh Sahoo", role: "Program Manager" },
      { empId: "SRN-0007", name: "Neha Kulkarni", role: "QA Engineer" },
    ],
    startDate: "2026-01-15",
    endDate: "2026-06-30",
    priority: "Medium",
    status: "Completed",
    progress: 100,
  },
];

export const projectStore = createPersistentStore("seereon.projects.v2", PROJECTS);
export const getProjects = () => projectStore.get();
export const getProjectTasks = () => taskStore.get();
/** Projects of the entity in view (all entities in the Super Admin group view). */
export const useProjects = () => {
  const all = projectStore.use();
  const inScope = useScopeMatch();
  return useMemo(() => all.filter((p) => inScope(orgOfRecord(p))), [all, inScope]);
};
export const useProjectTasks = () => useTasks();

// Next free number — a count-based id would reuse a surviving project's id after one was deleted.
const nextProjectId = () =>
  `PRJ-${String(projectStore.get().reduce((m, p) => Math.max(m, Number(p.id.replace(/^PRJ-/, "")) || 0), 0) + 1).padStart(3, "0")}`;

/** Project codes are business keys — case-insensitive unique. */
export const isProjectCodeTaken = (code, exceptId) =>
  projectStore
    .get()
    .some((p) => p.id !== exceptId && p.code.trim().toUpperCase() === code.trim().toUpperCase());

export function addProject(p) {
  const id = nextProjectId();
  const members = [
    { empId: p.managerId, name: p.manager, role: "Manager" },
    ...(p.members ?? []).filter((m) => m.empId !== p.managerId),
  ];
  projectStore.set((list) => [
    {
      ...p,
      id,
      orgId: p.orgId ?? activeOrgStore.get(),
      members,
      progress: 0,
      status: p.status ?? "Planning",
      createdOn: nowIso(),
      history: [
        { at: nowIso(), by: p.createdBy ?? p.manager, action: "Project created" },
        ...(p.history ?? []),
      ],
    },
    ...list,
  ]);
  return id;
}

export function updateProject(id, patch) {
  projectStore.set((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function deleteProject(id) {
  projectStore.set((list) => list.filter((p) => p.id !== id));
  taskStore.set((list) => list.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
}

export function addProjectMember(id, member) {
  projectStore.set((list) =>
    list.map((p) =>
      p.id === id && !p.members.some((m) => m.empId === member.empId)
        ? { ...p, members: [...p.members, member] }
        : p,
    ),
  );
}

export function removeProjectMember(id, empId) {
  projectStore.set((list) =>
    list.map((p) =>
      p.id === id ? { ...p, members: p.members.filter((m) => m.empId !== empId) } : p,
    ),
  );
}

export const toggleProjectMilestone = (id, msId) =>
  projectStore.set((list) =>
    list.map((p) =>
      p.id === id
        ? {
            ...p,
            milestones: (p.milestones ?? []).map((m) =>
              m.id === msId ? { ...m, done: !m.done } : m,
            ),
          }
        : p,
    ),
  );

/** Tasks under a project are ordinary tasks — created through the shared task store. */
export function addProjectTask(t) {
  return addTask(t);
}
export const updateProjectTask = (id, patch) => updateTask(id, patch);
export const deleteProjectTask = (id) => deleteTask(id);
export const postTaskUpdate = postUpdate;
export const approveTaskUpdate = approveUpdate;
export const rejectTaskUpdate = rejectUpdate;
export const pendingUpdateOf = pendingOf;

/** Live progress of a project = average of its tasks' progress (falls back to the stored figure). */
export function projectProgress(p, tasks = taskStore.get()) {
  const mine = tasks.filter((t) => t.projectId === p.id);
  if (!mine.length) return p.progress;
  return Math.round(mine.reduce((s, t) => s + t.progress, 0) / mine.length);
}

export const projectStatusClass = (s) =>
  s === "Completed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Active"
      ? "border-gold/40 bg-gold/15 text-gold"
      : s === "On Hold"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

export const projectPriorityClass = (p) =>
  p === "Critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : p === "High"
      ? "border-gold/40 bg-gold/15 text-gold"
      : p === "Medium"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border bg-muted text-muted-foreground";

export const taskStatusClass = (s) =>
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

// Evaluated per call, not once at module load: a long-running SSR process would otherwise keep yesterday's date
// and render different "overdue" markup than the client.
export const isOverdue = (task) => task.status !== "Completed" && task.dueDate < nowIso();

export const taskDueClass = (task) => {
  const overdue = isOverdue(task);
  if (overdue) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (task.status === "Completed") return "border-primary/30 bg-primary/10 text-primary";
  if (task.status === "In Progress") return "border-gold/40 bg-gold/15 text-gold";
  return "border-border bg-muted text-muted-foreground";
};
