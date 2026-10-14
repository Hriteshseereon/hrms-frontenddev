import { Plane } from "lucide-react";
import { TourWorkspace } from "@/features/travel/components/TourWorkspace";
import { TourRoiReport } from "@/features/travel/components/TourOutcomes";

function OrgTours() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Plane className="text-primary h-6 w-6" /> Tours
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Business tour requests routed HOD → HR → Finance, with outcome and proof of visit.
        </p>
      </div>
      <TourWorkspace />
      <div>
        <h2 className="mb-2 text-lg font-semibold">Tour outcomes &amp; ROI</h2>
        <TourRoiReport />
      </div>
    </div>
  );
}

export default OrgTours;
