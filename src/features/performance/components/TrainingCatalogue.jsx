// Training catalogue — programmes with purpose, links, timeline, deadline, mandatory / goals flags; assignment counts per programme.
import { useState } from "react";
import { CalendarRange, Link2, Download, Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportReportPdf } from "@/lib/export-utils";
import {
  useAssignments,
  useTrainingCatalog,
  trainingCatalogStore,
} from "@/features/performance/data/training-assign";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { toast } from "sonner";
import { TRAINING_TYPE_NAMES, TRAINER_NAMES } from "@/features/performance/data/training-data";
import { OFFICES } from "@/features/employees/data/hr-data";
import { TRAINING_MODES, TRAINING_PURPOSES, addProgramme } from "@/features/performance/data/training-assign";

const tone = {
  Completed: "border-primary/30 bg-primary/10 text-primary",
  Ongoing: "border-gold/40 bg-gold/10 text-gold",
  Planned: "border-border bg-muted text-muted-foreground",
  Cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function TrainingCatalogueTab() {
  const me = useCurrentUser();
  const catalog = useTrainingCatalog();
  const assignments = useAssignments();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: TRAINING_TYPE_NAMES[0] ?? "",
    description: "",
    purpose: TRAINING_PURPOSES[0] ?? "",
    trainer: TRAINER_NAMES[0] ?? "",
    mode: TRAINING_MODES[0] ?? "Online (self-paced)",
    start: "",
    end: "",
    deadline: "",
    durationHours: "8",
    branch: OFFICES[0] ?? "",
    location: "Online",
    skills: "",
    links: "",
    mandatory: false,
    includeInGoals: false,
  });
  const rows = catalog.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (!q ||
        [t.title, t.type, t.trainer, t.skills.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  // Programme status is catalogue administration (HR / people office) — managers see it read-only.
  const canEdit = can(me.role, "employee.manage") && me.role !== "Manager";
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const createTraining = () => {
    if (!form.title.trim()) return toast.error("Training title is required.");
    if (!form.start || !form.end || !form.deadline) return toast.error("Start, end and deadline dates are required.");
    if (form.end < form.start) return toast.error("End date cannot be before the start date.");
    if (form.deadline < form.start) return toast.error("Deadline cannot be before the start date.");
    if (!(Number(form.durationHours) > 0)) return toast.error("Duration must be more than 0 hours.");
    const links = form.links
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ label: url, url }));
    if (links.some((link) => !/^https?:\/\/\S+$/i.test(link.url)))
      return toast.error("Training links must start with https:// or http://");
    const row = addProgramme(
      {
        ...form,
        title: form.title.trim(),
        durationHours: Number(form.durationHours),
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        links,
        status: "Planned",
        materials: [],
      },
      me,
    );
    toast.success(`${row.title} added to the training catalogue.`);
    setCreateOpen(false);
    setForm((current) => ({ ...current, title: "", description: "", skills: "", links: "" }));
  };
  const setStatusOf = (id, st) => {
    trainingCatalogStore.set((l) => l.map((t) => (t.id === id ? { ...t, status: st } : t)));
    toast.success(`Status → ${st}`);
  };
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="text-primary h-4 w-4" /> Training catalogue
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, type, trainer, skill…"
            className="max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["Planned", "Ongoing", "Completed", "Cancelled"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportReportPdf({
                  title: "Training catalogue",
                  subtitle: `${rows.length} programmes · ${me.name}`,
                  columns: [
                    "ID",
                    "Title",
                    "Type",
                    "Trainer",
                    "Mode",
                    "Hours",
                    "Timeline",
                    "Deadline",
                    "Mandatory",
                    "In goals",
                    "Assigned",
                    "Certified",
                    "Status",
                  ],
                  rows: rows.map((t) => {
                    const a = assignments.filter((x) => x.trainingId === t.id);
                    return [
                      t.id,
                      t.title,
                      t.type,
                      t.trainer,
                      t.mode,
                      t.durationHours,
                      `${t.start} → ${t.end}`,
                      t.deadline,
                      t.mandatory ? "Yes" : "No",
                      t.includeInGoals ? "Yes" : "No",
                      a.length,
                      a.filter((x) => x.certificateRef).length,
                      t.status,
                    ];
                  }),
                })
              }
            >
              <Download className="h-4 w-4" /> Catalogue report
            </Button>
            {canEdit && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-emerald text-white">
                    <Plus className="h-4 w-4" /> Create training
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create training</DialogTitle>
                    <DialogDescription>
                      Add a programme to the catalogue. You can assign it to employees later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="training-title">Training title *</Label>
                      <Input id="training-title" value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Leadership essentials" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Training type</Label>
                      <Select value={form.type} onValueChange={(value) => setField("type", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TRAINING_TYPE_NAMES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Trainer</Label>
                      <Select value={form.trainer} onValueChange={(value) => setField("trainer", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TRAINER_NAMES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="training-description">Description</Label>
                      <Textarea id="training-description" value={form.description} onChange={(e) => setField("description", e.target.value)} rows={3} placeholder="What will participants learn?" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Purpose</Label>
                      <Select value={form.purpose} onValueChange={(value) => setField("purpose", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TRAINING_PURPOSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Delivery mode</Label>
                      <Select value={form.mode} onValueChange={(value) => setField("mode", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TRAINING_MODES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {[ ["start", "Start date"], ["end", "End date"], ["deadline", "Deadline"] ].map(([key, label]) => (
                      <div className="space-y-1.5" key={key}>
                        <Label htmlFor={`training-${key}`}>{label} *</Label>
                        <Input id={`training-${key}`} type="date" value={form[key]} onChange={(e) => setField(key, e.target.value)} />
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <Label htmlFor="training-hours">Duration (hours) *</Label>
                      <Input id="training-hours" type="number" min="1" value={form.durationHours} onChange={(e) => setField("durationHours", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Branch</Label>
                      <Select value={form.branch} onValueChange={(value) => setField("branch", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{OFFICES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="training-location">Location</Label>
                      <Input id="training-location" value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="Room or online link" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="training-skills">Skills</Label>
                      <Input id="training-skills" value={form.skills} onChange={(e) => setField("skills", e.target.value)} placeholder="Comma-separated skills" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="training-links">Course links</Label>
                      <Textarea id="training-links" value={form.links} onChange={(e) => setField("links", e.target.value)} rows={2} placeholder="One https:// link per line" />
                    </div>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.mandatory} onCheckedChange={(value) => setField("mandatory", value === true)} /> Mandatory training</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.includeInGoals} onCheckedChange={(value) => setField("includeInGoals", value === true)} /> Include in goals</label>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button className="bg-gradient-emerald text-white" onClick={createTraining}>Create training</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => {
          const a = assignments.filter((x) => x.trainingId === t.id);
          return (
            <Card key={t.id} className="shadow-card">
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{t.type}</Badge>
                  <Badge variant="outline" className={tone[t.status]}>
                    {t.status}
                  </Badge>
                </div>
                <h3 className="font-semibold">
                  {t.title}{" "}
                  <span className="text-muted-foreground text-xs font-normal">· {t.id}</span>
                </h3>
                <p className="text-muted-foreground text-xs">{t.description}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Purpose</span>
                    <br />
                    {t.purpose}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trainer / mode</span>
                    <br />
                    {t.trainer} · {t.mode}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeline</span>
                    <br />
                    {t.start} → {t.end}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deadline · hours</span>
                    <br />
                    {t.deadline} · {t.durationHours} h
                  </div>
                  <div>
                    <span className="text-muted-foreground">Branch</span>
                    <br />
                    {t.branch} · {t.location}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Flags</span>
                    <br />
                    {t.mandatory ? "Mandatory" : "Optional"}
                    {t.includeInGoals ? " · In goals" : ""}
                  </div>
                </div>
                {t.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {t.links.map((l) => (
                      <a
                        key={l.url}
                        href={/^https?:\/\//i.test(l.url) ? l.url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        {l.label}
                      </a>
                    ))}
                  </div>
                )}
                {t.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.skills.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {a.length} assigned ·{" "}
                    {a.filter((x) => x.certificateRef).length} certified
                  </span>
                  <Select
                    value={t.status}
                    disabled={!canEdit}
                    onValueChange={(v) => setStatusOf(t.id, v)}
                  >
                    <SelectTrigger className="h-7 w-full text-xs sm:w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Planned", "Ongoing", "Completed", "Cancelled"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="shadow-card md:col-span-3">
            <CardContent className="text-muted-foreground p-10 text-center">
              No programmes match.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
