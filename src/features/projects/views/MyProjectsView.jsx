import { FolderKanban } from "lucide-react";
import { ProjectsWorkspace } from "@/features/projects/components/ProjectsWorkspace";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";

function EmpProjects() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FolderKanban className="text-primary h-6 w-6" /> Projects & Assignments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Projects you're part of and tasks assigned to you. Post updates for manager approval.
        </p>
      </div>
      <ProjectsWorkspace scopeEmployeeId={me.id} canManage={false} />
    </div>
  );
}

export default EmpProjects;
