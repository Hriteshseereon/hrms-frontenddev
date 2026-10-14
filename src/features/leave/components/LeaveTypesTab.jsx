import { useState } from "react";
import { useSharedList } from "@/lib/shared-list";
import { Plus, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LEAVE_TYPES } from "@/features/leave/data/leave-data";

export function LeaveTypesTab() {
  const [rows, setRows] = useSharedList("leave-types", LEAVE_TYPES);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CalendarCheck className="text-primary h-4 w-4" />
            {rows.length} leave types configured
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Leave Type
              </Button>
            </DialogTrigger>
            <NewLeaveTypeDialog
              onSubmit={(t) => {
                setRows((r) => [t, ...r]);
                setOpen(false);
                toast.success(`Leave type "${t.name}" created`);
              }}
            />
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Max Days / Year</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 align-top transition">
                  <td className="p-3 font-medium">{t.id}</td>
                  <td className="p-3 font-semibold">{t.name}</td>
                  <td className="p-3">{t.maxDays}</td>
                  <td className="text-muted-foreground max-w-[420px] p-3">{t.description}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        t.status === "Active"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/30 bg-gold/10 text-gold"
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NewLeaveTypeDialog({ onSubmit }) {
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [description, setDescription] = useState("");
  const valid = name.trim() && Number(maxDays) > 0;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create Leave Type</DialogTitle>
        <DialogDescription>Define a leave category available to all employees.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Comp-off"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Max days per year *</Label>
          <Input
            type="number"
            min={1}
            value={maxDays}
            onChange={(e) => setMaxDays(e.target.value)}
            placeholder="12"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Description</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Eligibility, approval rules, carry-forward…"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() =>
            onSubmit({
              id: `LTP-${String(Math.floor(Math.random() * 90) + 10)}`,
              name: name.trim(),
              maxDays: Number(maxDays),
              description: description.trim(),
              status: "Active",
            })
          }
        >
          Create Leave Type
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
