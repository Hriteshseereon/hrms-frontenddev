// Shared detailed task form + detail popup — used by the Tasks module, Projects & Assignments (tasks under a
// project and inline while creating a project), My Team and the employee portal. Every task lands in the one
// task store, so a task created here shows up everywhere.
import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Link2,
  Paperclip,
  Users,
  ListChecks,
  CheckCircle2,
  XCircle,
  FileDown,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, safeUrl } from "@/lib/utils";
import { canOpenPath, useCurrentUser, userById } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { useManagerMap } from "@/features/organization/data/manager-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { exportReportPdf } from "@/lib/export-utils";
import { useProjects, projectStore } from "@/features/projects/data/project-data";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_PURPOSES,
  TASK_STATUSES,
  addTask,
  addTaskUpdate,
  approvalClass,
  approveTaskUpdate,
  canDecideTaskUpdate,
  isDelayed,
  pendingUpdateOf,
  postTaskUpdate,
  priorityClass,
  rejectTaskUpdate,
  statusToneClass,
  todayIso,
  toggleChecklist,
  updateTask,
} from "@/features/projects/data/task-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
  useScopedEmployees,
} from "@/features/employees/components/CasePieces";

const uid = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
export const nameOf = (id) => findEmployee(id)?.name ?? id;
/** Only web links — a free-text URL rendered as <a href> must not be a javascript: / data: URI. */
export const isWebUrl = (u) => /^https?:\/\/[^\s]+$/i.test(u.trim());

/**
 * Everything the form captures — the same shape is used for inline tasks inside the project form.
 * @typedef {Object} TaskDraft
 * @property {string} name
 * @property {string} description
 * @property {string} details
 * @property {string} purpose
 * @property {string} category
 * @property {string | null} projectId
 * @property {string[]} assignees
 * @property {boolean} teamTask
 * @property {string} teamName
 * @property {string} concernedManagerId
 * @property {string} concernedPersonId
 * @property {string} client
 * @property {TaskPriority} priority
 * @property {string} estimatedHours
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} dueDate
 * @property {string} deadline
 * @property {string} deliverables
 * @property {string} acceptanceCriteria
 * @property {TaskChecklistItem[]} checklist
 * @property {TaskLink[]} links
 * @property {string[]} attachments
 * @property {string} tags
 * @property {boolean} billable
 */
export const blankTaskDraft = (projectId = null) => ({
  name: "",
  description: "",
  details: "",
  purpose: "Client deliverable",
  category: "Development",
  projectId,
  assignees: [],
  teamTask: false,
  teamName: "",
  concernedManagerId: "",
  concernedPersonId: "",
  client: "",
  priority: "Medium",
  estimatedHours: "8",
  startDate: "",
  endDate: "",
  dueDate: "",
  deadline: "",
  deliverables: "",
  acceptanceCriteria: "",
  checklist: [],
  links: [],
  attachments: [],
  tags: "",
  billable: true,
});
export const taskDraftValid = (d) =>
  !!(
    d.name.trim() &&
    d.assignees.length > 0 &&
    d.dueDate &&
    d.startDate &&
    d.dueDate >= d.startDate
  );

export function draftToInput(d, by) {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    details: d.details.trim() || undefined,
    purpose: d.purpose,
    category: d.category,
    projectId: d.projectId,
    assignees: d.assignees,
    teamTask: d.teamTask,
    teamName: d.teamTask ? d.teamName.trim() || undefined : undefined,
    concernedManagerId: d.concernedManagerId || undefined,
    concernedManager: d.concernedManagerId ? nameOf(d.concernedManagerId) : undefined,
    concernedPersonId: d.concernedPersonId || undefined,
    concernedPerson: d.concernedPersonId ? nameOf(d.concernedPersonId) : undefined,
    client: d.client.trim() || undefined,
    priority: d.priority,
    estimatedHours: Number(d.estimatedHours) || 0,
    startDate: d.startDate,
    endDate: d.endDate || d.dueDate,
    dueDate: d.dueDate,
    deadline: d.deadline || `${d.dueDate}T18:00`,
    deliverables: d.deliverables.trim() || undefined,
    acceptanceCriteria: d.acceptanceCriteria.trim() || undefined,
    checklist: d.checklist.filter((c) => c.title.trim()),
    links: d.links,
    attachments: d.attachments,
    attachment: d.attachments[0],
    tags: d.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    billable: d.billable,
    createdBy: by.name,
    createdById: by.id,
  };
}

