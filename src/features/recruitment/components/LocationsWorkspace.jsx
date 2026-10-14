import { MapPin } from "lucide-react";
import { CrudSection } from "@/components/common/CrudSection";
import { JOB_LOCATIONS, STATUSES } from "@/features/recruitment/data/recruitment-data";

export function LocationsWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Locations</h1>
        <p className="text-muted-foreground text-sm">
          Places you hire for, including remote-friendly locations.
        </p>
      </div>
      <CrudSection
        icon={MapPin}
        title="Job Locations"
        desc="Used when publishing job postings."
        addLabel="Add Location"
        idPrefix="JL"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "address", label: "Address", full: true },
          { key: "city", label: "City", required: true },
          { key: "state", label: "State" },
          { key: "country", label: "Country", required: true },
          { key: "postal", label: "Postal Code" },
          {
            key: "remote",
            label: "Remote Work",
            type: "select",
            options: ["Yes", "No"],
            required: true,
            badge: true,
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: STATUSES,
            required: true,
            badge: true,
          },
        ]}
        seed={JOB_LOCATIONS}
      />
    </div>
  );
}
