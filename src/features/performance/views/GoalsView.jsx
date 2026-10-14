import { useMemo, useState } from "react";
import { Flag, Plus, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { GOAL_LEVELS, goalTone, useGoals } from "@/features/performance/data/goals-data";
import { GoalForm, GoalDetail } from "@/features/performance/components/GoalPieces";
import { useScopedIds } from "@/features/employees/components/CasePieces";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { usePerformanceScope } from "@/features/performance/components/scope";

function GoalsPage() {
  const me = useCurrentUser();
  const all = useGoals();
  const scopedIds = useScopedIds();
  const perf = usePerformanceScope();
  // Managers and HODs work through their reporting line (whole tree; an HOD also their department): their own goals,
  // their people's goals and organisation-wide goals. HR / CXO / admin roles see the whole entity.
  const teamScoped = !perf.orgWide;
  const teamIds = perf.visible;
  const goals = useMemo(
    () =>
      all.filter(
        (g) =>
          scopedIds.has(g.ownerId) &&
          (!teamScoped ||
            g.ownerId === me.id ||
            teamIds.has(g.ownerId) ||
            g.level === "Organizational"),
      ),
    [all, scopedIds, teamScoped, teamIds, me.id],
  );
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const rows = useMemo(
    () =>
      goals.filter(
        (g) => (level === "all" || g.level === level) && (status === "all" || g.status === status),
      ),
    [goals, level, status],
  );
  const active = detail ? (goals.find((g) => g.id === detail.id) ?? null) : null;

  const columns = [
    "Goal",
    "Title",
    "Level",
    "Category",
    "Priority",
    "Owner",
    "Assigned by",
    "Quarter",
    "Start",
    "Due",
    "Target",
    "Metrics",
    "Weight %",
    "Progress %",
    "Status",
    "Rating",
  ];
  const reportRows = rows.map((g) => [
    g.id,
    g.title,
    g.level,
    g.category ?? "—",
    g.priority ?? "—",
    g.owner,
    g.createdBy,
    g.quarter ?? "—",
    g.start,
    g.due,
    g.target,
    (g.metrics ?? []).map((m) => `${m.name} ${m.current || "—"}/${m.target}`).join("; ") || "—",
    g.weight,
    Math.round(g.progress ?? 0),
    g.status,
    g.rating || "—",
  ]);

  function downloadPdf() {
    const ok = exportReportPdf({
      title: "Goals Register",
      subtitle: "Individual, team, department and organizational goals with progress",
      filters: [
        { label: "Level", value: level === "all" ? "All levels" : level },
        { label: "Status", value: status === "all" ? "All statuses" : status },
      ],
      summary: [
        { label: "Goals", value: String(rows.length) },
        { label: "Approved", value: String(rows.filter((g) => g.status === "Approved").length) },
        { label: "Completed", value: String(rows.filter((g) => g.status === "Completed").length) },
      ],
      columns,
      rows: reportRows,
    });
    if (ok) toast.success("Goals PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Flag className="text-primary h-6 w-6" /> Goals Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Individual, team, department and organizational goals — HR, admins and managers assign
          goals with metrics, evaluation parameters, quarter and date range; employees self-add with
          the same form and get manager approval. Click a goal for the full detail.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {GOAL_LEVELS.map((l) => (
          <Card key={l} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">{l}</div>
              <div className="mt-1 text-2xl font-bold">
                {goals.filter((g) => g.level === l).length}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {GOAL_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "Draft",
                  "Pending Approval",
                  "Approved",
                  "In Progress",
                  "Completed",
                  "Rejected",
                ].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              exportCsv("goals", columns, reportRows);
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create &amp; assign goal
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((g) => (
          <Card
            key={g.id}
            className="shadow-card hover:border-primary/30 cursor-pointer transition"
            onClick={() => setDetail(g)}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{g.level}</Badge>
                <Badge variant="outline" className={goalTone(g.status)}>
                  {g.status}
                </Badge>
                <span className="text-muted-foreground ml-auto text-xs">{g.id}</span>
              </div>
              <div>
                <h3 className="font-semibold">{g.title}</h3>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{g.description}</p>
              </div>
              <div className="text-muted-foreground text-xs">
                {g.owner} · {g.quarter ?? `${g.start} → ${g.due}`} · weight {g.weight}%
                {g.priority ? ` · ${g.priority}` : ""}
              </div>
              <div className="text-muted-foreground line-clamp-1 text-xs">
                Target: {g.target}
                {(g.metrics?.length ?? 0) > 0 ? ` · ${g.metrics.length} metric(s)` : ""}
                {g.reviewer ? ` · reviewer ${g.reviewer}` : ""}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{g.progress}%</span>
                </div>
                <Progress value={g.progress} />
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center">
              {goals.length === 0
                ? teamScoped
                  ? "No goals for you or your team yet — create and assign one."
                  : "No goals on record for this organisation yet."
                : "No goals match these filters."}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {active && <GoalDetail goal={active} mode="manage" />}
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create &amp; assign goal</DialogTitle>
            <DialogDescription>
              Person, goal, quarter and date range, metrics and evaluation parameters, milestones,
              links, documents and remarks. The owner is notified; goals assigned by managers, HR or
              admins are active immediately.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            mode="assign"
            restrictTo={teamScoped ? [...teamIds] : undefined}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GoalsPage;
