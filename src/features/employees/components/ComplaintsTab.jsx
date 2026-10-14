import { GrievanceWorkspace } from "@/features/exit/components/GrievanceWorkspace";

/** People → Complaints: the same Grievance Redressal workspace (single source of truth), embedded. */
export function ComplaintsTab() {
  return <GrievanceWorkspace embedded />;
}
