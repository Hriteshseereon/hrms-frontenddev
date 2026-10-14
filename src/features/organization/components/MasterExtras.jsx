import { useState } from "react";
import { Plus, Clock3, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { nextId } from "@/lib/store";
import {
  timesheetFormatStore,
  addTimesheetFormat,
  toggleTimesheetFormat,
  TIMESHEET_FIELDS,
} from "@/features/timesheets/data/timesheet-data";
import { DEPARTMENT_NAMES } from "@/features/finance/data/finance-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

function Head({ icon: Icon, title, desc, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-muted-foreground text-xs">{desc}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Name + description + status master backed by a shared store. */
export function NamedMasterTab({ icon = Shield, title, desc, addLabel, prefix, store }) {
  const rows = store.use();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");

  function submit() {
    store.set((p) => [
      { id: nextId(prefix, p.length), name: name.trim(), description: description.trim(), status },
      ...p,
    ]);
    setOpen(false);
    setName("");
    setDescription("");
    setStatus("Active");
    toast.success(`${title} entry added`);
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <Head icon={icon} title={title} desc={desc}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald text-white">
                <Plus className="h-4 w-4" /> {addLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{addLabel}</DialogTitle>
                <DialogDescription>Adds a new entry to {title.toLowerCase()}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!name.trim()}
                  className="bg-gradient-emerald text-white"
                  onClick={submit}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Head>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="text-muted-foreground p-3">{r.description || "—"}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimesheetFormatsTab() {
  const rows = timesheetFormatStore.use();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [department, setDepartment] = useState("");
  const [fields, setFields] = useState([
    "Task Name",
    "Description",
    "Start Time",
    "End Time",
    "Hours",
    "Status",
  ]);
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState(null);

  const toggleField = (f, on) =>
    setFields((p) => (on ? Array.from(new Set([...p, f])) : p.filter((x) => x !== f)));

  function submit() {
    addTimesheetFormat({
      name: name.trim(),
      frequency,
      department: department || "All departments",
      fields,
      description: description.trim(),
      active: true,
    });
    setOpen(false);
    setName("");
    setDepartment("");
    setDescription("");
    toast.success("Timesheet format created");
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <Head
          icon={Clock3}
          title="Timesheet Formats"
          desc="Define what employees must fill in their timesheets"
        >
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald text-white">
                <Plus className="h-4 w-4" /> Add Format
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add Timesheet Format</DialogTitle>
                <DialogDescription>
                  Employees will see exactly the fields selected here.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">
                    Format name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Daily Engineering Timesheet"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Daily", "Weekly", "Monthly"].map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_NAMES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Fields shown to employees</Label>
                  <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-3">
                    {TIMESHEET_FIELDS.map((f) => (
                      <label
                        key={f}
                        className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={fields.includes(f)}
                          onCheckedChange={(v) => toggleField(f, !!v)}
                        />{" "}
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!name.trim() || fields.length === 0}
                  className="bg-gradient-emerald text-white"
                  onClick={submit}
                >
                  Save format
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Head>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Frequency</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Fields</th>
                <th className="p-3 text-left">Active</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={`${clickableRow} align-top`} onClick={() => setDetail(r)}>
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">
                    {r.name}
                    <div className="text-muted-foreground text-xs font-normal">{r.description}</div>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {r.frequency}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground p-3">{r.department}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.fields.map((f) => (
                        <Badge key={f} variant="outline" className="text-[10px]">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => toggleTimesheetFormat(r.id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={detail.name}
            subtitle={`${detail.id} · ${detail.frequency} · ${detail.department}`}
            badges={
              <>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {detail.frequency}
                </Badge>
                <Badge variant="outline">{detail.active ? "Active" : "Inactive"}</Badge>
              </>
            }
            record={detail}
            labels={{ id: "Code", fields: "Fields shown to employees" }}
          />
        )}
      </CardContent>
    </Card>
  );
}
