// Detailed project form (with tasks created inline under the project) and the project detail popup.
// Tasks created here go to the shared task store, so they appear in the Tasks tab, the Tasks module and each
// assignee's portal. Projects and tasks are correlated but independent — a task can also live without a project.
import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Link2,
  Users,
  Flag,
  FolderKanban,
  FileDown,
  ListTodo,
  CheckCircle2,
  Pencil,
  UserPlus,
  XCircle,
  Milestone,
  IndianRupee,
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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { cn, safeUrl } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory, findEmployee } from "@/features/employees/data/employee-directory";
import { useDepartments } from "@/features/organization/data/dept-data";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { exportReportPdf } from "@/lib/export-utils";
import { inr } from "@/lib/store";
import {
  BILLING_TYPES,
  PROJECT_PHASES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  addProject,
  addProjectMember,
  removeProjectMember,
  toggleProjectMilestone,
  updateProject,
  projectProgress,
  isProjectCodeTaken,
  projectPriorityClass,
  projectStatusClass,
} from "@/features/projects/data/project-data";
import {
  useTasks,
  statusToneClass,
  priorityClass,
  todayIso,
} from "@/features/projects/data/task-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import {
  TaskFields,
  blankTaskDraft,
  taskDraftValid,
  createTaskFromDraft,
  nameOf,
  isWebUrl,
} from "@/features/projects/components/TaskPieces";

const uid = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const today = todayIso;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * @typedef {Object} ProjectDraft
 * @property {string} name
 * @property {string} code
 * @property {string} client
 * @property {string} clientContact
 * @property {string} clientEmail
 * @property {string} description
 * @property {(typeof PROJECT_TYPES)[number]} type
 * @property {string} purpose
 * @property {string} objectives
 * @property {string} scope
 * @property {string} deliverables
 * @property {string} department
 * @property {string} branch
 * @property {string} managerId
 * @property {string} sponsorId
 * @property {ProjectPriority} priority
 * @property {ProjectStatus} status
 * @property {(typeof PROJECT_PHASES)[number]} phase
 * @property {string} startDate
 * @property {string} endDate
 * @property {(typeof BILLING_TYPES)[number]} billingType
 * @property {string} budget
 * @property {string} currency
 * @property {string} costCentre
 * @property {string} poNumber
 * @property {ProjectMember[]} members
 * @property {ProjectMilestone[]} milestones
 * @property {string} risks
 * @property {ProjectLink[]} links
 * @property {string[]} attachments
 * @property {string} tags
 */
const blank = () => ({
  name: "",
  code: "",
  client: "",
  clientContact: "",
  clientEmail: "",
  description: "",
  type: "Client engagement",
  purpose: "",
  objectives: "",
  scope: "",
  deliverables: "",
  department: "",
  branch: "",
  managerId: "",
  sponsorId: "",
  priority: "Medium",
  status: "Planning",
  phase: "Initiation",
  startDate: today(),
  endDate: "",
  billingType: "Fixed price",
  budget: "",
  currency: "INR",
  costCentre: "",
  poNumber: "",
  members: [],
  milestones: [],
  risks: "",
  links: [],
  attachments: [],
  tags: "",
});

/**
 * Inline task rows inside the project form — each is a full TaskDraft (collapsed to a summary once valid).
 * @typedef {Object} InlineTask
 * @property {string} key
 * @property {boolean} open
 * @property {TaskDraft} d
 */

