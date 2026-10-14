import { FileText } from "lucide-react";
import { CrudSection } from "@/components/common/CrudSection";
import { STATUSES } from "@/features/recruitment/data/recruitment-data";

export function RoundsWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interview Rounds Master</h1>
        <p className="text-muted-foreground text-sm">
          The rounds a candidate goes through for each job.
        </p>
      </div>
      <CrudSection
        icon={FileText}
        title="Interview Rounds"
        desc="Rounds mapped to a specific job opening."
        addLabel="Add Round"
        idPrefix="IR"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "job", label: "Job", required: true, placeholder: "Senior Frontend Engineer" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: STATUSES,
            required: true,
            badge: true,
          },
          { key: "description", label: "Description", type: "textarea", full: true },
        ]}
        seed={[
          {
            id: "IR-001",
            name: "HR Screening",
            job: "Senior Frontend Engineer",
            status: "Active",
            description: "Role fit and compensation alignment.",
          },
          {
            id: "IR-002",
            name: "Technical Round 1",
            job: "Senior Frontend Engineer",
            status: "Active",
            description: "Coding and system design.",
          },
          {
            id: "IR-003",
            name: "Sales Roleplay",
            job: "Enterprise Account Executive",
            status: "Active",
            description: "Live pitch simulation.",
          },
        ]}
      />
    </div>
  );
}
