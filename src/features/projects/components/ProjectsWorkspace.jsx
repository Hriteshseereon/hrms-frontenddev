import { useMemo, useState } from "react";
import {
  FolderKanban,
  Plus,
  Users,
  ListTodo,
  Clock3,
  CheckCircle2,
  AlarmClock,
  Download,
  FileText,
  MessageSquareText,
  Milestone,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useProjects,
  useProjectTasks,
  deleteProject,
  projectProgress,
  approveTaskUpdate,
  rejectTaskUpdate,
  pendingUpdateOf,
  projectStatusClass,
  projectPriorityClass,
  taskStatusClass,
  approvalClass,
  taskDueClass,
  isOverdue,
  PROJECT_STATUSES,
} from "@/features/projects/data/project-data";
import { TASK_STATUSES, canDecideTaskUpdate } from "@/features/projects/data/task-data";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { Kpi, nameOf } from "@/features/projects/components/project-shared";
import {
  NewProjectForm,
  EditProjectForm,
  ProjectDetail,
} from "@/features/projects/components/ProjectPieces";
import { TaskForm, TaskEditForm, TaskDetail } from "@/features/projects/components/TaskPieces";

export function ProjectsWorkspace({ scopeEmployeeId, canManage = false, scopeManagerId, team }) {
  const me = useCurrentUser();
  const allProjects = useProjects();
  const allTasks = useProjectTasks();

  const scopeId = scopeEmployeeId ?? scopeManagerId;
  const projects = useMemo(
    () =>
      scopeId
        ? allProjects.filter(
            (p) => p.members.some((m) => m.empId === scopeId) || p.managerId === scopeId,
          )
        : allProjects,
    [allProjects, scopeId],
  );
  const tasks = useMemo(() => {
    if (scopeEmployeeId) return allTasks.filter((t) => t.assignees.includes(scopeEmployeeId));
    if (scopeManagerId) {
      const mine = new Set(
        allProjects.filter((p) => p.managerId === scopeManagerId).map((p) => p.id),
      );
      return allTasks.filter(
        (t) =>
          (t.projectId && mine.has(t.projectId)) ||
          t.createdById === scopeManagerId ||
          t.concernedManagerId === scopeManagerId ||
          t.assignees.some((a) => a === scopeManagerId || team?.includes(a)),
      );
    }
    return allTasks;
  }, [allTasks, allProjects, scopeEmployeeId, scopeManagerId, team]);

  const [tab, setTab] = useState("projects");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskFor, setNewTaskFor] = useState(false); // false = closed, null = misc, string = project id
  const [projectDetailId, setProjectDetailId] = useState(null);
  const [editProjectId, setEditProjectId] = useState(null);
  const [taskDetailId, setTaskDetailId] = useState(null);
  const [editTaskId, setEditTaskId] = useState(null);

  const [projectQ, setProjectQ] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskProjectFilter, setTaskProjectFilter] = useState("all");
  const [taskQ, setTaskQ] = useState("");

  // A line manager runs only the projects they manage — being a member does not let them edit or delete it.
  const canManageProject = (p) =>
    canManage && !!p && (me.role !== "Manager" || p.managerId === me.id);
  // Line managers assign within their own reporting line (same rule as the Tasks module).
  const assignable = scopeManagerId ? [scopeManagerId, ...(team ?? [])] : undefined;
  const projectDetail = allProjects.find((p) => p.id === projectDetailId) ?? null;
  const editProject = allProjects.find((p) => p.id === editProjectId) ?? null;
  const taskDetail = allTasks.find((t) => t.id === taskDetailId) ?? null;
  const editTask = allTasks.find((t) => t.id === editTaskId) ?? null;

  const shownProjects = projects.filter(
    (p) =>
      (projectStatusFilter === "all" || p.status === projectStatusFilter) &&
      (!projectQ ||
        `${p.name} ${p.code} ${p.client} ${p.manager} ${p.department ?? ""} ${(p.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(projectQ.toLowerCase())),
  );

  const filteredTasks = tasks.filter(
    (t) =>
      (taskStatusFilter === "all" || t.status === taskStatusFilter) &&
      (taskProjectFilter === "all" ||
        (taskProjectFilter === "misc"
          ? t.projectId === null
          : t.projectId === taskProjectFilter)) &&
      (!taskQ ||
        `${t.id} ${t.name} ${t.description} ${t.assignees.map(nameOf).join(" ")} ${t.concernedManager ?? ""}`
          .toLowerCase()
          .includes(taskQ.toLowerCase())),
  );

  const pendingUpdates = tasks.filter((t) => t.approval === "Pending");

  const taskKpi = {
    total: tasks.length,
    active: tasks.filter((t) => t.status === "In Progress").length,
    done: tasks.filter((t) => t.status === "Completed").length,
    overdue: tasks.filter(isOverdue).length,
  };

  const projectKpi = {
    total: projects.length,
    active: projects.filter((p) => p.status === "Active").length,
    completed: projects.filter((p) => p.status === "Completed").length,
    milestones: projects.reduce(
      (s, p) => s + (p.milestones ?? []).filter((m) => !m.done).length,
      0,
    ),
  };

  const projectLabel = (t) =>
    t.projectId
      ? (allProjects.find((p) => p.id === t.projectId)?.name ?? t.projectId)
      : "Miscellaneous";
  const taskColumns = [
    "Task",
    "Name",
    "Project",
    "Assignees",
    "Team task",
    "Concerned manager",
    "Priority",
    "Start",
    "Due",
    "Est. delivery",
    "Est. hrs",
    "Logged hrs",
    "Progress %",
    "Status",
    "Approval",
  ];
  const taskReportRows = filteredTasks.map((t) => [
    t.id,
    t.name,
    projectLabel(t),
    t.assignees.map(nameOf).join(", "),
    t.teamTask ? "Yes" : "No",
    t.concernedManager ?? "—",
    t.priority,
    t.startDate,
    t.dueDate,
    t.deadline.replace("T", " "),
    t.estimatedHours,
    t.loggedHours,
    Math.round(t.progress),
    t.status,
    t.approval,
  ]);

  const projectColumns = [
    "Project",
    "Code",
    "Name",
    "Client",
    "Type",
    "Manager",
    "Department",
    "Phase",
    "Start",
    "End",
    "Priority",
    "Status",
    "Tasks",
    "Progress %",
    "Budget",
  ];
  const projectReportRows = shownProjects.map((p) => [
    p.id,
    p.code,
    p.name,
    p.client,
    p.type ?? "—",
    p.manager,
    p.department ?? "—",
    p.phase ?? "—",
    p.startDate,
    p.endDate,
    p.priority,
    p.status,
    allTasks.filter((t) => t.projectId === p.id).length,
    projectProgress(p, allTasks),
    p.budget ? `${p.currency ?? "INR"} ${p.budget.toLocaleString("en-IN")}` : "—",
  ]);

  function downloadTasksPdf() {
    const ok = exportReportPdf({
      title: "Projects & Assignments — Task Register",
      subtitle: scopeEmployeeId
        ? `Tasks assigned to ${nameOf(scopeEmployeeId)}`
        : "All project and miscellaneous tasks",
      filters: [
        { label: "Status", value: taskStatusFilter === "all" ? "All statuses" : taskStatusFilter },
        {
          label: "Project",
          value:
            taskProjectFilter === "all"
              ? "All projects"
              : taskProjectFilter === "misc"
                ? "Miscellaneous"
                : (allProjects.find((p) => p.id === taskProjectFilter)?.name ?? taskProjectFilter),
        },
      ],
      summary: [
        { label: "Total", value: String(taskKpi.total) },
        { label: "In progress", value: String(taskKpi.active) },
        { label: "Completed", value: String(taskKpi.done) },
        { label: "Overdue", value: String(taskKpi.overdue) },
      ],
      columns: taskColumns,
      rows: taskReportRows,
    });
    if (ok) toast.success("Task register PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }
  function downloadProjectsPdf() {
    const ok = exportReportPdf({
      title: "Projects & Assignments — Project Register",
      subtitle: scopeEmployeeId
        ? `Projects ${nameOf(scopeEmployeeId)} is part of`
        : "All projects with owner, phase, timeline and progress",
      filters: [
        {
          label: "Status",
          value: projectStatusFilter === "all" ? "All statuses" : projectStatusFilter,
        },
      ],
      summary: [
        { label: "Projects", value: String(projectKpi.total) },
        { label: "Active", value: String(projectKpi.active) },
        { label: "Completed", value: String(projectKpi.completed) },
        { label: "Open milestones", value: String(projectKpi.milestones) },
      ],
      columns: projectColumns,
      rows: projectReportRows,
    });
    if (ok) toast.success("Project register PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <ScrollTabsList>
        <TabsTrigger value="projects">
          <FolderKanban className="h-4 w-4" /> Projects
        </TabsTrigger>
        <TabsTrigger value="tasks">
          <ListTodo className="h-4 w-4" /> Tasks
        </TabsTrigger>
        <TabsTrigger value="updates">
          <MessageSquareText className="h-4 w-4" /> Updates{" "}
          {pendingUpdates.length > 0 && (
            <Badge variant="outline" className="ml-1">
              {pendingUpdates.length}
            </Badge>
          )}
        </TabsTrigger>
      </ScrollTabsList>

      <TabsContent value="projects" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Total Projects" value={String(projectKpi.total)} icon={FolderKanban} />
          <Kpi label="Active" value={String(projectKpi.active)} icon={Clock3} />
          <Kpi label="Completed" value={String(projectKpi.completed)} icon={CheckCircle2} />
          <Kpi label="Open milestones" value={String(projectKpi.milestones)} icon={Milestone} />
        </div>

        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Input
              value={projectQ}
              onChange={(e) => setProjectQ(e.target.value)}
              placeholder="Search projects, client, manager…"
              className="h-9 w-full sm:w-64"
            />
            <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {shownProjects.length} of {projects.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportCsv("projects", projectColumns, projectReportRows);
                  toast.success("CSV exported");
                }}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={downloadProjectsPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald shadow-premium text-white"
                  onClick={() => setNewProjectOpen(true)}
                >
                  <Plus className="h-4 w-4" /> New Project
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shownProjects.map((p) => {
            const pTasks = allTasks.filter((t) => t.projectId === p.id);
            const live = projectProgress(p, allTasks);
            const openMs = (p.milestones ?? []).filter((m) => !m.done);
            return (
              <Card
                key={p.id}
                className="shadow-card hover:shadow-premium cursor-pointer transition"
                onClick={() => setProjectDetailId(p.id)}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {p.code} · {p.client}
                        {p.type ? ` · ${p.type}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className={projectStatusClass(p.status)}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{p.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={projectPriorityClass(p.priority)}>
                      {p.priority}
                    </Badge>
                    {p.phase && <Badge variant="outline">{p.phase}</Badge>}
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" />
                      {p.members.length}
                    </Badge>
                    <Badge variant="outline">
                      <ListTodo className="mr-1 h-3 w-3" />
                      {pTasks.filter((t) => t.status === "Completed").length}/{pTasks.length}
                    </Badge>
                    {openMs.length > 0 && (
                      <Badge variant="outline" className="border-gold/60 text-gold">
                        <Milestone className="mr-1 h-3 w-3" />
                        {openMs[0].title} · {openMs[0].due}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {p.manager} · <span className="whitespace-nowrap">{p.startDate}</span> →{" "}
                    <span className="whitespace-nowrap">{p.endDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={live} className="h-2 flex-1" />
                    <span className="text-xs font-semibold">{live}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {shownProjects.length === 0 && (
            <div className="text-muted-foreground col-span-full py-10 text-center text-sm">
              No projects to show.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="tasks" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Total Tasks" value={String(taskKpi.total)} icon={ListTodo} />
          <Kpi label="In Progress" value={String(taskKpi.active)} icon={Clock3} />
          <Kpi label="Completed" value={String(taskKpi.done)} icon={CheckCircle2} />
          <Kpi label="Overdue" value={String(taskKpi.overdue)} icon={AlarmClock} />
        </div>

        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Input
              value={taskQ}
              onChange={(e) => setTaskQ(e.target.value)}
              placeholder="Search tasks…"
              className="h-9 w-full sm:w-52"
            />
            <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={taskProjectFilter} onValueChange={setTaskProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="misc">Miscellaneous</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {filteredTasks.length} of {tasks.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportCsv("project-tasks", taskColumns, taskReportRows);
                  toast.success("CSV exported");
                }}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={downloadTasksPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald shadow-premium text-white"
                  onClick={() =>
                    setNewTaskFor(
                      taskProjectFilter === "all" || taskProjectFilter === "misc"
                        ? null
                        : taskProjectFilter,
                    )
                  }
                >
                  <Plus className="h-4 w-4" /> New Task
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Task</th>
                  <th className="p-3 text-left">Project</th>
                  <th className="p-3 text-left">Assignees</th>
                  <th className="p-3 text-left">Priority</th>
                  <th className="p-3 text-left">Due / Est. delivery</th>
                  <th className="p-3 text-left">Est. / Logged</th>
                  <th className="p-3 text-left">Progress</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setTaskDetailId(t.id)}
                    className="hover:bg-muted/30 cursor-pointer transition"
                  >
                    <td className="max-w-[280px] p-3">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {t.name}
                        {t.teamTask && <Users className="text-primary h-3.5 w-3.5" />}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {t.id} · {t.description}
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3 text-xs">{projectLabel(t)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {t.assignees.slice(0, 3).map((a) => (
                          <Badge key={a} variant="outline" className="text-[10px]">
                            {nameOf(a)}
                          </Badge>
                        ))}
                        {t.assignees.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{t.assignees.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={projectPriorityClass(t.priority)}>
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className={taskDueClass(t)}>
                        <span className="whitespace-nowrap">{t.dueDate}</span>
                        {isOverdue(t) ? " · delayed" : ""}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t.deadline.replace("T", " ")}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {t.estimatedHours} h /{" "}
                      <span className="text-muted-foreground">{t.loggedHours} h</span>
                    </td>
                    <td className="min-w-[140px] p-3">
                      <div className="flex items-center gap-2">
                        <Progress value={t.progress} className="h-2 flex-1" />
                        <span className="text-xs font-semibold">{t.progress}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={taskStatusClass(t.status)}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={approvalClass(t.approval)}>
                        {t.approval}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted-foreground p-8 text-center text-sm">
                      No tasks match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="updates" className="space-y-4">
        {pendingUpdates.length === 0 && tasks.every((t) => t.updates.length === 0) && (
          <div className="text-muted-foreground py-10 text-center text-sm">
            No task updates yet.
          </div>
        )}
        {tasks
          .filter((t) => t.updates.length > 0)
          .map((t) => {
            const project = allProjects.find((p) => p.id === t.projectId);
            if (canManage && canDecideTaskUpdate(t, me.id, me.name))
              return (
                <PendingUpdateRow
                  key={t.id}
                  task={t}
                  project={project}
                  by={me.name}
                  byId={me.id}
                  onOpen={() => setTaskDetailId(t.id)}
                />
              );
            const latest = pendingUpdateOf(t) ?? t.updates[0];
            return (
              <Card
                key={t.id}
                className="shadow-card hover:bg-muted/20 cursor-pointer"
                onClick={() => setTaskDetailId(t.id)}
              >
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {t.id} · {project ? project.name : "Miscellaneous"}
                      </div>
                    </div>
                    <Badge variant="outline" className={approvalClass(t.approval)}>
                      {t.approval}
                    </Badge>
                  </div>
                  {latest && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">
                        {latest.at} · {latest.by}
                      </div>
                      <div>{latest.note}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </TabsContent>

      {/* New project (detailed, with inline tasks) */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          {newProjectOpen && (
            <NewProjectForm
              onDone={(id) => {
                setNewProjectOpen(false);
                if (id) setProjectDetailId(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Project detail */}
      <Dialog open={!!projectDetail} onOpenChange={(o) => !o && setProjectDetailId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {projectDetail && (
            <ProjectDetail
              project={projectDetail}
              canManage={canManageProject(projectDetail)}
              onOpenTask={(t) => setTaskDetailId(t.id)}
              onAddTask={() => setNewTaskFor(projectDetail.id)}
              onEdit={() => setEditProjectId(projectDetail.id)}
              onDelete={() => {
                if (
                  !window.confirm(
                    `Delete ${projectDetail.code} — ${projectDetail.name}? Its tasks stay as miscellaneous tasks.`,
                  )
                )
                  return;
                deleteProject(projectDetail.id);
                toast.success("Project deleted — its tasks are now miscellaneous");
                setProjectDetailId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProject} onOpenChange={(o) => !o && setEditProjectId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {editProject && canManageProject(editProject) && (
            <EditProjectForm project={editProject} onDone={() => setEditProjectId(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* New task (project locked when opened from a project) */}
      <Dialog open={newTaskFor !== false} onOpenChange={(o) => !o && setNewTaskFor(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {newTaskFor !== false && (
            <TaskForm
              projectId={newTaskFor}
              restrictAssignees={assignable}
              lockProject={typeof newTaskFor === "string"}
              onDone={() => setNewTaskFor(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTaskId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {editTask && <TaskEditForm task={editTask} onDone={() => setEditTaskId(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!taskDetail} onOpenChange={(o) => !o && setTaskDetailId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {taskDetail && (
            <>
              <TaskDetail
                task={taskDetail}
                mode={scopeEmployeeId || !canManage ? "self" : "manage"}
              />
              {canManage && !scopeEmployeeId && (
                <div className="-mt-2 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditTaskId(taskDetail.id)}>
                    Edit task details
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function PendingUpdateRow({ task, project, by, byId, onOpen }) {
  const [reason, setReason] = useState("");
  const latest = pendingUpdateOf(task);
  return (
    <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="cursor-pointer" onClick={onOpen}>
          <div className="text-sm font-semibold">{task.name}</div>
          <div className="text-muted-foreground text-xs">
            {task.id} · {project ? project.name : "Miscellaneous"} ·{" "}
            {task.assignees.map(nameOf).join(", ")}
          </div>
        </div>
        <Badge variant="outline" className={approvalClass(task.approval)}>
          {task.approval}
        </Badge>
      </div>
      {latest && (
        <div className="text-sm">
          <div className="text-muted-foreground">
            {latest.at} · {latest.by}
          </div>
          <div>{latest.note}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            {latest.hours !== undefined && <Badge variant="outline">{latest.hours} h</Badge>}
            {latest.progress !== undefined && <Badge variant="outline">{latest.progress}%</Badge>}
            {latest.status && <Badge variant="outline">{latest.status}</Badge>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Input
          placeholder="Rejection reason (required to reject)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          className="bg-gradient-emerald text-white"
          onClick={() => {
            if (approveTaskUpdate(task.id, by, byId)) toast.success("Update approved");
            else toast.error("No pending update to approve");
          }}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={!reason.trim()}
          onClick={() => {
            if (rejectTaskUpdate(task.id, by, reason.trim(), byId)) {
              setReason("");
              toast.success("Update rejected");
            }
          }}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
