// Master data sharing — per master type, the group's Super Admin decides whether one copy serves every company
// (group level) or each company keeps its own (starting as a copy of the group's).
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  MASTER_TYPES,
  companiesOf,
  masterStorageLabel,
  setMasterShared,
} from "@/features/organization/data/tenancy";

export function MasterSharingPanel({ tenant }) {
  const companies = companiesOf(tenant);
  if (tenant.kind !== "group")
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-5 text-sm">
          {tenant.name} is a single company — its masters belong to that company. Sharing applies
          once it becomes a group.
        </CardContent>
      </Card>
    );
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-2">
          <Layers className="text-primary mt-0.5 h-4 w-4" />
          <div className="text-sm">
            <div className="font-semibold">Same across all companies?</div>
            <div className="text-muted-foreground text-xs">
              On — one master maintained at group level and used by all {companies.length}{" "}
              companies. Off — each company keeps its own copy (it starts as a copy of the
              group&apos;s and is edited from that company&apos;s scope).
            </div>
          </div>
        </div>
        <div className="divide-border divide-y">
          {MASTER_TYPES.map((m) => {
            const shared = tenant.sharedMasters?.[m.key] !== false;
            return (
              <div key={m.key} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-muted-foreground text-xs">{m.hint}</div>
                </div>
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                  {masterStorageLabel(tenant, m.key)}
                </Badge>
                <Switch
                  checked={shared}
                  onCheckedChange={(v) => {
                    setMasterShared(tenant.id, m.key, v);
                    toast.success(
                      v
                        ? `${m.name}: one master for the whole group`
                        : `${m.name}: each company keeps its own`,
                    );
                  }}
                  aria-label={`Share ${m.name} across companies`}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
