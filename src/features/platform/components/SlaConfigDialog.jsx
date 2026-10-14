// Configurable SLA targets by severity, and default-owner routing rules by
// issue type — opened from a "Configure SLA" button on the Support screen.
import { useState } from "react";
import { Settings2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useSlaRules,
  updateSlaRule,
  useRoutingRules,
  updateRoutingRule,
} from "@/features/platform/data/support-sla-data";

export function SlaConfigDialog() {
  const [open, setOpen] = useState(false);
  const slaRules = useSlaRules();
  const routingRules = useRoutingRules();
  const [drafts, setDrafts] = useState({});
  const [ownerDrafts, setOwnerDrafts] = useState({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" /> Configure SLA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>SLA & Routing Configuration</DialogTitle>
          <DialogDescription>
            Resolution-time targets by severity, and default owners by issue category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              SLA target hours, by severity
            </div>
            <div className="space-y-2">
              {slaRules.map((r) => (
                <div key={r.severity} className="flex items-center justify-between gap-3">
                  <Label className="w-24 text-sm">{r.severity}</Label>
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="number"
                      className="h-8"
                      value={drafts[r.severity] ?? String(r.targetHours)}
                      onChange={(e) => setDrafts((p) => ({ ...p, [r.severity]: e.target.value }))}
                    />

                    <span className="text-muted-foreground shrink-0 text-xs">hours</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const val = Number(drafts[r.severity] ?? r.targetHours);
                        if (val > 0) {
                          updateSlaRule(r.severity, val);
                          toast.success(`${r.severity} SLA set to ${val}h`);
                        } else toast.error("SLA target must be a positive number of hours");
                      }}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Default owner, by issue type
            </div>
            <div className="space-y-2">
              {routingRules.map((r) => (
                <div key={r.issueType} className="flex items-center justify-between gap-3">
                  <Label className="w-32 shrink-0 text-sm">{r.issueType}</Label>
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      className="h-8"
                      placeholder="e.g. IT Helpdesk"
                      value={ownerDrafts[r.issueType] ?? r.defaultOwner}
                      onChange={(e) =>
                        setOwnerDrafts((p) => ({ ...p, [r.issueType]: e.target.value }))
                      }
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const val = (ownerDrafts[r.issueType] ?? r.defaultOwner).trim();
                        updateRoutingRule(r.issueType, val);
                        toast.success(`${r.issueType} now routes to ${val || "no one by default"}`);
                      }}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
