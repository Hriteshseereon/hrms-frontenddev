import { ListTodo } from "lucide-react";
import { TaskBoard } from "@/features/projects/components/TaskBoard";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useManagerMap } from "@/features/organization/data/manager-data";

function TasksPage() {
  const me = useCurrentUser();
  const managers = useManagerMap();
  // Line managers see (and approve) their own reporting line only; HOD / HR / CXO / Admin see the whole register.
  const isLineManager = me.role === "Manager";
  const team = isLineManager
    ? [me.id, ...Object.keys(managers).filter((id) => managers[id] === me.id)]
    : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ListTodo className="text-primary h-6 w-6" /> Task Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Detailed tasks — what, why, who (individual or team), concerned project / manager /
          person, timeline, estimated delivery, deliverables and checklist. Tasks linked to a
          project also show in Projects & Assignments.
        </p>
      </div>
      <TaskBoard scopeManagerId={isLineManager ? me.id : undefined} restrictAssignees={team} />
    </div>
  );
}

export default TasksPage;