export function NewProjectForm({ onDone }) {
  const me = useCurrentUser();
  const directory = useDirectory();
  const departments = useDepartments();
  const [d, setD] = useState(blank());
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const [tasks, setTasks] = useState([]);
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const memberIds = useMemo(
    () => [d.managerId, ...d.members.map((m) => m.empId)].filter(Boolean),
    [d.managerId, d.members],
  );
  const codeTaken = !!d.code.trim() && isProjectCodeTaken(d.code);
  const emailBad = !!d.clientEmail.trim() && !EMAIL_RE.test(d.clientEmail.trim());
  const budgetBad = d.budget !== "" && !(Number(d.budget) >= 0);
  const valid = !!(
    d.name.trim() &&
    d.code.trim() &&
    !codeTaken &&
    !emailBad &&
    !budgetBad &&
    d.client.trim() &&
    d.managerId &&
    d.startDate &&
    d.endDate &&
    d.endDate >= d.startDate
  );
  const invalidTasks = tasks.filter((t) => !taskDraftValid(t.d)).length;

  const setTask = (key, patch) =>
    setTasks((list) => list.map((t) => (t.key === key ? { ...t, d: { ...t.d, ...patch } } : t)));
  const addInlineTask = () =>
    setTasks((list) => [
      ...list.map((t) => ({ ...t, open: false })),
      {
        key: uid("T"),
        open: true,
        d: {
          ...blankTaskDraft("__new__"),
          client: d.client,
          startDate: d.startDate || today(),
          concernedManagerId: d.managerId,
        },
      },
    ]);

  function submit() {
    if (!valid) return;
    const manager = findEmployee(d.managerId);
    const sponsor = d.sponsorId ? findEmployee(d.sponsorId) : undefined;
    const id = addProject({
      name: d.name.trim(),
      code: d.code.trim().toUpperCase(),
      client: d.client.trim(),
      clientContact: d.clientContact.trim() || undefined,
      clientEmail: d.clientEmail.trim() || undefined,
      description: d.description.trim(),
      type: d.type,
      purpose: d.purpose.trim() || undefined,
      objectives: d.objectives.trim() || undefined,
      scope: d.scope.trim() || undefined,
      deliverables: d.deliverables.trim() || undefined,
      department: d.department || undefined,
      branch: d.branch || undefined,
      manager: manager?.name ?? d.managerId,
      managerId: d.managerId,
      sponsorId: d.sponsorId || undefined,
      sponsor: sponsor?.name,
      startDate: d.startDate,
      endDate: d.endDate,
      priority: d.priority,
      status: d.status,
      phase: d.phase,
      billingType: d.billingType,
      budget: Number(d.budget) || undefined,
      currency: d.currency,
      costCentre: d.costCentre.trim() || undefined,
      poNumber: d.poNumber.trim() || undefined,
      members: d.members,
      milestones: d.milestones,
      risks: d.risks.trim() || undefined,
      links: d.links,
      attachments: d.attachments,
      tags: d.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      createdBy: me.name,
    });
    // Tasks under the project — same store as the Tasks module.
    const created = tasks
      .filter((t) => taskDraftValid(t.d))
      .map((t) => createTaskFromDraft({ ...t.d, projectId: id }, me));
    // Notify manager + members.
    [d.managerId, ...d.members.map((m) => m.empId)]
      .filter((x, i, a) => x && x !== me.id && a.indexOf(x) === i)
      .forEach((empId) =>
        pushAlert({
          empId,
          kind: "general",
          to: "/emp/projects",
          title: `Added to project ${d.code.trim().toUpperCase()} — ${d.name.trim()}`,
          body: `${d.client.trim()} · ${d.startDate} → ${d.endDate} · ${created.length} task(s) created${empId === d.managerId ? " · you are the project manager" : ""}.`,
        }),
      );
    toast.success(`${id} created${created.length ? ` with ${created.length} task(s)` : ""}`);
    onDone(id);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderKanban className="text-primary h-5 w-5" /> Create project
        </DialogTitle>
        <DialogDescription>
          Engagement details, purpose & scope, people, commercials, milestones and the first set of
          tasks — tasks added here appear in the Tasks tab, the Tasks module and each assignee's
          portal.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <SectionTitle n={1} title="Project" sub="What the project is and who it is for" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project name" required className="sm:col-span-2 lg:col-span-3">
            <Input
              value={d.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Odisha Power — Smart Metering Analytics"
            />
          </Field>
          <Field
            label="Project code"
            required
            hint={codeTaken ? "This code is already used by another project" : "Short unique code"}
          >
            <Input
              value={d.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              placeholder="OPT-SMA"
              className={codeTaken ? "border-destructive" : ""}
            />
          </Field>
          <Field label="Project type">
            <Select
              value={d.type}
              onValueChange={(v) =>
                set({
                  type: v,
                  billingType:
                    v === "Internal product" || v === "R&D / POC" || v === "Infrastructure"
                      ? "Non-billable (internal)"
                      : d.billingType,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client / beneficiary" required>
            <Input
              value={d.client}
              onChange={(e) => set({ client: e.target.value })}
              placeholder="Client name or 'Internal'"
            />
          </Field>
          <Field label="Client contact">
            <Input
              value={d.clientContact}
              onChange={(e) => set({ clientContact: e.target.value })}
              placeholder="Name, designation"
            />
          </Field>
          <Field label="Client email" hint={emailBad ? "Enter a valid e-mail address" : undefined}>
            <Input
              type="email"
              value={d.clientEmail}
              onChange={(e) => set({ clientEmail: e.target.value })}
              placeholder="contact@client.com"
              className={emailBad ? "border-destructive" : ""}
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2 lg:col-span-4">
            <Textarea
              rows={2}
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="One or two lines that appear on the project card"
            />
          </Field>
        </div>

        <SectionTitle n={2} title="Purpose, objectives & scope" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Purpose" hint="Why this project exists — the business need">
            <Textarea
              rows={3}
              value={d.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            />
          </Field>
          <Field label="Objectives / success criteria" hint="Measurable outcomes">
            <Textarea
              rows={3}
              value={d.objectives}
              onChange={(e) => set({ objectives: e.target.value })}
            />
          </Field>
          <Field label="Scope (in / out)">
            <Textarea
              rows={3}
              value={d.scope}
              onChange={(e) => set({ scope: e.target.value })}
              placeholder="In scope: … Out of scope: …"
            />
          </Field>
          <Field label="Deliverables">
            <Textarea
              rows={3}
              value={d.deliverables}
              onChange={(e) => set({ deliverables: e.target.value })}
              placeholder="What is handed over — modules, documents, environments"
            />
          </Field>
          <Field label="Risks & assumptions" className="sm:col-span-2">
            <Textarea rows={2} value={d.risks} onChange={(e) => set({ risks: e.target.value })} />
          </Field>
        </div>

        <SectionTitle
          n={3}
          title="People & ownership"
          sub="Manager, sponsor, department, branch and team members"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project manager" required className="sm:col-span-1 lg:col-span-2">
            <EmployeePicker value={d.managerId} onChange={(id) => set({ managerId: id })} />
          </Field>
          <Field label="Sponsor / accountable executive" className="sm:col-span-1 lg:col-span-2">
            <EmployeePicker value={d.sponsorId} onChange={(id) => set({ sponsorId: id })} />
          </Field>
          <Field label="Department">
            <Select
              value={d.department || "none"}
              onValueChange={(v) =>
                set({
                  department: v === "none" ? "" : v,
                  costCentre:
                    d.costCentre || departments.find((x) => x.name === v)?.costCentre || "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {departments.map((x) => (
                  <SelectItem key={x.id} value={x.name}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Branch / location">
            <Select
              value={d.branch || "none"}
              onValueChange={(v) => set({ branch: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {ALL_MANAGED_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={`${b.office} · ${b.name}`}>
                    {b.office} · {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={d.priority} onValueChange={(v) => set({ priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={d.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="border-border space-y-2 rounded-lg border p-3">
          <Label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> Team members (the manager is added automatically)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {d.members.map((m) => (
              <Badge key={m.empId} variant="outline" className="gap-1 font-normal">
                {m.name} · {m.role}
                <button
                  type="button"
                  onClick={() => set({ members: d.members.filter((x) => x.empId !== m.empId) })}
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {d.members.length === 0 && (
              <span className="text-muted-foreground text-xs">No members yet.</span>
            )}
          </div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Employee">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {directory
                    .filter((e) => e.id !== d.managerId && !d.members.some((m) => m.empId === e.id))
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} · {e.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role on project">
              <Input
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder="e.g. Backend Lead"
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!memberId}
              onClick={() => {
                const e = findEmployee(memberId);
                if (!e) return;
                set({
                  members: [
                    ...d.members,
                    { empId: e.id, name: e.name, role: memberRole.trim() || e.role },
                  ],
                });
                setMemberId("");
                setMemberRole("");
              }}
            >
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <SectionTitle n={4} title="Timeline, phase & commercials" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Start date" required>
            <Input
              type="date"
              value={d.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Planned end date" required>
            <Input
              type="date"
              value={d.endDate}
              min={d.startDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </Field>
          <Field label="Current phase">
            <Select value={d.phase} onValueChange={(v) => set({ phase: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_PHASES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Billing type">
            <Select value={d.billingType} onValueChange={(v) => set({ billingType: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Budget / contract value">
            <Input
              type="number"
              min={0}
              value={d.budget}
              onChange={(e) => set({ budget: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="Currency">
            <Select value={d.currency} onValueChange={(v) => set({ currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["INR", "USD", "EUR", "GBP", "AED", "SAR"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cost centre">
            <Input
              value={d.costCentre}
              onChange={(e) => set({ costCentre: e.target.value })}
              placeholder="CC-1001"
            />
          </Field>
          <Field label="PO / contract reference">
            <Input
              value={d.poNumber}
              onChange={(e) => set({ poNumber: e.target.value })}
              placeholder="PO-2026-…"
            />
          </Field>
        </div>
        <div className="border-border space-y-2 rounded-lg border p-3">
          <Label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Milestone className="h-3.5 w-3.5" /> Milestones
          </Label>
          {d.milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <Flag className="text-primary h-3.5 w-3.5" />
              <span className="flex-1">{m.title}</span>
              <span className="text-muted-foreground text-xs">{m.due}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => set({ milestones: d.milestones.filter((x) => x.id !== m.id) })}
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Milestone">
              <Input
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                placeholder="e.g. UAT sign-off"
              />
            </Field>
            <Field label="Due">
              <Input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!msTitle.trim() || !msDue}
              onClick={() => {
                set({
                  milestones: [
                    ...d.milestones,
                    { id: uid("MS"), title: msTitle.trim(), due: msDue, done: false },
                  ],
                });
                setMsTitle("");
                setMsDue("");
              }}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <SectionTitle n={5} title="Links, documents & tags" />
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Link label">
            <Input
              className="w-full sm:w-44"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="SOW / repo / board"
            />
          </Field>
          <Field label="URL">
            <Input
              className="w-72 max-w-full"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AttachmentsInput
            value={d.attachments}
            onChange={(v) => set({ attachments: v })}
            label="Documents"
            hint="SOW, proposal, contract, architecture"
          />
          <Field label="Tags" hint="comma separated">
            <Input
              value={d.tags}
              onChange={(e) => set({ tags: e.target.value })}
              placeholder="fintech, cloud, migration"
            />
          </Field>
        </div>

        <SectionTitle
          n={6}
          title="Tasks under this project"
          sub="Optional — create the first tasks now; each one is a full task with assignees, timeline and estimated delivery"
        />
        <div className="space-y-3">
          {tasks.map((t, i) => (
            <div
              key={t.key}
              className={cn(
                "space-y-3 rounded-xl border p-3",
                taskDraftValid(t.d) ? "border-primary/40" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  Task {i + 1}
                </Badge>
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t.d.name || <span className="text-muted-foreground">Untitled task</span>}
                </div>
                {t.d.assignees.length > 0 && (
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    {t.d.assignees.map(nameOf).join(", ")}
                    {t.d.dueDate ? ` · due ${t.d.dueDate}` : ""}
                  </span>
                )}
                {taskDraftValid(t.d) ? (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gold/60 text-gold">
                    Incomplete
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setTasks((list) =>
                      list.map((x) => (x.key === t.key ? { ...x, open: !x.open } : x)),
                    )
                  }
                >
                  <Pencil className="h-4 w-4" /> {t.open ? "Collapse" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setTasks((list) => list.filter((x) => x.key !== t.key))}
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
              </div>
              {t.open && (
                <TaskFields
                  d={t.d}
                  set={(patch) => setTask(t.key, patch)}
                  lockProject
                  compact
                  restrictAssignees={memberIds.length ? memberIds : undefined}
                />
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addInlineTask}>
              <Plus className="h-4 w-4" /> Add task under this project
            </Button>
            <span className="text-muted-foreground text-xs">
              {memberIds.length
                ? "Assignees are limited to the project manager and members added above."
                : "Add a manager / members first to assign tasks."}
            </span>
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        {invalidTasks > 0 && (
          <span className="text-gold self-center text-xs">
            {invalidTasks} task(s) incomplete — they will be skipped
          </span>
        )}
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!valid}
          onClick={submit}
        >
          Create project
          {tasks.filter((t) => taskDraftValid(t.d)).length
            ? ` & ${tasks.filter((t) => taskDraftValid(t.d)).length} task(s)`
            : ""}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ---------------- Edit ---------------- */
export function EditProjectForm({ project, onDone }) {
  const me = useCurrentUser();
  const [f, setF] = useState({ ...project });
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const codeTaken = !!f.code.trim() && isProjectCodeTaken(f.code, project.id);
  const emailBad = !!f.clientEmail?.trim() && !EMAIL_RE.test(f.clientEmail.trim());
  const valid = !!(
    f.name.trim() &&
    f.code.trim() &&
    !codeTaken &&
    !emailBad &&
    f.client.trim() &&
    f.startDate &&
    f.endDate &&
    f.endDate >= f.startDate
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit project</DialogTitle>
        <DialogDescription>
          {project.id} · {project.code}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Project name" className="sm:col-span-2 lg:col-span-3">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Code">
          <Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Client" className="sm:col-span-2">
          <Input value={f.client} onChange={(e) => set({ client: e.target.value })} />
        </Field>
        <Field label="Client contact">
          <Input
            value={f.clientContact ?? ""}
            onChange={(e) => set({ clientContact: e.target.value })}
          />
        </Field>
        <Field label="Client email">
          <Input
            value={f.clientEmail ?? ""}
            onChange={(e) => set({ clientEmail: e.target.value })}
          />
        </Field>
        <Field label="Description" className="sm:col-span-2 lg:col-span-4">
          <Textarea
            rows={2}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <Field label="Purpose" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={f.purpose ?? ""}
            onChange={(e) => set({ purpose: e.target.value })}
          />
        </Field>
        <Field label="Objectives" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={f.objectives ?? ""}
            onChange={(e) => set({ objectives: e.target.value })}
          />
        </Field>
        <Field label="Scope" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={f.scope ?? ""}
            onChange={(e) => set({ scope: e.target.value })}
          />
        </Field>
        <Field label="Deliverables" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={f.deliverables ?? ""}
            onChange={(e) => set({ deliverables: e.target.value })}
          />
        </Field>
        <Field label="Risks & assumptions" className="sm:col-span-2 lg:col-span-4">
          <Textarea
            rows={2}
            value={f.risks ?? ""}
            onChange={(e) => set({ risks: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <Select value={f.type ?? "Client engagement"} onValueChange={(v) => set({ type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onValueChange={(v) => set({ priority: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Phase">
          <Select value={f.phase ?? "Initiation"} onValueChange={(v) => set({ phase: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_PHASES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={f.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={f.endDate}
            min={f.startDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </Field>
        <Field label="Billing type">
          <Select
            value={f.billingType ?? "Fixed price"}
            onValueChange={(v) => set({ billingType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Budget (${f.currency ?? "INR"})`}>
          <Input
            type="number"
            min={0}
            value={f.budget ?? ""}
            onChange={(e) => set({ budget: Number(e.target.value) || undefined })}
          />
        </Field>
        <Field label="Cost centre">
          <Input value={f.costCentre ?? ""} onChange={(e) => set({ costCentre: e.target.value })} />
        </Field>
        <Field label="PO / contract">
          <Input value={f.poNumber ?? ""} onChange={(e) => set({ poNumber: e.target.value })} />
        </Field>
        <Field
          label="Progress override (%)"
          hint="Live progress is the average of task progress when tasks exist"
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={f.progress}
            onChange={(e) =>
              set({ progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
          />
        </Field>
        <Field label="Tags">
          <Input
            value={(f.tags ?? []).join(", ")}
            onChange={(e) =>
              set({
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      </div>
      <DialogFooter>
        {!valid && (
          <span className="text-destructive self-center text-xs">
            {codeTaken
              ? "Project code is already in use."
              : emailBad
                ? "Client e-mail is not valid."
                : "Name, code, client and a valid date range are required."}
          </span>
        )}
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!valid}
          onClick={() => {
            const { id, ...rest } = f;
            updateProject(id, {
              ...rest,
              history: [
                { at: today(), by: me.name, action: "Project details updated" },
                ...(project.history ?? []),
              ],
            });
            toast.success("Project updated");
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
export function ProjectDetail({ project, canManage, onOpenTask, onEdit, onDelete, onAddTask }) {
  const tasks = useTasks().filter((t) => t.projectId === project.id);
  const directory = useDirectory();
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");
  const live = projectProgress(project, tasks);
  const done = tasks.filter((t) => t.status === "Completed").length;
  const overdue = tasks.filter((t) => t.status !== "Completed" && t.dueDate < today()).length;
  const hours = tasks.reduce(
    (a, t) => ({ est: a.est + t.estimatedHours, log: a.log + t.loggedHours }),
    { est: 0, log: 0 },
  );

  const pdf = () =>
    exportReportPdf({
      title: `Project ${project.code} — ${project.name}`,
      subtitle: `${project.client} · ${project.status} · ${project.priority} · ${project.startDate} → ${project.endDate}`,
      summary: [
        { label: "Progress", value: `${live}%` },
        { label: "Tasks", value: `${done}/${tasks.length} done` },
        { label: "Effort", value: `${hours.log}/${hours.est} h` },
        {
          label: "Budget",
          value: project.budget
            ? `${project.currency ?? "INR"} ${project.budget.toLocaleString("en-IN")}`
            : "—",
        },
      ],
      columns: [
        "Task",
        "Name",
        "Assignees",
        "Priority",
        "Due",
        "Est. delivery",
        "Progress",
        "Status",
      ],
      rows: tasks.map((t) => [
        t.id,
        t.name,
        t.assignees.map(nameOf).join(", "),
        t.priority,
        t.dueDate,
        t.deadline.replace("T", " "),
        `${t.progress}%`,
        t.status,
      ]),
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderKanban className="text-primary h-5 w-5" /> {project.name}
        </DialogTitle>
        <DialogDescription>
          {project.id} · {project.code} · {project.client}
          {project.type ? ` · ${project.type}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={projectStatusClass(project.status)}>
            {project.status}
          </Badge>
          <Badge variant="outline" className={projectPriorityClass(project.priority)}>
            {project.priority}
          </Badge>
          {project.phase && <Badge variant="outline">Phase: {project.phase}</Badge>}
          {project.billingType && <Badge variant="outline">{project.billingType}</Badge>}
          {(project.tags ?? []).map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              #{t}
            </Badge>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            {canManage && onAddTask && (
              <Button size="sm" className="bg-gradient-emerald text-white" onClick={onAddTask}>
                <Plus className="h-4 w-4" /> Add task
              </Button>
            )}
            {canManage && onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={pdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{project.description}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Progress", `${live}%`],
            ["Tasks", `${done} / ${tasks.length} done${overdue ? ` · ${overdue} overdue` : ""}`],
            ["Effort", `${hours.log} / ${hours.est} h`],
            ["Timeline", `${project.startDate} → ${project.endDate}`],
          ].map(([k, v]) => (
            <div key={k} className="border-border rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
              <div className="mt-0.5 text-sm font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <Progress value={live} />

        <Tabs defaultValue="overview">
          <ScrollTabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">
              <ListTodo className="h-4 w-4" /> Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4" /> Team ({project.members.length})
            </TabsTrigger>
            <TabsTrigger value="milestones">
              <Milestone className="h-4 w-4" /> Milestones
            </TabsTrigger>
            <TabsTrigger value="commercials">
              <IndianRupee className="h-4 w-4" /> Commercials
            </TabsTrigger>
          </ScrollTabsList>
          <TabsContent value="overview" className="space-y-3 pt-3">
            <KV
              items={[
                ["Purpose", project.purpose ?? "—"],
                ["Objectives", project.objectives ?? "—"],
                ["Scope", project.scope ?? "—"],
                ["Deliverables", project.deliverables ?? "—"],
                ["Risks & assumptions", project.risks ?? "—"],
              ]}
              cols={1}
            />
            <KV
              items={[
                ["Manager", project.manager],
                ["Sponsor", project.sponsor ?? "—"],
                ["Department", project.department ?? "—"],
                ["Branch", project.branch ?? "—"],
                [
                  "Client contact",
                  project.clientContact
                    ? `${project.clientContact}${project.clientEmail ? ` · ${project.clientEmail}` : ""}`
                    : "—",
                ],
                [
                  "Created",
                  project.createdOn ? `${project.createdOn} by ${project.createdBy ?? "—"}` : "—",
                ],
              ]}
            />
            {((project.links?.length ?? 0) > 0 || (project.attachments?.length ?? 0) > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {(project.links ?? []).map((l) => (
                  <a
                    key={l.url}
                    href={safeUrl(l.url) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Badge variant="outline" className="text-primary gap-1 font-normal">
                      <Link2 className="h-3 w-3" />
                      {l.label}
                    </Badge>
                  </a>
                ))}
                {(project.attachments ?? []).map((a) => (
                  <Badge key={a} variant="outline" className="font-normal">
                    {a}
                  </Badge>
                ))}
              </div>
            )}
            {(project.history?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  History
                </div>
                {(project.history ?? []).map((h, i) => (
                  <div key={i} className="text-muted-foreground text-xs">
                    {h.at} · {h.by} · {h.action}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="tasks" className="space-y-2 pt-3">
            {tasks.length === 0 && (
              <div className="text-muted-foreground text-sm">
                No tasks yet.{canManage ? " Use “Add task” to create one under this project." : ""}
              </div>
            )}
            {tasks.map((t) => (
              <div
                key={t.id}
                className="border-border hover:bg-muted/30 flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border p-3"
                onClick={() => onOpenTask(t)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {t.name}{" "}
                    <span className="text-muted-foreground text-xs font-normal">· {t.id}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t.assignees.map(nameOf).join(", ")} · due{" "}
                    <span className="whitespace-nowrap">{t.dueDate}</span>
                    {t.teamTask ? " · team task" : ""}
                  </div>
                </div>
                <div className="flex w-40 items-center gap-2">
                  <Progress value={t.progress} className="h-1.5 flex-1" />
                  <span className="text-xs font-semibold">{t.progress}%</span>
                </div>
                <Badge variant="outline" className={priorityClass(t.priority)}>
                  {t.priority}
                </Badge>
                <Badge variant="outline" className={statusToneClass(t)}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="team" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {project.members.map((m) => (
                <div
                  key={m.empId}
                  className="border-border flex items-center justify-between rounded-lg border p-2.5"
                >
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {m.role} · {tasks.filter((t) => t.assignees.includes(m.empId)).length} task(s)
                    </div>
                  </div>
                  {canManage && m.empId !== project.managerId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        removeProjectMember(project.id, m.empId);
                        toast.success("Member removed");
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <div className="border-border grid grid-cols-1 items-end gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Add member">
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {directory
                        .filter((e) => !project.members.some((m) => m.empId === e.id))
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} · {e.role}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Role">
                  <Input
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    placeholder="e.g. QA Engineer"
                  />
                </Field>
                <Button
                  size="sm"
                  disabled={!memberId}
                  onClick={() => {
                    const e = findEmployee(memberId);
                    if (!e) return;
                    addProjectMember(project.id, {
                      empId: e.id,
                      name: e.name,
                      role: memberRole.trim() || e.role,
                    });
                    pushAlert({
                      empId: e.id,
                      kind: "general",
                      to: "/emp/projects",
                      title: `Added to project ${project.code}`,
                      body: `${project.name} · role: ${memberRole.trim() || e.role}.`,
                    });
                    setMemberId("");
                    setMemberRole("");
                    toast.success("Member added");
                  }}
                >
                  <UserPlus className="h-4 w-4" /> Add
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="milestones" className="space-y-2 pt-3">
            {(project.milestones ?? []).length === 0 && (
              <div className="text-muted-foreground text-sm">No milestones recorded.</div>
            )}
            {(project.milestones ?? []).map((m) => (
              <label
                key={m.id}
                className="border-border flex items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                <Checkbox
                  checked={m.done}
                  disabled={!canManage}
                  onCheckedChange={() => toggleProjectMilestone(project.id, m.id)}
                />
                <span className={cn("flex-1", m.done && "text-muted-foreground line-through")}>
                  {m.title}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    !m.done && m.due < today() ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {m.due}
                </span>
              </label>
            ))}
            {canManage && (
              <div className="border-border grid grid-cols-1 items-end gap-2 border-t pt-3 sm:grid-cols-[1fr_auto_auto]">
                <Field label="Milestone">
                  <Input
                    value={msTitle}
                    onChange={(e) => setMsTitle(e.target.value)}
                    placeholder="e.g. Go-live"
                  />
                </Field>
                <Field label="Due">
                  <Input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} />
                </Field>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!msTitle.trim() || !msDue}
                  onClick={() => {
                    updateProject(project.id, {
                      milestones: [
                        ...(project.milestones ?? []),
                        { id: uid("MS"), title: msTitle.trim(), due: msDue, done: false },
                      ],
                    });
                    setMsTitle("");
                    setMsDue("");
                    toast.success("Milestone added");
                  }}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="commercials" className="pt-3">
            <KV
              items={[
                ["Billing type", project.billingType ?? "—"],
                [
                  "Budget / contract value",
                  project.budget
                    ? project.currency && project.currency !== "INR"
                      ? `${project.currency} ${project.budget.toLocaleString("en-IN")}`
                      : inr(project.budget)
                    : "—",
                ],
                ["Cost centre", project.costCentre ?? "—"],
                ["PO / contract", project.poNumber ?? "—"],
                [
                  "Billable effort logged",
                  `${tasks.filter((t) => t.billable !== false).reduce((s, t) => s + t.loggedHours, 0)} h`,
                ],
                [
                  "Non-billable effort",
                  `${tasks.filter((t) => t.billable === false).reduce((s, t) => s + t.loggedHours, 0)} h`,
                ],
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
      {canManage && onDelete && (
        <DialogFooter>
          <Button variant="outline" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete project
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
