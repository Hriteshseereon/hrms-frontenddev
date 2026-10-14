import { FolderKanban } from "lucide-react";
import { ProjectsWorkspace } from "@/features/projects/components/ProjectsWorkspace";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useManagerMap } from "@/features/organization/data/manager-data";

const MANAGE_ROLES = new Set([
  "SuperAdmin",
  "Admin",
  "CEO",
  "COO",
  "CFO",
  "CTO",
  "CHRO",
  "HR",
  "HOD",
  "Manager",
]);

function ProjectsPage() {
  const me = useCurrentUser();
  const canManage = MANAGE_ROLES.has(me.role);
  const managers = useManagerMap();
  // A line manager sees the projects they run / belong to and their reporting line's tasks — not every project in the org.
  const isLineManager = me.role === "Manager";
  const team = isLineManager
    ? Object.keys(managers).filter((id) => managers[id] === me.id)
    : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FolderKanban className="text-primary h-6 w-6" /> Projects & Assignments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Detailed project set-up (purpose, scope, people, commercials, milestones) with tasks
          created under the project — every task also appears in the Tasks module and on the
          assignee's portal.
        </p>
      </div>
      <ProjectsWorkspace
        canManage={canManage}
        scopeManagerId={isLineManager ? me.id : undefined}
        team={team}
      />
    </div>
  );
}

export default ProjectsPage;