/** Create the task in the store and notify assignees + concerned persons. */
export function createTaskFromDraft(d, by) {
  const id = addTask(draftToInput(d, by));
  const proj = d.projectId ? getProjectsSnapshot().find((p) => p.id === d.projectId) : undefined;
  d.assignees.forEach((empId) =>
    pushAlert({
      empId,
      kind: "general",
      to: "/emp/tasks",
      title: `New task assigned — ${d.name.trim()}`,
      body: `${proj ? `${proj.name} · ` : ""}due ${d.dueDate}${d.deadline ? ` ${d.deadline.slice(11)}` : ""} · ${d.priority} priority · assigned by ${by.name}.`,
    }),
  );
  [d.concernedManagerId, d.concernedPersonId]
    .filter((x) => x && x !== by.id && !d.assignees.includes(x))
    .forEach((empId) =>
      pushAlert({
        empId,
        kind: "general",
        to: taskLinkFor(empId, d.projectId),
        title: `You are concerned on task ${id}`,
        body: `${d.name.trim()} · ${d.assignees.map(nameOf).join(", ")} · due ${d.dueDate}.`,
      }),
    );
  return id;
}
const getProjectsSnapshot = () => projectStore.get();
/** Task screen a person can actually open — /org/tasks for org roles that have it, else their own portal list. */
export const taskLinkFor = (empId, projectId) => {
  const role = userById(empId)?.role ?? "Employee";
  if (projectId && canOpenPath(role, "/org/projects")) return "/org/projects";
  return canOpenPath(role, "/org/tasks") ? "/org/tasks" : "/emp/tasks";
};

