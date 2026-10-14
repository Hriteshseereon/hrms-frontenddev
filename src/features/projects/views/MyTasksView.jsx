import { ListTodo } from "lucide-react";
import { TaskBoard } from "@/features/projects/components/TaskBoard";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";

function EmpTasks() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ListTodo className="text-primary h-6 w-6" /> My Tasks
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tasks assigned to you. Update status, log hours and post progress notes.
        </p>
      </div>
      <TaskBoard scopeEmployeeId={me.id} canCreate={false} />
    </div>
  );
}

export default EmpTasks;
