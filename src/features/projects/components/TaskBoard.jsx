import { useMemo, useState } from "react";
import {
  Plus,
  Paperclip,
  Clock3,
  AlarmClock,
  CheckCircle2,
  ListTodo,
  Download,
  FileText,
  Users,
  FolderKanban,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useTasks,
  priorityClass,
  statusToneClass,
  dueDateClass,
  isDelayed,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/projects/data/task-data";
import { useProjects } from "@/features/projects/data/project-data";
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { TaskForm, TaskDetail, nameOf } from "@/features/projects/components/TaskPieces";

function Kpi({ label, value, icon: Icon }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Task register — one store shared with Projects & Assignments, My Team and the employee portal.
 * `scopeEmployeeId` limits the list to one person's tasks (employee portal), `restrictAssignees` limits who a
 * task can be assigned to (My Team → direct reports only).
 */
export function TaskBoard({
  scopeEmployeeId,
  title = "Task Management",
  canCreate = true,
  restrictAssignees,
  mode,
  scopeManagerId,
}) {
  const me = useCurrentUser();
  const all = useTasks();
  const projects = useProjects();
  // Creating / assigning tasks is a manager-level action (same gate the Projects workspace applies).
  const mayCreate = canCreate && can(me.role, "task.assign");
  const tasks = useMemo(() => {
    if (scopeEmployeeId) return all.filter((t) => t.assignees.includes(scopeEmployeeId));
    // A line manager works their own reporting line: tasks they created / are concerned on, or assigned to their team.
    if (scopeManagerId)
      return all.filter(
        (t) =>
          t.createdById === scopeManagerId ||
          t.concernedManagerId === scopeManagerId ||
          t.assignees.some((a) => a === scopeManagerId || restrictAssignees?.includes(a)),
      );
    if (restrictAssignees)
      return all.filter((t) => t.assignees.some((a) => restrictAssignees.includes(a)));
    return all;
  }, [all, scopeEmployeeId, restrictAssignees, scopeManagerId]);

  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [project, setProject] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const rows = tasks.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (priority === "all" || t.priority === priority) &&
      (project === "all" || (project === "none" ? !t.projectId : t.projectId === project)) &&
      (!q ||
        `${t.id} ${t.name} ${t.description} ${t.assignees.map(nameOf).join(" ")} ${t.concernedManager ?? ""} ${t.client ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  const kpi = {
    total: tasks.length,
    active: tasks.filter((t) => t.status === "In Progress").length,
    done: tasks.filter((t) => t.status === "Completed").length,
    overdue: tasks.filter(isDelayed).length,
    pending: tasks.filter((t) => t.approval === "Pending").length,
  };
  const projectLabel = (t) => {
    const p = projects.find((x) => x.id === t.projectId);
    return p ? `${p.code} · ${p.name}` : "Miscellaneous";
  };

  const columns = [
    "Task",
    "Name",
    "Project",
    "Assignees",
    "Team task",
    "Concerned manager",
    "Priority",
    "Start",
    "End",
    "Due",
    "Est. delivery",
    "Est. hrs",
    "Logged hrs",
    "Progress %",
    "Status",
  ];
  const reportRows = rows.map((t) => [
    t.id,
    t.name,
    projectLabel(t),
    t.assignees.map(nameOf).join(", "),
    t.teamTask ? "Yes" : "No",
    t.concernedManager ?? "—",
    t.priority,
    t.startDate,
    t.endDate,
    t.dueDate,
    t.deadline.replace("T", " "),
    t.estimatedHours,
    t.loggedHours,
    Math.round(t.progress),
    t.status,
  ]);

  function downloadPdf() {
    const ok = exportReportPdf({
      title: `${title} — Register`,
      subtitle: scopeEmployeeId
        ? `Tasks assigned to ${nameOf(scopeEmployeeId)}`
        : "All assigned tasks with effort and progress",
      filters: [
        { label: "Status", value: status === "all" ? "All statuses" : status },
        { label: "Priority", value: priority === "all" ? "All priorities" : priority },
        {
          label: "Project",
          value:
            project === "all"
              ? "All projects"
              : project === "none"
                ? "Miscellaneous"
                : (projects.find((p) => p.id === project)?.name ?? project),
        },
      ],
      summary: [
        { label: "Total", value: String(kpi.total) },
        { label: "In progress", value: String(kpi.active) },
        { label: "Completed", value: String(kpi.done) },
        { label: "Overdue", value: String(kpi.overdue) },
      ],
      columns,
      rows: reportRows,
    });
    if (ok) toast.success("Task register PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total Tasks" value={String(kpi.total)} icon={ListTodo} />
        <Kpi label="In Progress" value={String(kpi.active)} icon={Clock3} />
        <Kpi label="Completed" value={String(kpi.done)} icon={CheckCircle2} />
        <Kpi
          label={
            (mode ?? (scopeEmployeeId ? "self" : "manage")) === "self"
              ? "Overdue"
              : `Overdue · ${kpi.pending} updates to approve`
          }
          value={String(kpi.overdue)}
          icon={AlarmClock}
        />
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, people, client…"
            className="h-9 w-full sm:w-56"
          />
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="none">Miscellaneous only</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
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
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {rows.length} of {tasks.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportCsv("tasks", columns, reportRows);
                toast.success("CSV exported");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            {mayCreate && (
              <Button
                size="sm"
                className="bg-gradient-emerald shadow-premium text-white"
                onClick={() => setOpen(true)}
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
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setDetail(t)}
                  className="hover:bg-muted/30 cursor-pointer transition"
                >
                  <td className="max-w-[300px] p-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {t.name}
                      {(t.attachment || (t.attachments?.length ?? 0) > 0) && (
                        <Paperclip className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                      {t.teamTask && <Users className="text-primary h-3.5 w-3.5" />}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {t.id} · {t.description}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <FolderKanban className="text-muted-foreground h-3.5 w-3.5" />
                      {projectLabel(t)}
                    </span>
                  </td>
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
                    <Badge variant="outline" className={priorityClass(t.priority)}>
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className={dueDateClass(t)}>
                      <span className="whitespace-nowrap">{t.dueDate}</span>
                      {isDelayed(t) ? " · delayed" : ""}
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
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="outline" className={statusToneClass(t)}>
                        {t.status}
                      </Badge>
                      {t.approval === "Pending" && (
                        <Badge variant="outline" className="border-gold/60 text-gold text-[10px]">
                          Update pending
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center text-sm">
                    No tasks match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          {open && <TaskForm restrictAssignees={restrictAssignees} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detail && (
            <TaskDetail
              task={all.find((t) => t.id === detail.id) ?? detail}
              mode={mode ?? (scopeEmployeeId ? "self" : "manage")}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