/* ---------------- Form fields (embeddable) ---------------- */
export function TaskFields({ d, set, lockProject, restrictAssignees, compact }) {
  // Only people in the working scope (company / branch) — never another company's employees.
  const directory = useScopedEmployees();
  const projects = useProjects();
  const managerMap = useManagerMap();
  const people = restrictAssignees
    ? directory.filter((e) => restrictAssignees.includes(e.id))
    : directory;
  const [q, setQ] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const shown = useMemo(
    () =>
      people
        .filter(
          (e) =>
            !q || `${e.name} ${e.id} ${e.dept} ${e.role}`.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 60),
    [people, q],
  );
  const project = projects.find((p) => p.id === d.projectId);
  // Default the concerned manager to the project manager or the first assignee's reporting manager.
  const suggestedManager =
    project?.managerId ?? (d.assignees[0] ? managerMap[d.assignees[0]] : undefined);
  const toggleAssignee = (id, on) =>
    set({ assignees: on ? [...d.assignees, id] : d.assignees.filter((x) => x !== id) });

  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="What is the task" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Task name" required className="sm:col-span-2">
          <Input
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Build account-balance reconciliation service"
          />
        </Field>
        <Field label="Short description" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={d.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="One or two lines — what needs to be done"
          />
        </Field>
        <Field
          label="Details"
          className="sm:col-span-2"
          hint="Scope, approach, references — everything the assignee needs"
        >
          <Textarea
            rows={compact ? 2 : 4}
            value={d.details}
            onChange={(e) => set({ details: e.target.value })}
          />
        </Field>
        <Field label="Purpose" required>
          <Select value={d.purpose} onValueChange={(v) => set({ purpose: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={d.category} onValueChange={(v) => set({ category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Concerned project"
          hint={
            lockProject
              ? "Fixed — this task belongs to this project"
              : "Leave as Miscellaneous for stand-alone work"
          }
        >
          {lockProject ? (
            <Input
              value={project ? `${project.code} · ${project.name}` : "This project (being created)"}
              disabled
            />
          ) : (
            <Select
              value={d.projectId ?? "none"}
              onValueChange={(v) =>
                set({
                  projectId: v === "none" ? null : v,
                  client:
                    v === "none"
                      ? d.client
                      : (projects.find((p) => p.id === v)?.client ?? d.client),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Miscellaneous (no project)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Client">
          <Input
            value={d.client}
            onChange={(e) => set({ client: e.target.value })}
            placeholder={project?.client ?? "Internal"}
          />
        </Field>
        <Field label="Priority">
          <Select value={d.priority} onValueChange={(v) => set({ priority: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tags" hint="comma separated">
          <Input
            value={d.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="backend, uat, client"
          />
        </Field>
      </div>

      <SectionTitle
        n={2}
        title="Who"
        sub="Assignees, whether it is a team task, and the people concerned"
      />
      <div className="space-y-2">
        <Label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5" /> Assign to (one or many) *
        </Label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter people…"
          className="h-8"
        />
        <div className="border-border grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <label
              key={e.id}
              className="flex min-h-9 min-w-0 items-center gap-2 text-sm sm:min-h-0"
            >
              <Checkbox
                checked={d.assignees.includes(e.id)}
                onCheckedChange={(v) => toggleAssignee(e.id, !!v)}
              />
              <span className="min-w-0 truncate">
                {e.name} <span className="text-muted-foreground text-xs">· {e.role}</span>
              </span>
            </label>
          ))}
          {shown.length === 0 && (
            <div className="text-muted-foreground p-2 text-xs">No one matches.</div>
          )}
        </div>
        <div className="text-muted-foreground text-xs">
          {d.assignees.length
            ? `${d.assignees.length} selected: ${d.assignees.map(nameOf).join(", ")}`
            : "Nobody selected yet"}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="border-border flex items-center gap-2 rounded-lg border p-3 text-sm">
          <Checkbox checked={d.teamTask} onCheckedChange={(v) => set({ teamTask: !!v })} /> This is
          a team task (shared ownership, one progress)
        </label>
        <Field label="Team / squad name">
          <Input
            value={d.teamName}
            disabled={!d.teamTask}
            onChange={(e) => set({ teamName: e.target.value })}
            placeholder="e.g. Ledger squad"
          />
        </Field>
        <Field
          label="Concerned manager"
          hint={
            suggestedManager && !d.concernedManagerId
              ? `Suggested: ${nameOf(suggestedManager)}`
              : undefined
          }
        >
          <EmployeePicker
            value={d.concernedManagerId}
            onChange={(id) => set({ concernedManagerId: id })}
          />
        </Field>
        <Field label="Concerned person (reviewer / client-side owner / SME)">
          <EmployeePicker
            value={d.concernedPersonId}
            onChange={(id) => set({ concernedPersonId: id })}
          />
        </Field>
      </div>

      <SectionTitle n={3} title="Timeline & effort" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Start date" required>
          <Input
            type="date"
            value={d.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={d.endDate}
            min={d.startDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </Field>
        <Field label="Due date" required>
          <Input
            type="date"
            value={d.dueDate}
            min={d.startDate}
            onChange={(e) =>
              set({
                dueDate: e.target.value,
                deadline: d.deadline || (e.target.value ? `${e.target.value}T18:00` : ""),
              })
            }
          />
        </Field>
        <Field label="Est. delivery (date & time)">
          <Input
            type="datetime-local"
            value={d.deadline}
            onChange={(e) => set({ deadline: e.target.value })}
          />
        </Field>
        <Field label="Estimated hours">
          <Input
            type="number"
            step="0.5"
            min={0}
            value={d.estimatedHours}
            onChange={(e) => set({ estimatedHours: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Checkbox checked={d.billable} onCheckedChange={(v) => set({ billable: !!v })} /> Billable
        </label>
      </div>

      <SectionTitle n={4} title="Deliverables, checklist, links & documents" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Deliverables">
          <Textarea
            rows={2}
            value={d.deliverables}
            onChange={(e) => set({ deliverables: e.target.value })}
            placeholder="What is handed over when done"
          />
        </Field>
        <Field label="Acceptance criteria (definition of done)">
          <Textarea
            rows={2}
            value={d.acceptanceCriteria}
            onChange={(e) => set({ acceptanceCriteria: e.target.value })}
          />
        </Field>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground flex items-center gap-2 text-xs">
          <ListChecks className="h-3.5 w-3.5" /> Checklist / sub-tasks
        </Label>
        {d.checklist.map((c, i) => (
          <div key={c.id} className="flex gap-2">
            <Input
              value={c.title}
              onChange={(e) =>
                set({
                  checklist: d.checklist.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                })
              }
              placeholder="Sub-task"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => set({ checklist: d.checklist.filter((_, j) => j !== i) })}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            set({ checklist: [...d.checklist, { id: uid("CL"), title: "", done: false }] })
          }
        >
          <Plus className="h-4 w-4" /> Add sub-task
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Link label">
          <Input
            className="w-full sm:w-44"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Jira / design / doc"
          />
        </Field>
        <Field label="URL">
          <Input
            className="w-full sm:w-72"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isWebUrl(linkUrl) || d.links.some((l) => l.url === linkUrl.trim())}
          onClick={() => {
            set({
              links: [
                ...d.links,
                { label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() },
              ],
            });
            setLinkLabel("");
            setLinkUrl("");
          }}
        >
          <Link2 className="h-4 w-4" /> Add link
        </Button>
        {linkUrl.trim() && !isWebUrl(linkUrl) && (
          <span className="text-destructive text-xs">Enter a full http(s):// link</span>
        )}
        <div className="flex flex-wrap gap-1.5">
          {d.links.map((l) => (
            <Badge key={l.url} variant="outline" className="gap-1 font-normal">
              <Link2 className="h-3 w-3" />
              {l.label}
              <button
                type="button"
                onClick={() => set({ links: d.links.filter((x) => x.url !== l.url) })}
              >
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
      <AttachmentsInput
        value={d.attachments}
        onChange={(v) => set({ attachments: v })}
        label="Documents"
        hint="Specs, references, input files"
      />
    </div>
  );
}

/** Stand-alone create dialog body (wrap in <DialogContent>). */
export function TaskForm({ projectId, lockProject, restrictAssignees, presetAssignees, onDone }) {
  const me = useCurrentUser();
  const [d, setD] = useState({
    ...blankTaskDraft(projectId ?? null),
    assignees: presetAssignees ?? [],
    startDate: todayIso(),
  });
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  return (
    <>
      <DialogHeader>
        <DialogTitle>Create task</DialogTitle>
        <DialogDescription>
          What the task is, why, who owns it, the concerned manager / person, timeline and estimated
          delivery. It appears in Tasks, in the project's Tasks tab and on each assignee's portal.
        </DialogDescription>
      </DialogHeader>
      <TaskFields d={d} set={set} lockProject={lockProject} restrictAssignees={restrictAssignees} />
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!taskDraftValid(d)}
          onClick={() => {
            const id = createTaskFromDraft(d, me);
            toast.success(`${id} created and assigned to ${d.assignees.map(nameOf).join(", ")}`);
            onDone(id);
          }}
        >
          Create & assign
        </Button>
      </DialogFooter>
    </>
  );
}

/** Turn an existing task back into a draft so the same detailed fields can edit it. */
export function draftFromTask(t) {
  return {
    name: t.name,
    description: t.description,
    details: t.details ?? "",
    purpose: t.purpose ?? "Client deliverable",
    category: t.category ?? "Development",
    projectId: t.projectId,
    assignees: t.assignees,
    teamTask: !!t.teamTask,
    teamName: t.teamName ?? "",
    concernedManagerId: t.concernedManagerId ?? "",
    concernedPersonId: t.concernedPersonId ?? "",
    client: t.client ?? "",
    priority: t.priority,
    estimatedHours: String(t.estimatedHours),
    startDate: t.startDate,
    endDate: t.endDate,
    dueDate: t.dueDate,
    deadline: t.deadline,
    deliverables: t.deliverables ?? "",
    acceptanceCriteria: t.acceptanceCriteria ?? "",
    checklist: t.checklist ?? [],
    links: t.links ?? [],
    attachments: t.attachments ?? (t.attachment ? [t.attachment] : []),
    tags: (t.tags ?? []).join(", "),
    billable: t.billable !== false,
  };
}

/** Edit dialog body (wrap in <DialogContent>) — same fields as create. */
export function TaskEditForm({ task, onDone }) {
  const me = useCurrentUser();
  const [d, setD] = useState(draftFromTask(task));
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit task {task.id}</DialogTitle>
        <DialogDescription>
          Changes are visible immediately to the assignees and the concerned manager / person.
        </DialogDescription>
      </DialogHeader>
      <TaskFields d={d} set={set} />
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!taskDraftValid(d)}
          onClick={() => {
            const input = draftToInput(d, { id: task.createdById ?? me.id, name: task.createdBy });
            updateTask(task.id, {
              ...input,
              createdBy: task.createdBy,
              createdById: task.createdById,
            });
            addTaskUpdate(task.id, me.name, "Task details edited");
            toast.success("Task updated");
            onDone();
          }}
        >
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

/* ---------------- Detail ---------------- */
export function TaskDetail({ task, mode: requestedMode }) {
  const me = useCurrentUser();
  const managerMap = useManagerMap();
  const projects = useProjects();
  const project = projects.find((p) => p.id === task.projectId);
  const [note, setNote] = useState("");
  const [hours, setHours] = useState(String(task.loggedHours));
  const [progress, setProgress] = useState(String(task.progress));
  const [status, setStatus] = useState(task.status);
  const [reason, setReason] = useState("");
  const isAssignee = task.assignees.includes(me.id);
  // An assignee never manages their own task: they post progress for approval like everyone else (a Manager whose
  // own task shows on the Tasks board used to be able to save "Completed" directly or approve their own update).
  const mode = requestedMode === "manage" && isAssignee ? "self" : requestedMode;
  const pending = pendingUpdateOf(task);
  const mayDecide = mode === "manage" && canDecideTaskUpdate(task, me.id, me.name);
  // Whoever approves: the concerned manager, else the creator, else the poster's reporting manager — never the poster
  // themselves or another assignee of the task.
  const approverId = [
    task.concernedManagerId,
    task.createdById,
    managerMap[me.id] ?? userById(me.id)?.managerId,
  ].find((id) => id && id !== me.id && !task.assignees.includes(id));
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const hrs = Math.max(0, Number(hours) || 0);
  const pdf = () =>
    exportReportPdf({
      title: `Task ${task.id} — ${task.name}`,
      subtitle: `${project ? `${project.code} · ${project.name}` : "Miscellaneous"} · ${task.priority} · ${task.status} · due ${task.dueDate}`,
      columns: ["Item", "Detail"],
      rows: [
        ["Description", task.description],
        ["Details", task.details ?? "—"],
        ["Purpose / category", `${task.purpose ?? "—"} · ${task.category ?? "—"}`],
        ["Assignees", task.assignees.map(nameOf).join(", ")],
        ["Team task", task.teamTask ? `Yes${task.teamName ? ` — ${task.teamName}` : ""}` : "No"],
        ["Concerned manager", task.concernedManager ?? "—"],
        ["Concerned person", task.concernedPerson ?? "—"],
        [
          "Timeline",
          `${task.startDate} → ${task.endDate} · due ${task.dueDate} · delivery ${task.deadline.replace("T", " ")}`,
        ],
        ["Effort", `${task.loggedHours} / ${task.estimatedHours} h · ${task.progress} %`],
        ["Deliverables", task.deliverables ?? "—"],
        ["Acceptance criteria", task.acceptanceCriteria ?? "—"],
        [
          "Checklist",
          (task.checklist ?? []).map((c) => `${c.done ? "✓" : "○"} ${c.title}`).join("; ") || "—",
        ],
        ["Links", (task.links ?? []).map((l) => `${l.label}: ${l.url}`).join("; ") || "—"],
        ...task.updates.map((u) => [
          `Update ${u.at} · ${u.by}`,
          `${u.note}${u.hours !== undefined ? ` · ${u.hours} h` : ""}${u.progress !== undefined ? ` · ${u.progress} %` : ""}`,
        ]),
      ],
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardList className="text-primary h-5 w-5" /> {task.name}
        </DialogTitle>
        <DialogDescription>
          {task.id} · {project ? `${project.code} · ${project.name}` : "Miscellaneous task"} ·
          created by {task.createdBy}
          {task.createdOn ? ` on ${task.createdOn}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={priorityClass(task.priority)}>
            {task.priority}
          </Badge>
          <Badge variant="outline" className={statusToneClass(task)}>
            {task.status}
          </Badge>
          <Badge variant="outline" className={approvalClass(task.approval)}>
            Update: {task.approval}
          </Badge>
          {task.teamTask && (
            <Badge variant="outline">Team task{task.teamName ? ` · ${task.teamName}` : ""}</Badge>
          )}
          {task.purpose && <Badge variant="outline">{task.purpose}</Badge>}
          {task.category && <Badge variant="outline">{task.category}</Badge>}
          {task.billable === false && <Badge variant="outline">Non-billable</Badge>}
        </div>
        <p className="text-sm">{task.description}</p>
        {task.details && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
            {task.details}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Start", task.startDate],
            ["End", task.endDate],
            ["Due", task.dueDate],
            ["Est. delivery", task.deadline.replace("T", " ")],
          ].map(([k, v]) => (
            <div key={k} className="border-border rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
              <div
                className={cn(
                  "mt-0.5 font-medium",
                  k === "Due" && isDelayed(task) && "text-destructive",
                )}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Progress · {task.loggedHours} / {task.estimatedHours} h logged
            </span>
            <span className="font-semibold">{task.progress}%</span>
          </div>
          <Progress value={task.progress} />
        </div>
        <KV
          items={[
            ["Assignees", task.assignees.map(nameOf).join(", ")],
            ["Concerned manager", task.concernedManager ?? "—"],
            ["Concerned person", task.concernedPerson ?? "—"],
            ["Client", task.client ?? project?.client ?? "—"],
            ["Deliverables", task.deliverables ?? "—"],
            ["Acceptance criteria", task.acceptanceCriteria ?? "—"],
            ["Tags", (task.tags ?? []).join(", ") || "—"],
          ]}
        />
        {(task.checklist?.length ?? 0) > 0 && (
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Checklist
            </Label>
            {(task.checklist ?? []).map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={c.done}
                  disabled={!(isAssignee || mode === "manage")}
                  onCheckedChange={() => toggleChecklist(task.id, c.id)}
                />
                <span className={c.done ? "text-muted-foreground line-through" : ""}>
                  {c.title}
                </span>
              </label>
            ))}
          </div>
        )}
        {((task.links?.length ?? 0) > 0 ||
          (task.attachments?.length ?? 0) > 0 ||
          task.attachment) && (
          <div className="flex flex-wrap gap-1.5">
            {(task.links ?? []).map((l) => (
              <a key={l.url} href={safeUrl(l.url) ?? undefined} target="_blank" rel="noreferrer">
                <Badge variant="outline" className="text-primary gap-1 font-normal">
                  <Link2 className="h-3 w-3" />
                  {l.label}
                </Badge>
              </a>
            ))}
            {[
              ...new Set([
                ...(task.attachments ?? []),
                ...(task.attachment ? [task.attachment] : []),
              ]),
            ].map((a) => (
              <Badge key={a} variant="outline" className="gap-1 font-normal">
                <Paperclip className="h-3 w-3" />
                {a}
              </Badge>
            ))}
          </div>
        )}

        {(isAssignee || mode === "manage") && (
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {mode === "manage"
                ? "Update task"
                : "Post my progress (goes to the manager for approval)"}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Progress (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                />
              </Field>
              <Field label="Hours logged (total)">
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </Field>
            </div>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed on this task?"
            />
            <div className="flex flex-wrap justify-end gap-2">
              {mode === "manage" ? (
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    updateTask(task.id, {
                      status,
                      progress: status === "Completed" ? 100 : pct,
                      loggedHours: hrs,
                    });
                    if (note.trim()) addTaskUpdate(task.id, me.name, note.trim());
                    setNote("");
                    toast.success("Task updated");
                  }}
                >
                  Save
                </Button>
              ) : (
                <>
                  {!approverId && (
                    <span className="text-destructive self-center text-xs">
                      No approver — set a concerned manager or reporting manager first.
                    </span>
                  )}
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    disabled={!note.trim() || !approverId}
                    onClick={() => {
                      const p = status === "Completed" ? 100 : pct;
                      const st = status === "Not Started" && p > 0 ? "In Progress" : status;
                      postTaskUpdate(task.id, me.name, note.trim(), {
                        hours: hrs,
                        progress: p,
                        status: st,
                        byId: me.id,
                      });
                      pushAlert({
                        empId: approverId,
                        kind: "general",
                        to: taskLinkFor(approverId, task.projectId),
                        title: `Task update to approve — ${task.name}`,
                        body: `${me.name}: ${note.trim()} · ${p} % · ${hrs} h.`,
                      });
                      setNote("");
                      toast.success("Update posted — awaiting manager approval");
                    }}
                  >
                    Post update
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {mayDecide && (
          <div className="border-gold/40 bg-gold/5 space-y-2 rounded-xl border p-4">
            <div className="text-sm font-semibold">Pending update from {pending?.by ?? "—"}</div>
            <div className="text-sm">
              {pending?.note}{" "}
              <span className="text-muted-foreground text-xs">
                · {pending?.hours ?? "—"} h · {pending?.progress ?? "—"} % ·{" "}
                {pending?.status ?? "—"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 min-w-[200px] flex-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason if rejecting"
              />
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={!reason.trim()}
                onClick={() => {
                  if (rejectTaskUpdate(task.id, me.name, reason.trim(), me.id)) {
                    setReason("");
                    toast.success("Update rejected");
                  }
                }}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => {
                  if (approveTaskUpdate(task.id, me.name, me.id)) toast.success("Update approved");
                  else toast.error("No pending update to approve");
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        )}
        {task.updates.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Activity
            </div>
            {task.updates.map((u, i) => (
              <div key={i} className="border-border rounded-lg border p-2.5 text-sm">
                <div className="text-muted-foreground text-xs">
                  {u.at} · {u.by}
                  {u.hours !== undefined ? ` · ${u.hours} h` : ""}
                  {u.progress !== undefined ? ` · ${u.progress} %` : ""}
                  {u.status ? ` · ${u.status}` : ""}
                </div>
                <div>{u.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={pdf}>
          <FileDown className="h-4 w-4" /> Task PDF
        </Button>
      </DialogFooter>
    </>
  );
}
