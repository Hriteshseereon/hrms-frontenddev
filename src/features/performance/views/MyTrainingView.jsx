import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import {
  GraduationCap,
  MapPin,
  CalendarDays,
  User,
  Play,
  FileText,
  HelpCircle,
  Upload,
  BookOpen,
  Download,
  Award,
  Link2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  assignTone,
  submitAssignment,
  toggleAssignmentModule,
  useAssignments,
  useResources,
  useTrainingCatalog,
  renderTrainingReviewPdf,
  renderTrainingCertificate,
  TRAINING_REVIEW_PARAMS,
} from "@/features/performance/data/training-assign";
import { safeUrl } from "@/lib/utils";

const tone = {
  Completed: "border-primary/30 bg-primary/10 text-primary",
  Ongoing: "border-gold/40 bg-gold/10 text-gold",
  Planned: "border-border bg-muted text-muted-foreground",
  Cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const kindIcon = (k) =>
  k === "Video" ? Play : k === "Document" ? FileText : k === "Quiz" ? HelpCircle : Upload;

function EmpTraining() {
  const me = useCurrentEmployee();
  const mine = useAssignments().filter((a) => a.empId === me.id);
  const TRAININGS = useTrainingCatalog();
  const [openId, setOpenId] = useState(null);
  const active = mine.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="text-primary h-6 w-6" /> My Trainings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your assigned learning, the wider training calendar for {me.branch}, and product resources
          to get started.
        </p>
      </div>

      <Tabs defaultValue="assigned">
        <ScrollTabsList>
          <TabsTrigger value="assigned">
            <GraduationCap className="h-4 w-4" /> Assigned to me
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="h-4 w-4" /> Training Calendar
          </TabsTrigger>
          <TabsTrigger value="resources">
            <BookOpen className="h-4 w-4" /> Getting Started
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="assigned" className="pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mine.map((a) => (
              <Card key={a.id} className="shadow-card">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={assignTone(a.status)}>
                      {a.status}
                    </Badge>
                    {a.mandatory && (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-destructive"
                      >
                        Mandatory
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto text-xs">
                      Due <span className="whitespace-nowrap">{a.dueDate}</span>
                    </span>
                  </div>
                  <h2 className="font-semibold">{a.training}</h2>
                  <div className="text-muted-foreground text-xs">
                    Assigned by {a.assignedBy} on{" "}
                    <span className="whitespace-nowrap">{a.assignedOn}</span>
                    {a.purpose ? ` · ${a.purpose}` : ""}
                    {a.mode ? ` · ${a.mode}` : ""}
                    {a.durationHours ? ` · ${a.durationHours} h` : ""}
                  </div>
                  {a.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">{a.description}</p>
                  )}
                  {(a.links?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {a.links.map((l) => (
                        <a
                          key={l.url}
                          href={safeUrl(l.url) ?? undefined}
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
                  {a.includeInGoals && (
                    <div className="text-primary inline-flex items-center gap-1 text-[11px]">
                      <Target className="h-3 w-3" /> Linked to your goals
                      {a.goalId ? ` (${a.goalId})` : ""}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Completion</span>
                      <span className="font-semibold">{a.progress}%</span>
                    </div>
                    <Progress value={a.progress} />
                  </div>
                  {a.review && (
                    <div className="border-primary/20 bg-primary/5 space-y-1 rounded-lg border p-3 text-xs">
                      <div className="font-medium">
                        Review · {a.review.overall}/5 · {a.review.outcome} ·{" "}
                        {a.review.recommendation}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3">
                        {TRAINING_REVIEW_PARAMS.map(([k, label]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <b>{a.review.ratings[k]}/5</b>
                          </div>
                        ))}
                      </div>
                      <div className="text-muted-foreground">{a.review.learnings}</div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => renderTrainingReviewPdf(a)}
                        >
                          <Download className="h-3.5 w-3.5" /> Review report
                        </Button>
                        {a.certificateRef && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gold/40 h-7"
                            onClick={() => renderTrainingCertificate(a)}
                          >
                            <Award className="text-gold h-3.5 w-3.5" /> Certificate{" "}
                            {a.certificateRef}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {!a.review && a.evaluation && (
                    <div className="border-border bg-muted/30 rounded-lg border p-3 text-xs">
                      <span className="font-medium">Evaluation: </span>
                      {a.evaluation}
                      {a.score ? ` · score ${a.score}` : ""}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="bg-gradient-emerald w-full text-white"
                    onClick={() => setOpenId(a.id)}
                  >
                    Open training
                  </Button>
                </CardContent>
              </Card>
            ))}
            {mine.length === 0 && (
              <Card className="shadow-card md:col-span-2">
                <CardContent className="text-muted-foreground p-10 text-center">
                  No trainings are assigned to you right now.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRAININGS.map((t) => (
              <Card key={t.id} className="shadow-card">
                <CardContent className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline">{t.type}</Badge>
                    <Badge variant="outline" className={tone[t.status]}>
                      {t.status}
                    </Badge>
                  </div>
                  <h2 className="font-semibold">{t.title}</h2>
                  <p className="text-muted-foreground text-xs">{t.description}</p>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> {t.trainer} · {t.mode} · {t.durationHours} h
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> {t.start} → {t.end} · deadline{" "}
                      {t.deadline}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {t.branch} · {t.location}
                    </div>
                    {t.links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="pt-4">
          <EmpResources />
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-lg">
          {active && <Player a={active} onClose={() => setOpenId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Player({ a, onClose }) {
  const me = useCurrentUser();
  const [file, setFile] = useState(a.submission);
  // Completed / submitted trainings are locked: re-submitting used to flip a certified assignment back to "Submitted".
  const locked =
    a.status === "Completed" || a.status === "Submitted" || a.status === "Under Review";
  const openModule = (m) => {
    if (m.url && m.url !== "#" && /^https?:\/\//i.test(m.url))
      window.open(m.url, "_blank", "noopener");
    else toast.info(`“${m.title}” has no online link — use the materials shared by your trainer.`);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{a.training}</DialogTitle>
        <DialogDescription>
          Due <span className="whitespace-nowrap">{a.dueDate}</span> · {a.progress}% complete
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
        <Progress value={a.progress} />
        <div className="space-y-2">
          {a.modules.map((m) => {
            const Icon = kindIcon(m.kind);
            return (
              <div
                key={m.id}
                className="border-border flex items-center gap-3 rounded-lg border p-3"
              >
                <Checkbox
                  checked={m.done}
                  disabled={locked}
                  onCheckedChange={() => toggleAssignmentModule(a.id, m.id)}
                />
                <Icon className="text-primary h-4 w-4 shrink-0" />
                <div className="flex-1 text-sm">
                  {m.title}
                  <div className="text-muted-foreground text-xs">
                    {m.kind} · {m.duration}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openModule(m)}>
                  {m.kind === "Video" ? "Watch" : m.kind === "Document" ? "Read" : "Open"}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Upload assignment</Label>
          <Input
            type="file"
            disabled={locked}
            onChange={(e) => {
              captureFiles(e.target.files);
              setFile(e.target.files?.[0]?.name ?? "");
            }}
          />
          {file && <p className="text-muted-foreground text-xs">{file}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          className="bg-gradient-emerald text-white"
          disabled={locked}
          onClick={() => {
            const r = submitAssignment(a.id, file, me);
            toast[r.ok ? "success" : "error"](r.message);
            if (r.ok) onClose();
          }}
        >
          {a.status === "Completed"
            ? "Completed"
            : locked
              ? "Awaiting review"
              : "Submit for review"}
        </Button>
      </DialogFooter>
    </>
  );
}

function EmpResources() {
  const resources = useResources();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {resources.map((r) => (
        <Card key={r.id} className="shadow-card">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{r.category}</Badge>
              <span className="text-muted-foreground ml-auto text-xs">{r.format}</span>
            </div>
            <h3 className="font-semibold">{r.title}</h3>
            <p className="text-muted-foreground text-xs">{r.description}</p>
            <div className="text-muted-foreground text-xs">
              {r.duration} · {r.audience}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full"
              disabled={!r.url || r.url === "#"}
              onClick={() => safeUrl(r.url) && window.open(safeUrl(r.url), "_blank", "noopener")}
            >
              {!r.url || r.url === "#" ? "Link not configured" : "Open resource"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default EmpTraining;
