// Training catalogue — programmes with purpose, links, timeline, deadline, mandatory / goals flags; assignment counts per programme.
import { useState } from "react";
import { CalendarRange, Link2, Download, Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
          <div className="ml-auto flex gap-2">
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
            <span className="text-muted-foreground inline-flex items-center gap-1 self-center text-xs">
              <Plus className="h-3.5 w-3.5" /> Add new trainings from “Assign Training → Add a new
              training”.
            </span>
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
