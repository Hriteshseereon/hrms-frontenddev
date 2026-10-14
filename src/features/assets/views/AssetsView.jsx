import { Boxes } from "lucide-react";
import { AssetsWorkspace } from "@/features/assets/components/AssetsWorkspace";

function OrgAssets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Boxes className="text-primary h-6 w-6" /> Asset Lifecycle
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Register, issue, transfer and retire organisation assets — including SAP/AWS licenses.
        </p>
      </div>
      <AssetsWorkspace />
    </div>
  );
}

export default OrgAssets;
