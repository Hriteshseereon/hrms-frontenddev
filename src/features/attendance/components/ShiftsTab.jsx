import { useState } from "react";
import { Plus, Clock, Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { OFFICES } from "@/features/employees/data/hr-data";
import { addShift, useShifts } from "@/features/attendance/data/attendance-data";

export function ShiftsTab() {
  // Persisted shift master — shift resolution, work orders and wage workers read the same store.
  const rows = useShifts();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-muted-foreground text-sm">
            {rows.length} shifts configured · {rows.filter((s) => s.breakEnabled).length} with
            scheduled breaks
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Shift
              </Button>
            </DialogTrigger>
            <NewShiftDialog
              existing={rows}
              onSubmit={(s) => {
                const row = addShift(s);
                setOpen(false);
                toast.success(`Shift "${row.name}" created (${row.id})`);
              }}
            />
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <Card key={s.id} className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {s.id} · {s.office}
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {s.employees} staff
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="text-primary h-4 w-4" />
                <span className="font-medium">
                  {s.start} — {s.end}
                </span>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Coffee className="h-4 w-4" />
                {s.breakEnabled ? `Break ${s.breakStart} — ${s.breakEnd}` : "No scheduled break"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function NewShiftDialog({ onSubmit, existing }) {
  const [name, setName] = useState("");
  const [office, setOffice] = useState("");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("18:30");
  const [breakEnabled, setBreakEnabled] = useState(true);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("13:45");

  // A shift may cross midnight (22:00 → 06:00) but cannot be zero-length; the break must sit inside the shift and
  // names must be unique (shifts are matched by name on attendance records).
  const span = start && end ? (mins(end) - mins(start) + 1440) % 1440 : 0;
  const inShift = (t) => (mins(t) - mins(start) + 1440) % 1440 <= span;
  const error =
    !start || !end
      ? ""
      : span === 0
        ? "Start and end time cannot be the same."
        : breakEnabled &&
            breakStart &&
            breakEnd &&
            (!inShift(breakStart) ||
              !inShift(breakEnd) ||
              (mins(breakEnd) - mins(breakStart) + 1440) % 1440 >= span ||
              breakStart === breakEnd)
          ? "The break must fall inside the shift and end after it starts."
          : existing.some((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
            ? "A shift with this name already exists."
            : "";
  const valid =
    name.trim() && office && start && end && (!breakEnabled || (breakStart && breakEnd)) && !error;

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Shift</DialogTitle>
        <DialogDescription>Define shift timings and an optional break window.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Shift name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Evening Shift"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Office *</Label>
          <Select value={office} onValueChange={setOffice}>
            <SelectTrigger>
              <SelectValue placeholder="Select office" />
            </SelectTrigger>
            <SelectContent>
              {OFFICES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">Start time *</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">End time *</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="border-border space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Break time</div>
              <div className="text-muted-foreground text-xs">
                Add a break window in between the shift
              </div>
            </div>
            <Switch checked={breakEnabled} onCheckedChange={setBreakEnabled} />
          </div>
          {breakEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Break start</Label>
                <Input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Break end</Label>
                <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-destructive text-xs">{error}</div>}
      <DialogFooter>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() =>
            onSubmit({
              name: name.trim(),
              office,
              start,
              end,
              breakEnabled,
              breakStart: breakEnabled ? breakStart : "",
              breakEnd: breakEnabled ? breakEnd : "",
            })
          }
        >
          Create Shift
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
