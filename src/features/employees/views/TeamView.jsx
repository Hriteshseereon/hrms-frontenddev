import { useMemo, useState } from "react";
import {
  UsersRound,
  UserPlus,
  ClipboardList,
  Star,
  Download,
  Trash2,
  Plus,
  Eye,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { initials, getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import {
  directReports,
  setManager,
  teamReviewStore,
  useManagerMap,
} from "@/features/organization/data/manager-data";
import { TeamReviewForm, TeamReviewDetail } from "@/features/performance/components/TeamReviewForm";
import { useTasks, statusClass, priorityClass } from "@/features/projects/data/task-data";
import { TaskForm, TaskDetail } from "@/features/projects/components/TaskPieces";
import { exportReportPdf, exportCsv } from "@/lib/export-utils";
import { clickableRow } from "@/components/common/RecordDetail";
import { Flag } from "lucide-react";
import { useGoals, goalTone } from "@/features/performance/data/goals-data";
import { GoalForm, GoalDetail } from "@/features/performance/components/GoalPieces";

function TeamPage() {
  const me = useCurrentUser();
  const map = useManagerMap();
  const reviews = teamReviewStore.use();
  const tasks = useTasks();
  // Employees of the active entity (all entities for a Super Admin in group view) — the static roster listed
  // every organisation's people as candidates for "Add to my team".
  const EMPLOYEES = useScopedEmployees();

  // HR / Admin / CXO people-office roles can inspect any manager's team; a manager only sees their own.
  const isOverseer =
    me.role === "HR" ||
    me.role === "Admin" ||
    me.role === "SuperAdmin" ||
    me.role === "CEO" ||
    me.role === "CHRO";
  /** Managers in scope: everyone somebody in this entity reports to. */
  const scopedManagerIds = useMemo(
    () => [...new Set(Object.values(map))].filter((id) => id && EMPLOYEES.some((e) => e.id === id)),
    [map, EMPLOYEES],
  );
  /** Session ids mirror employee ids for every user except the administrators, who oversee the first manager in scope. */
  const myEmpId = EMPLOYEES.some((e) => e.id === me.id)
    ? me.id
    : (scopedManagerIds[0] ?? "SRN-0005");
  const managerIds = useMemo(
    () => [...new Set([myEmpId, ...scopedManagerIds])].filter(Boolean),
    [scopedManagerIds, myEmpId],
  );
  const [managerId, setManagerId] = useState(myEmpId);
  // The tenant scope is applied after hydration, so a manager picked before it (or from another entity) falls back
  // to the first manager in scope instead of leaving the selector blank.
  const activeManager = isOverseer
    ? managerIds.includes(managerId)
      ? managerId
      : (managerIds[0] ?? managerId)
    : myEmpId;
  const managerRecord = EMPLOYEES.find((e) => e.id === activeManager);

  const team = directReports(map, activeManager);
  const teamIds = team.map((t) => t.id);
  const teamReviews = reviews.filter(
    (r) => teamIds.includes(r.empId) || r.managerId === activeManager,
  );
  const teamTasks = tasks.filter((t) => t.assignees.some((a) => teamIds.includes(a)));

  // Never offer the manager's own reporting chain (adding your own manager to your team creates a reporting loop).
  const ancestors = useMemo(() => {
    const out = new Set();
    let cur = map[activeManager];
    while (cur && !out.has(cur)) {
      out.add(cur);
      cur = map[cur];
    }
    return out;
  }, [map, activeManager]);
  const available = EMPLOYEES.filter(
    (e) => e.id !== activeManager && map[e.id] !== activeManager && !ancestors.has(e.id),
  );

  /* ---------- add member ---------- */
  const [addId, setAddId] = useState("");

  /* ---------- review dialog ---------- */
  const [reviewFor, setReviewFor] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [viewReview, setViewReview] = useState(null);

  /* ---------- task dialog ---------- */
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskPreset, setTaskPreset] = useState([]);
  const [taskDetail, setTaskDetail] = useState(null);

  /* ---------- goals ---------- */
  const allGoals = useGoals();
  const teamGoals = allGoals.filter((g) => teamIds.includes(g.ownerId));
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDetailId, setGoalDetailId] = useState(null);
  const goalDetail = allGoals.find((g) => g.id === goalDetailId) ?? null;

  const teamRows = team.map((t) => {
    const p = getEmployeeProfile(t.id);
    const last = teamReviews.find((r) => r.empId === t.id);
    return [
      t.id,
      t.name,
      t.role,
      t.dept,
      t.status,
      p.performance.overallRating,
      last?.rating || "Not reviewed",
      String(teamTasks.filter((k) => k.assignees.includes(t.id)).length),
    ];
  });
  const teamCols = [
    "Employee ID",
    "Name",
    "Designation",
    "Department",
    "Status",
    "Overall rating",
    "Latest review",
    "Open tasks",
  ];

  function downloadTeam() {
    const ok = exportReportPdf({
      title: "My Team Register",
      subtitle: `${managerRecord?.name ?? "Manager"} · ${team.length} direct report(s)`,
      summary: [
        { label: "Direct reports", value: String(team.length) },
        { label: "Reviews on record", value: String(teamReviews.length) },
        { label: "Assigned tasks", value: String(teamTasks.length) },
      ],
      columns: teamCols,
      rows: teamRows,
    });
    toast[ok ? "success" : "error"](
      ok ? "Team register ready — save as PDF" : "Allow pop-ups to download the register",
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UsersRound className="text-primary h-6 w-6" /> My Team
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add members to your team, review their performance and assign work. Everything here is
          visible to HR and the Org Admin instantly.
        </p>
      </div>

      {isOverseer && (
        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Viewing team of</Label>
              <Select value={activeManager} onValueChange={setManagerId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {managerIds.map((id) => {
                    const e = EMPLOYEES.find((x) => x.id === id);
                    return (
                      <SelectItem key={id} value={id}>
                        {e ? `${e.name} · ${e.role}` : id}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="ml-auto">
              HR / Admin oversight view
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Direct reports", String(team.length), "Reporting into you", UsersRound],
          [
            "Reviews on record",
            String(teamReviews.length),
            `${teamReviews.filter((r) => r.status === "Completed").length} completed`,
            Star,
          ],
          [
            "Assigned tasks",
            String(teamTasks.length),
            `${teamTasks.filter((t) => t.status !== "Completed").length} open`,
            ClipboardList,
          ],
          [
            "On notice / leave",
            String(team.filter((t) => t.status !== "Active").length),
            "Needs attention",
            UserPlus,
          ],
        ].map(([label, value, sub, Icon]) => {
          const I = Icon;
          return (
            <Card key={label} className="shadow-card">
              <CardContent className="p-4">
                <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
                  <I className="h-3.5 w-3.5" /> {label}
                </div>
                <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="members">
        <ScrollTabsList>
          <TabsTrigger value="members">
            <UsersRound className="h-4 w-4" /> Team Members
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4" /> Performance Reviews
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ClipboardList className="h-4 w-4" /> Assigned Tasks
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Flag className="h-4 w-4" /> Team Goals
          </TabsTrigger>
        </ScrollTabsList>

        {/* -------------------- Goals -------------------- */}
        <TabsContent value="goals" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Flag className="text-primary h-4 w-4" /> Goals for your team
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Assign goals with metrics, evaluation parameters, quarter and date range; approve
                  goals your people raise themselves. Click a goal for the full detail.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-emerald shadow-premium ml-auto text-white"
                onClick={() => setGoalOpen(true)}
              >
                <Plus className="h-4 w-4" /> Assign goal
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Goal",
                      "Owner",
                      "Category · priority",
                      "Quarter",
                      "Due",
                      "Target",
                      "Progress",
                      "Status",
                      "Rating",
                      "",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {teamGoals.map((g) => (
                    <tr key={g.id} className={clickableRow} onClick={() => setGoalDetailId(g.id)}>
                      <td className="p-3">
                        <div className="font-medium">{g.title}</div>
                        <div className="text-muted-foreground text-xs">
                          {g.id} · {g.level} · by {g.createdBy}
                        </div>
                      </td>
                      <td className="p-3">{g.owner}</td>
                      <td className="p-3 text-xs">
                        {g.category ?? "—"}
                        <div className="text-muted-foreground">{g.priority ?? ""}</div>
                      </td>
                      <td className="p-3 text-xs">{g.quarter ?? `${g.start} → ${g.due}`}</td>
                      <td className="p-3 text-xs">{g.due}</td>
                      <td className="max-w-[200px] truncate p-3 text-xs">{g.target}</td>
                      <td className="w-28 p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${g.progress}%` }}
                            />
                          </div>
                          {g.progress}%
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={goalTone(g.status)}>
                          {g.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        {g.managerRating ? `${g.managerRating}/5` : "—"}
                      </td>
                      <td className="p-3">
                        <Eye className="text-muted-foreground h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                  {teamGoals.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-muted-foreground p-8 text-center">
                        No goals for this team yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Assign a goal</DialogTitle>
                <DialogDescription>
                  Person, goal, quarter and date range, metrics and evaluation parameters,
                  milestones, links, documents and your remarks. The owner is notified and the goal
                  is active immediately.
                </DialogDescription>
              </DialogHeader>
              <GoalForm mode="assign" restrictTo={teamIds} onDone={() => setGoalOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={!!goalDetail} onOpenChange={(o) => !o && setGoalDetailId(null)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              {goalDetail && <GoalDetail goal={goalDetail} mode="manage" />}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* -------------------- Members -------------------- */}
        <TabsContent value="members" className="space-y-4 pt-4">
          <Card className="shadow-card border-primary/20">
            <CardContent className="space-y-3 p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <UserPlus className="text-primary h-4 w-4" /> Add a team member
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  The employee starts reporting to {managerRecord?.name ?? "this manager"} and
                  appears in HR's hierarchy view.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
                  <Label className="text-muted-foreground text-xs">Employee</Label>
                  <Select value={addId} onValueChange={setAddId}>
                    <SelectTrigger className="w-full sm:w-[320px]">
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} · {e.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={!addId}
                  onClick={() => {
                    const e = EMPLOYEES.find((x) => x.id === addId);
                    setManager(addId, activeManager);
                    setAddId("");
                    toast.success(`${e?.name} now reports to ${managerRecord?.name}`);
                  }}
                >
                  <UserPlus className="h-4 w-4" /> Add to my team
                </Button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!team.length}
                    onClick={() => {
                      exportCsv("my-team-register", teamCols, teamRows);
                      toast.success("Team register exported as CSV");
                    }}
                  >
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!team.length}
                    onClick={downloadTeam}
                  >
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {team.map((t) => {
              const p = getEmployeeProfile(t.id);
              return (
                <Card key={t.id} className="shadow-card">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials(t.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{t.name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {t.role} · {t.dept}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          t.status === "Active"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-gold/40 bg-gold/15 text-gold"
                        }
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Rating", p.performance.overallRating],
                        ["Avg hrs", `${p.attendance.avgHours}`],
                        [
                          "Tasks",
                          String(teamTasks.filter((k) => k.assignees.includes(t.id)).length),
                        ],
                      ].map(([l, v]) => (
                        <div
                          key={l}
                          className="border-border bg-muted/40 rounded-lg border px-2 py-1.5"
                        >
                          <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            {l}
                          </div>
                          <div className="text-sm font-bold">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewFor(t.id);
                          setEditReview(null);
                          setReviewOpen(true);
                        }}
                      >
                        <Star className="h-4 w-4" /> Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTaskPreset([t.id]);
                          setTaskOpen(true);
                        }}
                      >
                        <ClipboardList className="h-4 w-4" /> Assign task
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive ml-auto"
                        title="Remove from team"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove ${t.name} from ${managerRecord?.name ?? "this"}'s team?`,
                            )
                          )
                            return;
                          setManager(t.id, "");
                          toast.success(`${t.name} removed from the team`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {team.length === 0 && (
              <Card className="shadow-card md:col-span-2 xl:col-span-3">
                <CardContent className="text-muted-foreground p-12 text-center">
                  No team members yet — add someone above to start building your team.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* -------------------- Reviews -------------------- */}
        <TabsContent value="reviews" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <div className="text-sm font-semibold">Reviews raised by this manager</div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!team.length}
                  onClick={() => {
                    setReviewFor("");
                    setEditReview(null);
                    setReviewOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> New review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!teamReviews.length}
                  onClick={() => {
                    const cols = [
                      "Review ID",
                      "Employee",
                      "Cycle",
                      "Date",
                      "Rating",
                      "Status",
                      "Strengths",
                      "Improvements",
                      "Remarks",
                    ];
                    const rows = teamReviews.map((r) => [
                      r.id,
                      r.employee,
                      r.cycle,
                      r.date,
                      r.rating || "—",
                      r.status,
                      r.strengths || "—",
                      r.improvements || "—",
                      r.remarks || "—",
                    ]);
                    const ok = exportReportPdf({
                      title: "Team Performance Reviews",
                      subtitle: `${managerRecord?.name ?? "Manager"} · ${teamReviews.length} review(s)`,
                      columns: cols,
                      rows,
                    });
                    toast[ok ? "success" : "error"](
                      ok ? "Reviews ready — save as PDF" : "Allow pop-ups to download",
                    );
                  }}
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Basis / cycle</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Overall</th>
                    <th className="p-3 text-left">Feedback</th>
                    <th className="p-3 text-left">Recommendation</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {teamReviews.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 align-top">
                      <td className="p-3 font-medium">
                        {r.employee}
                        <div className="text-muted-foreground text-xs font-normal">{r.empId}</div>
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        {r.basis ?? "Performance review"}
                        <div>
                          {r.cycle}
                          {r.period ? ` · ${r.period.from} → ${r.period.to}` : ""}
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3">
                        <span className="whitespace-nowrap">{r.date}</span>
                      </td>
                      <td className="p-3">
                        {r.overallScore != null ? (
                          <span className="font-semibold">{r.overallScore}/5</span>
                        ) : null}
                        <div className="text-muted-foreground text-xs">{r.rating || "—"}</div>
                      </td>
                      <td className="text-muted-foreground max-w-[320px] p-3 text-xs">
                        {r.feedback ? <div className="line-clamp-2">{r.feedback}</div> : null}
                        {r.strengths && (
                          <div>
                            <b>Strengths:</b> {r.strengths}
                          </div>
                        )}
                        {r.improvements && (
                          <div>
                            <b>Improve:</b> {r.improvements}
                          </div>
                        )}
                        {!r.feedback && !r.strengths && !r.improvements && "—"}
                        {(r.attachments?.length ?? 0) > 0 && (
                          <div>📎 {r.attachments.length} document(s)</div>
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        {r.recommendation ?? "—"}
                        {r.employeeAck ? (
                          <div className="text-primary">Acknowledged {r.employeeAck.on}</div>
                        ) : r.sharedWithEmployee && r.status === "Completed" ? (
                          <div className="text-muted-foreground">Awaiting acknowledgement</div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            r.status === "Completed"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-gold/40 bg-gold/15 text-gold"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setViewReview(r)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        {r.status !== "Completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditReview(r);
                              setReviewFor(r.empId);
                              setReviewOpen(true);
                            }}
                          >
                            <Pencil className="text-primary h-4 w-4" /> Continue
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {teamReviews.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-muted-foreground p-10 text-center">
                        No reviews yet for this team.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* -------------------- Tasks -------------------- */}
        <TabsContent value="tasks" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <div className="text-sm font-semibold">Tasks assigned to this team</div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  disabled={!team.length}
                  onClick={() => {
                    setTaskPreset([]);
                    setTaskOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Assign task
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!teamTasks.length}
                  onClick={() => {
                    const cols = [
                      "Task ID",
                      "Task",
                      "Assignees",
                      "Priority",
                      "Status",
                      "Progress",
                      "Due",
                    ];
                    const rows = teamTasks.map((t) => [
                      t.id,
                      t.name,
                      t.assignees
                        .map((a) => EMPLOYEES.find((e) => e.id === a)?.name ?? a)
                        .join(", "),
                      t.priority,
                      t.status,
                      `${t.progress}%`,
                      t.dueDate,
                    ]);
                    const ok = exportReportPdf({
                      title: "Team Task Assignments",
                      subtitle: `${managerRecord?.name ?? "Manager"} · ${teamTasks.length} task(s)`,
                      columns: cols,
                      rows,
                    });
                    toast[ok ? "success" : "error"](
                      ok ? "Task list ready — save as PDF" : "Allow pop-ups to download",
                    );
                  }}
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Task</th>
                    <th className="p-3 text-left">Assignees</th>
                    <th className="p-3 text-left">Priority</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Progress</th>
                    <th className="p-3 text-left">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {teamTasks.map((t) => (
                    <tr
                      key={t.id}
                      className={`${clickableRow} align-top`}
                      onClick={() => setTaskDetail(t)}
                    >
                      <td className="p-3 font-medium">
                        {t.name}
                        <div className="text-muted-foreground text-xs font-normal">
                          {t.description}
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        {t.assignees
                          .map((a) => EMPLOYEES.find((e) => e.id === a)?.name ?? a)
                          .join(", ")}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={priorityClass(t.priority)}>
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusClass(t.status)}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-semibold">{t.progress}%</td>
                      <td className="text-muted-foreground p-3">
                        <span className="whitespace-nowrap">{t.dueDate}</span>
                      </td>
                    </tr>
                  ))}
                  {teamTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground p-10 text-center">
                        No tasks assigned to this team yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!taskDetail} onOpenChange={(o) => !o && setTaskDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {taskDetail && (
            <TaskDetail
              task={tasks.find((t) => t.id === taskDetail.id) ?? taskDetail}
              mode="manage"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------- Review dialog (detailed form) -------------------- */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editReview ? `Continue review ${editReview.id}` : "Team member performance review"}
            </DialogTitle>
            <DialogDescription>
              Basis of review → goals set vs achieved → ratings on evaluation parameters →
              descriptive feedback, suggestions, development plan → documents. Completed reviews are
              visible to HR (Performance module) and, if shared, to the employee for
              acknowledgement.
            </DialogDescription>
          </DialogHeader>
          {reviewOpen && (
            <TeamReviewForm
              key={editReview?.id ?? reviewFor ?? "new"}
              empId={reviewFor || undefined}
              employee={team.find((t) => t.id === reviewFor)?.name}
              managerId={editReview?.managerId ?? (activeManager === myEmpId ? myEmpId : me.id)}
              manager={
                editReview?.manager ??
                (activeManager === myEmpId ? (managerRecord?.name ?? me.name) : me.name)
              }
              existing={editReview ?? undefined}
              teamOptions={team.map((t) => ({ id: t.id, name: t.name }))}
              onDone={() => {
                setReviewOpen(false);
                setEditReview(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewReview} onOpenChange={(o) => !o && setViewReview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {viewReview && (
            <TeamReviewDetail
              r={reviews.find((x) => x.id === viewReview.id) ?? viewReview}
              mode="manager"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------- Task dialog (shared detailed form, assignees limited to this team) -------------------- */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          {taskOpen && (
            <TaskForm
              restrictAssignees={teamIds}
              presetAssignees={taskPreset}
              onDone={() => setTaskOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamPage;
